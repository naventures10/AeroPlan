"""Audit all unique table header patterns across merged data."""
import os, glob, re, json
from bs4 import BeautifulSoup
from collections import Counter

merged_dir = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data"
header_patterns = Counter()
header_details = {}

for filepath in sorted(glob.glob(os.path.join(merged_dir, "*.md"))):
    fname = os.path.basename(filepath)
    with open(filepath) as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    for table in soup.find_all('table'):
        # Find first row with th elements or the first tr
        first_rows = table.find_all('tr')[:3]
        for row in first_rows:
            ths = row.find_all(['th', 'td'])
            header_text = [h.get_text(separator=' ', strip=True) for h in ths]
            # Classify table type
            text_lower = ' '.join(header_text).lower()
            if any(k in text_lower for k in ['serial', 'path', 'descriptor', 'terminator']):
                # This is a tabular/sequence table
                key = ' | '.join(header_text)
                header_patterns[key] += 1
                if key not in header_details:
                    header_details[key] = []
                header_details[key].append(fname)
                break

# Print unique patterns
print(f"Unique tabular header patterns: {len(header_patterns)}\n")
for pattern, count in header_patterns.most_common():
    cols = pattern.split(' | ')
    print(f"[{count} files] ({len(cols)} cols)")
    for i, c in enumerate(cols):
        print(f"  [{i}] {c}")
    print(f"  Files: {header_details[pattern][:3]}{'...' if len(header_details[pattern]) > 3 else ''}")
    print()
