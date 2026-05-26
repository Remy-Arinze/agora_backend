# --- BUILD STAGE ---
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Copy Prisma folder first to cache the generation if possible
COPY prisma ./prisma/
COPY . .

# Dummy URL for build-time generation
ENV DB_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

# --- PRODUCTION STAGE ---
FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy everything from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]