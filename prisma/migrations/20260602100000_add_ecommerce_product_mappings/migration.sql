CREATE TYPE "EcommerceProvider" AS ENUM ('woocommerce', 'shopify');

CREATE TABLE "EcommerceConnection" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "provider" "EcommerceProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "storeUrl" TEXT,
    "externalStoreId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EcommerceProductMapping" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "connectionId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "provider" "EcommerceProvider" NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT NOT NULL DEFAULT '',
    "externalSku" TEXT,
    "externalName" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceProductMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EcommerceConnection_accountId_provider_displayName_key" ON "EcommerceConnection"("accountId", "provider", "displayName");
CREATE INDEX "EcommerceConnection_accountId_provider_idx" ON "EcommerceConnection"("accountId", "provider");

CREATE UNIQUE INDEX "EcommerceProductMapping_accountId_connectionId_externalProductId_externalVariantId_key" ON "EcommerceProductMapping"("accountId", "connectionId", "externalProductId", "externalVariantId");
CREATE INDEX "EcommerceProductMapping_accountId_provider_externalProductId_idx" ON "EcommerceProductMapping"("accountId", "provider", "externalProductId");
CREATE INDEX "EcommerceProductMapping_accountId_connectionId_externalSku_idx" ON "EcommerceProductMapping"("accountId", "connectionId", "externalSku");
CREATE INDEX "EcommerceProductMapping_accountId_productId_idx" ON "EcommerceProductMapping"("accountId", "productId");

ALTER TABLE "EcommerceConnection" ADD CONSTRAINT "EcommerceConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EcommerceProductMapping" ADD CONSTRAINT "EcommerceProductMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EcommerceProductMapping" ADD CONSTRAINT "EcommerceProductMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "EcommerceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EcommerceProductMapping" ADD CONSTRAINT "EcommerceProductMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
