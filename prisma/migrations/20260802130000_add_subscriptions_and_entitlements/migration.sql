CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired');
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly');

CREATE TABLE "SubscriptionPlan" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPlanPrice" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "billingProvider" TEXT NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "unitAmountMinor" INTEGER NOT NULL,
    "externalPriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlanPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeatureDefinition" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanEntitlement" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "featureId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountSubscription" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "planId" INTEGER NOT NULL,
    "planPriceId" INTEGER,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "billingProvider" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStartsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountFeatureOverride" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "featureId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "limit" INTEGER,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE UNIQUE INDEX "SubscriptionPlanPrice_planId_billingProvider_billingInterval_currencyCode_key" ON "SubscriptionPlanPrice"("planId", "billingProvider", "billingInterval", "currencyCode");
CREATE UNIQUE INDEX "SubscriptionPlanPrice_billingProvider_externalPriceId_key" ON "SubscriptionPlanPrice"("billingProvider", "externalPriceId");
CREATE INDEX "SubscriptionPlanPrice_planId_isActive_idx" ON "SubscriptionPlanPrice"("planId", "isActive");
CREATE UNIQUE INDEX "FeatureDefinition_code_key" ON "FeatureDefinition"("code");
CREATE UNIQUE INDEX "PlanEntitlement_planId_featureId_key" ON "PlanEntitlement"("planId", "featureId");
CREATE INDEX "PlanEntitlement_featureId_idx" ON "PlanEntitlement"("featureId");
CREATE UNIQUE INDEX "AccountSubscription_accountId_key" ON "AccountSubscription"("accountId");
CREATE UNIQUE INDEX "AccountSubscription_billingProvider_externalSubscriptionId_key" ON "AccountSubscription"("billingProvider", "externalSubscriptionId");
CREATE INDEX "AccountSubscription_planId_status_idx" ON "AccountSubscription"("planId", "status");
CREATE INDEX "AccountSubscription_status_currentPeriodEndsAt_idx" ON "AccountSubscription"("status", "currentPeriodEndsAt");
CREATE UNIQUE INDEX "AccountFeatureOverride_accountId_featureId_key" ON "AccountFeatureOverride"("accountId", "featureId");
CREATE INDEX "AccountFeatureOverride_accountId_expiresAt_idx" ON "AccountFeatureOverride"("accountId", "expiresAt");

ALTER TABLE "SubscriptionPlanPrice" ADD CONSTRAINT "SubscriptionPlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountSubscription" ADD CONSTRAINT "AccountSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountSubscription" ADD CONSTRAINT "AccountSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountSubscription" ADD CONSTRAINT "AccountSubscription_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "SubscriptionPlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountFeatureOverride" ADD CONSTRAINT "AccountFeatureOverride_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountFeatureOverride" ADD CONSTRAINT "AccountFeatureOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve all current functionality for accounts that predate subscriptions.
INSERT INTO "SubscriptionPlan" ("code", "displayName", "description", "isActive", "sortOrder", "updatedAt")
VALUES ('legacy', 'Legacy', 'Full access for accounts created before subscription enforcement.', true, 0, CURRENT_TIMESTAMP);

INSERT INTO "FeatureDefinition" ("code", "displayName", "description", "isActive", "updatedAt") VALUES
  ('shopify_sync', 'Shopify synchronization', 'Synchronize Shopify products and orders.', true, CURRENT_TIMESTAMP),
  ('planning', 'Inventory planning', 'Sales history, replenishment, and recommendations.', true, CURRENT_TIMESTAMP),
  ('procurement', 'Procurement', 'Purchase orders, receipts, and recommendation conversion.', true, CURRENT_TIMESTAMP),
  ('locations', 'Locations', 'Maintain inventory locations.', true, CURRENT_TIMESTAMP),
  ('user_management', 'User management', 'Maintain users and role assignments.', true, CURRENT_TIMESTAMP),
  ('product_catalog', 'Product catalog', 'Maintain and synchronize products.', true, CURRENT_TIMESTAMP),
  ('ecommerce_connections', 'Ecommerce connections', 'Connect ecommerce stores.', true, CURRENT_TIMESTAMP);

INSERT INTO "PlanEntitlement" ("planId", "featureId", "enabled", "limit", "updatedAt")
SELECT plan."id", feature."id", true, NULL, CURRENT_TIMESTAMP
FROM "SubscriptionPlan" plan
CROSS JOIN "FeatureDefinition" feature
WHERE plan."code" = 'legacy';

INSERT INTO "AccountSubscription" ("accountId", "planId", "status", "billingProvider", "updatedAt")
SELECT account."id", plan."id", 'active', 'manual', CURRENT_TIMESTAMP
FROM "Account" account
CROSS JOIN "SubscriptionPlan" plan
WHERE plan."code" = 'legacy';
