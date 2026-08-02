UPDATE "SubscriptionPlan"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'legacy';

INSERT INTO "SubscriptionPlan" ("code", "displayName", "description", "isActive", "sortOrder", "updatedAt") VALUES
  ('starter', 'Starter', 'Core inventory and ecommerce synchronization for a small operation.', true, 10, CURRENT_TIMESTAMP),
  ('growth', 'Growth', 'Planning, procurement, and expanded operating limits.', true, 20, CURRENT_TIMESTAMP),
  ('professional', 'Professional', 'Full feature access without plan-level usage limits.', true, 30, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "description" = EXCLUDED."description",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH entitlement_values("planCode", "featureCode", "enabled", "limit") AS (
  VALUES
    ('starter', 'shopify_sync', true, NULL::INTEGER),
    ('starter', 'planning', false, NULL::INTEGER),
    ('starter', 'procurement', false, NULL::INTEGER),
    ('starter', 'locations', true, 1),
    ('starter', 'user_management', true, 3),
    ('starter', 'product_catalog', true, 1000),
    ('starter', 'ecommerce_connections', true, 1),
    ('growth', 'shopify_sync', true, NULL::INTEGER),
    ('growth', 'planning', true, NULL::INTEGER),
    ('growth', 'procurement', true, NULL::INTEGER),
    ('growth', 'locations', true, 5),
    ('growth', 'user_management', true, 15),
    ('growth', 'product_catalog', true, 10000),
    ('growth', 'ecommerce_connections', true, 3),
    ('professional', 'shopify_sync', true, NULL::INTEGER),
    ('professional', 'planning', true, NULL::INTEGER),
    ('professional', 'procurement', true, NULL::INTEGER),
    ('professional', 'locations', true, NULL::INTEGER),
    ('professional', 'user_management', true, NULL::INTEGER),
    ('professional', 'product_catalog', true, NULL::INTEGER),
    ('professional', 'ecommerce_connections', true, NULL::INTEGER)
)
INSERT INTO "PlanEntitlement" ("planId", "featureId", "enabled", "limit", "updatedAt")
SELECT plan."id", feature."id", values."enabled", values."limit", CURRENT_TIMESTAMP
FROM entitlement_values values
JOIN "SubscriptionPlan" plan ON plan."code" = values."planCode"
JOIN "FeatureDefinition" feature ON feature."code" = values."featureCode"
ON CONFLICT ("planId", "featureId") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "limit" = EXCLUDED."limit",
  "updatedAt" = CURRENT_TIMESTAMP;
