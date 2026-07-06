import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthTokenService } from './services/auth-token.service';
import { RequestIdentity } from './interfaces/request-identity.interface';
import { AuthPasswordService } from './services/auth-password.service';
import { EmailService } from '../email/email.service';
import { PasswordPolicyService } from './services/password-policy.service';

const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_REQUEST_COOLDOWN_MINUTES = 5;
const PASSWORD_RESET_RESPONSE = {
  message:
    'If an active user exists for that email, password reset instructions will be sent.',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly emailService: EmailService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async login(email: string, password: string, roleCode?: UserRoleCode) {
    const users = await this.prisma.user.findMany({
      where: {
        email,
        isActive: true,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (users.length !== 1 || !users[0].passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = users[0];
    const passwordHash = user.passwordHash;

    if (!passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await this.authPasswordService.verifyPassword(
      password,
      passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const availableRoles = user.userRoles
      .filter((userRole) => userRole.role.isActive)
      .map((userRole) => userRole.role)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const selectedRole = roleCode
      ? availableRoles.find((role) => role.code === roleCode)
      : (availableRoles.find(
          (role) => role.code === UserRoleCode.system_admin,
        ) ?? availableRoles[0]);

    if (!selectedRole) {
      throw new UnauthorizedException('Role is not assigned to this user.');
    }

    return this.createSessionResponse(user, selectedRole, availableRoles);
  }

  async getSession(identity: RequestIdentity) {
    const { user, availableRoles } = await this.getUserWithRoles(identity);
    const selectedRole = availableRoles.find(
      (role) => role.code === identity.roleCode,
    );

    if (!selectedRole) {
      throw new UnauthorizedException('Active role is no longer assigned.');
    }

    return {
      identity: this.mapIdentity(user, selectedRole),
      availableRoles: this.mapAvailableRoles(availableRoles),
    };
  }

  async switchRole(identity: RequestIdentity, roleCode: UserRoleCode) {
    const { user, availableRoles } = await this.getUserWithRoles(identity);
    const selectedRole = availableRoles.find((role) => role.code === roleCode);

    if (!selectedRole) {
      throw new UnauthorizedException('Role is not assigned to this user.');
    }

    return this.createSessionResponse(user, selectedRole, availableRoles);
  }

  private async createSessionResponse(
    user: { id: bigint; accountId: bigint; email: string },
    selectedRole: { code: UserRoleCode; displayName: string },
    availableRoles: { code: UserRoleCode; displayName: string }[],
  ) {
    const tokenIdentity: RequestIdentity = {
      userId: user.id,
      accountId: user.accountId,
      email: user.email,
      roleCode: selectedRole.code,
    };

    const accessToken =
      await this.authTokenService.signAccessToken(tokenIdentity);

    return {
      accessToken,
      identity: this.mapIdentity(user, selectedRole),
      availableRoles: this.mapAvailableRoles(availableRoles),
    };
  }

  private async getUserWithRoles(identity: RequestIdentity) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: identity.userId,
        accountId: identity.accountId,
        isActive: true,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User is no longer active.');
    }

    const availableRoles = user.userRoles
      .filter((userRole) => userRole.role.isActive)
      .map((userRole) => userRole.role)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return { user, availableRoles };
  }

  private mapIdentity(
    user: { id: bigint; accountId: bigint; email: string },
    role: { code: UserRoleCode; displayName: string },
  ) {
    return {
      userId: user.id.toString(),
      accountId: user.accountId.toString(),
      email: user.email,
      roleCode: role.code,
      roleName: role.displayName,
    };
  }

  private mapAvailableRoles(
    roles: { code: UserRoleCode; displayName: string }[],
  ) {
    return roles.map((role) => ({
      code: role.code,
      displayName: role.displayName,
    }));
  }

  async requestPasswordReset(email: string) {
    const users = await this.prisma.user.findMany({
      where: {
        email,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        passwordResetRequestedAt: true,
      },
    });

    if (users.length !== 1) {
      return PASSWORD_RESET_RESPONSE;
    }

    const lastRequestedAt = users[0].passwordResetRequestedAt;
    const cooldownStartedAt = new Date(
      Date.now() - RESET_REQUEST_COOLDOWN_MINUTES * 60 * 1000,
    );

    if (lastRequestedAt && lastRequestedAt > cooldownStartedAt) {
      return PASSWORD_RESET_RESPONSE;
    }

    const resetToken = randomBytes(32).toString('base64url');
    const resetTokenHash = this.hashResetToken(resetToken);
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.user.update({
      where: {
        id: users[0].id,
      },
      data: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetTokenExpiresAt: expiresAt,
        passwordResetRequestedAt: new Date(),
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail({
        to: users[0].email,
        token: resetToken,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      });
    } catch (error) {
      this.logger.error(
        `Password reset email failed for user ${users[0].id.toString()}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    if (process.env.NODE_ENV === 'production') {
      return PASSWORD_RESET_RESPONSE;
    }

    return {
      ...PASSWORD_RESET_RESPONSE,
      resetToken,
      expiresAt,
    };
  }

  async resetPassword(token: string, password: string) {
    const resetTokenHash = this.hashResetToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetTokenExpiresAt: {
          gt: new Date(),
        },
        isActive: true,
      },
      select: {
        id: true,
        accountId: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Password reset token is invalid or expired.',
      );
    }

    await this.passwordPolicyService.assertPasswordMeetsAccountPolicy(
      user.accountId,
      password,
    );

    const passwordHash = await this.authPasswordService.hashPassword(password);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });

    return {
      message: 'Password has been reset.',
    };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
