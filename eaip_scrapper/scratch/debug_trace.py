import os, sys, glob, json, re
from bs4 import BeautifulSoup
sys.path.append("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch")
from parser import parse_coordinate, clean_text

filepath = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data/VOBL-RNP-Y-RWY-09R-CODING.PDF.md"
with open(filepath, 'r') as f: content = f.read()
soup = BeautifulSoup(content, 'html.parser')

waypoint_data = []
for table in soup.find_all('table'):
    for tr in table.find_all('tr'):
        tds = tr.find_all(['td', 'th'])
        flat_cells = []
        for td in tds:
            colspan = int(td.get('colspan', 1))
            cleaned = clean_text(td.get_text(separator=' ', strip=True))
            flat_cells.extend([cleaned] * colspan)
            
        wpt_id = None; coord_raw = None; lat_cell = None; lon_cell = None
        for cid, cell in enumerate(flat_cells):
            if not cell: continue
            c_lower = cell.lower()
            if ("n" in c_lower or "s" in c_lower) and ("e" in c_lower or "w" in c_lower) and bool(re.search(r'\d', cell)):
                coord_raw = cell
                if cid > 0:
                    wpt_id = flat_cells[cid-1]
                    while (wpt_id == cell or wpt_id is None) and cid > 0: 
                        cid -= 1
                        wpt_id = flat_cells[cid]
                break
                
        if not coord_raw and len(flat_cells) == 2:
            wpt_id = flat_cells[0]; coord_raw = flat_cells[1]
            
        if wpt_id and coord_raw and not (wpt_id == coord_raw):
            if "°" in coord_raw or ":" in coord_raw or re.search(r'\d{5}', coord_raw):
                lat_dd, lon_dd = parse_coordinate(coord_raw)
                if lat_dd and lon_dd:
                    waypoint_data.append(wpt_id)
                    
print("WPT DATA FOUND:", waypoint_data)
