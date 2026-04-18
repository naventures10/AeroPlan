import json

with open('scratch/output.json', 'r') as f:
    data = json.load(f)

for item in data:
    if item['procedure_name'] == 'VEBN-RNP-Y-RWY-27-CODING':
        print(json.dumps(item['waypoints'], indent=2))
