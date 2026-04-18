import argparse
import sys
import logging
from pathlib import Path

# Add src to path for absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR / "src"))

from rnp_processor.utils import setup_logging, SCRATCH_DIR, MERGED_DIR
from rnp_processor.extractor import RNPExtractor
from rnp_processor.transformer import RNPTransformer
from rnp_processor.loader import RNPLoader
from rnp_processor.validator import RNPValidator

def main():
    parser = argparse.ArgumentParser(description="Unified RNP ETL Pipeline")
    parser.add_argument("--step", choices=["extract", "merge", "parse", "load", "all"], default="all",
                        help="Etl step to run (default: all)")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
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
        # 1. Extraction (Optional/Manual for now to save API credits unless requested)
        if args.step in ("extract", "all"):
            # Note: Full extraction is long, usually run as-needed
            # For this unification, we assume extraction is handled by dedicated command or run subset
            logger.info("Extraction step triggered (LlamaCloud/Mistral)...")
            # extractor = RNPExtractor()
            # ... logic to trigger extraction ...
            pass

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
            merged_files = list(MERGED_DIR.glob("*.md"))
            logger.info(f"Processing {len(merged_files)} merged files...")
            
            summary = {"total": 0, "loaded": 0, "failed": 0}
            
            for f in merged_files:
                summary["total"] += 1
                proc_data = transformer.parse_file(f)
                
                # Validation
                val_res = validator.validate_procedure_data(proc_data)
                if val_res["status"] == "FAILED":
                    logger.warning(f"Validation FAILED for {f.name}: {val_res['issues']}")
                
                # Load
                if args.step in ("load", "all"):
                    if loader.load_procedure(proc_data):
                        summary["loaded"] += 1
                    else:
                        summary["failed"] += 1
            
            logger.info(f"ETL Summary: Total={summary['total']}, Loaded={summary['loaded']}, Failed={summary['failed']}")

    except Exception as e:
        logger.exception(f"ETL Pipeline failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
