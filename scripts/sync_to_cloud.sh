#!/bin/bash
set -e

echo "🚀 Starting full local-to-cloud synchronization..."

# 1. Start SSH Tunnel
echo "🔒 Opening SSH tunnel to cloud DB in the background..."
gcloud compute ssh eaip-db-vm \
    --project=project-d5038013-e773-4f0b-98a \
    --zone=us-central1-a \
    -- -N -L 5433:localhost:5432 &
TUNNEL_PID=$!

cleanup() {
    echo "🧹 Cleaning up..."
    rm -f local_db.dump
    if kill -0 $TUNNEL_PID 2>/dev/null; then
        kill $TUNNEL_PID
        echo "✅ SSH tunnel closed."
    fi
}
trap cleanup EXIT

echo "⏳ Waiting 3 seconds for tunnel to establish..."
sleep 3

# 2. Dump Local Database
echo "📦 Dumping local PostgreSQL database..."
docker exec eaip-postgres pg_dump -U postgres -d aeronautical_information_system -F c > local_db.dump

# 3. Restore to Cloud Database
echo "☁️  Pushing database dump to cloud VM..."
# Using --clean --if-exists to replace the old data cleanly
docker exec -i eaip-postgres env PGPASSWORD=postgres pg_restore -h host.docker.internal -p 5433 -U postgres -d aeronautical_information_system -1 --clean --if-exists < local_db.dump || true
echo "✅ Database transfer complete."

# 4. Sync MinIO to GCS
echo "☁️  Syncing MinIO bucket to GCS (excluding /output/ and /weather/)..."
TEMP_MINIO_DIR=$(mktemp -d)
/opt/homebrew/bin/mc mirror --exclude "output/*" --exclude "weather/*" localminio/ais "$TEMP_MINIO_DIR"
gsutil -m rsync -r "$TEMP_MINIO_DIR" "gs://eaip-staging-data-project-d5038013-e773-4f0b-98a/"
rm -rf "$TEMP_MINIO_DIR"
echo "✅ Storage sync complete."

echo "🎉 Database and Storage have been successfully pushed to the cloud!"
