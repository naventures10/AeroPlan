variable "project_id" {
  description = "The GCP Project ID"
  type        = string
  default     = "project-d5038013-e773-4f0b-98a"
}

variable "region" {
  description = "The GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (e.g. staging, prod)"
  type        = string
  default     = "staging"
}

variable "redis_host" {
  description = "The Redis host IP address"
  type        = string
  default     = "localhost"
}

variable "github_repo" {
  description = "The GitHub repository to bind to Workload Identity (format: owner/repo)"
  type        = string
  default     = "naventures10/AeroPlan"
}

variable "db_password" {
  description = "The PostgreSQL/Redis database password"
  type        = string
  sensitive   = true
}

variable "backend_image" {
  description = "The Docker image for the backend service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  description = "The Docker image for the frontend service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "martin_image" {
  description = "The Docker image for Martin tile server"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "weather_pipeline_image" {
  description = "The Docker image for the weather pipeline job"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}


