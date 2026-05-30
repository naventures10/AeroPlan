#!/bin/zsh

# Wrapper script to run the weather pipeline with correct environment
# Used by launchd agent
#
# The weather pipeline now lives in the eaip_scrapper project and uploads
# data to MinIO instead of the frontend public folder.

# Set path to the script's directory
SCRIPT_DIR=$(dirname "$0")
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
SCRAPPER_DIR="$ROOT_DIR/eaip_scrapper"
LOG_DIR="$SCRAPPER_DIR/logs"
LOG_FILE="$LOG_DIR/weather_pipeline.log"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# Navigate to scrapper directory
cd "$SCRAPPER_DIR"

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Cron/launchd often start with a minimal PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

function check_network() {
  # Try to ping a reliable host to ensure network is up (especially after system wake)
  ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1
  return $?
}

function run_with_retry() {
  local max_attempts=3
  local attempt=1
  local wait_time=60

  while [[ $attempt -le $max_attempts ]]; do
    echo "[$(date)] Starting weather pipeline (Attempt $attempt/$max_attempts)..." >> "$LOG_FILE"
    
    # Cleanup any stale pipeline processes from previous runs
    STALE_PIDS=$(pgrep -f "eaip_scrapper.etl.etl_weather" | grep -v $$)
    if [ -n "$STALE_PIDS" ]; then
      echo "[$(date)] Found stale weather pipeline processes. Cleaning up..." >> "$LOG_FILE"
      pkill -f "eaip_scrapper.etl.etl_weather"
      sleep 2
    fi

    # Wait for network if needed
    if ! check_network; then
      echo "[$(date)] Network not available. Waiting 30s..." >> "$LOG_FILE"
      sleep 30
      if ! check_network; then
        echo "[$(date)] Network still not available. Skipping attempt." >> "$LOG_FILE"
        ((attempt++))
        continue
      fi
    fi

    # Run the pipeline using uv with a 20-minute hard timeout
    echo "[$(date)] Running pipeline with 20m timeout..." >> "$LOG_FILE"
    python3 -c "
import subprocess, sys
try:
    subprocess.run(['uv', 'run', 'python', 'src/eaip_scrapper/etl/etl_weather.py'], timeout=1200, check=True)
except subprocess.TimeoutExpired:
    print('ERROR: Weather pipeline timed out after 20 minutes', file=sys.stderr)
    sys.exit(124)
except subprocess.CalledProcessError as e:
    sys.exit(e.returncode)
" >> "$LOG_FILE" 2>&1
    
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
      echo "[$(date)] Weather pipeline completed successfully." >> "$LOG_FILE"
      return 0
    elif [[ $exit_code -eq 124 ]]; then
      echo "[$(date)] Weather pipeline timed out." >> "$LOG_FILE"
    else
      echo "[$(date)] Weather pipeline failed with exit code $exit_code." >> "$LOG_FILE"
    fi

    if [[ $attempt -lt $max_attempts ]]; then
      echo "[$(date)] Retrying in $wait_time seconds..." >> "$LOG_FILE"
      sleep $wait_time
    fi
    ((attempt++))
  done

  return 1
}

run_with_retry
EXIT_CODE=$?

echo "------------------------------------------------" >> "$LOG_FILE"
exit $EXIT_CODE
