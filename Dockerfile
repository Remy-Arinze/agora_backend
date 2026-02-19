# Build stage: install deps, generate Prisma client, build NestJS
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Prisma schema and migrations (needed for generate)
COPY prisma ./prisma

# Generate Prisma client (uses prisma/schema.prisma; DB_URL not needed for generate)
RUN npx prisma generate

# Application source and build
COPY . .
RUN npm run build

# Production stage: minimal image to run the API
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps

# Prisma CLI for migrate deploy at runtime (optional)
RUN npm install prisma --no-save --legacy-peer-deps

# Prisma schema + migrations (for prisma migrate deploy)
COPY prisma ./prisma

# Generated Prisma client from builder (so we don't need to run generate again)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Built application
COPY --from=builder /app/dist ./dist

# Optional: run migrations then start (uncomment CMD and use entrypoint for migrate)
# We use a simple start script that can run migrate then node
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
