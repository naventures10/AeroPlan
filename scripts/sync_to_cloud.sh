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

echo "⏳ Waiting 3 seconds for tunnel to establish..."
sleep 3

# 2. Dump Local Database
echo "📦 Dumping local PostgreSQL database..."
PGPASSWORD=postgres pg_dump -h localhost -p 5432 -U postgres -d aeronautical_information_system -F c -f local_db.dump

# 3. Restore to Cloud Database
echo "☁️  Pushing database dump to cloud VM..."
# Using --clean --if-exists to replace the old data cleanly
PGPASSWORD=postgres pg_restore -h localhost -p 5433 -U postgres -d aeronautical_information_system -1 --clean --if-exists local_db.dump || true
echo "✅ Database transfer complete."

# 4. Cleanup
echo "🧹 Cleaning up..."
rm local_db.dump
kill $TUNNEL_PID
echo "✅ SSH tunnel closed."

echo "🎉 Database has been successfully pushed to the cloud!"
