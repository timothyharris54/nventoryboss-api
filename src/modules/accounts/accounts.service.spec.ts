import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthPasswordService } from 'src/modules/auth/services/auth-password.service';
import { EmailService } from 'src/modules/email/email.service';

describe('AccountsService', () => {
  let service: AccountsService;

  type PrismaMock = {
    account: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: {
      updateMany: jest.Mock;
    };
    accountSubscription: {
      updateMany: jest.Mock;
    };
    role: {
      findUniqueOrThrow: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const prismaMock: PrismaMock = {
    account: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
    },
    accountSubscription: {
      updateMany: jest.fn(),
    },
    role: {
      findUniqueOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const authPasswordServiceMock = {
    hashPassword: jest.fn(),
  };
  const emailServiceMock = {
    sendWelcomeEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AuthPasswordService,
          useValue: authPasswordServiceMock,
        },
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('creates an account', async () => {
    authPasswordServiceMock.hashPassword.mockResolvedValue('hashed-password');
    const tx = {
      role: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 7n }),
      },
      account: {
        create: jest.fn().mockResolvedValue({ id: 1n, name: 'Acme' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({ id: 3n }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(tx),
    );

    const result = await service.create({
      name: 'Acme',
      initialAdmin: {
        email: 'admin@acme.com',
        fullName: 'Jane Smith',
        password: 'secure-password',
      },
    });

    expect(authPasswordServiceMock.hashPassword).toHaveBeenCalledWith(
      'secure-password',
    );

    expect(tx.role.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { code: 'account_admin' },
    });
    expect(tx.account.create).toHaveBeenCalledWith({
      data: {
        name: 'Acme',
        nextPurchaseOrderNumber: 1000,
      },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        accountId: 1n,
        email: 'admin@acme.com',
        fullName: 'Jane Smith',
        passwordHash: 'hashed-password',
        passwordChangedAt: expect.any(Date),
      },
    });
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: {
        accountId: 1n,
        userId: 2n,
        roleId: 7n,
      },
    });
    expect(emailServiceMock.sendWelcomeEmail).toHaveBeenCalledWith({
      to: 'admin@acme.com',
      fullName: 'Jane Smith',
      accountName: 'Acme',
      password: 'secure-password',
    });

    expect(result).toEqual({ id: 1n, name: 'Acme' });
  });

  it('updates an existing account', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 2n, name: 'Old' });
    prismaMock.account.update.mockResolvedValue({ id: 2n, name: 'New' });

    const result = await service.update(2n, { name: 'New' });

    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 2n },
      data: { name: 'New', nextPurchaseOrderNumber: undefined },
    });

    expect(result).toEqual({ id: 2n, name: 'New' });
  });

  it('throws NotFoundException when updating missing account', async () => {
    prismaMock.account.findUnique.mockResolvedValue(null);

    await expect(service.update(3n, { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deactivates account by disabling users and cancelling subscriptions', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 5n });

    prismaMock.$transaction.mockImplementation(async (cb) => {
      await cb({
        user: { updateMany: jest.fn().mockResolvedValue({}) },
        accountSubscription: { updateMany: jest.fn().mockResolvedValue({}) },
      });
    });

    const result = await service.deactivate(5n);

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 5n });
  });
});
