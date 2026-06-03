# Enable Cloud Run API
resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

# ------------------------------------------------------------------------------
# Backend Service
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "backend" {
  name     = "eaip-backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = 80
    timeout                          = "300s"
    service_account                  = google_service_account.github_actions_sa.email

    scaling {
      max_instance_count = 3
    }

    vpc_access {
      network_interfaces {
        network = "default"
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      # Use a placeholder image initially; Github Actions will deploy the real one.
      # We ignore changes to this field so Tofu doesn't overwrite new deployments.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "ENVIRONMENT"
        value = "staging"
      }

      env {
        name  = "STORAGE_PATH"
        value = "/mnt/gcs"
      }

      env {
        name  = "MINIO_BUCKET"
        value = google_storage_bucket.staging_data.name
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "gcs-volume"
        mount_path = "/mnt/gcs"
      }
    }

    volumes {
      name = "gcs-volume"
      gcs {
        bucket    = google_storage_bucket.staging_data.name
        read_only = false
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }

  depends_on = [google_project_service.run]
}

# Make backend public
resource "google_cloud_run_service_iam_member" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  service  = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ------------------------------------------------------------------------------
# Frontend Service
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "frontend" {
  name     = "eaip-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    max_instance_request_concurrency = 80
    timeout                          = "300s"
    service_account                  = google_service_account.github_actions_sa.email

    scaling {
      max_instance_count = 3
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 8080
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }

  depends_on = [google_project_service.run]
}

# Make frontend public
resource "google_cloud_run_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  service  = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ------------------------------------------------------------------------------
# Martin Service
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "martin" {
  name     = "eaip-martin"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = 1000
    timeout                          = "300s"
    service_account                  = google_service_account.github_actions_sa.email

    scaling {
      max_instance_count = 10
    }

    vpc_access {
      network_interfaces {
        network = "default"
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      args  = ["--config", "/mnt/gcs/martin.yaml"]

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 3000
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.martin_database_url.secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "gcs-volume"
        mount_path = "/mnt/gcs"
      }
    }

    volumes {
      name = "gcs-volume"
      gcs {
        bucket    = google_storage_bucket.staging_data.name
        read_only = false
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }

  depends_on = [google_project_service.run]
}

# Make martin public
resource "google_cloud_run_service_iam_member" "martin_public" {
  location = google_cloud_run_v2_service.martin.location
  service  = google_cloud_run_v2_service.martin.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ------------------------------------------------------------------------------
# Weather Pipeline Job
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_job" "weather_pipeline" {
  name     = "weather-pipeline"
  location = var.region

  template {
    template {
      max_retries     = 2
      timeout         = "1200s" # 20m
      service_account = google_service_account.storage_sa.email

      containers {
        image = "us-docker.pkg.dev/cloudrun/container/hello"

        resources {
          limits = {
            cpu    = "4"
            memory = "8Gi"
          }
        }

        env {
          name  = "ENVIRONMENT"
          value = "staging"
        }

        env {
          name  = "MINIO_BUCKET"
          value = google_storage_bucket.staging_data.name
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image
    ]
  }

  depends_on = [google_project_service.run]
}
