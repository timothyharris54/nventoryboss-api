CREATE TABLE "VendorPlatform" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "loginUrl" TEXT,
    "username" TEXT,
    "credentials" JSONB,
    "paymentTerms" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPlatform_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Vendor" ADD COLUMN "platformId" BIGINT;

CREATE UNIQUE INDEX "VendorPlatform_accountId_name_key" ON "VendorPlatform"("accountId", "name");

CREATE INDEX "VendorPlatform_accountId_isActive_idx" ON "VendorPlatform"("accountId", "isActive");

CREATE INDEX "Vendor_accountId_platformId_idx" ON "Vendor"("accountId", "platformId");

ALTER TABLE "VendorPlatform" ADD CONSTRAINT "VendorPlatform_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "VendorPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
