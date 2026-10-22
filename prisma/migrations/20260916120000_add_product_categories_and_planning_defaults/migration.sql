ALTER TABLE "PlanningSettings"
ADD COLUMN "defaultSafetyStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "defaultTargetDaysOfCover" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "defaultLeadTimeDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "defaultMinReorderQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "defaultLocationCode" TEXT NOT NULL DEFAULT 'MAIN';

CREATE TABLE "ProductCategory" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "safetyStock" DECIMAL(12,2),
    "targetDaysOfCover" INTEGER,
    "leadTimeDays" INTEGER,
    "minReorderQty" DECIMAL(12,2),
    "locationCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "categoryId" BIGINT;

CREATE UNIQUE INDEX "ProductCategory_accountId_name_key" ON "ProductCategory"("accountId", "name");
CREATE INDEX "ProductCategory_accountId_idx" ON "ProductCategory"("accountId");
CREATE INDEX "Product_accountId_categoryId_idx" ON "Product"("accountId", "categoryId");

ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
