#!/bin/bash
set -e

# Change directory to the workspace root to ensure relative paths resolve correctly
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOFU_DIR="$WORKSPACE_ROOT/infra/tofu"

echo "=== Starting Cloud Infrastructure Setup (OpenTofu) ==="

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

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "ERROR: Could not retrieve active GCP project ID." >&2
    exit 1
fi


# Load secrets from local .env files if present and not already in environment
if [ -z "$DB_PASSWORD" ] && [ -f "$WORKSPACE_ROOT/backend/.env" ]; then
    DB_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$WORKSPACE_ROOT/backend/.env" | cut -d'=' -f2-)
    if [ -n "$DB_PASSWORD" ]; then
        echo "✅ Loaded DB_PASSWORD from backend/.env"
    fi
fi

if [ -z "$VITE_MAPTILER_KEY" ] && [ -f "$WORKSPACE_ROOT/frontend/.env" ]; then
    VITE_MAPTILER_KEY=$(grep "^VITE_MAPTILER_KEY=" "$WORKSPACE_ROOT/frontend/.env" | cut -d'=' -f2-)
    if [ -n "$VITE_MAPTILER_KEY" ]; then
        echo "✅ Loaded VITE_MAPTILER_KEY from frontend/.env"
    fi
fi

if [ -z "$VITE_FARO_URL" ] && [ -f "$WORKSPACE_ROOT/frontend/.env" ]; then
    VITE_FARO_URL=$(grep "^VITE_FARO_URL=" "$WORKSPACE_ROOT/frontend/.env" | cut -d'=' -f2-)
    if [ -n "$VITE_FARO_URL" ]; then
        echo "✅ Loaded VITE_FARO_URL from frontend/.env"
    fi
fi

if [ -z "$VITE_LOCK_AIP_SUPPLEMENTS" ] && [ -f "$WORKSPACE_ROOT/frontend/.env" ]; then
    VITE_LOCK_AIP_SUPPLEMENTS=$(grep "^VITE_LOCK_AIP_SUPPLEMENTS=" "$WORKSPACE_ROOT/frontend/.env" | cut -d'=' -f2-)
    if [ -n "$VITE_LOCK_AIP_SUPPLEMENTS" ]; then
        echo "✅ Loaded VITE_LOCK_AIP_SUPPLEMENTS from frontend/.env"
    fi
fi

if [ -z "$VITE_LOCK_AERODROME_CHARTS" ] && [ -f "$WORKSPACE_ROOT/frontend/.env" ]; then
    VITE_LOCK_AERODROME_CHARTS=$(grep "^VITE_LOCK_AERODROME_CHARTS=" "$WORKSPACE_ROOT/frontend/.env" | cut -d'=' -f2-)
    if [ -n "$VITE_LOCK_AERODROME_CHARTS" ]; then
        echo "✅ Loaded VITE_LOCK_AERODROME_CHARTS from frontend/.env"
    fi
fi


if [ -f "$WORKSPACE_ROOT/monitoring/.env" ]; then
    GRAFANA_USER=$(grep "^GRAFANA_CLOUD_OTLP_USER=" "$WORKSPACE_ROOT/monitoring/.env" | cut -d'=' -f2-)
    GRAFANA_KEY=$(grep "^GRAFANA_CLOUD_API_KEY=" "$WORKSPACE_ROOT/monitoring/.env" | cut -d'=' -f2-)
    if [ -n "$GRAFANA_USER" ] && [ -n "$GRAFANA_KEY" ]; then
        OTEL_HEADERS="Authorization=Basic $(echo -n "${GRAFANA_USER}:${GRAFANA_KEY}" | base64 | tr -d '\n')"
        echo "✅ Loaded OTEL_HEADERS from monitoring/.env"
    fi
    OTEL_ENDPOINT=$(grep "^GRAFANA_CLOUD_OTLP_ENDPOINT=" "$WORKSPACE_ROOT/monitoring/.env" | cut -d'=' -f2-)
    if [ -n "$OTEL_ENDPOINT" ]; then
        echo "✅ Loaded OTEL_ENDPOINT from monitoring/.env"
    fi
fi

# Fallback prompts if secrets are still empty
if [ -z "$DB_PASSWORD" ]; then
    read -sp "🔑 Enter password for PostgreSQL and Redis: " DB_PASSWORD
    echo ""
    if [ -z "$DB_PASSWORD" ]; then
        echo "ERROR: DB_PASSWORD cannot be empty." >&2
        exit 1
    fi
fi

if [ -z "$VITE_MAPTILER_KEY" ]; then
    read -sp "🔑 Enter MapTiler API Key for Frontend: " VITE_MAPTILER_KEY
    echo ""
    if [ -z "$VITE_MAPTILER_KEY" ]; then
        echo "ERROR: VITE_MAPTILER_KEY cannot be empty." >&2
        exit 1
    fi
fi

# Retrieve Google access token for OpenTofu state backend
echo "Retrieving Google access token..."
export GOOGLE_OAUTH_ACCESS_TOKEN
if ! GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null) || [ -z "$GOOGLE_OAUTH_ACCESS_TOKEN" ]; then
    echo "ERROR: Failed to retrieve active access token from gcloud." >&2
    exit 1
