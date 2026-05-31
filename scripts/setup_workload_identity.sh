#!/bin/bash
set -e

PROJECT_ID="project-d5038013-e773-4f0b-98a"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Validate PROJECT_NUMBER is non-empty
if [ -z "$PROJECT_NUMBER" ]; then
    echo "ERROR: Failed to retrieve PROJECT_NUMBER for project '$PROJECT_ID'." >&2
    exit 1
fi

POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-actions-provider"
GH_SA_EMAIL="eaip-github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
GITHUB_REPO="naventures10/AeroPlan" # REPLACE THIS with your actual github repo name if different! e.g., username/repo

echo "Creating Workload Identity Pool: $POOL_NAME..."
gcloud iam workload-identity-pools create $POOL_NAME \
    --project=$PROJECT_ID --location="global" \
    --display-name="GitHub Actions Pool" || true

echo "Creating Workload Identity Provider: $PROVIDER_NAME..."
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
    --project=$PROJECT_ID --location="global" --workload-identity-pool=$POOL_NAME \
    --display-name="GitHub Actions Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-condition="assertion.repository == '$GITHUB_REPO'" || true

echo "Binding Service Account to the GitHub Repository..."
gcloud iam service-accounts add-iam-policy-binding $GH_SA_EMAIL \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$GITHUB_REPO"

echo ""
echo "============================================================"
echo "Workload Identity Setup Complete!"
echo "Please update the WORKLOAD_IDENTITY_PROVIDER in your .github/workflows/deploy-staging.yml with the following value:"
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"
echo "============================================================"
