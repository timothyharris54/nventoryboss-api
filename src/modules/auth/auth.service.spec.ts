import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthTokenService } from './services/auth-token.service';
import { AuthPasswordService } from './services/auth-password.service';
import { EmailService } from '../email/email.service';
import { PasswordPolicyService } from './services/password-policy.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const authTokenServiceMock = {
    signAccessToken: jest.fn(),
  };

  const authPasswordServiceMock = {
    hashPassword: jest.fn(),
    verifyPassword: jest.fn(),
  };

  const emailServiceMock = {
    sendPasswordResetEmail: jest.fn(),
  };

  const passwordPolicyServiceMock = {
    assertPasswordMeetsAccountPolicy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    passwordPolicyServiceMock.assertPasswordMeetsAccountPolicy.mockResolvedValue(
      undefined,
    );

    service = new AuthService(
      prismaMock as unknown as PrismaService,
      authTokenServiceMock as unknown as AuthTokenService,
      authPasswordServiceMock as unknown as AuthPasswordService,
      emailServiceMock as unknown as EmailService,
      passwordPolicyServiceMock as unknown as PasswordPolicyService,
    );
  });

  it('signs the selected assigned role into the access token', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 10n,
        accountId: 1n,
        email: 'buyer@example.com',
        passwordHash: 'hash',
        userRoles: [
          {
            role: {
              code: UserRoleCode.planner,
              displayName: 'Planner',
              isActive: true,
            },
          },
          {
            role: {
              code: UserRoleCode.buyer,
              displayName: 'Buyer',
              isActive: true,
            },
          },
        ],
      },
    ]);
    authPasswordServiceMock.verifyPassword.mockResolvedValue(true);
    authTokenServiceMock.signAccessToken.mockResolvedValue('token');

    const result = await service.login(
      'buyer@example.com',
      'password',
      UserRoleCode.buyer,
    );

    expect(authTokenServiceMock.signAccessToken).toHaveBeenCalledWith({
      userId: 10n,
      accountId: 1n,
      email: 'buyer@example.com',
      roleCode: UserRoleCode.buyer,
    });
    expect(result.identity.roleCode).toBe(UserRoleCode.buyer);
    expect(result.availableRoles).toEqual([
      { code: UserRoleCode.buyer, displayName: 'Buyer' },
      { code: UserRoleCode.planner, displayName: 'Planner' },
    ]);
  });

  it('rejects role selection when the role is not assigned to the user', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 10n,
        accountId: 1n,
        email: 'buyer@example.com',
        passwordHash: 'hash',
        userRoles: [
          {
            role: {
              code: UserRoleCode.buyer,
              displayName: 'Buyer',
              isActive: true,
            },
          },
        ],
      },
    ]);
    authPasswordServiceMock.verifyPassword.mockResolvedValue(true);

    await expect(
      service.login('buyer@example.com', 'password', UserRoleCode.system_admin),
    ).rejects.toThrow(UnauthorizedException);

    expect(authTokenServiceMock.signAccessToken).not.toHaveBeenCalled();
  });

  it('defaults to system admin when no role is selected', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 10n,
        accountId: 1n,
        email: 'admin@example.com',
        passwordHash: 'hash',
        userRoles: [
          {
            role: {
              code: UserRoleCode.buyer,
              displayName: 'Buyer',
              isActive: true,
            },
          },
          {
            role: {
              code: UserRoleCode.system_admin,
              displayName: 'System Admin',
              isActive: true,
            },
          },
        ],
      },
    ]);
    authPasswordServiceMock.verifyPassword.mockResolvedValue(true);
    authTokenServiceMock.signAccessToken.mockResolvedValue('admin-token');

    const result = await service.login('admin@example.com', 'password');

    expect(result.identity.roleCode).toBe(UserRoleCode.system_admin);
    expect(authTokenServiceMock.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ roleCode: UserRoleCode.system_admin }),
    );
  });

  it('hydrates the current session with all assigned active roles', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'admin@example.com',
      isActive: true,
      userRoles: [
        {
          role: {
            code: UserRoleCode.system_admin,
            displayName: 'System Admin',
            isActive: true,
          },
        },
        {
          role: {
            code: UserRoleCode.buyer,
            displayName: 'Buyer',
            isActive: true,
          },
        },
      ],
    });

    await expect(
      service.getSession({
        userId: 10n,
        accountId: 1n,
        email: 'admin@example.com',
        roleCode: UserRoleCode.system_admin,
      }),
    ).resolves.toEqual({
      identity: {
        userId: '10',
        accountId: '1',
        email: 'admin@example.com',
        roleCode: UserRoleCode.system_admin,
        roleName: 'System Admin',
      },
      availableRoles: [
        { code: UserRoleCode.buyer, displayName: 'Buyer' },
        { code: UserRoleCode.system_admin, displayName: 'System Admin' },
      ],
    });
  });

  it('switches to an assigned role and issues a replacement token', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'admin@example.com',
      isActive: true,
      userRoles: [
        {
          role: {
            code: UserRoleCode.buyer,
            displayName: 'Buyer',
            isActive: true,
          },
        },
        {
          role: {
            code: UserRoleCode.system_admin,
            displayName: 'System Admin',
            isActive: true,
          },
        },
      ],
    });
    authTokenServiceMock.signAccessToken.mockResolvedValue('admin-token');

    const result = await service.switchRole(
      {
        userId: 10n,
        accountId: 1n,
        email: 'admin@example.com',
        roleCode: UserRoleCode.buyer,
      },
      UserRoleCode.system_admin,
    );

    expect(result.accessToken).toBe('admin-token');
    expect(result.identity.roleCode).toBe(UserRoleCode.system_admin);
    expect(authTokenServiceMock.signAccessToken).toHaveBeenCalledWith({
      userId: 10n,
      accountId: 1n,
      email: 'admin@example.com',
      roleCode: UserRoleCode.system_admin,
    });
  });

  it('rejects switching to a role that is no longer assigned', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'buyer@example.com',
      isActive: true,
      userRoles: [
        {
          role: {
            code: UserRoleCode.buyer,
            displayName: 'Buyer',
            isActive: true,
          },
        },
      ],
    });

    await expect(
      service.switchRole(
        {
          userId: 10n,
          accountId: 1n,
          email: 'buyer@example.com',
          roleCode: UserRoleCode.buyer,
        },
        UserRoleCode.system_admin,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(authTokenServiceMock.signAccessToken).not.toHaveBeenCalled();
  });

  it('rejects invalid passwords', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 10n,
        accountId: 1n,
        email: 'buyer@example.com',
        passwordHash: 'hash',
        userRoles: [],
      },
    ]);
    authPasswordServiceMock.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login('buyer@example.com', 'bad-password'),
    ).rejects.toThrow(UnauthorizedException);

    expect(authTokenServiceMock.signAccessToken).not.toHaveBeenCalled();
  });

  it('creates a password reset token without exposing whether unknown emails exist', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 10n, email: 'buyer@example.com' },
    ]);
    prismaMock.user.update.mockResolvedValue({});
    emailServiceMock.sendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await service.requestPasswordReset('buyer@example.com');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: {
        id: 10n,
      },
      data: {
        passwordResetTokenHash: expect.any(String),
        passwordResetTokenExpiresAt: expect.any(Date),
        passwordResetRequestedAt: expect.any(Date),
      },
    });
    expect(emailServiceMock.sendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'buyer@example.com',
      token: expect.any(String),
      expiresInMinutes: 30,
    });
    expect(result).toEqual({
      message:
        'If an active user exists for that email, password reset instructions will be sent.',
      resetToken: expect.any(String),
      expiresAt: expect.any(Date),
    });
  });

  it('throttles repeated password reset requests without exposing account state', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 10n,
        passwordResetRequestedAt: new Date(),
      },
    ]);

    await expect(
      service.requestPasswordReset('buyer@example.com'),
    ).resolves.toEqual({
      message:
        'If an active user exists for that email, password reset instructions will be sent.',
    });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(emailServiceMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('does not expose password reset email delivery failures', async () => {
    const loggerSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 10n, email: 'buyer@example.com' },
    ]);
    prismaMock.user.update.mockResolvedValue({});
    emailServiceMock.sendPasswordResetEmail.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(
      service.requestPasswordReset('buyer@example.com'),
    ).resolves.toEqual({
      message:
        'If an active user exists for that email, password reset instructions will be sent.',
      resetToken: expect.any(String),
      expiresAt: expect.any(Date),
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      'Password reset email failed for user 10.',
      expect.any(String),
    );
  });

  it('resets a password and clears the reset token', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 10n, accountId: 1n });
    prismaMock.user.update.mockResolvedValue({});
    authPasswordServiceMock.hashPassword.mockResolvedValue('new-hash');

    await expect(
      service.resetPassword('a'.repeat(32), 'new-password-123'),
    ).resolves.toEqual({
      message: 'Password has been reset.',
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: {
        id: 10n,
      },
      data: {
        passwordHash: 'new-hash',
        passwordChangedAt: expect.any(Date),
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });
    expect(
      passwordPolicyServiceMock.assertPasswordMeetsAccountPolicy,
    ).toHaveBeenCalledWith(1n, 'new-password-123');
  });

  it('rejects reset passwords that do not meet account policy', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 10n, accountId: 1n });
    passwordPolicyServiceMock.assertPasswordMeetsAccountPolicy.mockRejectedValue(
      new BadRequestException('Password must be at least 16 characters.'),
    );

    await expect(
      service.resetPassword('a'.repeat(32), 'short-password'),
    ).rejects.toThrow(BadRequestException);

    expect(authPasswordServiceMock.hashPassword).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired reset tokens', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.resetPassword('a'.repeat(32), 'new-password-123'),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
