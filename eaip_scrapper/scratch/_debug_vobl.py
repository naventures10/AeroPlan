from bs4 import BeautifulSoup
import re, sys
sys.path.insert(0, 'scratch')
from parser import extract_headers, classify_table, sanitize_header

with open('output/merged_data/VOBL-RNP-RWY-09L-CODING.PDF.md') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')
for i, table in enumerate(soup.find_all('table')):
    ttype = classify_table(table)
    print(f"Table {i}: type={ttype}")
    headers = extract_headers(table)
    print(f"  Headers: {headers}")
    # Show raw th text
    for row in table.find_all('tr')[:2]:
        ths = row.find_all('th')
        if ths:
            print(f"  Raw TH: {[th.get_text(separator=' ', strip=True) for th in ths]}")
