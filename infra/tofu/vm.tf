resource "google_compute_instance" "db_vm" {
  name         = "eaip-db-vm"
  machine_type = "e2-micro"
  zone         = "${var.region}-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 30
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral public IP to match current setup (external IP for SSH tunnel sync)
    }
  }

  tags = ["allow-postgres"]

  service_account {
    # Default Compute Engine service account to match user preference
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e

    # Install Docker
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Fetch DB password from Secret Manager at runtime
    DB_PASSWORD=$(gcloud secrets versions access latest --secret=eaip-db-password --project="${var.project_id}")

    docker run -d --name eaip-postgres --restart unless-stopped \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB=aeronautical_information_system \
      -p 5432:5432 \
      -v postgres_data:/var/lib/postgresql/data \
      postgis/postgis:15-3.4

    docker run -d --name eaip-redis --restart unless-stopped \
      -p 6379:6379 \
      redis:7.4-alpine \
      redis-server --maxmemory 100mb --maxmemory-policy allkeys-lru
  EOT
}

output "db_vm_ip" {
  value       = google_compute_instance.db_vm.network_interface[0].network_ip
  description = "The private IP address of the database VM."
}
