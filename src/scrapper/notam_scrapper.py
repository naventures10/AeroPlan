import requests
import re
import json
import tempfile
import urllib3
from pathlib import Path
from bs4 import BeautifulSoup

# Disable insecure request warnings caused by the expired SSL cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://aim-india.aai.aero"
NOTAM_SUMMARIES_URL = f"{BASE_URL}/notam-summaries"
PDF_LINK_PATTERN = re.compile(r"/sites/default/files/notam_files/.*\.pdf$", re.IGNORECASE)
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"


def scrape_latest_notam_links() -> dict[str, str]:
    """
    Scrape the NOTAM summaries page and return the latest PDF URL
    for each series (A and C).

    Returns a dict like:
        {"A": "https://aim-india.aai.aero/sites/default/files/notam_files/Chennai_A_2026_03.pdf",
         "C": "https://aim-india.aai.aero/sites/default/files/notam_files/Chennai_C_2026_03.pdf"}
    """
    print(f"Fetching NOTAM summaries page: {NOTAM_SUMMARIES_URL}")
    response = requests.get(NOTAM_SUMMARIES_URL, timeout=30, verify=False)
    response.raise_for_status()

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

    # Group by series and pick the latest (first listed) for each
    # Filename format: Chennai_{Series}_{Year}_{Month}.pdf
    latest: dict[str, str] = {}
    for link in pdf_links:
        filename = link.rsplit("/", 1)[-1]  # e.g. Chennai_A_2026_03.pdf
        match = re.match(r"Chennai_([AC])_(\d{4})_(\d{2})\.pdf", filename)
        if match:
            series = match.group(1)
            year_month = (int(match.group(2)), int(match.group(3)))
            if series not in latest or year_month > latest[series][1]:
                latest[series] = (link, year_month)

    result = {series: url for series, (url, _) in latest.items()}
    print("\nLatest NOTAM PDFs selected:")
    for series, url in sorted(result.items()):
        print(f"  Series {series}: {url}")

    return result


def download_pdf(pdf_url: str, dest_path: Path) -> Path:
    """
    Download a PDF from a URL (with SSL verification disabled) to a local path.
    """
    print(f"  Downloading: {pdf_url}")
    response = requests.get(pdf_url, timeout=60, verify=False)
    response.raise_for_status()

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with dest_path.open("wb") as f:
        f.write(response.content)

    print(f"  ✓ Downloaded ({len(response.content)} bytes)")
    return dest_path


def convert_pdf_to_markdown(pdf_path: Path, output_path: Path) -> None:
    """
    Use docling DocumentConverter to parse a local PDF and save as Markdown.
    """
    from docling.document_converter import DocumentConverter

    print(f"  Converting with docling: {pdf_path.name}")
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))

    # Export parsed document as Markdown
    markdown_content = result.document.export_to_markdown()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        f.write(markdown_content)

    print(f"  ✓ Saved Markdown to: {output_path}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    latest_links = scrape_latest_notam_links()

    if not latest_links:
        print("No NOTAM PDFs found. Exiting.")
        return

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        for series, pdf_url in sorted(latest_links.items()):
            pdf_filename = pdf_url.rsplit("/", 1)[-1]  # e.g. Chennai_A_2026_03.pdf
            md_filename = pdf_filename.replace(".pdf", ".md")

            print(f"\nProcessing Series {series}: {pdf_filename}")

            # Step 1: Download the PDF locally (bypasses SSL issue for docling)
            try:
                local_pdf = download_pdf(pdf_url, tmp_path / pdf_filename)

                # Step 2: Convert with docling and save Markdown
                convert_pdf_to_markdown(local_pdf, OUTPUT_DIR / md_filename)
            except Exception as e:
                print(f"  FAILED to process {pdf_filename}: {e}")

    print(f"\nDone! All NOTAM PDFs converted and saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
