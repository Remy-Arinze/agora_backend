#!/bin/sh
set -e

echo "Applying Prisma migrations..."
i=0
until npx prisma migrate deploy --schema=prisma/schema; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Prisma migrate failed after 30 attempts"
    exit 1
  fi
  echo "Database not ready, retrying in 2s ($i/30)..."
  sleep 2
done

# Seeds create tools/plans/subjects/super-admin only if they do not already exist.
if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "Running seed scripts..."
  npx tsx prisma/seed.ts
  npx tsx prisma/seed-agora-subjects.ts
fi

exec "$@"
