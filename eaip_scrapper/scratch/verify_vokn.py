import json
with open('scratch/output.json', 'r') as f:
    data = json.load(f)

for item in data:
    if item['procedure_name'] == 'VOKN-RNP-Y-RWY-07-CODING' or item['airport_id'] == 'VOKN':
        print("Tabular IDs:", [x.get('waypoint_id') for x in item.get('tabular_description', [])])
        print("Waypoint IDs:", [x.get('waypoint_id') for x in item.get('waypoints', [])])
        break
