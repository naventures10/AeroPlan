# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# Backend Database URL Secret
resource "google_secret_manager_secret" "database_url" {
  secret_id = "backend-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "database_url_version" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.database_url
}

# Martin Database URL Secret
resource "google_secret_manager_secret" "martin_database_url" {
  secret_id = "martin-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "martin_database_url_version" {
  secret      = google_secret_manager_secret.martin_database_url.id
  secret_data = var.martin_database_url
}

# Frontend MapTiler Key Secret
resource "google_secret_manager_secret" "vite_maptiler_key" {
  secret_id = "vite-maptiler-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "vite_maptiler_key_version" {
  secret      = google_secret_manager_secret.vite_maptiler_key.id
  secret_data = var.vite_maptiler_key
}

# Grant the Github Actions SA access to read the secrets (since it runs the Cloud Run services)
resource "google_secret_manager_secret_iam_member" "sa_secret_access_db" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_secret_access_martin" {
  secret_id = google_secret_manager_secret.martin_database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_secret_access_maptiler" {
  secret_id = google_secret_manager_secret.vite_maptiler_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

# Database VM Password Secret
resource "google_secret_manager_secret" "db_password" {
  secret_id = "eaip-db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "db_password_version" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}

# Grant default compute service account access to the database password secret
resource "google_secret_manager_secret_iam_member" "compute_sa_secret_access_db" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Grant GitHub Actions service account access to the database password secret
resource "google_secret_manager_secret_iam_member" "sa_secret_access_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}


# Faro URL Secret
resource "google_secret_manager_secret" "vite_faro_url" {
  secret_id = "vite-faro-url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "vite_faro_url_version" {
  secret      = google_secret_manager_secret.vite_faro_url.id
  secret_data = var.vite_faro_url
}

# OTEL Endpoint Secret
resource "google_secret_manager_secret" "otel_endpoint" {
  secret_id = "otel-endpoint"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "otel_endpoint_version" {
  secret      = google_secret_manager_secret.otel_endpoint.id
  secret_data = var.otel_endpoint
}

# OTEL Headers Secret
resource "google_secret_manager_secret" "otel_headers" {
  secret_id = "otel-headers"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "otel_headers_version" {
  secret      = google_secret_manager_secret.otel_headers.id
  secret_data = var.otel_headers
}

# Grant GitHub Actions Service Account access to read Faro & OTEL secrets
resource "google_secret_manager_secret_iam_member" "sa_secret_access_faro" {
  secret_id = google_secret_manager_secret.vite_faro_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_secret_access_otel_endpoint" {
  secret_id = google_secret_manager_secret.otel_endpoint.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_secret_access_otel_headers" {
  secret_id = google_secret_manager_secret.otel_headers.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions_sa.email}"
}


