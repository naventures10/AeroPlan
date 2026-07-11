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



# IAM Role Bindings for Storage Service Account
resource "google_project_iam_member" "storage_sa_object_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.storage_sa.email}"
}

resource "google_project_iam_member" "storage_sa_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.storage_sa.email}"
}

# IAM Role Bindings for GitHub Actions Service Account
resource "google_project_iam_member" "github_sa_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_project_iam_member" "github_sa_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_project_iam_member" "github_sa_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_project_iam_member" "github_sa_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_project_iam_member" "github_sa_scheduler_admin" {
  project = var.project_id
  role    = "roles/cloudscheduler.admin"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

