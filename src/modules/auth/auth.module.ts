import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { AuthController } from 'src/modules/auth/auth.controller';
import { AuthService } from 'src/modules/auth/auth.service';
import { IdentityMapperService } from 'src/modules/auth/services/indentity-mapper.service';
import { AuthTokenService } from 'src/modules/auth/services/auth-token.service';
import { AuthPasswordService } from 'src/modules/auth/services/auth-password.service';
import { PasswordPolicyService } from 'src/modules/auth/services/password-policy.service';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    IdentityMapperService,
    AuthTokenService,
    AuthPasswordService,
    PasswordPolicyService,
    JwtStrategy,
    RolesGuard,
  ],
  exports: [
    AuthService,
    IdentityMapperService,
    AuthTokenService,
    AuthPasswordService,
    PasswordPolicyService,
    RolesGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
