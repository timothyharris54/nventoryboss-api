import { UserRoleCode } from '@prisma/client';

export const CHANNEL_SYNCHRONIZATION_ROLES = [
  UserRoleCode.executive,
  UserRoleCode.purchasing_manager,
  UserRoleCode.planner,
  UserRoleCode.account_admin,
  UserRoleCode.system_admin,
] as const satisfies readonly UserRoleCode[];
