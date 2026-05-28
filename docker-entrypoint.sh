#!/bin/sh
set -e

# Run migrations when DB_URL is set.
# Use the local prisma binary from node_modules to ensure we use the pinned
# version (5.x) and not whatever npx resolves from the global cache (7.x).
if [ -n "$DB_URL" ]; then
  echo "Running database migrations..."
  ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema
  echo "Migrations complete."
fi

exec "$@"
