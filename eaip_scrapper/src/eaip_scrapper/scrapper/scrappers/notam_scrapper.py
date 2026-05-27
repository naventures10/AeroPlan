import asyncio
import os
import re
import tempfile
from pathlib import Path

import boto3
import requests
import urllib3
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from llama_cloud import AsyncLlamaCloud

# MinIO Config
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")

# Load environment variables
load_dotenv()

# Disable insecure request warnings caused by the expired SSL cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://aim-india.aai.aero"
NOTAM_SUMMARIES_URL = f"{BASE_URL}/notam-summaries"
PDF_LINK_PATTERN = re.compile(r"/sites/default/files/notam_files/.*\.pdf$", re.IGNORECASE)
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"


def scrape_latest_notam_links() -> list[str]:
    """
    Scrape the NOTAM summaries page and return the both the latest PDF URL
    AND the January summary URL for each FIR and series (A, C, G).

    Returns a list of unique PDF URLs.
    """
    print(f"Fetching NOTAM summaries page: {NOTAM_SUMMARIES_URL}")
    params = {"field_airport_tid": "All", "field_series_value": "All"}

    # Retry logic for the initial page fetch
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.get(NOTAM_SUMMARIES_URL, params=params, timeout=60, verify=False)
            response.raise_for_status()
            break
        except (requests.exceptions.RequestException, Exception) as e:
            if attempt < max_retries - 1:
                print(
                    f"  [!] Timeout/Error fetching summaries (Attempt {attempt + 1}/{max_retries}): {e}. Retrying in 5s..."
                )
                import time

                time.sleep(5)
            else:
                print(f"  [!] Failed to fetch NOTAM summaries after {max_retries} attempts.")
                raise e

    # pyrefly: ignore [unbound-name]
    soup = BeautifulSoup(response.text, "html.parser")

    # Collect all PDF links matching the NOTAM file path pattern
    pdf_links: list[str] = []
    for anchor in soup.find_all("a", href=PDF_LINK_PATTERN):
        href = anchor["href"]
        # Make absolute URL if needed
        # pyrefly: ignore [missing-attribute]
        if href.startswith("/"):
            # pyrefly: ignore [unsupported-operation]
            href = BASE_URL + href
        if href not in pdf_links:
            # pyrefly: ignore [bad-argument-type]
            pdf_links.append(href)

    if not pdf_links:
        print("WARNING: No NOTAM PDF links found on the page.")
        # pyrefly: ignore [bad-return]
        return {}

    print(f"Found {len(pdf_links)} unique NOTAM PDF link(s):")
    for link in pdf_links:
        print(f"  - {link}")

    # Group by FIR and series, and pick the latest for each
    latest: dict[tuple[str, str], tuple[str, tuple[int, int]]] = {}
    for link in pdf_links:
        filename = link.rsplit("/", 1)[-1]  # e.g. Chennai_A_2026_03.pdf or Kolkata_C_2026_02_0.pdf
        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", filename)
        if match:
            fir = match.group(1).capitalize()
            series = match.group(2).upper()
            year_month = (int(match.group(3)), int(match.group(4)))
            key = (fir, series)
            if key not in latest or year_month > latest[key][1]:
                latest[key] = (link, year_month)

    january_links = []
    # Second pass: find January links mapping to the max year
    for link in pdf_links:
        filename = link.rsplit("/", 1)[-1]
        match = re.search(r"[A-Za-z]+_[A-Z]_(\d{4})_(\d{2})", filename)
        if match:
            key = (filename.split("_")[0].capitalize(), filename.split("_")[1].upper())
            year = int(match.group(1))
            month = int(match.group(2))

            if key in latest:
                max_year = latest[key][1][0]
                if year == max_year and month == 1 and key[0] != "Delhi":
                    january_links.append(link)

    result_urls = set(url for _, (url, _) in latest.items())
    result_urls.update(january_links)

    final_urls = sorted(list(result_urls))

    print("\nSelected NOTAM PDFs (Latest Month + January Baseline):")
    for url in final_urls:
        filename = url.rsplit("/", 1)[-1]
        print(f"  - {filename}")

    return final_urls


def download_pdf(pdf_url: str, dest_path: Path) -> Path:
    """
    Download a PDF from a URL (with SSL verification disabled) to a local path.
    """
    print(f"  Downloading: {pdf_url}")
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.get(pdf_url, timeout=60, verify=False)
            response.raise_for_status()
            break
        except (requests.exceptions.RequestException, Exception) as e:
            if attempt < max_retries - 1:
                print(
                    f"    [!] Download failed (Attempt {attempt + 1}/{max_retries}): {e}. Retrying in 5s..."
                )
                import time

                time.sleep(5)
            else:
                print(f"    [!] Failed to download PDF after {max_retries} attempts.")
                raise e

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with dest_path.open("wb") as f:
        # pyrefly: ignore [unbound-name]
        f.write(response.content)

    print(f"  ✓ Downloaded ({len(response.content)} bytes)")
    return dest_path


