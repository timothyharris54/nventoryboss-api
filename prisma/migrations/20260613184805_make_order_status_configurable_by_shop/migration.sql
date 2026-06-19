/*
  Warnings:

  - Changed the type of `status` on the `Order` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "ReservationSourceType" ADD VALUE 'sales_order_line';

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT USING "status"::text;

-- AlterTable
ALTER TABLE "PlanningSettings" ALTER COLUMN "demandDateBasis" SET DEFAULT 'orderedAt';

-- CreateTable
CREATE TABLE "LookupValue" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "lookupType" TEXT NOT NULL,
    "channelKey" TEXT,
    "lookupKeyValue" TEXT NOT NULL,
    "lookupTextValue" TEXT NOT NULL,
    "lookupDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LookupValue_accountId_lookupType_idx" ON "LookupValue"("accountId", "lookupType");

-- CreateIndex
CREATE INDEX "LookupValue_accountId_lookupType_channelKey_idx" ON "LookupValue"("accountId", "lookupType", "channelKey");

-- CreateIndex
CREATE UNIQUE INDEX "LookupValue_accountId_lookupType_channelKey_lookupKeyValue_key" ON "LookupValue"("accountId", "lookupType", "channelKey", "lookupKeyValue");

-- AddForeignKey
ALTER TABLE "LookupValue" ADD CONSTRAINT "LookupValue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "EcommerceProductMapping_accountId_connectionId_externalProductI" RENAME TO "EcommerceProductMapping_accountId_connectionId_externalProd_key";

-- RenameIndex
ALTER INDEX "EcommerceProductMapping_accountId_provider_externalProductId_id" RENAME TO "EcommerceProductMapping_accountId_provider_externalProductI_idx";
