import os
import requests
import re
import tempfile
import urllib3
import asyncio
from pathlib import Path
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from llama_cloud import AsyncLlamaCloud

# Load environment variables
load_dotenv()

# Disable insecure request warnings caused by the expired SSL cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://aim-india.aai.aero"
NOTAM_SUMMARIES_URL = f"{BASE_URL}/notam-summaries"
PDF_LINK_PATTERN = re.compile(
    r"/sites/default/files/notam_files/.*\.pdf$", re.IGNORECASE
)
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
            response = requests.get(
                NOTAM_SUMMARIES_URL, params=params, timeout=60, verify=False
            )
            response.raise_for_status()
            break
        except (requests.exceptions.RequestException, Exception) as e:
            if attempt < max_retries - 1:
                print(f"  [!] Timeout/Error fetching summaries (Attempt {attempt+1}/{max_retries}): {e}. Retrying in 5s...")
                import time
                time.sleep(5)
            else:
                print(f"  [!] Failed to fetch NOTAM summaries after {max_retries} attempts.")
                raise e

    soup = BeautifulSoup(response.text, "html.parser")

    # Collect all PDF links matching the NOTAM file path pattern
    pdf_links: list[str] = []
    for anchor in soup.find_all("a", href=PDF_LINK_PATTERN):
        href = anchor["href"]
        # Make absolute URL if needed
        if href.startswith("/"):
            href = BASE_URL + href
        if href not in pdf_links:
            pdf_links.append(href)

    if not pdf_links:
        print("WARNING: No NOTAM PDF links found on the page.")
        return {}

    print(f"Found {len(pdf_links)} unique NOTAM PDF link(s):")
    for link in pdf_links:
        print(f"  - {link}")

    # Group by FIR and series, and pick the latest for each
    latest: dict[tuple[str, str], tuple[str, tuple[int, int]]] = {}
    for link in pdf_links:
        filename = link.rsplit("/", 1)[
            -1
        ]  # e.g. Chennai_A_2026_03.pdf or Kolkata_C_2026_02_0.pdf
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
                if year == max_year and month == 1:
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
                print(f"    [!] Download failed (Attempt {attempt+1}/{max_retries}): {e}. Retrying in 5s...")
                import time
                time.sleep(5)
            else:
                print(f"    [!] Failed to download PDF after {max_retries} attempts.")
                raise e

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with dest_path.open("wb") as f:
        f.write(response.content)

    print(f"  ✓ Downloaded ({len(response.content)} bytes)")
    return dest_path


async def convert_pdf_to_md_with_llama(pdf_path: Path, output_path: Path) -> None:
    """
    Use LlamaParse (LlamaCloud) to convert a PDF to high-fidelity Markdown.
    Requires LLAMA_CLOUD_API_KEY in .env.
    """
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY not found in environment")

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
        full_markdown = "\n\n".join([page.markdown for page in result.markdown.pages])
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(full_markdown, encoding="utf-8")
        print(f"  ✓ Saved Markdown to: {output_path.name} ({len(result.markdown.pages)} pages)")
    else:
        print(f"  [!] No content extracted for {pdf_path.name}")


def openai_file_upload_stream(path: Path):
    """Helper to provide a file stream for LlamaCloud create."""
    return open(path, "rb")


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    latest_links = scrape_latest_notam_links()

    if not latest_links:
        print("No NOTAM PDFs found. Exiting.")
        return

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        for i, pdf_url in enumerate(latest_links):
            pdf_filename = pdf_url.rsplit("/", 1)[-1]  # e.g. Chennai_A_2026_03.pdf
            md_filename = pdf_filename.replace(".pdf", ".md")
            output_md_path = OUTPUT_DIR / md_filename

            if output_md_path.exists():
                print(f"\nSkipping {pdf_filename} (already exists: {md_filename})")
                continue

            print(f"\nProcessing {pdf_filename} ({i+1}/{len(latest_links)})...")

            try:
                # Step 1: Download the PDF locally
                local_pdf = download_pdf(pdf_url, tmp_path / pdf_filename)

                # Step 2: Convert with LlamaParse
                await convert_pdf_to_md_with_llama(local_pdf, output_md_path)
                
                # Rate limit mitigation: 2-minute delay after each file
                if i < len(latest_links) - 1:
                    print("  ⏳ Resting for 2 minutes to respect LlamaParse rate limits...")
                    await asyncio.sleep(120)
            except Exception as e:
                print(f"  FAILED to process {pdf_filename}: {e}")
                # Optional: Even on failure, we might want to wait before retrying the next file
                if i < len(latest_links) - 1:
                    await asyncio.sleep(60) # Shorter sleep on failure? or same?

    print(f"\nDone! All NOTAM PDFs converted and saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
