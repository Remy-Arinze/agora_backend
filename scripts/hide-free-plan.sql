-- Hide the FREE subscription plan from public listing.
-- The FREE tier still exists and is assigned to all new schools automatically;
-- this only removes it from the landing page / pricing page display.
-- Run once on production: docker compose exec db psql -U agora -d agora -f /scripts/hide-free-plan.sql

UPDATE "SubscriptionPlan"
SET "isPublic" = false
WHERE "tierCode" = 'FREE';
