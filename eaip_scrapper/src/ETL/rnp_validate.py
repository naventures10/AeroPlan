import argparse
import sys
import logging
import json
from pathlib import Path

# Add src to path for absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR / "src"))

from rnp_processor.utils import setup_logging, MERGED_DIR
from rnp_processor.transformer import RNPTransformer
from rnp_processor.validator import RNPValidator

def main():
    parser = argparse.ArgumentParser(description="Unified RNP Validation Tool")
    parser.add_argument("--stage", choices=["markdown", "json", "db"], default="markdown",
                        help="Validation stage to run (default: markdown)")
    args = parser.parse_args()

    logger = setup_logging()
    logger.info(f"Starting RNP Validation [Stage: {args.stage}]")

    transformer = RNPTransformer()
    validator = RNPValidator()

    if args.stage == "markdown":
        # Check merged markdown files for consistency
        files = list(MERGED_DIR.glob("*.md"))
        logger.info(f"Auditing {len(files)} markdown files...")
        passed = 0
        for f in files:
            proc_data = transformer.parse_file(f)
            res = validator.validate_procedure_data(proc_data)
            if res["success"]:
                passed += 1
            else:
                logger.warning(f"  FAILED: {f.name} - {res['issues']}")
        
        logger.info(f"Audit Complete: {passed}/{len(files)} passed.")

    elif args.stage == "json":
        # Placeholder for existing output.json validation
        logger.info("JSON stage validation triggered (Audit of output.json)...")
        pass

if __name__ == "__main__":
    main()
