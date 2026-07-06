import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthPasswordService } from 'src/modules/auth/services/auth-password.service';
import { PasswordPolicyService } from 'src/modules/auth/services/password-policy.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async findAll(accountId: bigint) {
    const users = await this.prisma.user.findMany({
      where: { accountId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return users.map((user) => this.toUserMaintenanceResponse(user));
  }

  async listRoles() {
    return this.prisma.role.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });
  }

  async create(accountId: bigint, dto: CreateUserDto) {
    await this.assertEmailAvailable(accountId, dto.email);

    if (dto.password !== undefined && dto.temporaryPassword !== undefined) {
      throw new BadRequestException(
        'Only one of `password` or `temporaryPassword` may be provided.',
      );
    }

    const roles = await this.resolveRoles(dto.roleCodes);
    const passwordValue = dto.password ?? dto.temporaryPassword;
    if (passwordValue !== undefined) {
      await this.passwordPolicyService.assertPasswordMeetsAccountPolicy(
        accountId,
        passwordValue,
      );
    }

    const passwordHash = passwordValue !== undefined
      ? await this.authPasswordService.hashPassword(passwordValue)
      : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          accountId,
          email: dto.email,
          fullName: dto.fullName,
          passwordHash,
          passwordChangedAt: passwordHash ? new Date() : undefined,
          isActive: dto.isActive ?? true,
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          accountId,
          userId: createdUser.id,
          roleId: role.id,
        })),
      });

      return tx.user.findFirstOrThrow({
        where: {
          id: createdUser.id,
          accountId,
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    return this.toUserMaintenanceResponse(user);
  }

  async update(accountId: bigint, userId: bigint, dto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        accountId,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== existingUser.email) {
      await this.assertEmailAvailable(accountId, dto.email, userId);
    }

    const roles = dto.roleCodes ? await this.resolveRoles(dto.roleCodes) : null;
    if (dto.password !== undefined) {
      await this.passwordPolicyService.assertPasswordMeetsAccountPolicy(
        accountId,
        dto.password,
      );
    }

    const passwordHash = dto.password !== undefined
      ? await this.authPasswordService.hashPassword(dto.password)
      : undefined;
    const nextRoleCodes =
      roles?.map((role) => role.code) ??
      existingUser.userRoles.map((userRole) => userRole.role.code);
    const nextIsActive = dto.isActive ?? existingUser.isActive;

    await this.assertSystemAdminAccessRemains(
      accountId,
      existingUser,
      nextIsActive,
      nextRoleCodes,
    );

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash,
          passwordChangedAt: passwordHash ? new Date() : undefined,
          passwordResetTokenHash: passwordHash ? null : undefined,
          passwordResetTokenExpiresAt: passwordHash ? null : undefined,
          passwordResetRequestedAt: passwordHash ? null : undefined,
          isActive: dto.isActive,
        },
      });

      if (roles) {
        await tx.userRole.deleteMany({
          where: {
            accountId,
            userId,
          },
        });

        await tx.userRole.createMany({
          data: roles.map((role) => ({
            accountId,
            userId,
            roleId: role.id,
          })),
        });
      }

      return tx.user.findFirstOrThrow({
        where: {
          id: userId,
          accountId,
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    return this.toUserMaintenanceResponse(user);
  }

  async disable(accountId: bigint, userId: bigint) {
    return this.update(accountId, userId, { isActive: false });
  }

  private async assertEmailAvailable(
    accountId: bigint,
    email: string,
    currentUserId?: bigint,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        accountId,
        email,
      },
    });

    if (existingUser && existingUser.id !== currentUserId) {
      throw new ConflictException('Email is already assigned to a user.');
    }
  }

  private async resolveRoles(roleCodes: UserRoleCode[]) {
    const distinctRoleCodes = [...new Set(roleCodes)];

    if (distinctRoleCodes.length === 0) {
      throw new BadRequestException('At least one role is required.');
    }

    const roles = await this.prisma.role.findMany({
      where: {
        code: {
          in: distinctRoleCodes,
        },
        isActive: true,
      },
    });

    if (roles.length !== distinctRoleCodes.length) {
      throw new BadRequestException('One or more roles are invalid.');
    }

    return roles;
  }

  private async assertSystemAdminAccessRemains(
    accountId: bigint,
    user: {
      id: bigint;
      isActive: boolean;
      userRoles: {
        role: {
          code: UserRoleCode;
        };
      }[];
    },
    nextIsActive: boolean,
    nextRoleCodes: UserRoleCode[],
  ) {
    const currentlyActiveSystemAdmin =
      user.isActive &&
      user.userRoles.some(
        (userRole) => userRole.role.code === UserRoleCode.system_admin,
      );

    if (!currentlyActiveSystemAdmin) {
      return;
    }

    const remainsActiveSystemAdmin =
      nextIsActive && nextRoleCodes.includes(UserRoleCode.system_admin);

    if (remainsActiveSystemAdmin) {
      return;
    }

    const remainingSystemAdmins = await this.prisma.user.count({
      where: {
        accountId,
        id: {
          not: user.id,
        },
        isActive: true,
        userRoles: {
          some: {
            role: {
              code: UserRoleCode.system_admin,
              isActive: true,
            },
          },
        },
      },
    });

    if (remainingSystemAdmins === 0) {
      throw new BadRequestException(
        'At least one active system admin is required.',
      );
    }
  }

  private toUserMaintenanceResponse(user: {
    id: bigint;
    accountId: bigint;
    email: string;
    fullName: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userRoles: {
      role: {
        code: UserRoleCode;
        displayName: string;
      };
    }[];
  }) {
    const roles = user.userRoles
      .map((userRole) => userRole.role)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return {
      id: user.id,
      accountId: user.accountId,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: roles.map((role) => ({
        code: role.code,
        displayName: role.displayName,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