async def convert_pdf_to_md_with_llama(pdf_path: Path, output_path: Path, api_key: str) -> None:
    """
    Use LlamaParse (LlamaCloud) to convert a PDF to high-fidelity Markdown.
    """

    print(f"  Parsing with LlamaParse: {pdf_path.name}")
    client = AsyncLlamaCloud(api_key=api_key)

    # Upload and parse
    file = await client.files.create(file=openai_file_upload_stream(pdf_path), purpose="parse")

    result = await client.parsing.parse(
        file_id=file.id,
        tier="agentic",
        version="latest",
        expand=["markdown"],
    )

    if result.markdown and result.markdown.pages:
        # pyrefly: ignore [missing-attribute]
        full_markdown = "\n\n".join([page.markdown for page in result.markdown.pages])

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(full_markdown, encoding="utf-8")
        print(f"  ✓ Saved Markdown to: {output_path.name} ({len(result.markdown.pages)} pages)")
    else:
        print(f"  [!] No content extracted for {pdf_path.name}")


def convert_pdf_to_md_with_mistral(pdf_url: str, output_path: Path) -> bool:
    """
    Use Mistral OCR fallback to parse PDF and extract structured HTML tables inside markdown.
    """
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if not mistral_key:
        print("  [!] Mistral API key (MISTRAL_API_KEY) is not configured. Skipping fallback.")
        return False

    print(f"  Parsing with Mistral OCR fallback: {pdf_url}")
    try:
        from mistralai.client import Mistral

        client = Mistral(api_key=mistral_key)
        response = client.ocr.process(
            model="mistral-ocr-latest",
            document={"type": "document_url", "document_url": pdf_url},
            table_format="html",
        )

        md_parts = []
        for page in response.pages:
            md = page.markdown or ""
            table_lookup = {tbl.id: tbl.content for tbl in (page.tables or [])}

            def _replace_table(match, tl=table_lookup):
                tid = match.group(1)
                content = tl.get(tid)
                if content is None:
                    print(f"  [WARN] Mistral OCR: table '{tid}' not found in lookup.")
                    return ""
                return content

            md = re.sub(r"\[([^\]]+\.html)\]\([^\)]+\)", _replace_table, md)
            md_parts.append(md)

        full_md = "\n\n---\n\n".join(md_parts)
        if full_md.strip():
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(full_md, encoding="utf-8")
            print(f"  ✓ Saved Mistral OCR Markdown to: {output_path.name}")
            return True
        return False
    except Exception as e:
        print(f"  [!] Mistral OCR failed for {pdf_url}: {e}")
        return False


def openai_file_upload_stream(path: Path):
    """Helper to provide a file stream for LlamaCloud create."""
    return open(path, "rb")


