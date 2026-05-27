#!/bin/sh
set -e

# Run migrations when DB_URL is set
# Schema uses prismaSchemaFolder preview feature — files live in prisma/schema/
# prisma migrate deploy accepts a directory path via --schema
if [ -n "$DB_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy --schema=./prisma/schema
  echo "Migrations complete."
fi

exec "$@"
