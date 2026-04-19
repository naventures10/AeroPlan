import argparse
import sys
import logging
from pathlib import Path

# Add src to path for absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR / "src"))

from rnp_processor.utils import setup_logging, MERGED_DIR
from rnp_processor.extractor import RNPExtractor
from rnp_processor.transformer import RNPTransformer
from rnp_processor.loader import RNPLoader
from rnp_processor.validator import RNPValidator


def main():
    parser = argparse.ArgumentParser(description="Unified RNP ETL Pipeline")
    parser.add_argument("--step", choices=["extract", "merge", "parse", "load", "all"], default="all",
                        help="ETL step to run (default: all)")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--force-load", action="store_true",
                        help="Load procedures even if validation fails (not recommended)")
    parser.add_argument("--extract-tables-only", action="store_true",
                        help="Extract only missing TABLES files (skip existing CODING files)")
    args = parser.parse_args()

    # Logging setup
    logger = setup_logging(level=logging.DEBUG if args.debug else logging.INFO)
    logger.info(f"Starting RNP ETL Pipeline [Step: {args.step}]")

    # DB Config
    db_config = {
        "host": "localhost",
        "port": 5432,
        "database": "aeronautical_information_system",
        "user": "postgres",
        "password": "postgres"
    }

    try:
        # 1. Extraction
        if args.step in ("extract", "all"):
            logger.info("Extraction step triggered (LlamaCloud/Mistral)...")
            extractor = RNPExtractor()
            
            if args.extract_tables_only:
                # Extract only missing TABLES files
                success = extractor.extract_tables_files()
                if not success:
                    logger.warning("Some TABLES files failed to extract")
            else:
                # Full extraction (can be extended for other extraction needs)
                logger.info("Full extraction mode - currently only TABLES extraction is implemented")
                success = extractor.extract_tables_files()
                if not success:
                    logger.warning("Some TABLES files failed to extract")

        # 2. Merging
        if args.step in ("merge", "all"):
            transformer = RNPTransformer()
            transformer.merge_files()

        # 3. Parsing & Loading
        if args.step in ("parse", "load", "all"):
            transformer = RNPTransformer()
            loader = RNPLoader(db_config)
            validator = RNPValidator()

            if args.step in ("load", "all"):
                loader.init_schema()

            # Iterate through merged files
            merged_files = sorted(MERGED_DIR.glob("*.md"))
            logger.info(f"Processing {len(merged_files)} merged files...")

            summary = {
                "total": 0,
                "loaded": 0,
                "skipped": 0,
                "warned": 0,
                "failed": 0,
            }

            for f in merged_files:
                summary["total"] += 1
                proc_data = transformer.parse_file(f)

                # ── Validation ────────────────────────────────────────────
                val_res = validator.validate_procedure_data(proc_data)

                if val_res["status"] == "FAILED":
                    logger.error(
                        f"VALIDATION FAILED — {f.name}: {val_res['issues']}"
                    )
                    if not args.force_load:
                        summary["skipped"] += 1
                        continue
                    else:
                        logger.warning(f"  --force-load: loading despite failure")

                if val_res["status"] == "WARNING":
                    logger.warning(
                        f"VALIDATION WARNING — {f.name}: {val_res['issues']}"
                    )
                    summary["warned"] += 1

                # ── Load ──────────────────────────────────────────────────
                if args.step in ("load", "all"):
                    notes = "; ".join(val_res["issues"]) if val_res["issues"] else None
                    if loader.load_procedure(
                        proc_data,
                        validation_status=val_res["status"],
                        validation_notes=notes
                    ):
                        summary["loaded"] += 1
                    else:
                        summary["failed"] += 1

            logger.info(
                f"ETL Summary: "
                f"Total={summary['total']}, "
                f"Loaded={summary['loaded']}, "
                f"Warned={summary['warned']}, "
                f"Skipped={summary['skipped']}, "
                f"Failed={summary['failed']}"
            )

    except Exception as e:
        logger.exception(f"ETL Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
