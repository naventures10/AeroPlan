import re

# 1. Update pyproject.toml
with open("pyproject.toml") as f:
    pyproject = f.read()
pyproject = pyproject.replace('"N999", "RUF001"', '"N999", "RUF001", "RUF002"')
with open("pyproject.toml", "w") as f:
    f.write(pyproject)

# 2. Fix etl_notams.py
with open("src/ETL/etl_notams.py") as f:
    etl_notams = f.read()
etl_notams = re.sub(r"STATE_SEEKING_HEADER", "state_seeking_header", etl_notams)
etl_notams = re.sub(r"STATE_SEEKING_NOTAM", "state_seeking_notam", etl_notams)
etl_notams = re.sub(r"STATE_BUILDING_NOTAM", "state_building_notam", etl_notams)
etl_notams = etl_notams.replace(
    'if not re.search(r"\\d", remainder):\n                # Ensure the string is purely letters, spaces, parenthesis, and standard marks\n                if re.fullmatch(r"([A-Z\\s\\(\\)/\\-]+)", text_upper):',
    'if not re.search(r"\\d", remainder) and re.fullmatch(r"([A-Z\\s\\(\\)/\\-]+)", text_upper):',
)
with open("src/ETL/etl_notams.py", "w") as f:
    f.write(etl_notams)

# 3. Fix etl_routes.py
with open("src/ETL/etl_routes.py") as f:
    etl_routes = f.read()
etl_routes = etl_routes.replace(
    "except ValueError, IndexError:", "except (ValueError, IndexError):"
)
etl_routes = etl_routes.replace(
    '[l.strip() for l in lc_raw.split("\\n") if l.strip()]',
    '[line.strip() for line in lc_raw.split("\\n") if line.strip()]',
)
with open("src/ETL/etl_routes.py", "w") as f:
    f.write(etl_routes)

# 4. Fix rnp_etl.py
with open("src/ETL/rnp_etl.py") as f:
    rnp_etl = f.read()
rnp_etl = rnp_etl.replace(
    'raise ValueError(f"Invalid POSTGRES_PORT: {postgres_port_str}. Must be numeric.")',
    'raise ValueError(f"Invalid POSTGRES_PORT: {postgres_port_str}. Must be numeric.") from None',
)
with open("src/ETL/rnp_etl.py", "w") as f:
    f.write(rnp_etl)

# 5. Fix extractor.py
with open("src/rnp_processor/extractor.py") as f:
    extractor = f.read()
extractor = extractor.replace(
    "def _replace_table(match):",
    "def _replace_table(match, tl=table_lookup):\n                    tid = match.group(1)\n                    content = tl.get(tid)\n                    if content is None:",
)
extractor = extractor.replace(
    "content = table_lookup.get(tid)\n                    if content is None:", ""
)
with open("src/rnp_processor/extractor.py", "w") as f:
    f.write(extractor)
