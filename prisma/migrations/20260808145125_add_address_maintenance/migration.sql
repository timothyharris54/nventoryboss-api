-- AlterEnum
ALTER TYPE "UserRoleCode" ADD VALUE 'account_admin';

-- RenameIndex
ALTER INDEX "SubscriptionPlanPrice_planId_billingProvider_billingInterval_cu" RENAME TO "SubscriptionPlanPrice_planId_billingProvider_billingInterva_key";
