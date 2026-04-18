import sys, re, json
from bs4 import BeautifulSoup
sys.path.append("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch")
from parser import parse_coordinate, clean_text

filepath = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data/VOBL-RNP-Y-RWY-09R-CODING.PDF.md"
with open(filepath) as f: content = f.read()
soup = BeautifulSoup(content, 'html.parser')

waypoint_data = []
tables = soup.find_all('table')
for table in tables:
    for tr in table.find_all('tr'):
        tds = tr.find_all(['td', 'th'])
        flat_cells = []
        for td in tds:
            cleaned = clean_text(td.get_text(separator=' ', strip=True))
            flat_cells.extend([cleaned] * int(td.get('colspan', 1)))
            
        wpt_id = None
        coord_raw = None
        lat_cell = None
        lon_cell = None
        
        for cid, cell in enumerate(flat_cells):
            if not cell: continue
            c_lower = cell.lower()
            has_ns = "n" in c_lower or "s" in c_lower
            has_ew = "e" in c_lower or "w" in c_lower
            has_digits = bool(re.search(r'\d', cell))
            
            if has_ns and has_ew and has_digits:
                coord_raw = cell
                if cid > 0: wpt_id = flat_cells[cid-1]
                break
        
        if not coord_raw and len(flat_cells) == 2:
            wpt_id, coord_raw = flat_cells[0], flat_cells[1]
            
        if wpt_id and coord_raw and not (wpt_id == coord_raw):
            if "°" in coord_raw or ":" in coord_raw or re.search(r'\d{5}', coord_raw): 
                lat, lon = parse_coordinate(coord_raw)
                print(f"MAPPED -> ID: {wpt_id}, Coord: {coord_raw}, Parsed: {(lat, lon)}")
