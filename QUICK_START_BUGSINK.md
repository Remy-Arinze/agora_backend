# Quick Start: Bugsink Error Tracking

## Local Development (Optional)

Bugsink is disabled in development by default. If you want to test it locally:

```bash
# Start all services including Bugsink
docker compose -f docker-compose.prod.yml up -d

# Access Bugsink at http://localhost:8000
# Create admin account and project
# Update .env with the DSN
```

## Production Deployment (3 Steps)

### Step 1: Generate Secret
```bash
openssl rand -hex 32
```
Copy the output - you'll need it for `BUGSINK_SECRET_KEY`

### Step 2: Deploy on VPS
```bash
# On your VPS
cd /path/to/agora/backend

# Create Bugsink database
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec db psql -U agora -c "CREATE DATABASE bugsink;"

# Start Bugsink
docker compose -f docker-compose.prod.yml up -d bugsink
```

### Step 3: Configure
1. Open `http://your-vps-ip:8000` in browser
2. Create admin account (save credentials!)
3. Click "Create Project" → Name: "Agora Backend"
4. Copy the DSN (shown after project creation)
5. Edit `.env.prod` on VPS:
   ```env
   BUGSINK_DSN=http://[KEY_FROM_BUGSINK]@localhost:8000/[PROJECT_ID]
   BUGSINK_SECRET_KEY=[generated_from_step_1]
   BUGSINK_ALLOWED_HOSTS=your-vps-ip
   ```
6. Restart API:
   ```bash
   docker compose -f docker-compose.prod.yml restart api
   ```

### Step 4: Verify
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs api | grep Bugsink

# Should see: 🐛 Bugsink error tracking initialized
```

## Accessing Bugsink

- **URL**: `http://your-vps-ip:8000`
- **Login**: Use admin credentials from Step 3.2
- **Dashboard**: View all errors, stack traces, and request context

## What's Tracked

- All uncaught exceptions
- HTTP errors (4xx, 5xx)
- Stack traces with source context
- Request details (URL, method, headers, body)
- User information (if authenticated)
- Environment info (Node version, OS, etc.)

## Maintenance

```bash
# View Bugsink logs
docker compose -f docker-compose.prod.yml logs -f bugsink

# Restart Bugsink
docker compose -f docker-compose.prod.yml restart bugsink

# Backup Bugsink data
docker compose -f docker-compose.prod.yml exec db pg_dump -U agora bugsink > bugsink-backup.sql

# Check disk usage
docker compose -f docker-compose.prod.yml exec db psql -U agora -c "\l+ bugsink"
```

## Troubleshooting

**Errors not appearing in Bugsink?**
1. Check API logs: `docker compose logs api | grep -i error`
2. Verify BUGSINK_DSN is set correctly
3. Check Bugsink is running: `docker ps | grep bugsink`
4. Test connectivity: `docker compose exec api ping bugsink`

**Can't access Bugsink UI?**
1. Ensure port 8000 is not blocked by firewall
2. Check Bugsink logs: `docker compose logs bugsink`
3. Verify BUGSINK_ALLOWED_HOSTS includes your access IP/domain

## Need More Help?

📚 Full documentation: `docs/bugsink-setup.md`  
📋 Migration details: `BUGSINK_MIGRATION_SUMMARY.md`
