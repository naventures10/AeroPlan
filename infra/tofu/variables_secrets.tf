# sensitive variables for secrets
variable "database_url" {
  description = "The database URL for the backend"
  type        = string
  sensitive   = true
  default     = "dummy_value_please_change"
}

variable "martin_database_url" {
  description = "The database URL for Martin"
  type        = string
  sensitive   = true
  default     = "dummy_value_please_change"
}

variable "vite_maptiler_key" {
  description = "The MapTiler Key for Frontend"
  type        = string
  sensitive   = true
  default     = "dummy_value_please_change"
}
