-- Run this once on your production PostgreSQL instance.
-- Creates a read-only monitoring user for Grafana Alloy's postgres exporter.
-- Replace CHANGE_ME with a strong password and update POSTGRES_MONITOR_URL in .env.prod

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agora_monitor') THEN
    CREATE USER agora_monitor WITH PASSWORD 'CHANGE_ME_monitor_password';
  END IF;
END
$$;

-- Grant connect on the main database
GRANT CONNECT ON DATABASE agora TO agora_monitor;

-- Grant usage on all schemas
GRANT USAGE ON SCHEMA public TO agora_monitor;

-- Grant SELECT on all existing tables (read-only for stats queries)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agora_monitor;

-- Ensure future tables are also readable
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agora_monitor;

-- Required for pg_stat_statements (slow query tracking)
GRANT pg_monitor TO agora_monitor;

-- Verify
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'agora_monitor';
