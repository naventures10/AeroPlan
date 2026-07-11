#!/bin/bash
set -e

# Change directory to the workspace root to ensure relative paths resolve correctly
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOFU_DIR="$WORKSPACE_ROOT/infra/tofu"

echo "=== Starting Cloud Infrastructure Teardown (OpenTofu) ==="

# Check if tofu directory exists
if [ ! -d "$TOFU_DIR" ]; then
    echo "ERROR: OpenTofu directory not found at $TOFU_DIR" >&2
    exit 1
fi

echo "Checking gcloud authentication..."
if ! ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null) || [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "ERROR: No active gcloud account found. Please run 'gcloud auth login' or ensure you are authenticated." >&2
    exit 1
fi
echo "Authenticated as: $ACTIVE_ACCOUNT"

echo "Retrieving Google access token..."
export GOOGLE_OAUTH_ACCESS_TOKEN
if ! GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null) || [ -z "$GOOGLE_OAUTH_ACCESS_TOKEN" ]; then
    echo "ERROR: Failed to retrieve active access token from gcloud." >&2
    exit 1
fi

echo "Retrieving GCP project ID from variables..."
if ! PROJECT_ID=$(cd "$TOFU_DIR" && tofu console <<< "var.project_id" 2>/dev/null | tr -d '"') || [ -z "$PROJECT_ID" ]; then
    echo "WARNING: Could not retrieve project ID using tofu console. Falling back to gcloud active project..."
    if ! PROJECT_ID=$(gcloud config get-value project 2>/dev/null) || [ -z "$PROJECT_ID" ]; then
        echo "ERROR: Could not retrieve GCP project ID." >&2
        exit 1
    fi
fi
echo "Active Project ID: $PROJECT_ID"

STAGING_BUCKET="eaip-staging-data-$PROJECT_ID"

echo "Checking GCS staging bucket: gs://$STAGING_BUCKET..."
if gcloud storage buckets describe "gs://$STAGING_BUCKET" >/dev/null 2>&1; then
    echo "Emptying staging GCS bucket: gs://$STAGING_BUCKET..."
    gcloud storage rm --recursive "gs://$STAGING_BUCKET/**" >/dev/null 2>&1 || true
    echo "Staging bucket cleaned."
else
    echo "Staging bucket gs://$STAGING_BUCKET does not exist (or has already been deleted)."
fi

echo "Initializing OpenTofu backend..."
(
    cd "$TOFU_DIR"
    tofu init -reconfigure -backend-config="access_token=${GOOGLE_OAUTH_ACCESS_TOKEN}" >/dev/null
)

echo "Destroying infrastructure via OpenTofu..."
(
    cd "$TOFU_DIR"
    # Provide dummy password and secrets as they are required by variables but not used during destroy
    tofu destroy -auto-approve \
        -var="db_password=dummy_to_destroy" \
        -var="vite_maptiler_key=dummy_to_destroy" \
        -var="vite_faro_url=dummy_to_destroy" \
        -var="otel_endpoint=dummy_to_destroy" \
        -var="otel_headers=dummy_to_destroy"

)

echo "=== Teardown Completed Successfully ==="