async def main():
    # Load all LLAMA_CLOUD_API_KEY_* variables
    llama_keys = [
        v for k, v in os.environ.items() if k.startswith("LLAMA_CLOUD_API_KEY_") and v.strip()
    ]
    if not llama_keys:
        legacy_key = os.getenv("LLAMA_CLOUD_API_KEY")
        if legacy_key:
            llama_keys = [legacy_key]
        else:
            print("No LLAMA_CLOUD_API_KEY_* found in environment. Exiting.")
            return

    print(f"Loaded {len(llama_keys)} LlamaParse API keys for concurrent extraction.")

    latest_links = scrape_latest_notam_links()

    if not latest_links:
        print("No NOTAM PDFs found. Exiting.")
        return

    s3 = boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
    )

    def minio_file_exists(key):
        try:
            s3.head_object(Bucket=MINIO_BUCKET, Key=key)
            return True
        except Exception:
            return False

    # Extract target filenames for the cleanup phase
    target_pdf_names = set()
    target_md_names = set()
    for link in latest_links:
        fname = link.rsplit("/", 1)[-1]
        target_pdf_names.add(fname)
        target_md_names.add(fname.replace(".pdf", ".md"))

    print("\nCleaning up obsolete NOTAM markdowns from MinIO...")
    notam_pattern = re.compile(r"[A-Za-z]+_[A-Z]_\d{4}_\d{2}\.md", re.IGNORECASE)
    try:
        response = s3.list_objects_v2(Bucket=MINIO_BUCKET, Prefix="output/notams/")
        if "Contents" in response:
            for obj in response["Contents"]:
                md_name = obj["Key"].split("/")[-1]
                if notam_pattern.match(md_name) and md_name not in target_md_names:
                    print(f"  Removing obsolete MD from MinIO: {obj['Key']}")
                    s3.delete_object(Bucket=MINIO_BUCKET, Key=obj["Key"])
    except Exception as e:
        print(f"  [!] Failed to clean up MinIO: {e}")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        raw_pdf_dir = temp_path / "raw_pdfs"
        temp_output_dir = temp_path / "output"
        raw_pdf_dir.mkdir(parents=True, exist_ok=True)
        temp_output_dir.mkdir(parents=True, exist_ok=True)

        # Pass 1: Download all required PDFs sequentially
        print("\n--- PASSS 1: Downloading PDFs ---")
        conversion_tasks = []

        for i, pdf_url in enumerate(latest_links):
            pdf_filename = pdf_url.rsplit("/", 1)[-1]  # e.g. Chennai_A_2026_03.pdf
            md_filename = pdf_filename.replace(".pdf", ".md")
            minio_md_key = f"output/notams/{md_filename}"
            output_md_path = temp_output_dir / md_filename
            local_pdf = raw_pdf_dir / pdf_filename

            if minio_file_exists(minio_md_key):
                print(f"Skipping {pdf_filename} (MD already exists in MinIO)")
                continue

            # Explicitly skip Delhi January NOTAM PDFs
            match = re.search(r"([A-Za-z]+)_[A-Z]_\d{4}_(\d{2})\.pdf", pdf_filename, re.IGNORECASE)
            if match and match.group(1).lower() == "delhi" and match.group(2) == "01":
                print(
                    f"Skipping {pdf_filename} (Delhi January NOTAMs are handled via carry-forward)."
                )
                continue

            try:
                print(f"Downloading {pdf_filename} ({i + 1}/{len(latest_links)})...")
                download_pdf(pdf_url, local_pdf)

                if not output_md_path.exists():
                    conversion_tasks.append((local_pdf, output_md_path, minio_md_key, pdf_url))
            except Exception as e:
                print(f"  FAILED to process {pdf_filename}: {e}")

        # Pass 2: Concurrent Markdown Conversion
        if conversion_tasks:
            print(
                f"\n--- PASS 2: Concurrent LlamaParse Processing ({len(conversion_tasks)} files) ---"
            )

            async def run_conversion(pdf_path, md_path, minio_key, api_key, pdf_url):
                from eaip_scrapper.validation.core.central_validator import ValidationRouter

                validator = ValidationRouter()
                success = False

                # 1. Try LlamaParse
                try:
                    await convert_pdf_to_md_with_llama(pdf_path, md_path, api_key)
                    if md_path.exists():
                        content = md_path.read_text(encoding="utf-8")
                        if validator.validate_raw_markdown(content, md_path.name):
                            success = True
                        else:
                            print(
                                f"  [WARN] LlamaParse output for {pdf_path.name} failed structure validation. Triggering Mistral OCR fallback..."
                            )
                except Exception as e:
                    print(
                        f"  [!] LlamaParse failed for {pdf_path.name}: {e}. Triggering Mistral OCR fallback..."
                    )

                # 2. Try Mistral OCR Fallback
                if not success:
                    try:
                        mistral_success = await asyncio.to_thread(
                            convert_pdf_to_md_with_mistral, pdf_url, md_path
                        )
                        if mistral_success and md_path.exists():
                            content = md_path.read_text(encoding="utf-8")
                            if validator.validate_raw_markdown(content, md_path.name):
                                success = True
                            else:
                                print(
                                    f"  [!] Mistral OCR output for {pdf_path.name} failed structure validation."
                                )
                    except Exception as e:
                        print(f"  [!] Mistral OCR fallback failed for {pdf_path.name}: {e}")

                # 3. Handle Upload or Halt
                if not success and md_path.exists():
                    # Last resort: both engines failed strict validation.
                    # Try lenient mode on the Mistral output (skips corruption threshold check)
                    # to accept files where the source PDF itself has corrupted timestamps.
                    content = md_path.read_text(encoding="utf-8")
                    if validator.validate_raw_markdown(content, md_path.name, strict=False):
                        print(
                            f"  [WARN] Accepting {md_path.name} with lenient validation "
                            f"(source-level corruption detected in both OCR engines)."
                        )
                        success = True

                if success:
                    print(f"  Uploading {md_path.name} to MinIO...")
                    with open(md_path, "rb") as f:
                        s3.put_object(
                            Bucket=MINIO_BUCKET,
                            Key=minio_key,
                            Body=f,
                            ContentType="text/markdown",
                        )
                    print(f"  ✓ Uploaded to {minio_key}")
                else:
                    print(f"\n[!] CRITICAL DATA INTEGRITY FAILURE for {pdf_path.name}!")
                    print(
                        "[!] Both LlamaParse and Mistral OCR failed to extract structured "
                        "markdown (even with lenient validation). Halting pipeline."
                    )
                    import sys

                    sys.exit(1)

            # Limit concurrency to 1 active request per API key to respect general rate limits
            semaphore = asyncio.Semaphore(len(llama_keys))

            async def worker(pdf_path, md_path, minio_key, api_key, pdf_url):
                async with semaphore:
                    await run_conversion(pdf_path, md_path, minio_key, api_key, pdf_url)

            tasks = []
            for i, (p_pdf, p_md, minio_key, pdf_url) in enumerate(conversion_tasks):
                assigned_key = llama_keys[i % len(llama_keys)]
                tasks.append(worker(p_pdf, p_md, minio_key, assigned_key, pdf_url))

            await asyncio.gather(*tasks)

        print("\nDone! All new NOTAMs parsed and uploaded to MinIO.")


if __name__ == "__main__":
    asyncio.run(main())
