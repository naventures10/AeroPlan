import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings()

url = "https://aim-india.aai.aero/eaip/eaip-v2-01-2026/eAIP/IN-AD%202.1VAPO-en-GB.html"
resp = requests.get(url, verify=False)
soup = BeautifulSoup(resp.text, 'html.parser')
tables = soup.find_all('table')

for i, t in enumerate(tables):
    text = t.get_text(separator=' ', strip=True)
    if "AD 2.9" in text or "AD 2.10" in text or "AERODROME OBSTACLES" in text:
        rows = t.find_all('tr', recursive=False)
        if not rows:
            rows = t.find('tbody').find_all('tr', recursive=False) if t.find('tbody') else t.find_all('tr')
        print(f"Table {i} | Nested TRs: {len(rows)} | Preview: {text[:100]}")
