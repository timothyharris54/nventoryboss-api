-- CreateTable
CREATE TABLE "Address" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "addressTypeCode" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT,
    "companyName" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_accountId_addressTypeCode_idx" ON "Address"("accountId", "addressTypeCode");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
