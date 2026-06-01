#!/bin/bash
# deploy_weather_job.sh — Build, push, and schedule the weather pipeline Cloud Run Job.
# Idempotent: safe to re-run. Uses --update-if-exists for scheduler.
#
# Usage:
#   ./scripts/deploy_weather_job.sh

set -e

PROJECT_ID="project-d5038013-e773-4f0b-98a"
REGION="us-central1"
REPO_NAME="eaip-repo"
IMAGE_NAME="weather-pipeline"
JOB_NAME="weather-pipeline"
SCHEDULER_NAME="weather-pipeline-schedule"
SERVICE_ACCOUNT="eaip-storage-sa@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="eaip-staging-data-${PROJECT_ID}"

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest"

echo "=== Weather Pipeline — Cloud Run Job Deployment ==="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Image:    ${IMAGE_URI}"
echo "SA:       ${SERVICE_ACCOUNT}"
echo "Bucket:   ${BUCKET_NAME}"
echo ""

# ── 1. Enable required APIs ──────────────────────────────────────────────────
echo "[1/5] Enabling Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com --project="${PROJECT_ID}"

# ── 2. Build and push the Docker image ───────────────────────────────────────
echo "[2/5] Building and pushing Docker image..."
CLOUDBUILD_CONFIG=$(mktemp /tmp/cloudbuild-XXXXXX.yaml)
cat > "${CLOUDBUILD_CONFIG}" <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.weather', '-t', '${IMAGE_URI}', '.']
images:
  - '${IMAGE_URI}'
EOF

gcloud builds submit ./backend \
    --project="${PROJECT_ID}" \
    --config="${CLOUDBUILD_CONFIG}" \
    --timeout=600

rm -f "${CLOUDBUILD_CONFIG}"

# ── 3. Create or update the Cloud Run Job ────────────────────────────────────
echo "[3/5] Creating/updating Cloud Run Job..."
if gcloud run jobs describe "${JOB_NAME}" --region="${REGION}" --project="${PROJECT_ID}" > /dev/null 2>&1; then
    echo "Job exists — updating..."
    gcloud run jobs update "${JOB_NAME}" \
        --region="${REGION}" \
        --project="${PROJECT_ID}" \
        --image="${IMAGE_URI}" \
        --service-account="${SERVICE_ACCOUNT}" \
        --set-env-vars="ENVIRONMENT=staging,MINIO_BUCKET=${BUCKET_NAME}" \
        --memory=8Gi \
        --cpu=4 \
        --task-timeout=20m \
        --max-retries=2
else
    echo "Creating new job..."
    gcloud run jobs create "${JOB_NAME}" \
        --region="${REGION}" \
        --project="${PROJECT_ID}" \
        --image="${IMAGE_URI}" \
        --service-account="${SERVICE_ACCOUNT}" \
        --set-env-vars="ENVIRONMENT=staging,MINIO_BUCKET=${BUCKET_NAME}" \
        --memory=8Gi \
        --cpu=4 \
        --task-timeout=20m \
        --max-retries=2
fi

# ── 4. Grant Cloud Scheduler permission to invoke the job ────────────────────
echo "[4/5] Granting run.invoker to ${SERVICE_ACCOUNT}..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/run.invoker" \
    --condition=None

# ── 5. Create or update Cloud Scheduler ──────────────────────────────────────
echo "[5/5] Creating/updating Cloud Scheduler job..."
SCHEDULER_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run"

if gcloud scheduler jobs describe "${SCHEDULER_NAME}" --location="${REGION}" --project="${PROJECT_ID}" > /dev/null 2>&1; then
    echo "Scheduler exists — updating..."
    gcloud scheduler jobs update http "${SCHEDULER_NAME}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="0 */6 * * *" \
        --time-zone="UTC" \
        --uri="${SCHEDULER_URI}" \
        --http-method=POST \
        --oauth-service-account-email="${SERVICE_ACCOUNT}"
else
    echo "Creating new scheduler..."
    gcloud scheduler jobs create http "${SCHEDULER_NAME}" \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="0 */6 * * *" \
        --time-zone="UTC" \
        --uri="${SCHEDULER_URI}" \
        --http-method=POST \
        --oauth-service-account-email="${SERVICE_ACCOUNT}"
fi

echo ""
echo "============================================================"
echo "✅ Weather Pipeline Deployed!"
echo ""
echo "Schedule:  Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)"
echo "Manual:    gcloud run jobs execute ${JOB_NAME} --region ${REGION}"
echo "Logs:      gcloud run jobs executions list --job ${JOB_NAME} --region ${REGION}"
echo "============================================================"
