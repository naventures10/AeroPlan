#!/bin/bash
set -e

# Change directory to the workspace root to ensure relative paths resolve correctly
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOFU_DIR="$WORKSPACE_ROOT/infra/tofu"

echo "=== Starting Cloud Infrastructure Setup ==="

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

# 1. Prompt for required secrets if not present in environment
if [ -z "$DB_PASSWORD" ]; then
    read -sp "🔑 Enter password for PostgreSQL and Redis: " DB_PASSWORD
    echo ""
    if [ -z "$DB_PASSWORD" ]; then
        echo "ERROR: DB_PASSWORD cannot be empty." >&2
        exit 1
    fi
fi
export DB_PASSWORD

if [ -z "$VITE_MAPTILER_KEY" ]; then
    read -sp "🔑 Enter MapTiler API Key for Frontend: " VITE_MAPTILER_KEY
    echo ""
    if [ -z "$VITE_MAPTILER_KEY" ]; then
        echo "ERROR: VITE_MAPTILER_KEY cannot be empty." >&2
        exit 1
    fi
fi
export VITE_MAPTILER_KEY

# 2. Run Base GCP Resource Provisioning
echo "🚀 Running base GCP provisioning script..."
bash "$SCRIPT_DIR/gcp_provision.sh"

# 3. Fetch Database VM Private IP
echo "📡 Fetching database VM private IP address..."
DB_VM_IP=""
for i in {1..10}; do
    DB_VM_IP=$(gcloud compute instances describe eaip-db-vm \
        --project="project-d5038013-e773-4f0b-98a" \
        --zone="us-central1-a" \
        --format='value(networkInterfaces[0].networkIP)' 2>/dev/null || echo "")
    if [ -n "$DB_VM_IP" ]; then
        break
    fi
    echo "⏳ Waiting for VM network interface to populate..."
    sleep 3
done

if [ -z "$DB_VM_IP" ]; then
    echo "ERROR: Could not retrieve database VM private IP." >&2
    exit 1
fi
echo "✅ Database VM Private IP: $DB_VM_IP"

# 4. Prepare OpenTofu input variables
export TF_VAR_project_id="project-d5038013-e773-4f0b-98a"
export TF_VAR_region="us-central1"
export TF_VAR_database_url="postgresql+asyncpg://postgres:${DB_PASSWORD}@${DB_VM_IP}:5432/aeronautical_information_system"
export TF_VAR_martin_database_url="postgres://postgres:${DB_PASSWORD}@${DB_VM_IP}:5432/aeronautical_information_system"
export TF_VAR_vite_maptiler_key="${VITE_MAPTILER_KEY}"
export TF_VAR_redis_host="${DB_VM_IP}"

# 5. Initialize and run OpenTofu
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

echo "Applying OpenTofu configuration..."
(
    cd "$TOFU_DIR"
    tofu apply -auto-approve
)

echo "=== Cloud Infrastructure Setup Completed Successfully ==="