fi

echo "Initializing OpenTofu backend..."
(
    cd "$TOFU_DIR"
    tofu init -reconfigure -backend-config="access_token=${GOOGLE_OAUTH_ACCESS_TOKEN}" >/dev/null
)

# Self-healing Workload Identity Pool check and import
echo "Validating Workload Identity Pool status..."
POOL_STATE=$(gcloud iam workload-identity-pools describe github-actions-pool --location=global --project="${PROJECT_ID}" --format="value(state)" 2>/dev/null || echo "NOT_FOUND")

if [ "$POOL_STATE" = "DELETED" ]; then
    echo "Workload Identity Pool is soft-deleted. Undeleting..."
    gcloud iam workload-identity-pools undelete github-actions-pool --location=global --project="${PROJECT_ID}" >/dev/null
    POOL_STATE="ACTIVE"
fi

if [ "$POOL_STATE" = "ACTIVE" ]; then
    if ! (cd "$TOFU_DIR" && tofu state show google_iam_workload_identity_pool.github_pool >/dev/null 2>&1); then
        echo "Workload Identity Pool exists in GCP but not in OpenTofu state. Importing..."
        (
            cd "$TOFU_DIR"
            tofu import -var="db_password=${DB_PASSWORD}" \
                -var="vite_maptiler_key=${VITE_MAPTILER_KEY}" \
                -var="vite_faro_url=${VITE_FARO_URL}" \
                -var="otel_endpoint=${OTEL_ENDPOINT}" \
                -var="otel_headers=${OTEL_HEADERS}" \
                -var="vite_lock_aip_supplements=${VITE_LOCK_AIP_SUPPLEMENTS}" \
                -var="vite_lock_aerodrome_charts=${VITE_LOCK_AERODROME_CHARTS}" \
                google_iam_workload_identity_pool.github_pool \
                projects/${PROJECT_ID}/locations/global/workloadIdentityPools/github-actions-pool
        )
    fi

    # Do the same for the Workload Identity Provider
    PROVIDER_STATE=$(gcloud iam workload-identity-pools providers describe github-actions-provider --workload-identity-pool=github-actions-pool --location=global --project="${PROJECT_ID}" --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
    if [ "$PROVIDER_STATE" = "DELETED" ]; then
        echo "Workload Identity Provider is soft-deleted. Undeleting..."
        gcloud iam workload-identity-pools providers undelete github-actions-provider --workload-identity-pool=github-actions-pool --location=global --project="${PROJECT_ID}" >/dev/null
        PROVIDER_STATE="ACTIVE"
    fi

    if [ "$PROVIDER_STATE" = "ACTIVE" ]; then
        if ! (cd "$TOFU_DIR" && tofu state show google_iam_workload_identity_pool_provider.github_provider >/dev/null 2>&1); then
            echo "Workload Identity Provider exists in GCP but not in OpenTofu state. Importing..."
            (
                cd "$TOFU_DIR"
                tofu import -var="db_password=${DB_PASSWORD}" \
                    -var="vite_maptiler_key=${VITE_MAPTILER_KEY}" \
                    -var="vite_faro_url=${VITE_FARO_URL}" \
                    -var="otel_endpoint=${OTEL_ENDPOINT}" \
                    -var="otel_headers=${OTEL_HEADERS}" \
                    -var="vite_lock_aip_supplements=${VITE_LOCK_AIP_SUPPLEMENTS}" \
                    -var="vite_lock_aerodrome_charts=${VITE_LOCK_AERODROME_CHARTS}" \
                    google_iam_workload_identity_pool_provider.github_provider \
                    projects/${PROJECT_ID}/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
            )
        fi
    fi
fi


echo "Applying OpenTofu configuration..."

(
    cd "$TOFU_DIR"
    tofu apply -auto-approve \
        -replace=terraform_data.upload_martin_yaml \
        -var="db_password=${DB_PASSWORD}" \
        -var="vite_maptiler_key=${VITE_MAPTILER_KEY}" \
        -var="vite_faro_url=${VITE_FARO_URL}" \
        -var="otel_endpoint=${OTEL_ENDPOINT}" \
        -var="otel_headers=${OTEL_HEADERS}" \
        -var="vite_lock_aip_supplements=${VITE_LOCK_AIP_SUPPLEMENTS}" \
        -var="vite_lock_aerodrome_charts=${VITE_LOCK_AERODROME_CHARTS}"
)


# Fetch Database VM Private IP from OpenTofu output
echo "📡 Fetching database VM private IP address from OpenTofu..."
DB_VM_IP=$(cd "$TOFU_DIR" && tofu output -raw db_vm_ip)

if [ -z "$DB_VM_IP" ]; then
    echo "ERROR: Could not retrieve database VM private IP from OpenTofu outputs." >&2
    exit 1
fi

echo "✅ Database VM Private IP: $DB_VM_IP"
echo "=== Cloud Infrastructure Setup Completed Successfully ==="
