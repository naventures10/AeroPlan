import json

with open('scratch/output.json', 'r') as f:
    data = json.load(f)

for item in data:
    if item['procedure_name'] == 'VOHB-RNP-Y-RWY26-CODING':
        print(json.dumps(item['tabular_description'][:3], indent=2))
