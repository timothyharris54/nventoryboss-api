ALTER TYPE "UserRoleCode" ADD VALUE 'warehouse_manager';
ALTER TYPE "UserRoleCode" ADD VALUE 'warehouse_user';

COMMIT;

INSERT INTO "Role" ("code", "displayName", "description", "updatedAt") VALUES
  ('warehouse_manager', 'Warehouse Manager', 'Warehouse oversight, inventory movement, and fulfillment coordination.', CURRENT_TIMESTAMP),
  ('warehouse_user', 'Warehouse User', 'Warehouse receiving, inventory handling, and fulfillment activity.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
