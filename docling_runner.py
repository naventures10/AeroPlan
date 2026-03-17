from docling.document_converter import DocumentConverter
from pathlib import Path

source = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/VABB-RNP-Y-RWY-09-CODING.pdf"
output_path = Path("VABB-RNP-Y-RWY-09-CODING.md")

converter = DocumentConverter()
result = converter.convert(source)
markdown_content = result.document.export_to_markdown()

with output_path.open("w", encoding="utf-8") as f:
    f.write(markdown_content)

print(f"Markdown output saved to: {output_path}")
