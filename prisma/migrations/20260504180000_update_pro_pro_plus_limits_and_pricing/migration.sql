-- Align public Pro / Pro+ plans and active subscriptions with new caps, credits, and NGN pricing.

UPDATE "SubscriptionPlan"
SET
  "monthlyPrice" = 49999,
  "yearlyPrice" = 499990,
  "maxStudents" = 800,
  "maxTeachers" = 80,
  "maxAdmins" = 20,
  "aiCredits" = 10000
WHERE "tierCode" = 'PRO' AND "isPublic" = true AND "customSchoolId" IS NULL;

UPDATE "SubscriptionPlan"
SET
  "monthlyPrice" = 99999,
  "yearlyPrice" = 999990,
  "maxStudents" = 2000,
  "maxTeachers" = 150,
  "maxAdmins" = 35,
  "aiCredits" = 25000
WHERE "tierCode" = 'PRO_PLUS' AND "isPublic" = true AND "customSchoolId" IS NULL;

UPDATE "Subscription"
SET
  "maxStudents" = 800,
  "maxTeachers" = 80,
  "maxAdmins" = 20
WHERE "tier" = 'PRO';

UPDATE "Subscription"
SET
  "maxStudents" = 2000,
  "maxTeachers" = 150,
  "maxAdmins" = 35
WHERE "tier" = 'PRO_PLUS';

UPDATE "Subscription"
SET "aiCredits" = GREATEST("aiCredits", 10000)
WHERE "tier" = 'PRO' AND "aiCredits" <> -1;

UPDATE "Subscription"
SET "aiCredits" = GREATEST("aiCredits", 25000)
WHERE "tier" = 'PRO_PLUS' AND "aiCredits" <> -1;
