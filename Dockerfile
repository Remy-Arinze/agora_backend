# Build stage: install deps, generate Prisma client, build NestJS
FROM node:22-alpine AS builder

WORKDIR /app

# Install OpenSSL — required by Prisma client on Alpine
RUN apk add --no-cache openssl

# Install dependencies (including devDependencies for build)
# NODE_ENV must NOT be production here — npm skips devDependencies when it is,
# and we need @nestjs/cli, prisma, typescript etc. to build.
COPY package.json package-lock.json* ./
RUN NODE_ENV=development npm ci --legacy-peer-deps

# Verify CLI binaries exist before attempting build
RUN ls node_modules/.bin/nest node_modules/.bin/prisma

# Copy all source files
COPY . .

# npm run build = "prisma generate && nest build"
# DB_URL must be set so Prisma doesn't fail on missing env var at generate time.
# This is a dummy value — the real DB_URL is injected at runtime only.
ENV DB_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npm run build

# Production stage: minimal image to run the API
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install OpenSSL — required by Prisma client on Alpine
RUN apk add --no-cache openssl

# Production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps

# Prisma CLI for migrate deploy at runtime
RUN npm install prisma --no-save --legacy-peer-deps

# Prisma schema + migrations (for prisma migrate deploy at startup)
COPY prisma ./prisma

# Generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Built application
COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
