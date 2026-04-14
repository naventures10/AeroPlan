import json
import os
import sys
import tempfile

import boto3
import requests

# --- 1. BOOTSTRAP: Initialize Headless QGIS ---
sys.path.insert(0, "/Applications/QGIS.app/Contents/Resources/python")
sys.path.insert(0, "/Applications/QGIS.app/Contents/Resources/python/plugins")

from qgis.core import (
    QgsApplication,
    QgsVectorLayer,
    QgsVectorFileWriter,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsProject,
    QgsFeature,
    QgsField,
    QgsGeometry,
    QgsWkbTypes,
)
from qgis.PyQt.QtCore import QVariant


# ── Constants ────────────────────────────────────────────────────────────────

MINIO_ENDPOINT = "http://localhost:9000"
MINIO_ACCESS_KEY = "ais_admin"
MINIO_SECRET_KEY = "AviationData2026!"
MINIO_BUCKET = "ais"
MINIO_METADATA_KEY = "output/enr_6_en_route_charts.json"

# The government website has stored the Chennai FIR ERC chart under the wrong
# name – the actual ERC-INDIA.pdf is listed as "En route Chart- Chennai FIR.pdf"
TARGET_CHART_NAME = "En route Chart- Chennai FIR.pdf"

DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "aeronautical_information_system"
DB_USER = "postgres"
DB_PASS = "postgres"

TARGET_TABLE = "airspaces"

WHITELIST = [
    "_ENROUTE_MAIN_AREA'S_DANGER_AREAS",
    "_ENROUTE_MAIN_AREA'S_PROHIBITED_AREAS",
    "_ENROUTE_MAIN_AREA'S_TRA_",
    "_ENROUTE_MAIN_AREA'S_TSA",
    "_ENROUTE_MAIN_AREA'S_RESTRICTED_AREAS",
    "_ENROUTE_MAIN_AREA'S_RES_AREA_VER78",
    "_ENROUTE_MAIN_ADIZ",
    "_ENROUTE_MAIN_FIR'S_FIR_DOMESTIC",
    "_ENROUTE_MAIN_FIR'S_FIR_DOMESTIC_AREA",
    "_ENROUTE_MAIN_FIR'S_FIR_SHADE",
    "_ENROUTE_MAIN_UPR_ZONE",
    "_ENROUTE_MAIN_CTR'S_CTR",
    "_ENROUTE_MAIN_LOWER_CTA'S_CTA_LOWER_1",
    "_ENROUTE_MAIN_LOWER_CTA'S_CTA_LOWER_2",
    "_ENROUTE_MAIN_LOWER_CTA'S_CTA_LOWER_3",
    "_ENROUTE_MAIN_LOWER_CTA'S_CTA_LOWER_4",
    "_ENROUTE_MAIN_LOWER_CTA'S_CTA_LOWER_5",
    "_ENROUTE_MAIN_LOWER_CTA'S_SUB_CTA_LOWER",
    "_ENROUTE_MAIN_LOWER_CTA'S_SUB_CTA2_LOWER",
    "_ENROUTE_MAIN_UPPPER_CTA'S_UPPER_SUB_CTA_",
    "_ENROUTE_MAIN_UPPPER_CTA'S_UPPER_SUB2_CTA",
    "_ENROUTE_MAIN_UPPPER_CTA'S_CTA_UPPER_1",
    "_ENROUTE_MAIN_UPPPER_CTA'S_CTA_UPPER_2",
    "_ENROUTE_MAIN_UPPPER_CTA'S_CTA_UPPER_3",
    "_ENROUTE_MAIN_UPPPER_CTA'S_CTA_UPPER_4",
    "_ENROUTE_MAIN_UPPPER_CTA'S_CTA_UPPER_5",
]


# ── Helpers ──────────────────────────────────────────────────────────────────


def sanitize_name(name: str) -> str:
    """Strip special characters that could cause issues in PostgreSQL."""
    return name.replace("'", "").replace('"', "").strip()


