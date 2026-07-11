resource "google_compute_firewall" "allow_postgres" {
  name    = "allow-postgres"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["allow-postgres"]
}

resource "google_compute_firewall" "allow_redis" {
  name    = "allow-redis"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["6379"]
  }

  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["allow-postgres"]
}
