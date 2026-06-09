import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IdentityMapperService } from 'src/modules/auth/services/indentity-mapper.service';
import { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly identityMapperService: IdentityMapperService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }

  async validate(payload: any): Promise<RequestIdentity> {
    return this.identityMapperService.toRequestIdentity(payload);
  }
}
