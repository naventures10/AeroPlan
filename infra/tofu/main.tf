# ------------------------------------------------------------------------------
# Phase 1: Foundational Resources
# ------------------------------------------------------------------------------

# Artifact Registry Repository
resource "google_artifact_registry_repository" "eaip_repo" {
  location      = var.region
  repository_id = "eaip-repo"
  description   = "Docker repository for eAIP services"
  format        = "DOCKER"
}

# GCS Data Bucket (Already exists, we are managing it with OpenTofu)
resource "google_storage_bucket" "staging_data" {
  name          = "eaip-staging-data-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true
}

# Service Accounts
resource "google_service_account" "storage_sa" {
  account_id   = "eaip-storage-sa"
  display_name = "eAIP Storage Account"
}

resource "google_service_account" "github_actions_sa" {
  account_id   = "eaip-github-actions"
  display_name = "eAIP GitHub Actions"
}
