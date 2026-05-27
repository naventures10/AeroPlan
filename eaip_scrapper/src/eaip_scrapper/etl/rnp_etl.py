# ruff: noqa: E402
import argparse
import logging
import sys
from pathlib import Path

# Add src to path for absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR / "src"))

from eaip_scrapper.rnp_processor.extractor import RNPExtractor
from eaip_scrapper.rnp_processor.loader import RNPLoader
from eaip_scrapper.rnp_processor.transformer import RNPTransformer
from eaip_scrapper.rnp_processor.utils import get_s3_client, setup_logging
from eaip_scrapper.validation.core.rnp_validator import RNPValidator


def main():
    parser = argparse.ArgumentParser(
        description="Unified RNP eaip_scrapper.etl Pipeline",
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
        help="eaip_scrapper.etl step to run (default: all)",
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
    logger.info(f"Starting RNP eaip_scrapper.etl Pipeline [Step: {args.step}]")

    import os

    # ── DB Config ──────────────────────────────────────────────────────────────
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    if not postgres_password:
        raise ValueError("POSTGRES_PASSWORD must be set in environment variables.")

    postgres_port_str = os.getenv("POSTGRES_PORT", "5432")
    try:
        postgres_port = int(postgres_port_str)
    except ValueError:
        raise ValueError(f"Invalid POSTGRES_PORT: {postgres_port_str}. Must be numeric.") from None

    db_config = {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": postgres_port,
        "database": os.getenv("POSTGRES_DB", "aeronautical_information_system"),
        "user": os.getenv("POSTGRES_USER"),
        "password": postgres_password,
    }

    try:
        # ── 1. Extraction ──────────────────────────────────────────────────────
        if args.step in ("extract", "all") and not args.skip_extract:
            logger.info("=== EXTRACTION STEP: CODING + TABLE charts ===")
            extractor = RNPExtractor()

            # Force-extract: wipe existing markdown files so gap-analysis sees them
            if args.force_extract:
                s3_client = get_s3_client()
                bucket = os.getenv("MINIO_BUCKET", "ais")
                paginator = s3_client.get_paginator('list_objects_v2')
                keys = []
                for page in paginator.paginate(Bucket=bucket, Prefix="output/rnp/extracted_data/"):
                    for obj in page.get("Contents", []):
                        if obj["Key"].endswith(".md"):
                            keys.append(obj["Key"])

                wiped = 0
                errors = 0
                for key in keys:
                    try:
                        s3_client.delete_object(Bucket=bucket, Key=key)
                        wiped += 1
                    except Exception as e:
                        logger.error(f"Failed to remove {key}: {e}")
                        errors += 1
                logger.warning(
                    f"--force-extract: removed {wiped} existing .md files in MinIO, {errors} errors"
                )

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

            s3_client = get_s3_client()
            bucket = os.getenv("MINIO_BUCKET", "ais")
            response = s3_client.list_objects_v2(Bucket=bucket, Prefix="output/rnp/merged_data/")
            merged_keys = [
                obj["Key"] for obj in response.get("Contents", []) if obj["Key"].endswith(".md")
            ]
            merged_keys.sort()
            logger.info(f"Processing {len(merged_keys)} merged procedure files from MinIO...")

            summary = {
                "total": 0,
                "loaded": 0,
                "skipped": 0,
                "warned": 0,
                "failed": 0,
            }

            for key in merged_keys:
                summary["total"] += 1
                proc_data = transformer.parse_file(key)
                filename = os.path.basename(key)

                # ── Validation ─────────────────────────────────────────────
                val_res = validator.validate_procedure_data(proc_data)

                if val_res["status"] == "FAILED":
                    logger.error(f"VALIDATION FAILED — {filename}: {val_res['issues']}")
                    if not args.force_load:
                        summary["skipped"] += 1
                        continue
                    else:
                        logger.warning("  --force-load: loading despite failure")

                if val_res["status"] == "WARNING":
                    logger.warning(f"VALIDATION WARNING — {filename}: {val_res['issues']}")
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
                f"eaip_scrapper.etl Summary — "
                f"Total: {summary['total']}, "
                f"Loaded: {summary['loaded']}, "
                f"Warned: {summary['warned']}, "
                f"Skipped: {summary['skipped']}, "
                f"Failed: {summary['failed']}"
            )

    except Exception as e:
        logger.exception(f"eaip_scrapper.etl Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
