#!/bin/zsh

# Wrapper script to run the weather pipeline with correct environment
# Used by crontab

# Set path to the script's directory
SCRIPT_DIR=$(dirname "$0")
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
LOG_DIR="$BACKEND_DIR/logs"
LOG_FILE="$LOG_DIR/weather_pipeline.log"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# Navigate to backend directory
cd "$BACKEND_DIR"

echo "[$(date)] Starting weather pipeline..." >> "$LOG_FILE"

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Cron/launchd often start with a minimal PATH that excludes Homebrew.
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/naveendevapalan/.local/bin:$PATH"

# Run the pipeline using uv
# We use the full path to uv if needed, or assume it's in the PATH
/Users/naveendevapalan/.local/bin/uv run python -m app.services.weather_pipeline >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date)] Weather pipeline completed successfully." >> "$LOG_FILE"
else
  echo "[$(date)] Weather pipeline failed with exit code $EXIT_CODE." >> "$LOG_FILE"
fi

echo "------------------------------------------------" >> "$LOG_FILE"
