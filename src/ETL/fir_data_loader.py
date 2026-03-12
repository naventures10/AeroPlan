import geopandas as gpd
from sqlalchemy import create_engine
import json

# 1. Connect to your PostGIS database
# Replace with your actual username, password, and port
db_url = 'postgresql://postgres:postgres@localhost:5432/aeronautical_information_system'
engine = create_engine(db_url)

print("[*] Loading GeoJSON into GeoPandas...")
# 2. Read the GeoJSON file directly into a GeoDataFrame
gdf = gpd.read_file('/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eAIP_Source code/output/in_asp.geojson')

# 3. Clean up nested JSON columns (Important!)
# GeoJSON allows dictionaries inside properties (like "upperLimit" and "lowerLimit").
# PostGIS prefers these as JSONB text strings so it doesn't crash on insertion.
nested_columns = ['upperLimit', 'lowerLimit', 'hoursOfOperation']
for col in nested_columns:
    if col in gdf.columns:
        gdf[col] = gdf[col].apply(lambda x: json.dumps(x) if isinstance(x, dict) else x)

# 4a. Rename geometry column to 'geom' (PostGIS convention)
gdf = gdf.rename_geometry('geom')

print("[*] Pushing to PostGIS database...")
# 4b. Push the dataframe straight to PostGIS
gdf.to_postgis(
    name='fir_airspaces',       # Name of the new table in PostGIS
    con=engine, 
    if_exists='replace',        # Use 'append' if you want to add to an existing table
    index=False,
)

print("[+] GeoJSON successfully loaded into PostGIS!")