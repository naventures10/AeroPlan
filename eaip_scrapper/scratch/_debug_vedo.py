from bs4 import BeautifulSoup
with open('output/extracted_data/VEDO-RNP-Z-RWY-27-CODING.PDF.md') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')
for i, table in enumerate(soup.find_all('table')):
    text_lower = table.get_text(separator=' ').lower()
    is_seq = "serial" in text_lower or "path" in text_lower or "descriptor" in text_lower
    is_fas = "fas" in text_lower and ("operation type" in text_lower or "calculated crc" in text_lower)
    print(f"Table {i}: is_seq={is_seq}, is_fas={is_fas}")
    print(f"  has 'path': {'path' in text_lower}")
    print(f"  has 'fas': {'fas' in text_lower}")
    print(f"  has 'operation type': {'operation type' in text_lower}")
    print(f"  First 100 chars: {text_lower[:100]}")
