# --- BUILD STAGE ---
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY prisma ./prisma/
COPY . .

ENV DB_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

# --- PRODUCTION STAGE ---
FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production

# FIX: We copy the package files FROM THE BUILDER 
# This ensures Docker finishes the builder stage BEFORE starting this one.
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]