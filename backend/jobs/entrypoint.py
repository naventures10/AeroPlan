"""
Combined Entrypoint for Cloud Run Jobs.
Runs the AIP Supplements Scrapper and then the Weather ETL Pipeline sequentially.
"""

import logging
import sys

from jobs.aip_supplements_scrapper import run_scraper as run_aip_scraper
from jobs.etl_weather import run_pipeline as run_weather_pipeline

# Configure logging for the entrypoint
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    logger.info("Starting combined Cloud Run Jobs...")

    # 1. Run AIP Supplements Scrapper
    logger.info("--- Phase 1: AIP Supplements Scrapper ---")
    aip_success = run_aip_scraper()
    if not aip_success:
        logger.error("AIP Supplements Scrapper encountered an error or failed.")
    else:
        logger.info("AIP Supplements Scrapper completed successfully.")

    # 2. Run Weather ETL Pipeline
    logger.info("--- Phase 2: Weather ETL Pipeline ---")
    weather_success = run_weather_pipeline()
    if not weather_success:
        logger.error("Weather ETL Pipeline encountered an error or failed.")
    else:
        logger.info("Weather ETL Pipeline completed successfully.")

    # Exit with failure if either failed, so the job status reflects it
    if not aip_success or not weather_success:
        logger.error("One or more jobs failed.")
        sys.exit(1)

    logger.info("All jobs completed successfully.")
    sys.exit(0)


if __name__ == "__main__":
    main()
