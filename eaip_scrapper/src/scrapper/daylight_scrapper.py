import requests
import tempfile
import urllib3
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

# Disable insecure request warnings caused by the expired SSL cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DAYLIGHT_PDF_URL = "https://aim-india.aai.aero/sites/default/files/menu_item_files/GEN_2.7_Sunrise_Sunset%20%282026%29.pdf"
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"
CHUNK_SIZE = 20  # pages per chunk — keep small to limit memory per worker
MAX_WORKERS = 2  # each worker loads ~1-2GB of ML models, so keep low


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


def _get_accelerator_device():
    """
    Return the best available accelerator device for docling.
    Prefers MPS (Apple Silicon GPU) > CUDA > AUTO.
    """
    try:
        import torch

        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            from docling.datamodel.pipeline_options import AcceleratorDevice

            print("  🚀 Using Apple Silicon MPS GPU acceleration")
            return AcceleratorDevice.MPS
    except ImportError:
        pass

    try:
        import torch

        if torch.cuda.is_available():
            from docling.datamodel.pipeline_options import AcceleratorDevice

            print("  🚀 Using CUDA GPU acceleration")
            return AcceleratorDevice.CUDA
    except ImportError:
        pass

    from docling.datamodel.pipeline_options import AcceleratorDevice

    print("  ℹ️  Using AUTO accelerator (CPU)")
    return AcceleratorDevice.AUTO


def convert_chunk(chunk_path_str: str) -> tuple[str, str]:
    """
    Worker function: convert a single PDF chunk to Markdown.
    Runs in a separate process.

    Returns (chunk_filename, markdown_content).
    """
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        PdfPipelineOptions,
        AcceleratorOptions,
    )

    chunk_path = Path(chunk_path_str)
    device = _get_accelerator_device()

    pipeline_options = PdfPipelineOptions()
    pipeline_options.accelerator_options = AcceleratorOptions(
        device=device, num_threads=4
    )

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        },
    )

    result = converter.convert(str(chunk_path))
    markdown_content = result.document.export_to_markdown()

    print(f"    ✓ Converted {chunk_path.name} ({len(markdown_content)} chars)")
    return chunk_path.name, markdown_content


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pdf_filename = DAYLIGHT_PDF_URL.rsplit("/", 1)[-1]
    md_filename = pdf_filename.replace(".pdf", ".md")

    print(f"\n{'=' * 60}")
    print(" Daylight Tables Scraper (Batch + GPU)")
    print(f"{'=' * 60}")
    print(f" PDF:        {pdf_filename}")
    print(f" Chunk size: {CHUNK_SIZE} pages")
    print(f" Workers:    {MAX_WORKERS}")
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
        print(f"\n[3/4] Converting {len(chunk_paths)} chunk(s) in parallel...")
        chunk_markdowns: dict[str, str] = {}
        failed_chunks: list[str] = []

        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_chunk = {
                executor.submit(convert_chunk, str(cp)): cp.name for cp in chunk_paths
            }
            for future in as_completed(future_to_chunk):
                chunk_name = future_to_chunk[future]
                try:
                    name, md = future.result()
                    chunk_markdowns[name] = md
                except Exception as e:
                    print(f"    ✗ FAILED {chunk_name}: {e}")
                    failed_chunks.append(chunk_name)

        if failed_chunks:
            print(f"\n  ⚠️  {len(failed_chunks)} chunk(s) failed: {failed_chunks}")

        # Step 4: Merge in page order and save
        print(f"\n[4/4] Merging {len(chunk_markdowns)} chunk(s) into final Markdown...")
        sorted_names = sorted(chunk_markdowns.keys())
        merged_markdown = "\n\n".join(chunk_markdowns[n] for n in sorted_names)

        output_path = OUTPUT_DIR / md_filename
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            f.write(merged_markdown)

        print(f"  ✓ Saved merged Markdown to: {output_path}")
        print(f"    Total size: {len(merged_markdown):,} characters")

    print(f"\n{'=' * 60}")
    print(f" Done! Daylight Tables PDF converted and saved to {OUTPUT_DIR}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
