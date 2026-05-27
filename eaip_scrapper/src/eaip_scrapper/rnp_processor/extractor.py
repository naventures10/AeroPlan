import json
import logging
import os
import re
import tempfile

import requests
from llama_cloud import LlamaCloud
from mistralai.client import Mistral

from .utils import BASE_DIR, get_s3_client

logger = logging.getLogger("RNP-eaip_scrapper.etl.Extractor")


class RNPExtractor:
    def __init__(self):
        self.llama_keys = [os.getenv(f"LLAMA_CLOUD_API_KEY_{i}") for i in range(1, 5)]
        self.llama_keys = [k for k in self.llama_keys if k]
        self.mistral_key = os.getenv("MISTRAL_API_KEY")
        self.current_key_index = 0
        self.s3_client = get_s3_client()
        self.bucket = os.getenv("MINIO_BUCKET", "ais")

    # ── API key rotation ──────────────────────────────────────────────────────

    def _get_llama_key(self):
        if not self.llama_keys:
            return None
        key = self.llama_keys[self.current_key_index % len(self.llama_keys)]
        self.current_key_index += 1
        return key

    # ── Low-level download ────────────────────────────────────────────────────

    def download_pdf(self, url: str, local_path: str) -> bool:
        """Download a PDF to *local_path*; skip if already populated."""
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            logger.debug(f"PDF already downloaded: {local_path}")
            return True
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(response.content)
            logger.debug(f"Downloaded {local_path}")
            return True
        except Exception as e:
            logger.error(f"Download failed for {url}: {e}")
            return False

    # ── Extraction back-ends ──────────────────────────────────────────────────

    def extract_via_llama(self, pdf_path: str, output_name: str) -> bool:
        """Extract *pdf_path* with LlamaCloud; write markdown to MinIO."""
        api_key = self._get_llama_key()
        if not api_key:
            logger.error("No LlamaCloud API keys found.")
            return False

        logger.info(f"Extracting {os.path.basename(pdf_path)} via LlamaCloud...")
        try:
            client = LlamaCloud(api_key=api_key)
            with open(pdf_path, "rb") as f_obj:
                file_obj = client.files.create(file=f_obj, purpose="parse")

            result = client.parsing.parse(
                file_id=file_obj.id,
                tier="agentic",
                version="latest",
                expand=["markdown"],
            )

            if result.markdown and result.markdown.pages:
                # pyrefly: ignore [missing-attribute]
                full_md = "\n\n".join([p.markdown for p in result.markdown.pages])

                # Structural validation: must contain tabular navigation data
                text_lower = full_md.lower()
                has_tabular = any(
                    k in text_lower
                    for k in [
                        "serial",
                        "path",
                        "descriptor",
                        "terminator",
                        "seq num",
                        "waypoint",
                        "coordinate",
                        "latitude",
                        "longitude",
                    ]
                )
                if not has_tabular:
                    logger.warning(
                        f"LlamaCloud extraction missing tabular data for "
                        f"{os.path.basename(pdf_path)}. Triggering fallback."
                    )
                    return False

                s3_key = f"output/rnp/extracted_data/{output_name}"
                self.s3_client.put_object(
                    Bucket=self.bucket, Key=s3_key, Body=full_md.encode("utf-8")
                )
                return True
            return False
        except Exception as e:
            logger.error(f"LlamaCloud failed for {os.path.basename(pdf_path)}: {e}")
            return False

    def extract_via_mistral(self, pdf_url: str, output_name: str) -> bool:
        """Extract *pdf_url* with Mistral OCR; write markdown to MinIO."""
        if not self.mistral_key:
            logger.error("No Mistral API key found.")
            return False

        logger.info(f"Extracting {pdf_url} via Mistral OCR...")
        try:
            client = Mistral(api_key=self.mistral_key)
            response = client.ocr.process(
                model="mistral-ocr-latest",
                document={"type": "document_url", "document_url": pdf_url},
                table_format="html",
            )

            md_parts = []
            for page in response.pages:
                md = page.markdown or ""
                table_lookup = {tbl.id: tbl.content for tbl in (page.tables or [])}

                # Replace placeholders [tbl-X.html](tbl-X.html)
                def _replace_table(match, tl=table_lookup):
                    tid = match.group(1)
                    content = tl.get(tid)
                    if content is None:
                        logger.warning(
                            f"Mistral OCR: table '{tid}' not found in lookup for {pdf_url}"
                        )
                        return ""
                    return content

                md = re.sub(r"\[([^\]]+\.html)\]\([^\)]+\)", _replace_table, md)
                md_parts.append(md)

            full_md = "\n\n---\n\n".join(md_parts)
            if full_md.strip():
                s3_key = f"output/rnp/extracted_data/{output_name}"
                self.s3_client.put_object(
                    Bucket=self.bucket, Key=s3_key, Body=full_md.encode("utf-8")
                )
                return True
            return False
        except Exception as e:
            logger.error(f"Mistral OCR failed for {pdf_url}: {e}")
            return False

    # ── Master AIP data loader ────────────────────────────────────────────────

    def load_master_aip_data(self, json_path=None):
        """Load master_aip_data.json from the project output directory."""
        if json_path is None:
            # BASE_DIR is the eaip_scrapper dir; master data lives one level up
            json_path = BASE_DIR.parent / "output" / "master_aip_data.json"

        try:
            with open(json_path) as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load master_aip_data.json from {json_path}: {e}")
            return None

    # ── Skip-aware gap analysis ───────────────────────────────────────────────

    def get_missing_files(self, master_data=None) -> list[dict]:
        """
        Scan master_aip_data.json and return every RNP chart (CODING *and*
        TABLE/TABLES) whose extracted markdown file does not yet exist.

        Each entry is a dict with keys:
            chart_type   – "CODING" | "TABLE"
            icao         – airport ICAO code
            chart_name   – original PDF filename
            pdf_url      – downloadable URL
            output_name  – expected .PDF.md filename in EXTRACTED_DIR
        """
        if master_data is None:
            master_data = self.load_master_aip_data()
        if not master_data:
            return []

        paginator = self.s3_client.get_paginator('list_objects_v2')
        existing_md = set()
        for page in paginator.paginate(Bucket=self.bucket, Prefix="output/rnp/extracted_data/"):
            for obj in page.get("Contents", []):
                if obj["Key"].endswith(".md"):
                    existing_md.add(os.path.basename(obj["Key"]))

        missing = []
        for airport in master_data:
            icao = airport.get("icao", "")
            for chart in airport.get("charts", []):
                chart_name: str = chart.get("chart_name", "")
                pdf_url: str = chart.get("pdf_url", "")

                if "RNP" not in chart_name.upper():
                    continue

                chart_name_upper = chart_name.upper()
                is_coding = "CODING" in chart_name_upper
                is_table = "TABLE" in chart_name_upper or "WAYPOINT" in chart_name_upper

                if not (is_coding or is_table):
                    continue

                # Expected markdown name: replace .pdf with .PDF.md (case-insensitive)
                expected_md = re.sub(r"\.pdf$", ".PDF.md", chart_name, flags=re.IGNORECASE)

                if expected_md in existing_md:
                    logger.debug(f"Skipping (already extracted): {expected_md}")
                    continue

                missing.append(
                    {
                        "chart_type": "CODING" if is_coding else "TABLE",
                        "icao": icao,
                        "chart_name": chart_name,
                        "pdf_url": pdf_url,
                        "output_name": expected_md,
                    }
                )

        coding_count = sum(1 for m in missing if m["chart_type"] == "CODING")
        table_count = sum(1 for m in missing if m["chart_type"] == "TABLE")
        logger.info(
            f"Gap analysis: {len(missing)} files to extract "
            f"({coding_count} CODING, {table_count} TABLE)"
        )
        return missing

    # ── Unified extraction pipeline ───────────────────────────────────────────

    def extract_all_files(self, missing_files: list[dict] | None = None) -> bool:
        """
        Extract every missing RNP chart (both CODING and TABLE types).

        Each file is attempted with LlamaCloud first; Mistral OCR is used as
        fallback.  Already-present markdown files are never re-extracted.

        Returns True only if *all* pending files were extracted successfully.
        """
        if missing_files is None:
            missing_files = self.get_missing_files()

        if not missing_files:
            logger.info("All RNP charts already extracted — nothing to do.")
            return True

        success_count = 0
        fail_count = 0

        for file_info in missing_files:
            chart_name = file_info["chart_name"]
            chart_type = file_info["chart_type"]
            pdf_url = file_info["pdf_url"]
            output_name = file_info["output_name"]
            s3_key = f"output/rnp/extracted_data/{output_name}"

            # Guard: skip if someone wrote the file mid-run
            try:
                self.s3_client.head_object(Bucket=self.bucket, Key=s3_key)
                logger.info(f"Skipping (appeared mid-run): {output_name}")
                success_count += 1
                continue
            except Exception:
                pass  # Object does not exist, proceed

            logger.info(f"[{chart_type}] Processing {chart_name}...")

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_pdf:
                tmp_pdf_path = tmp_pdf.name

            try:
                # Download PDF to local scratch area
                if not self.download_pdf(pdf_url, tmp_pdf_path):
                    logger.error(f"  ✗ Download failed — skipping {chart_name}")
                    fail_count += 1
                    continue

                # Try LlamaCloud first
                if self.extract_via_llama(tmp_pdf_path, output_name):
                    logger.info(f"  ✓ Extracted via LlamaCloud: {chart_name}")
                    success_count += 1
                else:
                    # Fallback: Mistral OCR (works directly from URL)
                    if self.extract_via_mistral(pdf_url, output_name):
                        logger.info(f"  ✓ Extracted via Mistral OCR: {chart_name}")
                        success_count += 1
                    else:
                        logger.error(f"  ✗ Both extractors failed for {chart_name}")
                        fail_count += 1
            finally:
                if os.path.exists(tmp_pdf_path):
                    os.unlink(tmp_pdf_path)

        total = len(missing_files)
        logger.info(
            f"Extraction complete: {success_count}/{total} succeeded, {fail_count}/{total} failed."
        )
        return fail_count == 0

    # ── Legacy convenience helpers (kept for back-compat) ────────────────────

    def get_missing_tables_files(self, master_data=None) -> list[dict]:
        """Deprecated: use get_missing_files() instead."""
        logger.warning("get_missing_tables_files() is deprecated; use get_missing_files().")
        all_missing = self.get_missing_files(master_data)
        return [m for m in all_missing if m["chart_type"] == "TABLE"]

    def extract_tables_files(self, missing_files=None) -> bool:
        """Deprecated: use extract_all_files() instead."""
        logger.warning("extract_tables_files() is deprecated; use extract_all_files().")
        if missing_files is None:
            missing_files = self.get_missing_tables_files()
        return self.extract_all_files(missing_files)
