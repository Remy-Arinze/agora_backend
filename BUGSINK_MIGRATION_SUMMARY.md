# Bugsink Migration Summary

✅ **Migration from Sentry to Bugsink completed successfully**

## Changes Made

### 1. Dependencies Updated
- ❌ Removed: `@sentry/nestjs@10.49.0` and `@sentry/profiling-node@10.49.0`
- ✅ Added: `@sentry/nestjs@10.56.0` (Bugsink-compatible Sentry SDK)

### 2. Environment Variables Changed
- ❌ Removed: `SENTRY_DSN`
- ✅ Added:
  - `BUGSINK_DSN` - Points to your self-hosted Bugsink instance
  - `BUGSINK_SECRET_KEY` - Django secret key for Bugsink
  - `BUGSINK_ALLOWED_HOSTS` - Allowed hosts for Bugsink UI

### 3. Docker Compose Updated (`docker-compose.prod.yml`)
- ✅ Added Bugsink service (port 8000)
- ✅ Added `bugsink_data` volume
- ✅ Configured Bugsink to use shared PostgreSQL database
- ✅ Updated API container to use `BUGSINK_DSN` instead of `SENTRY_DSN`

### 4. Application Code Updated (`src/main.ts`)
- ✅ Updated Sentry.init() to use `BUGSINK_DSN` environment variable
- ✅ Changed log message to indicate Bugsink instead of Sentry
- ✅ Maintained same error tracking functionality (Sentry SDK is compatible)

### 5. Documentation Added
- ✅ Created `docs/bugsink-setup.md` - Complete setup guide
- ✅ Created `scripts/init-bugsink-db.sh` - Database initialization script (Linux/Mac)
- ✅ Created `scripts/init-bugsink-db.bat` - Database initialization script (Windows)

### 6. Configuration Examples Updated
- ✅ Updated `.env.prod.example` with Bugsink variables
- ✅ Updated local `.env` with development Bugsink configuration

## Next Steps for Deployment

### 1. Generate Production Secrets
```bash
# Generate Bugsink Django secret key
openssl rand -hex 32

# Output: Use this for BUGSINK_SECRET_KEY
```

### 2. Initialize Bugsink on VPS

**Option A: Using the script (Linux/Mac)**
```bash
cd /path/to/agora/backend
chmod +x scripts/init-bugsink-db.sh
./scripts/init-bugsink-db.sh
```

**Option B: Manual setup**
```bash
# Start database and create Bugsink DB
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec db psql -U agora -c "CREATE DATABASE bugsink;"

# Start Bugsink
docker compose -f docker-compose.prod.yml up -d bugsink
```

### 3. Configure Bugsink
1. Access Bugsink at `http://your-vps-ip:8000`
2. Create admin account
3. Create project: "Agora Backend"
4. Copy the DSN from project settings (looks like: `http://KEY@host:8000/PROJECT_ID`)

### 4. Update Production Environment
```bash
# On VPS, edit .env.prod
nano .env.prod

# Update these values:
BUGSINK_DSN=http://[YOUR_KEY]@localhost:8000/[PROJECT_ID]
BUGSINK_SECRET_KEY=[generated_secret_from_step_1]
BUGSINK_ALLOWED_HOSTS=your-vps-ip,bugsink.yourdomain.com
```

### 5. Deploy Updated Application
```bash
# Pull latest code
git pull

# Rebuild and restart API
docker compose -f docker-compose.prod.yml up -d --build api

# Verify Bugsink is initialized
docker compose -f docker-compose.prod.yml logs api | grep -i bugsink
# Should see: "🐛 Bugsink error tracking initialized"
```

### 6. Test Error Tracking
Create a test endpoint or trigger an error to verify Bugsink is capturing errors:

```bash
# Check Bugsink dashboard at http://your-vps-ip:8000
# You should see the error appear within seconds
```

### 7. Optional: Setup Reverse Proxy
If you want to use a domain for Bugsink:

**Caddy configuration:**
```
bugsink.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Then update:
```env
BUGSINK_DSN=http://[KEY]@bugsink.yourdomain.com/[PROJECT_ID]
BUGSINK_ALLOWED_HOSTS=bugsink.yourdomain.com
```

## Verification Checklist

- [ ] Dependencies installed successfully (`npm install` completed)
- [ ] Bugsink container running (`docker ps | grep bugsink`)
- [ ] Bugsink UI accessible at port 8000
- [ ] Bugsink database created in PostgreSQL
- [ ] Admin account created in Bugsink
- [ ] Project created in Bugsink
- [ ] DSN copied from Bugsink project settings
- [ ] Production `.env.prod` updated with real DSN
- [ ] API container restarted
- [ ] API logs show "🐛 Bugsink error tracking initialized"
- [ ] Test error appears in Bugsink dashboard

## Rollback (if needed)

If you need to rollback to Sentry:

1. Restore old environment variable:
   ```env
   SENTRY_DSN=https://your-sentry-dsn
   ```

2. Update `docker-compose.prod.yml`:
   ```yaml
   environment:
     SENTRY_DSN: ${SENTRY_DSN}  # Instead of BUGSINK_DSN
   ```

3. Update `src/main.ts`:
   ```typescript
   if (isProduction && process.env.SENTRY_DSN) {
     Sentry.init({ dsn: process.env.SENTRY_DSN, ... });
   ```

4. Restart API container

## Benefits of Bugsink

✅ **Full Control**: All error data stays on your VPS  
✅ **Privacy**: No third-party data sharing  
✅ **Cost**: No usage-based pricing  
✅ **Performance**: Lower latency (same infrastructure)  
✅ **Compliance**: GDPR/data residency friendly  

## Support

- **Documentation**: `/backend/docs/bugsink-setup.md`
- **Bugsink Docs**: https://www.bugsink.com/
- **GitHub**: https://github.com/bugsink/bugsink
- **SDK Docs**: https://docs.sentry.io/platforms/javascript/guides/nestjs/ (compatible)

---

**Migration completed**: June 4, 2026  
**Status**: Ready for deployment ✅
