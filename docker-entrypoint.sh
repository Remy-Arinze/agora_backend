#!/bin/sh
set -e

# Run migrations when DB_URL is set (e.g. in docker-compose or production)
if [ -n "$DB_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
  echo "Migrations complete."
fi

exec "$@"
