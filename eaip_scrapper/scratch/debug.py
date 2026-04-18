import sys, re, json
sys.path.append("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch")
from parser import parse_markdown_files

res = parse_markdown_files("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data")
vobl = next((x for x in res if x["filename"] == "VOBL-RNP-Y-RWY-09R-CODING.PDF.md"), None)
print(json.dumps(vobl["waypoints"], indent=2))
