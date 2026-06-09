import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestIdentity } from '../interfaces/request-identity.interface';

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestIdentity | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.identity as RequestIdentity | undefined;
  },
);
