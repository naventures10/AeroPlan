import os
import re
from pathlib import Path
from collections import defaultdict

# Configuration
EXTRACTED_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/extracted_data")
MERGED_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data")

MERGED_DIR.mkdir(parents=True, exist_ok=True)

def get_base_name(filename):
    """
    Extracts the base procedure name by removing -1.PDF.md or -2.PDF.md suffixes,
    and strips -CODING and -WAYPOINTS so they merge together.
    """
    # Remove extension
    name = filename.replace(".PDF.md", "").replace(".md", "")
    # Remove -1 or -2 suffix
    name = re.sub(r'-\d+$', '', name)
    # Remove -CODING and -WAYPOINTS to group them
    name = name.replace("-CODING", "").replace("-WAYPOINTS", "")
    return name

def merge_files():
    files = list(EXTRACTED_DIR.glob("*.md"))
    groups = defaultdict(list)
    
    # First pass: identify true multi-part groups
    for f in files:
        base_name = get_base_name(f.name)
        groups[base_name].append(f)
    
    print(f"Analyzing {len(groups)} potential procedure groups...")
    
    for base_name, file_list in groups.items():
        if len(file_list) > 1:
            # TRUE SPLIT: Group has multiple parts (e.g., -1, -2)
            file_list.sort(key=lambda x: x.name)
            merged_content = []
            for f in file_list:
                with open(f, "r") as src:
                    content = src.read()
                    merged_content.append(f"<!-- Source: {f.name} -->\n" + content)
            
            output_file = MERGED_DIR / f"{base_name}.md"
            with open(output_file, "w") as dest:
                dest.write("\n\n---\n\n".join(merged_content))
            print(f"  [MERGED] {len(file_list)} parts -> {base_name}.md")
        else:
            # STANDALONE: Only one file in this "group"
            # It might have a -1 (like VOTP) or no suffix (like VOBL)
            src_file = file_list[0]
            output_file = MERGED_DIR / src_file.name
            
            import shutil
            shutil.copy2(src_file, output_file)
            print(f"  [STANDALONE] {src_file.name}")

if __name__ == "__main__":
    # Clean output dir first to avoid stale merges
    if MERGED_DIR.exists():
        import shutil
        shutil.rmtree(MERGED_DIR)
    MERGED_DIR.mkdir(parents=True, exist_ok=True)
    
    merge_files()
