import json
import struct
import sys
from pathlib import Path

import geopandas as gpd
from sqlalchemy import create_engine

# Add the backend directory to sys.path to allow importing 'app'
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

try:
    from app.core.config import settings
except ImportError:
    print(
        "Error: Could not import app.core.config. Make sure you are running from the backend directory."
    )
    sys.exit(1)


def export_nav_aids_binary():
    """
    Fetches radio navigation aids from PostGIS, normalizes their coordinates,
    and exports them to a binary flat buffer for WebGPU/Shaders.

    Data Layout: [X, Y, Size, Type] (all 32-bit floats)
    """
    # 1. Database Connection
    db_url = (
        f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
    engine = create_engine(db_url)

    # 2. Fetch Data
    print("Fetching navigation aids from PostGIS...")
    query = "SELECT geom, aid_type, station_name, ident FROM radio_nav_aids"
    try:
        df = gpd.read_postgis(query, engine, geom_col="geom")
    except Exception as e:
        print(f"Error: {e}")
        return

    if df.empty:
        print("No navigation aids found.")
        return

    # 3. Extract Coordinates and Calculate Bounding Box
    df["lon"] = df.geometry.x
    df["lat"] = df.geometry.y

    min_lon, max_lon = df["lon"].min(), df["lon"].max()
    min_lat, max_lat = df["lat"].min(), df["lat"].max()

    range_lon = max_lon - min_lon
    range_lat = max_lat - min_lat
    # Use the larger range to preserve aspect ratio (prevents squishing India)
    max_range = max(range_lon, range_lat)

    print("Extents found:")
    print(f"  Longitude: {min_lon:.4f} to {max_lon:.4f}")
    print(f"  Latitude:  {min_lat:.4f} to {max_lat:.4f}")
    print(f"  Normalization Range: {max_range:.4f} degrees")

    # 4. Define Mappings Dynamically
    # We use a preferred order for consistency, but only include what's actually in the DB.
    preferred_order = ["VOR", "VOR/DME", "NDB", "DME"]
    found_types = df["aid_type"].unique()

    type_mapping = {}
    current_id = 0.0

    # Assign IDs to preferred types first to keep shader logic consistent
    for pt in preferred_order:
        if pt in found_types:
            type_mapping[pt] = float(current_id)
            current_id += 1.0

    # Add any other types found in the DB
    for ft in sorted(found_types):
        if ft not in type_mapping:
            type_mapping[ft] = float(current_id)
            current_id += 1.0

    print("Dynamic Type Mapping:")
    for t, val in type_mapping.items():
        print(f"  {t}: {val}")

    # 5. Export to Binary
    output_dir = backend_dir.parent / "frontend/public/data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "nav_aids.bin"

    # We'll also save a metadata file so the frontend knows the bounding box if needed
    meta_file = output_dir / "nav_aids_meta.json"
    metadata = {
        "count": len(df),
        "min_lon": min_lon,
        "max_lon": max_lon,
        "min_lat": min_lat,
        "max_lat": max_lat,
        "max_range": max_range,
        "layout": ["X", "Y", "Size", "Type"],
        "type_mapping": type_mapping,
    }

    print(f"Exporting to {output_file}...")

    count = 0
    with open(output_file, "wb") as f:
        for _, row in df.iterrows():
            # Normalize to 0..1 space while preserving aspect ratio
            x = (row["lon"] - min_lon) / max_range
            y = (row["lat"] - min_lat) / max_range

            # size is a float the shader uses to scale the primitive
            size = 0.012

            # aid_type mapping
            t = type_mapping.get(row["aid_type"], 4.0)  # 4.0 is 'Other'

            # 'f' is 32-bit float (4 bytes). 'ffff' = 16 bytes per entry.
            binary_data = struct.pack("ffff", x, y, size, t)
            f.write(binary_data)
            count += 1

    # Save metadata
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\nSuccess!")
    print(f"  Total records: {count}")
    print(f"  Binary file:   {output_file.relative_to(backend_dir.parent)}")
    print(f"  Metadata file: {meta_file.relative_to(backend_dir.parent)}")
    print(f"  Total size:    {count * 16} bytes")


if __name__ == "__main__":
    export_nav_aids_binary()
