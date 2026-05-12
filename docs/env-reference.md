# Environment Variables Reference

All variables are read from `.env` (or `.env.local` which takes priority).  
Copy `.env.example` and fill in values before running.

---

## Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_URL` | ✅ | Full PostgreSQL connection string. Format: `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require` |
| `STUDENT_UID_SUFFIX_LENGTH` | Optional | Length of the random suffix on student UIDs. Default: `6` |

---

## Server

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Optional | Port the API listens on. Default: `4000` |
| `NODE_ENV` | ✅ | `development` or `production`. Controls Swagger, Sentry, and security headers |
| `FRONTEND_URL` | ✅ | The URL of the frontend app. Used for CORS whitelist. E.g. `https://agora-schools.com` |

---

## Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Secret key for signing/verifying JWTs. Use a 64+ character random hex string in production |
| `JWT_EXPIRES_IN` | Optional | Access token lifetime. Default: `1d` |
| `INTERNAL_API_KEY` | ✅ | Bearer token for internal server-to-server calls (e.g. metrics scraping). Keep secret |

---

## Redis / BullMQ

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_HOST` | ✅ | Redis server hostname. E.g. `127.0.0.1` for local, Azure hostname for cloud |
| `REDIS_PORT` | ✅ | Redis port. Default `6379`, Azure Redis Cache uses `10000` |
| `REDIS_PASSWORD` | Optional | Redis AUTH password. Leave blank for local dev. Required for Azure |
| `REDIS_TLS` | Optional | Set to `true` for Azure Redis (uses TLS). Default: `false` |
| `REDIS_IS_CLUSTER` | Optional | Set to `true` only for Azure Redis Cluster mode. Default: `false` |

> **Note:** BullMQ uses Redis for all background job queues (curriculum parsing, scheme of work generation). Without a working Redis connection the API starts but queued jobs will never process.

---

## Email (SMTP)

| Variable | Required | Description |
|----------|----------|-------------|
| `MAIL_HOST` | ✅ | SMTP server hostname. E.g. `smtp.gmail.com` |
| `MAIL_PORT` | ✅ | SMTP port. `587` for TLS, `465` for SSL |
| `MAIL_USER` | ✅ | SMTP username / email address used to send mail |
| `MAIL_PASSWORD` | ✅ | SMTP password or App Password (for Gmail, use an App Password) |
| `MAIL_SECURE` | Optional | `true` for port 465 (SSL), `false` for port 587 (STARTTLS). Default: `false` |
| `MAIL_FROM` | ✅ | The `From:` address shown on all outbound emails |

---

## Cloudinary (File Storage)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | ✅ | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |

> Used for: school logos, staff profile photos, student profile photos, curriculum source PDF/DOCX uploads, school curriculum document uploads.

---

## AI / LLM (Azure OpenAI)

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_API_KEY` | ✅ | API key for the primary Azure OpenAI resource (chat completions) |
| `AZURE_OPENAI_ENDPOINT` | ✅ | Azure OpenAI resource endpoint URL for chat completions |
| `AZURE_OPENAI_DEPLOYMENT` | ✅ | Deployment name for the chat model. Currently `gpt-4.1-mini` |
| `AZURE_OPENAI_API_VERSION` | ✅ | API version string. E.g. `2025-01-01-preview` |
| `AZURE_OPENAI_EMBEDDING_API_KEY` | ✅ | API key for the embedding resource (may differ from chat) |
| `Azure_OPENAI_EMBEDDING_ENDPOINT` | ✅ | Azure OpenAI resource endpoint URL for embeddings |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | ✅ | Deployment name for the embedding model. Currently `text-embedding-3-small` |
| `AZURE_OPENAI_EMBEDDING_API_VERSION` | ✅ | API version for embeddings. E.g. `2023-05-15` |
| `AGORA_CREDITS_PER_1M_TOKENS` | Optional | How many AI credits to deduct per 1 million tokens consumed. Default: `1000` |

> `OPENAI_API_KEY` is also present but not currently used in production. Azure OpenAI is the active provider.

---

## Payments (Paystack)

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYSTACK_SECRET_KEY` | ✅ | Paystack secret key. Use your Paystack test secret key in development and your live secret key in production |
| `PAYSTACK_PUBLIC_KEY` | ✅ | Paystack public key |
| `PAYSTACK_WEBHOOK_SECRET` | ✅ | Shared secret for verifying incoming Paystack webhook signatures |
| `PAYMENT_WEBHOOK_ALLOWED_IPS` | Optional | Comma-separated list of Paystack webhook IPs to whitelist |

---

## Google Calendar Integration

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Optional | OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Optional | OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Optional | OAuth redirect URI after user grants calendar access |

---

## Monitoring & Observability

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_DSN` | Optional | Sentry project DSN. Error tracking is only enabled in `production` when this is set |
| `METRICS_API_KEY` | Optional | Bearer token required to access `/metrics` endpoint (Prometheus scrape target) |
| `GRAFANA_CLOUD_PROMETHEUS_URL` | Optional | Grafana Cloud remote write URL for push-based Prometheus metrics |
| `GRAFANA_CLOUD_PROMETHEUS_USER` | Optional | Grafana Cloud prometheus user ID |
| `GRAFANA_CLOUD_PROMETHEUS_TOKEN` | Optional | Grafana Cloud API token for remote write |
