CREATE TABLE "AccountSecuritySettings" (
    "id" SERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSecuritySettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountSecuritySettings_passwordMinLength_check" CHECK ("passwordMinLength" BETWEEN 1 AND 128)
);

CREATE UNIQUE INDEX "AccountSecuritySettings_accountId_key" ON "AccountSecuritySettings"("accountId");

ALTER TABLE "AccountSecuritySettings" ADD CONSTRAINT "AccountSecuritySettings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
