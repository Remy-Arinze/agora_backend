# --- BUILD STAGE ---
FROM node:22-alpine AS builder
WORKDIR /app

# 1. Install Alpine dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# 2. INCREASE NODE MEMORY LIMIT
# This tells the TypeScript compiler it can use 4GB of RAM (using your new Swap file)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 3. Install ALL dependencies
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# 4. Copy source code
COPY prisma ./prisma/
COPY . .

# 5. Build the application
# We use a dummy URL for generation
ENV DB_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
# We call 'npx nest build' directly to avoid the double generate in your npm script
RUN npx nest build

# [FIX] Prune development dependencies locally. 
# This requires ZERO network/internet usage and keeps Prisma/Nest production packages intact.
RUN npm prune --omit=dev

# --- PRODUCTION STAGE ---
FROM node:22-alpine AS production
WORKDIR /app

# 6. Install runtime dependencies
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
# Keep the memory limit for the runtime as well just in case
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 7. Copy production dependencies directly from the builder stage
# (This completely replaces the failing 'RUN npm ci' command)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# 8. Copy built application files and Prisma schemas
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]