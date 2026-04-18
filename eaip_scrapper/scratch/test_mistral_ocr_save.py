#!/usr/bin/env python3
"""Script to test Mistral OCR-latest and save output to a file."""

import os
import json
from mistralai.client import Mistral

def test_mistral_ocr_and_save():
    """Test Mistral OCR-latest and save the output to a file."""
    # Load API key from .env file
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError("MISTRAL_API_KEY not found in .env file")

    # Initialize Mistral client
    client = Mistral(api_key=api_key)

    # Define the document URL
    document_url = "https://aim-india.aai.aero/eaip/eaip-v2-02-2026/eAIP/VOMD-RNP-Y-RWY-09-CODING.pdf"

    # Process the document using Mistral OCR
    ocr_response = client.ocr.process(
        model="mistral-ocr-latest",
        document={
            "type": "document_url",
            "document_url": document_url
        },
        table_format="html",  # default is None
        include_image_base64=True
    )

    # Define the output directory and file path
    output_dir = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/mistral_ocr"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "ocr_output.json")

    # Convert the response to a dictionary for JSON serialization
    ocr_response_dict = {
        "model": ocr_response.model,
        "usage_info": {
            "pages_processed": ocr_response.usage_info.pages_processed,
            "doc_size_bytes": ocr_response.usage_info.doc_size_bytes
        },
        "pages": []
    }

    for page in ocr_response.pages:
        page_dict = {
            "index": page.index,
            "markdown": page.markdown,
            "dimensions": {
                "dpi": page.dimensions.dpi,
                "height": page.dimensions.height,
                "width": page.dimensions.width
            },
            "tables": [],
            "hyperlinks": page.hyperlinks,
            "header": page.header,
            "footer": page.footer
        }

        for table in page.tables:
            table_dict = {
                "id": table.id,
                "content": table.content,
                "format": table.format_
            }
            page_dict["tables"].append(table_dict)

        ocr_response_dict["pages"].append(page_dict)

    # Save the response to a JSON file
    with open(output_file, "w") as f:
        json.dump(ocr_response_dict, f, indent=4)

    print(f"OCR output saved to: {output_file}")

if __name__ == "__main__":
    test_mistral_ocr_and_save()