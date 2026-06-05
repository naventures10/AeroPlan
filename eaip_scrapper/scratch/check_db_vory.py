import os
import sys
from pathlib import Path

import psycopg2

# Add src to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / "src"))

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", 5432)),
    "database": os.getenv("POSTGRES_DB", "aeronautical_information_system"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
}


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Let's find the procedure ID for VORY-RNP-Z-RWY-23-CODING
    cur.execute("SELECT id, name FROM rnp_procedures WHERE name LIKE '%VORY%'")
    procs = cur.fetchall()
    print("Found VORY procedures in DB:")
    for pid, name in procs:
        print(f"  ID: {pid}, Name: {name}")

        # Let's print the legs for this procedure
        cur.execute(
            """
            SELECT sequence_nr, path_descriptor, waypoint_ident, course, distance, alt_constraint, speed_limit, nav_spec, fly_over
            FROM rnp_legs
            WHERE procedure_id = %s
            ORDER BY sequence_nr
        """,
            (pid,),
        )
        legs = cur.fetchall()
        print("  Legs:")
        for leg in legs:
            print(
                f"    Seq: {leg[0]}, Path: {leg[1]}, Waypoint: {leg[2]}, Course: {leg[3]}, Distance: {leg[4]}, Alt: {leg[5]}, Speed: {leg[6]}, NavSpec: {leg[7]}, FlyOver: {leg[8]}"
            )


if __name__ == "__main__":
    main()
