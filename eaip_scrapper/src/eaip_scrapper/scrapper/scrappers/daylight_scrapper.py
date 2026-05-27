import asyncio
import os
import tempfile
from pathlib import Path

import requests
import urllib3
from dotenv import load_dotenv
from llama_cloud import AsyncLlamaCloud

# Load environment variables
load_dotenv()

# Disable insecure request warnings caused by the expired SSL cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DAYLIGHT_PDF_URL = "https://aim-india.aai.aero/sites/default/files/menu_item_files/GEN_2.7_Sunrise_Sunset%20%282026%29.pdf"
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent.parent / "output"
CHUNK_SIZE = 20  # pages per chunk


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


def split_pdf(pdf_path: Path, chunk_size: int, output_dir: Path) -> list[Path]:
    """
    Split a PDF into chunks of `chunk_size` pages.
    Returns a list of paths to the chunk PDFs, in page order.
    """
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    print(f"  Total pages: {total_pages} → splitting into chunks of {chunk_size}")

    output_dir.mkdir(parents=True, exist_ok=True)
    chunk_paths: list[Path] = []

    for start in range(0, total_pages, chunk_size):
        end = min(start + chunk_size, total_pages)
        writer = PdfWriter()
        for page_num in range(start, end):
            writer.add_page(reader.pages[page_num])

        chunk_filename = f"chunk_{start + 1:04d}_{end:04d}.pdf"
        chunk_path = output_dir / chunk_filename
        with chunk_path.open("wb") as f:
            writer.write(f)

        chunk_paths.append(chunk_path)
        print(f"    Created {chunk_filename}  (pages {start + 1}–{end})")

    print(f"  ✓ Split into {len(chunk_paths)} chunk(s)")
    return chunk_paths


def openai_file_upload_stream(path: Path):
    """Helper to provide a file stream for LlamaCloud create."""
    return open(path, "rb")


async def convert_chunk_async(chunk_path: Path, api_key: str) -> tuple[str, str]:
    """
    Worker function: convert a single PDF chunk to Markdown using Llama Cloud OCR.
    """
    print(f"    Parsing with LlamaParse: {chunk_path.name}")
    client = AsyncLlamaCloud(api_key=api_key)

    # Upload and parse
    file = await client.files.create(file=openai_file_upload_stream(chunk_path), purpose="parse")

    result = await client.parsing.parse(
        file_id=file.id,
        tier="agentic",
        version="latest",
        expand=["markdown"],
    )

    if result.markdown and result.markdown.pages:
        full_markdown = "\n\n".join([page.markdown for page in result.markdown.pages])
        print(f"    ✓ Converted {chunk_path.name} ({len(full_markdown)} chars)")
        return chunk_path.name, full_markdown
    else:
        print(f"    [!] No content extracted for {chunk_path.name}")
        return chunk_path.name, ""


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

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pdf_filename = DAYLIGHT_PDF_URL.rsplit("/", 1)[-1]
    md_filename = pdf_filename.replace(".pdf", ".md")

    print(f"\n{'=' * 60}")
    print(" Daylight Tables Scraper (Async Llama Cloud OCR)")
    print(f"{'=' * 60}")
    print(f" PDF:        {pdf_filename}")
    print(f" Chunk size: {CHUNK_SIZE} pages")
    print(f" API Keys:   {len(llama_keys)} loaded")
    print(f"{'=' * 60}\n")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # Step 1: Download the full PDF
        print("[1/4] Downloading PDF...")
        try:
            local_pdf = download_pdf(DAYLIGHT_PDF_URL, tmp_path / pdf_filename)
        except Exception as e:
            print(f"  FAILED to download PDF: {e}")
            return

        # Step 2: Split into chunks
        print("\n[2/4] Splitting PDF into chunks...")
        chunks_dir = tmp_path / "chunks"
        chunk_paths = split_pdf(local_pdf, CHUNK_SIZE, chunks_dir)

        # Step 3: Convert chunks in parallel
        print(f"\n[3/4] Converting {len(chunk_paths)} chunk(s) concurrently...")
        chunk_markdowns: dict[str, str] = {}
        failed_chunks: list[str] = []

        # Semaphore limits concurrency to the number of API keys
        semaphore = asyncio.Semaphore(len(llama_keys))

        async def worker(cp: Path, api_key: str):
            async with semaphore:
                try:
                    name, md = await convert_chunk_async(cp, api_key)
                    chunk_markdowns[name] = md
                except Exception as e:
                    print(f"    ✗ FAILED {cp.name}: {e}")
                    failed_chunks.append(cp.name)

        tasks = []
        for i, cp in enumerate(chunk_paths):
            assigned_key = llama_keys[i % len(llama_keys)]
            tasks.append(worker(cp, assigned_key))

        await asyncio.gather(*tasks)

        if failed_chunks:
            print(f"\n  ⚠️  {len(failed_chunks)} chunk(s) failed: {failed_chunks}")

        # Step 4: Merge in page order and save
        print(f"\n[4/4] Merging {len(chunk_markdowns)} chunk(s) into final Markdown...")
        sorted_names = sorted(chunk_markdowns.keys())
        merged_markdown = "\n\n".join(chunk_markdowns[n] for n in sorted_names)

        print(f"    Total size: {len(merged_markdown):,} characters")

        # Step 5: Upload directly to MinIO
        print("\n[5/5] Uploading to MinIO...")
        try:
            import boto3

            s3 = boto3.client(
                "s3",
                endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
                aws_access_key_id=os.getenv("MINIO_ACCESS_KEY", "ais_admin"),
                aws_secret_access_key=os.getenv("MINIO_SECRET_KEY", "AviationData2026!"),
                region_name="us-east-1",
            )
            bucket = os.getenv("MINIO_BUCKET", "ais")
            key = f"output/{md_filename}"
            s3.put_object(Body=merged_markdown.encode("utf-8"), Bucket=bucket, Key=key)
            print(f"  ✓ Uploaded to MinIO bucket '{bucket}' as '{key}'")
        except Exception as e:
            print(f"  ✗ FAILED to upload to MinIO: {e}")

    print(f"\n{'=' * 60}")
    print(" Done! Daylight Tables PDF converted and uploaded to MinIO.")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
