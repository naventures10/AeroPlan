import os
import asyncio
from dotenv import load_dotenv
from llama_cloud import AsyncLlamaCloud

# Load environment variables from .env
load_dotenv()


async def main():
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        print("Error: LLAMA_CLOUD_API_KEY not found in .env")
        return

    client = AsyncLlamaCloud(api_key=api_key)

    # Upload and parse a document
    file_path = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/Chennai_A_2026_03.pdf"  # Adjusting to the correct local path for Chennai A

    print(f"Uploading and parsing {file_path}...")
    file = await client.files.create(file=file_path, purpose="parse")
    result = await client.parsing.parse(
        file_id=file.id,
        tier="agentic",
        version="latest",
        expand=["markdown"],
    )

    # Get markdown output
    if result.markdown and result.markdown.pages:
        from pathlib import Path
        
        full_markdown = "\n\n".join([page.markdown for page in result.markdown.pages])
        
        # Derive output filename from input file path
        pdf_name = Path(file_path).stem
        output_md_path = Path("output") / f"{pdf_name}.md"
        
        output_md_path.parent.mkdir(parents=True, exist_ok=True)
        output_md_path.write_text(full_markdown)
        
        print(f"Successfully parsed {len(result.markdown.pages)} pages.")
        print(f"Full markdown saved to: {output_md_path}")
        print("\nFirst page preview:")
        print(result.markdown.pages[0].markdown[:500])
    else:
        print("No markdown result returned.")


if __name__ == "__main__":
    asyncio.run(main())
