ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetRequestedAt" TIMESTAMP(3);

CREATE INDEX "User_passwordResetTokenHash_idx" ON "User"("passwordResetTokenHash");
