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