def derive_airspace_type(layer_name: str) -> str:
    """Map the raw PDF layer name to a clean airspace classification."""
    norm = layer_name.upper()
    if "DANGER" in norm:
        return "DANGER"
    if "PROHIBITED" in norm:
        return "PROHIBITED"
    if "RESTRICTED" in norm or "RES_AREA" in norm:
        return "RESTRICTED"
    if "TRA_" in norm:
        return "TRA"
    if "TSA" in norm:
        return "TSA"
    if "ADIZ" in norm:
        return "ADIZ"
    if "FIR" in norm:
        return "FIR"
    if "UPR_ZONE" in norm:
        return "UPR_ZONE"
    if "CTR" in norm and "CTA" not in norm:
        return "CTR"
    if "LOWER_CTA" in norm:
        return "CTA_LOWER"
    if "UPPPER_CTA" in norm or "UPPER_CTA" in norm:
        return "CTA_UPPER"
    return "UNKNOWN"


# ── MinIO Data Source ────────────────────────────────────────────────────────


class MinIOSource:
    """Fetches metadata from MinIO and downloads the target PDF."""

    def __init__(self):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            region_name="us-east-1",
        )

    def get_pdf_url(self) -> str:
        """Read the chart metadata JSON from MinIO and extract the PDF URL."""
        print(f"[*] Fetching metadata from MinIO: {MINIO_METADATA_KEY}")
        response = self.s3.get_object(Bucket=MINIO_BUCKET, Key=MINIO_METADATA_KEY)
        metadata = json.loads(response["Body"].read().decode("utf-8"))

        charts = metadata.get("charts", [])
        for chart in charts:
            if chart.get("chart_name") == TARGET_CHART_NAME:
                url = chart["pdf_url"]
                print(f"[+] Found target chart URL: {url}")
                return url

        raise ValueError(
            f"Chart '{TARGET_CHART_NAME}' not found in metadata. "
            f"Available: {[c.get('chart_name') for c in charts]}"
        )

    def download_pdf(self, url: str) -> str:
        """Download the PDF to a temporary file and return its path."""
        print(f"[*] Downloading PDF from: {url}")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()

        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(resp.content)
        tmp.close()

        size_mb = len(resp.content) / (1024 * 1024)
        print(f"[+] Downloaded {size_mb:.1f} MB -> {tmp.name}")
        return tmp.name


# ── QGIS Processing Engine ──────────────────────────────────────────────────


