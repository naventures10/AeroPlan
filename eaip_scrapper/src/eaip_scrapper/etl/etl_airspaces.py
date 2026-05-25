import json
import os
import subprocess
import tempfile
import warnings

import boto3
import geopandas as gpd
import numpy as np
import requests
from joblib import Parallel, delayed
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
from shapely import STRtree, line_merge, snap, unary_union
from sqlalchemy import create_engine, text

# Suppress specific Shapely deprecation/geometry warnings
warnings.filterwarnings("ignore", category=DeprecationWarning, module="shapely")
warnings.filterwarnings("ignore", message=".*Shapely.*")

EXTERNAL_CMD_TIMEOUT = 300  # 5 minutes for heavy PDF extraction


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

TARGET_TABLE = "airspaces_geometry"

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


def stitch_cluster(airspace_type, cluster_id, group):
    """Processes a single airspace cluster: snapping and merging lines."""
    try:
        # 1. Force a 50-meter snap on all fragments in this specific cluster
        union_all = group.geometry.unary_union
        snapped_lines = [snap(geom, union_all, 50.0) for geom in group.geometry]
        union_result = unary_union(snapped_lines)

        # 2. Ensure we only have LineStrings/MultiLineStrings for linemerge
        if union_result.geom_type == "GeometryCollection":
            lines = [
                # pyrefly: ignore [missing-attribute]
                g
                for g in union_result.geoms
                if g.geom_type in ["LineString", "MultiLineString"]
            ]
            if lines:
                union_result = unary_union(lines)
            else:
                return None

        # 3. Merge them into continuous lines
        merged = (
            union_result if union_result.geom_type == "LineString" else line_merge(union_result)
        )

        return {
            "airspace_type": airspace_type,
            "cluster_id": cluster_id,
            "geometry": merged,
        }
    except Exception as e:
        print(f"  [Error] Failed to stitch {airspace_type} cluster {cluster_id}: {e}")
        return {
            "airspace_type": airspace_type,
            "cluster_id": cluster_id,
            "geometry": group.geometry.unary_union,
        }


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
    """Engine that extracts airspace geometries from a GeoPDF using GDAL/GeoPandas
    and loads them into PostGIS."""

    def __init__(self):
        print("[*] Initializing Airspace eaip_scrapper.etl engine...")
        self.db_url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        self.engine = create_engine(self.db_url)
        self.target_crs = "EPSG:4326"

    def extract(self, pdf_path: str) -> gpd.GeoDataFrame:
        """Read all whitelisted layers from the PDF using system GDAL binaries."""
        print(f"\n[*] Processing {len(WHITELIST)} whitelisted layers using system GDAL...")
        print("-" * 50)

        # 1. List all available layers in the PDF using ogrinfo
        try:
            cmd_info = ["ogrinfo", "-so", pdf_path]
            output = subprocess.check_output(cmd_info, stderr=subprocess.STDOUT, timeout=60).decode(
                "utf-8"
            )
            available_layers = []
            for line in output.splitlines():
                if ":" in line and not line.startswith("INFO") and not line.startswith("Had to"):
                    # Extract layer name after the colon and space
                    parts = line.split(":", 1)
                    if len(parts) > 1:
                        available_layers.append(parts[1].strip())
        except Exception as e:
            print(f"  [X] Failed to list layers using ogrinfo: {e}")
            return gpd.GeoDataFrame()

        all_layers = []
        for layer_str in WHITELIST:
            # Match the whitelisted layer name with the actual layer name in the PDF
            actual_layer = next(
                (al for al in available_layers if al.upper() == layer_str.upper()), None
            )

            if not actual_layer:
                print(f"  [X] Layer '{layer_str}' not found in PDF. Skipping...")
                continue

            print(f"  Processing: {actual_layer}")

            # 2. Extract specific layer to temporary GeoJSON using ogr2ogr
            temp_json = os.path.join(
                tempfile.gettempdir(), f"layer_{sanitize_name(actual_layer)}.json"
            )
            try:
                cmd_extract = [
                    "ogr2ogr",
                    "-f",
                    "GeoJSON",
                    temp_json,
                    pdf_path,
                    actual_layer,
                ]
                subprocess.run(
                    cmd_extract,
                    check=True,
                    capture_output=True,
                    timeout=EXTERNAL_CMD_TIMEOUT,
                )

                # 3. Load the temporary GeoJSON with GeoPandas
                gdf = gpd.read_file(temp_json)
                if gdf.empty:
                    if os.path.exists(temp_json):
                        os.remove(temp_json)
                    continue

                # Clean attributes
                gdf["layer_name"] = sanitize_name(actual_layer)
                gdf["airspace_type"] = derive_airspace_type(actual_layer)

                # Ensure target CRS (WGS 84)
                if gdf.crs is None:
                    gdf = gdf.set_crs(self.target_crs, allow_override=True)
                elif str(gdf.crs).lower() != self.target_crs.lower():
                    gdf = gdf.to_crs(self.target_crs)

                # Filter for line geometries (LineString or MultiLineString)
                gdf = gdf[gdf.geometry.type.isin(["LineString", "MultiLineString"])]

                if not gdf.empty:
                    print(f"      {len(gdf)} lines extracted.")
                    all_layers.append(gdf)

            except Exception as e:
                print(f"      [X] Failed to extract {actual_layer}: {e}")
            finally:
                if os.path.exists(temp_json):
                    os.remove(temp_json)

        print("-" * 50)
        if not all_layers:
            print("[!] No geometries extracted from any layer.")
            return gpd.GeoDataFrame()

        full_gdf = gpd.pd.concat(all_layers, ignore_index=True)
        print(f"[+] Extraction complete. {len(full_gdf)} geometries in memory.")
        return full_gdf

    def reconstruct(self, full_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Consolidates fragmented airspace geometries using clustering and stitching."""
        if full_gdf.empty:
            print("  [!] No geometries to reconstruct.")
            return full_gdf

        print("\n[*] Starting geometry reconstruction pipeline...")

        # 1. Project to metric plane (EPSG:3857) for accurate clustering
        print("  [Step 1] Projecting to metric plane (EPSG:3857)...")
        planar_gdf = full_gdf.to_crs(epsg=3857)

        reconstructed_results = []
        eps = 7000.0  # 7km clustering distance

        # 2. Process each Airspace Type separately
        for airspace_type, type_group in planar_gdf.groupby("airspace_type"):
            print(f"  --- Processing {airspace_type} ---")

            # A. Clustering
            geoms = type_group.geometry.values
            # pyrefly: ignore [bad-argument-type]
            tree = STRtree(geoms)
            # pyrefly: ignore [no-matching-overload]
            indices_i, indices_j = tree.query(geoms, predicate="dwithin", distance=eps)

            n = len(type_group)
            adj_matrix = csr_matrix((np.ones(len(indices_i)), (indices_i, indices_j)), shape=(n, n))
            n_components, labels = connected_components(csgraph=adj_matrix, directed=False)

            type_group = type_group.copy()
            type_group["cluster_id"] = labels
            print(f"    Identified {n_components} zones.")

            # B. Stitching in Parallel
            results = Parallel(n_jobs=-1)(
                delayed(stitch_cluster)(airspace_type, cid, group)
                for cid, group in type_group.groupby("cluster_id")
            )

            stitched_geoms = [r for r in results if r is not None]
            if not stitched_geoms:
                continue

            stitched_gdf = gpd.GeoDataFrame(stitched_geoms, crs="EPSG:3857")
            stitched_gdf["geometry"] = stitched_gdf["geometry"].simplify(10.0)

            # C. Post-processing
            final_type_gdf = stitched_gdf.to_crs(epsg=4326)
            final_type_gdf["airspace_type"] = airspace_type
            final_type_gdf["layer_name"] = f"{airspace_type}_RECONSTRUCTED"

            reconstructed_results.append(final_type_gdf)

        if not reconstructed_results:
            return gpd.GeoDataFrame()

        final_gdf = gpd.pd.concat(reconstructed_results, ignore_index=True)
        if "cluster_id" in final_gdf.columns:
            final_gdf = final_gdf.drop(columns=["cluster_id"])

        print(f"[+] Reconstruction complete. {len(final_gdf)} consolidated geometries.")
        return final_gdf

    def load(self, data: gpd.GeoDataFrame):
        """Export the GeoDataFrame into the PostGIS airspaces table."""
        if data.empty:
            print("  [!] No data to load.")
            return False

        print(f"[*] Exporting to PostGIS table '{TARGET_TABLE}'...")
        try:
            # Prepare for PostGIS load
            sync_gdf = data.copy()
            sync_gdf = sync_gdf.rename_geometry("wkb_geometry")

            with self.engine.begin() as conn:
                # Check if the table exists
                result = conn.execute(
                    text(
                        f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{TARGET_TABLE}')"
                    )
                )
                table_exists = result.scalar()

                if table_exists:
                    conn.execute(text(f"TRUNCATE TABLE {TARGET_TABLE} RESTART IDENTITY CASCADE"))

                sync_gdf.to_postgis(TARGET_TABLE, con=conn, if_exists="append", index=False)

                # If table was just created, add the primary key required by Martin Tile Server
                if not table_exists:
                    conn.execute(
                        text(f"ALTER TABLE {TARGET_TABLE} ADD COLUMN ogc_fid SERIAL PRIMARY KEY")
                    )

            print(f"[+] SUCCESS: Data loaded into PostGIS table: {TARGET_TABLE}")
            return True
        except Exception as e:
            print(f"  [X] FAILED PostGIS export: {e}")
            return False

    def shutdown(self):
        """Graceful teardown."""
        print("[*] eaip_scrapper.etl process finished.")


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

        # Phase 3: Extraction using GDAL/GeoPandas
        etl = AirspaceETL()
        full_gdf = etl.extract(pdf_path)

        # Phase 4: Geometry Reconstruction
        reconstructed_gdf = etl.reconstruct(full_gdf)

        # Phase 5: PostGIS load
        if not etl.load(reconstructed_gdf):
            raise RuntimeError("Failed to load data into PostGIS")

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
    print("[+] Airspace eaip_scrapper.etl pipeline completed successfully.")
    print("=" * 50)


if __name__ == "__main__":
    main()
