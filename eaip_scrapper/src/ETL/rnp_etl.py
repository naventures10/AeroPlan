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
    parser = argparse.ArgumentParser(
        description="Unified RNP ETL Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Steps:
  extract  – Download and OCR-extract all missing CODING + TABLE charts
  merge    – Merge per-chart markdowns into unified per-procedure files
  parse    – Parse merged files into structured records
  load     – Validate and load records into PostGIS
  all      – Run extract → merge → parse → load  (default)

Skip flags:
  --skip-extract   Skip the extraction step even when running 'all'
  --force-extract  Re-extract charts that already have a markdown file
""",
    )
    parser.add_argument(
        "--step",
        choices=["extract", "merge", "parse", "load", "all"],
        default="all",
        help="ETL step to run (default: all)",
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument(
        "--force-load",
        action="store_true",
        help="Load procedures even if validation fails (not recommended)",
    )
    parser.add_argument(
        "--skip-extract",
        action="store_true",
        help="Skip chart extraction even when step=all",
    )
    parser.add_argument(
        "--force-extract",
        action="store_true",
        help="Re-extract charts that already have a markdown file (clears existing .md)",
    )
    args = parser.parse_args()

    # ── Logging ────────────────────────────────────────────────────────────────
    logger = setup_logging(level=logging.DEBUG if args.debug else logging.INFO)
    logger.info(f"Starting RNP ETL Pipeline [Step: {args.step}]")

    # ── DB Config ──────────────────────────────────────────────────────────────
    db_config = {
        "host": "localhost",
        "port": 5432,
        "database": "aeronautical_information_system",
        "user": "postgres",
        "password": "postgres",
    }

    try:
        # ── 1. Extraction ──────────────────────────────────────────────────────
        if args.step in ("extract", "all") and not args.skip_extract:
            logger.info("=== EXTRACTION STEP: CODING + TABLE charts ===")
            extractor = RNPExtractor()

            # Force-extract: wipe existing markdown files so gap-analysis sees them
            if args.force_extract:
                from rnp_processor.utils import EXTRACTED_DIR
                wiped = 0
                for md in EXTRACTED_DIR.glob("*.md"):
                    md.unlink()
                    wiped += 1
                logger.warning(f"--force-extract: removed {wiped} existing .md files")

            missing = extractor.get_missing_files()
            if missing:
                ok = extractor.extract_all_files(missing)
                if not ok:
                    logger.warning(
                        "Some charts failed to extract — pipeline will continue "
                        "with files that are present."
                    )
            else:
                logger.info("All charts already extracted — skipping.")
        elif args.skip_extract and args.step == "all":
            logger.info("Extraction step skipped (--skip-extract).")

        # ── 2. Merging ─────────────────────────────────────────────────────────
        if args.step in ("merge", "all"):
            logger.info("=== MERGE STEP ===")
            transformer = RNPTransformer()
            transformer.merge_files()

        # ── 3. Parse & Load ────────────────────────────────────────────────────
        if args.step in ("parse", "load", "all"):
            logger.info("=== PARSE / LOAD STEP ===")
            transformer = RNPTransformer()
            loader = RNPLoader(db_config)
            validator = RNPValidator()

            if args.step in ("load", "all"):
                loader.init_schema()

            merged_files = sorted(MERGED_DIR.glob("*.md"))
            logger.info(f"Processing {len(merged_files)} merged procedure files...")

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

                # ── Validation ─────────────────────────────────────────────
                val_res = validator.validate_procedure_data(proc_data)

                if val_res["status"] == "FAILED":
                    logger.error(
                        f"VALIDATION FAILED — {f.name}: {val_res['issues']}"
                    )
                    if not args.force_load:
                        summary["skipped"] += 1
                        continue
                    else:
                        logger.warning("  --force-load: loading despite failure")

                if val_res["status"] == "WARNING":
                    logger.warning(
                        f"VALIDATION WARNING — {f.name}: {val_res['issues']}"
                    )
                    summary["warned"] += 1

                # ── Load ───────────────────────────────────────────────────
                if args.step in ("load", "all"):
                    notes = "; ".join(val_res["issues"]) if val_res["issues"] else None
                    if loader.load_procedure(
                        proc_data,
                        validation_status=val_res["status"],
                        validation_notes=notes,
                    ):
                        summary["loaded"] += 1
                    else:
                        summary["failed"] += 1

            logger.info(
                f"ETL Summary — "
                f"Total: {summary['total']}, "
                f"Loaded: {summary['loaded']}, "
                f"Warned: {summary['warned']}, "
                f"Skipped: {summary['skipped']}, "
                f"Failed: {summary['failed']}"
            )

    except Exception as e:
        logger.exception(f"ETL Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
