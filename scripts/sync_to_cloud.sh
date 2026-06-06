#!/bin/bash
set -e

SYNC_DB=false
SYNC_BUCKET=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --db) SYNC_DB=true ;;
        --bucket) SYNC_BUCKET=true ;;
        --all) SYNC_DB=true; SYNC_BUCKET=true ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --db        Sync only the database"
            echo "  --bucket    Sync only the MinIO bucket"
            echo "  --all       Sync both (default behavior if no options are specified)"
            exit 0
            ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Default to syncing both if nothing specified
if [ "$SYNC_DB" = false ] && [ "$SYNC_BUCKET" = false ]; then
    SYNC_DB=true
    SYNC_BUCKET=true
fi

echo "🚀 Starting synchronization..."

TUNNEL_PID=""
cleanup() {
    echo "🧹 Cleaning up..."
    rm -f local_db.dump
    if [ -n "$TUNNEL_PID" ] && kill -0 $TUNNEL_PID 2>/dev/null; then
        kill $TUNNEL_PID
        echo "✅ SSH tunnel closed."
    fi
}
trap cleanup EXIT

if [ "$SYNC_DB" = true ]; then
    # 1. Start SSH Tunnel
    echo "🔒 Opening SSH tunnel to cloud DB in the background..."
    gcloud compute ssh eaip-db-vm \
        --project=project-d5038013-e773-4f0b-98a \
        --zone=us-central1-a \
        -- -N -g -L 0.0.0.0:5433:localhost:5432 &
    TUNNEL_PID=$!

    echo "⏳ Waiting for tunnel to establish on port 5433..."
    for i in {1..30}; do
        if nc -z localhost 5433; then
            echo "✅ Tunnel established!"
            break
        fi
        sleep 1
    done

    # 2. Dump Local Database
    echo "📦 Dumping local PostgreSQL database..."
    docker exec eaip-postgres pg_dump -U postgres -d aeronautical_information_system -F c > local_db.dump

    # 3. Restore to Cloud Database
    echo "☁️  Pushing database dump to cloud VM..."
    # Using --clean --if-exists to replace the old data cleanly
    docker exec -i eaip-postgres env PGPASSWORD=postgres pg_restore -h host.docker.internal -p 5433 -U postgres -d aeronautical_information_system -1 --clean --if-exists < local_db.dump || true
    echo "✅ Database transfer complete."
fi

if [ "$SYNC_BUCKET" = true ]; then
    # 4. Sync MinIO to GCS
    echo "☁️  Syncing MinIO bucket to GCS (excluding /output/ and /weather/)..."
    TEMP_MINIO_DIR=$(mktemp -d)
    /opt/homebrew/bin/mc mirror --exclude "output/*" --exclude "weather/*" localminio/ais "$TEMP_MINIO_DIR"
    gsutil -m rsync -r "$TEMP_MINIO_DIR" "gs://eaip-staging-data-project-d5038013-e773-4f0b-98a/"
    rm -rf "$TEMP_MINIO_DIR"
    echo "✅ Storage sync complete."
fi

echo "🎉 Synchronization process finished!"
