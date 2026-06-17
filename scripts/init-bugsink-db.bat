@echo off
REM Initialize Bugsink database in PostgreSQL
REM This script creates the Bugsink database if it doesn't exist

echo 🔧 Initializing Bugsink database...
echo.

REM Wait for PostgreSQL to be ready
echo ⏳ Waiting for PostgreSQL to be ready...
docker compose -f docker-compose.prod.yml exec -T db pg_isready -U agora >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL is not ready. Please start the database first:
    echo    docker compose -f docker-compose.prod.yml up -d db
    exit /b 1
)

REM Check if Bugsink database exists
echo 📦 Checking if Bugsink database exists...
docker compose -f docker-compose.prod.yml exec -T db psql -U agora -tAc "SELECT 1 FROM pg_database WHERE datname='bugsink'" > temp_check.txt
set /p DB_EXISTS=<temp_check.txt
del temp_check.txt

if "%DB_EXISTS%"=="1" (
    echo ✅ Bugsink database already exists
) else (
    echo 📦 Creating Bugsink database...
    docker compose -f docker-compose.prod.yml exec -T db psql -U agora -c "CREATE DATABASE bugsink;"
    echo ✅ Bugsink database created successfully
)

echo.
echo 🚀 Starting Bugsink container...
docker compose -f docker-compose.prod.yml up -d bugsink

echo.
echo ✅ Bugsink initialization complete!
echo.
echo 📋 Next steps:
echo    1. Access Bugsink at: http://localhost:8000 (or your server IP)
echo    2. Create your admin account
echo    3. Create a new project (e.g., 'Agora Backend')
echo    4. Copy the DSN from project settings
echo    5. Update your .env.prod with the DSN
echo    6. Restart API: docker compose -f docker-compose.prod.yml restart api
echo.