class AirspaceETL:
    """Headless QGIS engine that extracts airspace geometries from a GeoPDF
    and loads them into PostGIS."""

    def __init__(self):
        QgsApplication.setPrefixPath("/Applications/QGIS.app/Contents/MacOS", True)
        print("[*] Starting headless QGIS engine...")
        self.qgs = QgsApplication([], False)
        self.qgs.initQgis()

        self.pg_uri = (
            f"PG:dbname='{DB_NAME}' host='{DB_HOST}' "
            f"port='{DB_PORT}' user='{DB_USER}' password='{DB_PASS}'"
        )
        self.target_crs = QgsCoordinateReferenceSystem("EPSG:4326")

    def _build_memory_layers(self):
        """Create three typed memory layers (Point, Line, Polygon)."""
        layers = {
            QgsWkbTypes.PointGeometry: QgsVectorLayer(
                "MultiPoint?crs=EPSG:4326", "points", "memory"
            ),
            QgsWkbTypes.LineGeometry: QgsVectorLayer(
                "MultiLineString?crs=EPSG:4326", "lines", "memory"
            ),
            QgsWkbTypes.PolygonGeometry: QgsVectorLayer(
                "MultiPolygon?crs=EPSG:4326", "polygons", "memory"
            ),
        }
        for mem in layers.values():
            pr = mem.dataProvider()
            pr.addAttributes(
                [
                    QgsField("layer_name", QVariant.String),
                    QgsField("airspace_type", QVariant.String),
                ]
            )
            mem.updateFields()
        return layers

    def extract(self, pdf_path: str):
        """Read all whitelisted layers from the PDF into memory layers."""
        mem_layers = self._build_memory_layers()
        total_mapped = 0

        print(f"\n[*] Processing {len(WHITELIST)} whitelisted layers...")
        print("-" * 50)

        for layer_str in WHITELIST:
            uri = f"{pdf_path}|layername={layer_str}"
            vlayer = QgsVectorLayer(uri, layer_str, "ogr")

            if not vlayer.isValid():
                print(f"  [X] Could not load '{layer_str}'. Skipping...")
                continue

            print(f"  Processing: {layer_str}")
            transform = QgsCoordinateTransform(
                vlayer.crs(), self.target_crs, QgsProject.instance()
            )

            clean_name = sanitize_name(layer_str)
            derived_type = derive_airspace_type(layer_str)

            counts = {
                QgsWkbTypes.PointGeometry: 0,
                QgsWkbTypes.LineGeometry: 0,
                QgsWkbTypes.PolygonGeometry: 0,
            }
            features_by_type = {
                QgsWkbTypes.PointGeometry: [],
                QgsWkbTypes.LineGeometry: [],
                QgsWkbTypes.PolygonGeometry: [],
            }

            for feat in vlayer.getFeatures():
                geom = feat.geometry()
                if geom.isNull():
                    continue

                geom_type = geom.type()
                if geom_type not in features_by_type:
                    continue

                geom.transform(transform)
                geom.convertToMultiType()

                new_feat = QgsFeature(mem_layers[geom_type].fields())
                new_feat.setGeometry(geom)
                new_feat.setAttribute("layer_name", clean_name)
                new_feat.setAttribute("airspace_type", derived_type)

                features_by_type[geom_type].append(new_feat)
                counts[geom_type] += 1

            for geom_type, feats in features_by_type.items():
                if feats:
                    mem_layers[geom_type].dataProvider().addFeatures(feats)
                    total_mapped += len(feats)

            print(
                f"      {counts[QgsWkbTypes.PointGeometry]} pts, "
                f"{counts[QgsWkbTypes.LineGeometry]} lines, "
                f"{counts[QgsWkbTypes.PolygonGeometry]} polys"
            )

        print("-" * 50)
        print(f"[+] Extraction complete. {total_mapped} geometries in memory.")
        return mem_layers

    def load(self, mem_layers: dict):
        """Export the memory layers into the PostGIS airspaces table."""
        print(f"[*] Exporting to PostGIS table '{TARGET_TABLE}'...")

        for geom_type, mem_layer in mem_layers.items():
            if mem_layer.featureCount() == 0:
                continue

            options = QgsVectorFileWriter.SaveVectorOptions()
            options.driverName = "PostgreSQL"
            options.layerName = TARGET_TABLE
            options.actionOnExistingFile = QgsVectorFileWriter.AppendToLayerAddFields
            options.ct = QgsCoordinateTransform(
                mem_layer.crs(), self.target_crs, QgsProject.instance()
            )

            error, error_string = QgsVectorFileWriter.writeAsVectorFormatV2(
                mem_layer,
                self.pg_uri,
                QgsProject.instance().transformContext(),
                options,
            )

            if error != QgsVectorFileWriter.NoError:
                print(f"  [X] FAILED export ({geom_type}): {error_string}")
                return False

        print(f"[+] SUCCESS: Data loaded into PostGIS table: {TARGET_TABLE}")
        return True

    def shutdown(self):
        """Graceful teardown of the QGIS engine."""
        print("[*] Shutting down QGIS engine.")
        self.qgs.exitQgis()


# ── Main Pipeline ────────────────────────────────────────────────────────────


def main():
    pdf_path = None
    etl = None

    try:
        # Phase 1: Fetch PDF URL from MinIO metadata
        source = MinIOSource()
        pdf_url = source.get_pdf_url()

        # Phase 2: Download the PDF to a temp file
        pdf_path = source.download_pdf(pdf_url)

        # Phase 3: QGIS extraction
        etl = AirspaceETL()
        mem_layers = etl.extract(pdf_path)

        # Phase 4: PostGIS load
        etl.load(mem_layers)

    except Exception as e:
        print(f"\n[!] PIPELINE FAILURE: {e}")
        raise

    finally:
        # Phase 5: Cleanup
        if etl:
            etl.shutdown()
        if pdf_path and os.path.exists(pdf_path):
            os.remove(pdf_path)
            print(f"[*] Cleaned up temp file: {pdf_path}")

    print("\n" + "=" * 50)
    print("[+] Airspace ETL pipeline completed successfully.")
    print("=" * 50)


if __name__ == "__main__":
    main()
