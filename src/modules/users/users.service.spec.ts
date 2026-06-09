import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const txMock = {
    user: {
      create: jest.fn(),
      update: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    userRole: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prismaMock = {
    user: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(txMock)),
  };

  const buyerRole = {
    id: 20n,
    code: UserRoleCode.buyer,
    displayName: 'Buyer',
  };
  const plannerRole = {
    id: 21n,
    code: UserRoleCode.planner,
    displayName: 'Planner',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prismaMock as unknown as PrismaService);
  });

  it('creates a user and selected roles in one transaction', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([buyerRole, plannerRole]);
    txMock.user.create.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'new@example.com',
    });
    txMock.user.findFirstOrThrow.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'new@example.com',
      fullName: 'New User',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      userRoles: [{ role: buyerRole }, { role: plannerRole }],
    });

    const result = await service.create(1n, {
      email: 'new@example.com',
      fullName: 'New User',
      roleCodes: [UserRoleCode.buyer, UserRoleCode.planner],
    });

    expect(txMock.user.create).toHaveBeenCalledWith({
      data: {
        accountId: 1n,
        email: 'new@example.com',
        fullName: 'New User',
        isActive: true,
      },
    });
    expect(txMock.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { accountId: 1n, userId: 10n, roleId: 20n },
        { accountId: 1n, userId: 10n, roleId: 21n },
      ],
    });
    expect(result.roles).toEqual([
      { code: UserRoleCode.buyer, displayName: 'Buyer' },
      { code: UserRoleCode.planner, displayName: 'Planner' },
    ]);
  });

  it('rejects duplicate user emails within the account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'new@example.com',
    });

    await expect(
      service.create(1n, {
        email: 'new@example.com',
        roleCodes: [UserRoleCode.buyer],
      }),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid role codes before creating a user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([]);

    await expect(
      service.create(1n, {
        email: 'new@example.com',
        roleCodes: [UserRoleCode.buyer],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('updates profile fields and replaces assigned roles', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 10n,
        accountId: 1n,
        email: 'old@example.com',
        fullName: 'Old User',
        isActive: true,
        userRoles: [{ role: buyerRole }],
      })
      .mockResolvedValueOnce(null);
    prismaMock.role.findMany.mockResolvedValue([plannerRole]);
    txMock.user.findFirstOrThrow.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'updated@example.com',
      fullName: 'Updated User',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      userRoles: [{ role: plannerRole }],
    });

    const result = await service.update(1n, 10n, {
      email: 'updated@example.com',
      fullName: 'Updated User',
      roleCodes: [UserRoleCode.planner],
    });

    expect(txMock.user.update).toHaveBeenCalledWith({
      where: {
        id: 10n,
      },
      data: {
        email: 'updated@example.com',
        fullName: 'Updated User',
        isActive: undefined,
      },
    });
    expect(txMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        userId: 10n,
      },
    });
    expect(txMock.userRole.createMany).toHaveBeenCalledWith({
      data: [{ accountId: 1n, userId: 10n, roleId: 21n }],
    });
    expect(result.roles).toEqual([
      { code: UserRoleCode.planner, displayName: 'Planner' },
    ]);
  });

  it('disables a user without changing assigned roles', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'user@example.com',
      fullName: 'User',
      isActive: true,
      userRoles: [{ role: buyerRole }],
    });
    txMock.user.findFirstOrThrow.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'user@example.com',
      fullName: 'User',
      isActive: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      userRoles: [{ role: buyerRole }],
    });

    const result = await service.disable(1n, 10n);

    expect(txMock.user.update).toHaveBeenCalledWith({
      where: {
        id: 10n,
      },
      data: {
        email: undefined,
        fullName: undefined,
        isActive: false,
      },
    });
    expect(txMock.userRole.deleteMany).not.toHaveBeenCalled();
    expect(result.isActive).toBe(false);
  });

  it('rejects disabling the last active system admin', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'admin@example.com',
      fullName: 'Admin',
      isActive: true,
      userRoles: [
        {
          role: {
            id: 30n,
            code: UserRoleCode.system_admin,
            displayName: 'System Admin',
          },
        },
      ],
    });
    prismaMock.user.count.mockResolvedValue(0);

    await expect(service.disable(1n, 10n)).rejects.toThrow(BadRequestException);

    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: {
        accountId: 1n,
        id: {
          not: 10n,
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
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
