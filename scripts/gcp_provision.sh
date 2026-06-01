#!/bin/bash
set -e

PROJECT_ID="project-d5038013-e773-4f0b-98a"
REGION="us-central1"
ZONE="us-central1-a"

echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

echo "Enabling necessary APIs (this might take a minute)..."
gcloud services enable \
    compute.googleapis.com \
    run.googleapis.com \
    storage-api.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com

# 1. GCS Bucket
BUCKET_NAME="eaip-staging-data-$PROJECT_ID"
echo "Creating GCS Bucket: $BUCKET_NAME..."
if ! gcloud storage ls "gs://$BUCKET_NAME" > /dev/null 2>&1; then
    gcloud storage buckets create "gs://$BUCKET_NAME" --location=$REGION
else
    echo "Bucket gs://$BUCKET_NAME already exists."
fi

# Service Account for GCS HMAC Keys
HMAC_SA="eaip-storage-sa"
HMAC_SA_EMAIL="$HMAC_SA@$PROJECT_ID.iam.gserviceaccount.com"
echo "Setting up Storage Service Account..."
if ! gcloud iam service-accounts describe $HMAC_SA_EMAIL > /dev/null 2>&1; then
    gcloud iam service-accounts create $HMAC_SA --display-name="eAIP Storage Account"
    # Wait for IAM propagation
    sleep 5
fi

# Add role (outside the if block in case it failed previously)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$HMAC_SA_EMAIL" \
    --role="roles/storage.objectAdmin" --condition=None

echo "Checking existing HMAC Keys for $HMAC_SA_EMAIL..."
EXISTING_KEYS=$(gcloud storage hmac list --service-account=$HMAC_SA_EMAIL --project=$PROJECT_ID --format="value(accessId)" 2>/dev/null || true)
if [ -n "$EXISTING_KEYS" ]; then
    echo "HMAC key already exists for $HMAC_SA_EMAIL."
else
    echo "Generating new GCS HMAC Key..."
    if ! HMAC_OUTPUT=$(gcloud storage hmac create $HMAC_SA_EMAIL --project=$PROJECT_ID 2>&1); then
        echo "ERROR: Failed to create HMAC key for service account $HMAC_SA_EMAIL. Output:" >&2
        echo "$HMAC_OUTPUT" >&2
        echo "WARNING: Continuing despite HMAC key failure (often blocked by org policy)."
        # exit 1
    else
        echo "HMAC Key created successfully:"
        echo "$HMAC_OUTPUT"
    fi
fi

# 2. Artifact Registry
REPO_NAME="eaip-repo"
echo "Creating Artifact Registry..."
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION > /dev/null 2>&1; then
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="eAIP Docker repository"
fi

# 3. Compute Engine VM (Database)
VM_NAME="eaip-db-vm"
echo "Creating Database VM..."

# Require DB_PASSWORD to be set explicitly — no weak defaults
if [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: DB_PASSWORD environment variable must be set." >&2
    exit 1
fi

# Store password in Secret Manager
SECRET_NAME="eaip-db-password"
echo "Storing DB password in Secret Manager..."
if ! gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID > /dev/null 2>&1; then
    gcloud secrets create $SECRET_NAME \
        --replication-policy="automatic" \
        --project=$PROJECT_ID
fi
# Only add a new version if the secret value has changed
CURRENT_SECRET=$(gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT_ID 2>/dev/null || echo "")
if [ "$CURRENT_SECRET" != "$DB_PASSWORD" ]; then
    echo "Updating secret $SECRET_NAME in Secret Manager..."
    echo -n "$DB_PASSWORD" | gcloud secrets versions add $SECRET_NAME \
        --data-file=- \
        --project=$PROJECT_ID
else
    echo "Secret $SECRET_NAME already has the correct value."
fi

# Cleanup: destroy all older enabled versions, retaining only the latest
LATEST_VERSION=$(gcloud secrets versions list "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --sort-by="~create-time" \
    --limit=1 \
    --format="value(name)" 2>/dev/null || echo "")

if [ -n "$LATEST_VERSION" ]; then
    echo "Retaining latest secret version: $LATEST_VERSION"
    gcloud secrets versions list "$SECRET_NAME" \
        --project="$PROJECT_ID" \
        --format="value(name)" \
        --filter="name != '$LATEST_VERSION' AND state=enabled" 2>/dev/null | while read -r ver; do
            if [ -n "$ver" ]; then
                echo "Destroying old secret version: $ver"
                gcloud secrets versions destroy "$ver" --quiet
            fi
        done
fi

# Grant the default compute SA permission to access the secret
COMPUTE_SA=$(gcloud iam service-accounts list \
    --project=$PROJECT_ID \
    --filter="email~compute@developer.gserviceaccount.com" \
    --format="value(email)" | head -1)

if [ -n "$COMPUTE_SA" ]; then
    echo "Granting Secret Manager access to $COMPUTE_SA..."
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID --condition=None
fi

if ! gcloud compute instances describe $VM_NAME --zone=$ZONE > /dev/null 2>&1; then
    gcloud compute instances create $VM_NAME \
        --zone=$ZONE \
        --machine-type=e2-micro \
        --image-family=debian-12 \
        --image-project=debian-cloud \
        --boot-disk-size=30GB \
        --boot-disk-type=pd-standard \
        --tags=allow-postgres \
        --scopes=https://www.googleapis.com/auth/cloud-platform \
        --metadata=startup-script='#!/bin/bash
set -e

# Install Docker
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Fetch DB password from Secret Manager at runtime
DB_PASSWORD=$(gcloud secrets versions access latest --secret=eaip-db-password --project='"$PROJECT_ID"')

docker run -d --name eaip-postgres --restart unless-stopped \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB=aeronautical_information_system \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgis/postgis:15-3.4
'
fi

# VPC Firewall Rule
echo "Creating Firewall Rule for Postgres..."
if ! gcloud compute firewall-rules describe allow-postgres > /dev/null 2>&1; then
    gcloud compute firewall-rules create allow-postgres \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=tcp:5432 \
        --source-ranges=${POSTGRES_INGRESS_RANGE:-"10.0.0.0/8"} \
        --target-tags=allow-postgres
fi

# 4. Service Account for GitHub Actions
GH_SA="eaip-github-actions"
GH_SA_EMAIL="$GH_SA@$PROJECT_ID.iam.gserviceaccount.com"
echo "Setting up GitHub Actions Service Account..."
if ! gcloud iam service-accounts describe $GH_SA_EMAIL > /dev/null 2>&1; then
    gcloud iam service-accounts create $GH_SA --display-name="eAIP GitHub Actions"
    sleep 5
fi

echo "Adding roles to GitHub Actions SA..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$GH_SA_EMAIL" \
    --role="roles/artifactregistry.writer" --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$GH_SA_EMAIL" \
    --role="roles/run.admin" --condition=None
    
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$GH_SA_EMAIL" \
    --role="roles/iam.serviceAccountUser" --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$GH_SA_EMAIL" \
    --role="roles/storage.objectAdmin" --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$GH_SA_EMAIL" \
    --role="roles/cloudscheduler.admin" --condition=None

# Grant run.invoker to storage SA so Cloud Scheduler can trigger Cloud Run Jobs
STORAGE_SA_EMAIL="eaip-storage-sa@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$STORAGE_SA_EMAIL" \
    --role="roles/run.invoker" --condition=None

echo "Infrastructure Provisioning Script Complete!"
