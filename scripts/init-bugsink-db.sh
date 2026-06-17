#!/bin/bash
# Initialize Bugsink database in PostgreSQL
# This script creates the Bugsink database if it doesn't exist

set -e

echo "🔧 Initializing Bugsink database..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
docker compose -f docker-compose.prod.yml exec -T db pg_isready -U "${POSTGRES_USER:-agora}" || {
    echo "❌ PostgreSQL is not ready. Please start the database first:"
    echo "   docker compose -f docker-compose.prod.yml up -d db"
    exit 1
}

# Check if Bugsink database exists
DB_EXISTS=$(docker compose -f docker-compose.prod.yml exec -T db psql -U "${POSTGRES_USER:-agora}" -tAc "SELECT 1 FROM pg_database WHERE datname='bugsink'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ Bugsink database already exists"
else
    echo "📦 Creating Bugsink database..."
    docker compose -f docker-compose.prod.yml exec -T db psql -U "${POSTGRES_USER:-agora}" -c "CREATE DATABASE bugsink;"
    echo "✅ Bugsink database created successfully"
fi

echo "🚀 Starting Bugsink container..."
docker compose -f docker-compose.prod.yml up -d bugsink

echo ""
echo "✅ Bugsink initialization complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Access Bugsink at: http://localhost:8000 (or your server IP)"
echo "   2. Create your admin account"
echo "   3. Create a new project (e.g., 'Agora Backend')"
echo "   4. Copy the DSN from project settings"
echo "   5. Update your .env.prod with the DSN"
echo "   6. Restart API: docker compose -f docker-compose.prod.yml restart api"
echo ""
