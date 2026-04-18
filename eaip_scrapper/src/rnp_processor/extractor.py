import os
import logging
import json
import time
import requests
import re
from pathlib import Path
from mistralai.client import Mistral
from llama_cloud import LlamaCloud
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
