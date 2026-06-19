CREATE TYPE "EcommerceAuthType" AS ENUM ('none', 'basic', 'api_key', 'oauth');

ALTER TABLE "EcommerceConnection"
ADD COLUMN "channelKey" TEXT,
ADD COLUMN "authType" "EcommerceAuthType" NOT NULL DEFAULT 'api_key',
ADD COLUMN "credentials" JSONB,
ADD COLUMN "settings" JSONB,
ADD COLUMN "defaultLocationCode" TEXT NOT NULL DEFAULT 'MAIN',
ADD COLUMN "currencyCode" TEXT,
ADD COLUMN "lastConnectionTestedAt" TIMESTAMP(3),
ADD COLUMN "lastConnectionStatus" TEXT,
ADD COLUMN "lastConnectionError" TEXT;

UPDATE "EcommerceConnection"
SET "channelKey" = lower("provider"::TEXT) || '-' || "id"::TEXT
WHERE "channelKey" IS NULL;

ALTER TABLE "EcommerceConnection"
ALTER COLUMN "channelKey" SET NOT NULL;

CREATE UNIQUE INDEX "EcommerceConnection_accountId_channelKey_key" ON "EcommerceConnection"("accountId", "channelKey");
CREATE INDEX "EcommerceConnection_accountId_isActive_idx" ON "EcommerceConnection"("accountId", "isActive");
