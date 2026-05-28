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

# --- PRODUCTION STAGE ---
FROM node:22-alpine AS production
WORKDIR /app

# 6. Install runtime dependencies
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
# Keep the memory limit for the runtime as well just in case
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 7. Production dependencies only
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps

# 8. Copy generated Prisma client and built files from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]