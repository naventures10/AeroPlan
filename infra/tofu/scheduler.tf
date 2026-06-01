# Enable Cloud Scheduler API
resource "google_project_service" "scheduler" {
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

resource "google_cloud_scheduler_job" "weather_pipeline_schedule" {
  name        = "weather-pipeline-schedule"
  description = "Triggers the weather pipeline every 6 hours"
  schedule    = "0 */6 * * *"
  time_zone   = "UTC"
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.weather_pipeline.name}:run"

    oauth_token {
      service_account_email = google_service_account.storage_sa.email
    }
  }

  depends_on = [google_project_service.scheduler]
}
