"""Audit column ORDERINGS (not exact text) across all tabular tables."""
import os, glob, re, json
from bs4 import BeautifulSoup
from collections import Counter

merged_dir = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data"

# Canonical field matchers
def classify_col(text):
    t = re.sub(r'\s+', ' ', text).lower().strip()
    if any(k in t for k in ['serial', 'seq', 'sl.']):
        return 'SEQ'
    if any(k in t for k in ['path', 'terminator']):
        return 'PATH'
    if any(k in t for k in ['waypoint', 'fix ident', 'fix identifier']):
        return 'WPT'
    if 'fly' in t and 'over' in t:
        return 'FLYOVER'
    if 'course' in t:
        return 'COURSE'
    if 'distance' in t or 'tm dst' in t or t == 'nm/min':
        return 'DISTANCE'
    if 'turn' in t:
        return 'TURN'
    if 'altitude' in t or 'upper limit' in t or 'lower limit' in t:
        return 'ALT'
    if 'speed' in t:
        return 'SPEED'
    if any(k in t for k in ['vpa', 'va/', 'va/tch', 'vertical angle', 'va']):
        return 'VPA'
    if 'role' in t:
        return 'ROLE'
    if 'nav' in t or 'specification' in t:
        return 'NAV'
    return f'?({t[:20]})'

orderings = Counter()
ordering_files = {}

for filepath in sorted(glob.glob(os.path.join(merged_dir, "*.md"))):
    fname = os.path.basename(filepath)
    with open(filepath) as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    for table in soup.find_all('table'):
        first_rows = table.find_all('tr')[:3]
        for row in first_rows:
            ths = row.find_all(['th', 'td'])
            header_text = [h.get_text(separator=' ', strip=True) for h in ths]
            text_lower = ' '.join(header_text).lower()
            if any(k in text_lower for k in ['serial', 'path', 'descriptor', 'terminator', 'seq']):
                classified = [classify_col(h) for h in header_text]
                key = ' → '.join(classified)
                orderings[key] += 1
                if key not in ordering_files:
                    ordering_files[key] = []
                ordering_files[key].append(fname)
                break

print(f"Unique column orderings: {len(orderings)}\n")
for order, count in orderings.most_common():
    print(f"[{count} files] {order}")
    print(f"  e.g.: {ordering_files[order][:2]}")
    print()
