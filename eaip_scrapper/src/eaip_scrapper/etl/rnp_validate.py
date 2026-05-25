# ruff: noqa: E402
import argparse
import sys
from pathlib import Path

# Add src to path for absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR / "src"))

import os

from eaip_scrapper.rnp_processor.transformer import RNPTransformer
from eaip_scrapper.rnp_processor.utils import MERGED_DIR, setup_logging
from eaip_scrapper.validation.core.rnp_validator import RNPValidator

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", 5432)),
    "database": os.getenv("POSTGRES_DB", "aeronautical_information_system"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
}


def validate_markdown(logger):
    """Audit merged markdown files for data consistency."""
    transformer = RNPTransformer()
    validator = RNPValidator()

    files = sorted(MERGED_DIR.glob("*.md"))
    logger.info(f"Auditing {len(files)} markdown files...")
    passed = 0
    warned = 0
    failed = 0
    for f in files:
        proc_data = transformer.parse_file(f)
        res = validator.validate_procedure_data(proc_data)
        if res["status"] == "SUCCESS":
            passed += 1
        elif res["status"] == "WARNING":
            warned += 1
            logger.warning(f"  WARNING: {f.name} — {res['issues']}")
        else:
            failed += 1
            logger.error(f"  FAILED: {f.name} — {res['issues']}")

    logger.info(
        f"Audit Complete: {passed} passed, {warned} warned, {failed} failed "
        f"(out of {len(files)} total)"
    )


def validate_db(logger):
    """Audit the live PostGIS database for geometry and data integrity."""
    import psycopg2

    try:
        with psycopg2.connect(**DB_CONFIG) as conn, conn.cursor() as cur:
            # 1. Total procedure count
            cur.execute("SELECT COUNT(*) FROM rnp_procedures")
            # pyrefly: ignore [unsupported-operation]
            total = cur.fetchone()[0]
            logger.info(f"Total procedures in DB: {total}")

            # 2. Procedures with NULL geometry
            cur.execute("SELECT COUNT(*) FROM rnp_procedures WHERE geom_3d IS NULL")
            # pyrefly: ignore [unsupported-operation]
            null_geom = cur.fetchone()[0]
            if null_geom:
                logger.warning(f"Procedures with NULL geometry: {null_geom}")
                cur.execute("SELECT name FROM rnp_procedures WHERE geom_3d IS NULL")
                for row in cur.fetchall():
                    logger.warning(f"  — {row[0]}")

            # 3. Procedures with invalid geometry
            cur.execute("""
                    SELECT name, ST_IsValidReason(geom_3d)
                    FROM rnp_procedures
                    WHERE geom_3d IS NOT NULL AND NOT ST_IsValid(geom_3d)
                """)
            invalid = cur.fetchall()
            if invalid:
                logger.error(f"Procedures with INVALID geometry: {len(invalid)}")
                for name, reason in invalid:
                    logger.error(f"  — {name}: {reason}")
            else:
                logger.info("✓ All geometries are valid.")

            # 4. Geometry bounding box sanity (should be within India)
            cur.execute("""
                    SELECT name,
                           ST_XMin(geom_3d), ST_YMin(geom_3d),
                           ST_XMax(geom_3d), ST_YMax(geom_3d)
                    FROM rnp_procedures
                    WHERE geom_3d IS NOT NULL
                      AND (ST_XMin(geom_3d) < 66 OR ST_XMax(geom_3d) > 100
                           OR ST_YMin(geom_3d) < 5 OR ST_YMax(geom_3d) > 40)
                """)
            out_of_bounds = cur.fetchall()
            if out_of_bounds:
                logger.error(f"Procedures with geometry OUTSIDE India bbox: {len(out_of_bounds)}")
                for name, xmin, ymin, xmax, ymax in out_of_bounds:
                    logger.error(
                        f"  — {name}: bbox=({xmin:.2f},{ymin:.2f})–({xmax:.2f},{ymax:.2f})"
                    )
            else:
                logger.info("✓ All geometries within India bounding box.")

            # 5. Validation status distribution
            cur.execute("""
                    SELECT validation_status, COUNT(*)
                    FROM rnp_procedures
                    GROUP BY validation_status
                    ORDER BY validation_status
                """)
            logger.info("Validation status distribution:")
            for status, count in cur.fetchall():
                logger.info(f"  {status or 'NULL'}: {count}")

            # 6. Waypoints with NULL geom
            cur.execute("SELECT COUNT(*) FROM rnp_waypoints WHERE geom IS NULL")
            # pyrefly: ignore [unsupported-operation]
            null_wpt = cur.fetchone()[0]
            if null_wpt:
                logger.warning(f"Waypoints with NULL geometry: {null_wpt}")
            else:
                logger.info("✓ All waypoints have geometry.")

            # 7. Orphan legs (legs referencing non-existent procedures)
            cur.execute("""
                    SELECT COUNT(*)
                    FROM rnp_legs l
                    LEFT JOIN rnp_procedures p ON l.procedure_id = p.id
                    WHERE p.id IS NULL
                """)
            # pyrefly: ignore [unsupported-operation]
            orphans = cur.fetchone()[0]
            if orphans:
                logger.error(f"Orphan legs (no parent procedure): {orphans}")
            else:
                logger.info("✓ No orphan legs.")

    except Exception as e:
        logger.exception(f"DB validation failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="Unified RNP Validation Tool")
    parser.add_argument(
        "--stage",
        choices=["markdown", "db"],
        default="markdown",
        help="Validation stage to run (default: markdown)",
    )
    args = parser.parse_args()

    logger = setup_logging()
    logger.info(f"Starting RNP Validation [Stage: {args.stage}]")

    if args.stage == "markdown":
        validate_markdown(logger)
    elif args.stage == "db":
        validate_db(logger)


if __name__ == "__main__":
    main()
