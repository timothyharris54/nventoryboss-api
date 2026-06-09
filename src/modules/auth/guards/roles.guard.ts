import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleCode } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestIdentity } from '../interfaces/request-identity.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRoleCode[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: RequestIdentity }>();
    const identity = request.user;

    return !!identity && requiredRoles.includes(identity.roleCode);
  }
}
