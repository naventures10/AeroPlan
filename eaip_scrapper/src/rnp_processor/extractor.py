import os
import logging
import json
import time
import requests
import re
from pathlib import Path
from mistralai.client import Mistral
from llama_cloud import LlamaCloud
import boto3
from .utils import EXTRACTED_DIR, BASE_DIR

logger = logging.getLogger("RNP-ETL.Extractor")

class RNPExtractor:
    def __init__(self):
        self.llama_keys = [
            os.getenv(f"LLAMA_CLOUD_API_KEY_{i}") for i in range(1, 5)
        ]
        self.llama_keys = [k for k in self.llama_keys if k]
        self.mistral_key = os.getenv("MISTRAL_API_KEY")
        self.current_key_index = 0

    def _get_llama_key(self):
        if not self.llama_keys:
            return None
        key = self.llama_keys[self.current_key_index % len(self.llama_keys)]
        self.current_key_index += 1
        return key

    def download_pdf(self, url, local_path):
        if local_path.exists():
            return True
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            local_path.parent.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(response.content)
            return True
        except Exception as e:
            logger.error(f"Download failed for {url}: {e}")
            return False

    def extract_via_llama(self, pdf_path, output_md_path):
        api_key = self._get_llama_key()
        if not api_key:
            logger.error("No LlamaCloud API keys found.")
            return False
            
        logger.info(f"Extracting {pdf_path.name} via LlamaCloud...")
        try:
            client = LlamaCloud(api_key=api_key)
            file_obj = client.files.create(file=str(pdf_path), purpose="parse")
            result = client.parsing.parse(
                file_id=file_obj.id,
                tier="agentic",
                version="latest",
                expand=["markdown"]
            )
            
            if result.markdown and result.markdown.pages:
                full_md = "\n\n".join([p.markdown for p in result.markdown.pages])
                
                # Check if it looks like a valid tabular representation
                text_lower = full_md.lower()
                has_tabular = any(k in text_lower for k in ['serial', 'path', 'descriptor', 'terminator', 'seq num'])
                
                if not has_tabular:
                    logger.warning(f"LlamaCloud extraction lacking tabular data for {pdf_path.name}. Triggering fallback.")
                    return False

                output_md_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_md_path, "w") as f:
                    f.write(full_md)
                return True
            return False
        except Exception as e:
            logger.error(f"LlamaCloud failed for {pdf_path.name}: {e}")
            return False

    def extract_via_mistral(self, pdf_url, output_md_path):
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
                md = re.sub(r"\[([^\]]+\.html)\]\([^\)]+\)", 
                           lambda m: table_lookup.get(m.group(1), ""), md)
                md_parts.append(md)
            
            full_md = "\n\n---\n\n".join(md_parts)
            if full_md.strip():
                output_md_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_md_path, "w") as f:
                    f.write(full_md)
                return True
            return False
        except Exception as e:
            logger.error(f"Mistral OCR failed for {pdf_url}: {e}")
            return False

    def load_master_aip_data(self, json_path=None):
        """Load master_aip_data.json from local file or MinIO."""
        if json_path is None:
            json_path = BASE_DIR.parent / "output" / "master_aip_data.json"
        
        try:
            with open(json_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load master_aip_data.json: {e}")
            return None

    def get_missing_tables_files(self, master_data=None):
        """Identify missing TABLES files from master_aip_data.json."""
        if master_data is None:
            master_data = self.load_master_aip_data()
        if not master_data:
            return []
        
        missing_files = []
        existing_files = {f.stem for f in EXTRACTED_DIR.glob("*.md")}
        
        for airport in master_data:
            icao = airport.get("icao", "")
            charts = airport.get("charts", [])
            
            for chart in charts:
                chart_name = chart.get("chart_name", "")
                pdf_url = chart.get("pdf_url", "")
                
                # Look for RNP TABLES files
                if ("RNP" in chart_name and 
                    ("-TABLE.pdf" in chart_name or "-TABLES.pdf" in chart_name)):
                    
                    # Convert to expected filename format
                    if "-TABLE.pdf" in chart_name:
                        expected_name = chart_name.replace(".pdf", ".PDF.md")
                    else:  # -TABLES.pdf
                        expected_name = chart_name.replace(".pdf", ".PDF.md")
                    
                    # Check if file already exists
                    if expected_name not in existing_files:
                        missing_files.append({
                            "icao": icao,
                            "chart_name": chart_name,
                            "pdf_url": pdf_url,
                            "output_name": expected_name
                        })
        
        logger.info(f"Found {len(missing_files)} missing TABLES files")
        return missing_files

    def extract_tables_files(self, missing_files=None):
        """Extract missing TABLES files using LlamaCloud with Mistral fallback."""
        if missing_files is None:
            missing_files = self.get_missing_tables_files()
        
        if not missing_files:
            logger.info("No missing TABLES files found.")
            return True
        
        success_count = 0
        for file_info in missing_files:
            chart_name = file_info["chart_name"]
            pdf_url = file_info["pdf_url"]
            output_name = file_info["output_name"]
            output_path = EXTRACTED_DIR / output_name
            
            logger.info(f"Processing {chart_name}...")
            
            # Download PDF first
            pdf_path = EXTRACTED_DIR / chart_name
            if not self.download_pdf(pdf_url, pdf_path):
                logger.error(f"Failed to download {chart_name}")
                continue
            
            # Try LlamaCloud first
            if self.extract_via_llama(pdf_path, output_path):
                success_count += 1
                logger.info(f"Successfully extracted {chart_name} via LlamaCloud")
            else:
                # Fallback to Mistral OCR
                if self.extract_via_mistral(pdf_url, output_path):
                    success_count += 1
                    logger.info(f"Successfully extracted {chart_name} via Mistral OCR")
                else:
                    logger.error(f"Failed to extract {chart_name} with both methods")
        
        logger.info(f"Extraction complete: {success_count}/{len(missing_files)} files processed successfully")
        return success_count == len(missing_files)
