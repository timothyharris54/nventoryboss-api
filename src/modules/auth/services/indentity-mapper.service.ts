import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { RequestIdentity } from '../interfaces/request-identity.interface';

@Injectable()
export class IdentityMapperService {
  toRequestIdentity(payload: any): RequestIdentity {
    if (
      !payload?.sub ||
      !payload?.accountId ||
      !payload?.email ||
      !payload?.roleCode
    ) {
      throw new UnauthorizedException('Invalid authentication payload.');
    }

    try {
      if (!Object.values(UserRoleCode).includes(payload.roleCode)) {
        throw new Error('Invalid role code.');
      }

      return {
        userId: BigInt(payload.sub),
        accountId: BigInt(payload.accountId),
        email: String(payload.email),
        roleCode: payload.roleCode,
      };
    } catch {
      throw new UnauthorizedException('Invalid authentication payload.');
    }
  }
}
