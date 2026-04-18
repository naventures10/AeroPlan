import sys, re, json
import importlib.util

spec = importlib.util.spec_from_file_location("parser", "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/parser.py")
parser_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser_mod)

res = parser_mod.parse_markdown_files("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data")
vobl = next((x for x in res if x["filename"] == "VOBL-RNP-Y-RWY-09R-CODING.PDF.md"), None)
print("WAYPOINTS:", vobl["waypoints"])
