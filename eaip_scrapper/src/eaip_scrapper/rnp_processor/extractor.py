import json
import logging
import os
import re
from pathlib import Path

import requests
from llama_cloud import LlamaCloud
from mistralai.client import Mistral

from .utils import BASE_DIR, EXTRACTED_DIR

logger = logging.getLogger("RNP-eaip_scrapper.etl.Extractor")

# Chart types this extractor handles
CODING_SUFFIX = "-CODING.pdf"
TABLE_SUFFIXES = ("-TABLE.pdf", "-TABLES.pdf")


class RNPExtractor:
    def __init__(self):
        self.llama_keys = [os.getenv(f"LLAMA_CLOUD_API_KEY_{i}") for i in range(1, 5)]
        self.llama_keys = [k for k in self.llama_keys if k]
        self.mistral_key = os.getenv("MISTRAL_API_KEY")
        self.current_key_index = 0

    # ── API key rotation ──────────────────────────────────────────────────────

    def _get_llama_key(self):
        if not self.llama_keys:
            return None
        key = self.llama_keys[self.current_key_index % len(self.llama_keys)]
        self.current_key_index += 1
        return key

    # ── Low-level download ────────────────────────────────────────────────────

    def download_pdf(self, url: str, local_path: Path) -> bool:
        """Download a PDF to *local_path*; skip if already present."""
        if local_path.exists():
            logger.debug(f"PDF already downloaded: {local_path.name}")
            return True
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            local_path.parent.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(response.content)
            logger.debug(f"Downloaded {local_path.name}")
            return True
        except Exception as e:
            logger.error(f"Download failed for {url}: {e}")
            return False

    # ── Extraction back-ends ──────────────────────────────────────────────────

    def extract_via_llama(self, pdf_path: Path, output_md_path: Path) -> bool:
        """Extract *pdf_path* with LlamaCloud; write markdown to *output_md_path*."""
        api_key = self._get_llama_key()
        if not api_key:
            logger.error("No LlamaCloud API keys found.")
            return False

        logger.info(f"Extracting {pdf_path.name} via LlamaCloud...")
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
                        f"{pdf_path.name}. Triggering fallback."
                    )
                    return False

                output_md_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_md_path, "w", encoding="utf-8") as f:
                    f.write(full_md)
                return True
            return False
        except Exception as e:
            logger.error(f"LlamaCloud failed for {pdf_path.name}: {e}")
            return False

    def extract_via_mistral(self, pdf_url: str, output_md_path: Path) -> bool:
        """Extract *pdf_url* with Mistral OCR; write markdown to *output_md_path*."""
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
                output_md_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_md_path, "w", encoding="utf-8") as f:
                    f.write(full_md)
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

        existing_md = {f.name for f in EXTRACTED_DIR.glob("*.md")}

        missing = []
        for airport in master_data:
            icao = airport.get("icao", "")
            for chart in airport.get("charts", []):
                chart_name: str = chart.get("chart_name", "")
                pdf_url: str = chart.get("pdf_url", "")

                if "RNP" not in chart_name.upper():
                    continue

                chart_name_lower = chart_name.lower()
                is_coding = chart_name_lower.endswith(CODING_SUFFIX.lower())
                is_table = any(chart_name_lower.endswith(s.lower()) for s in TABLE_SUFFIXES)

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
            output_path = EXTRACTED_DIR / output_name

            # Guard: skip if someone wrote the file mid-run
            if output_path.exists():
                logger.info(f"Skipping (appeared mid-run): {output_name}")
                success_count += 1
                continue

            logger.info(f"[{chart_type}] Processing {chart_name}...")

            # Download PDF to local scratch area
            pdf_path = EXTRACTED_DIR / chart_name
            if not self.download_pdf(pdf_url, pdf_path):
                logger.error(f"  ✗ Download failed — skipping {chart_name}")
                fail_count += 1
                continue

            # Try LlamaCloud first
            if self.extract_via_llama(pdf_path, output_path):
                logger.info(f"  ✓ Extracted via LlamaCloud: {chart_name}")
                success_count += 1
            else:
                # Fallback: Mistral OCR (works directly from URL)
                if self.extract_via_mistral(pdf_url, output_path):
                    logger.info(f"  ✓ Extracted via Mistral OCR: {chart_name}")
                    success_count += 1
                else:
                    logger.error(f"  ✗ Both extractors failed for {chart_name}")
                    fail_count += 1

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
