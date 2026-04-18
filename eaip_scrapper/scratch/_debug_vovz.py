from bs4 import BeautifulSoup
import re
COORD = re.compile(r'[NS]\s*\d{1,2}[:\u00b0].*[EW]\s*\d{2,3}[:\u00b0]', re.IGNORECASE)
with open('output/extracted_data/VOVZ-RNP-Y-RWY-28-CODING.PDF.md') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')
for i, table in enumerate(soup.find_all('table')):
    text = table.get_text(separator=' ').lower()
    has_kw = 'coordinate' in text or 'latitude' in text or 'waypoint information' in text or 'waypoint list' in text
    has_coord_row = any(COORD.search(r.get_text(separator=' ')) for r in table.find_all('tr')[:5])
    print(f'Table {i}: has_kw={has_kw}, has_coord_fallback={has_coord_row}')
    for j, row in enumerate(table.find_all('tr')[:3]):
        print(f'  Row {j}: {row.get_text(separator=" ", strip=True)[:120]}')
