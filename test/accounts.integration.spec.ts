import express from 'express';
import request from 'supertest';
import { AccountsAdminController } from 'src/modules/accounts/accounts.admin.controller';
import { AccountsService } from 'src/modules/accounts/accounts.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

describe('Accounts integration (admin endpoints)', () => {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  const prismaMock = {
    account: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { updateMany: jest.fn() },
    accountSubscription: { updateMany: jest.fn() },
    role: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  } as any;

  let app: express.Express;

  beforeAll(() => {
    const accountsService = new AccountsService(
      prismaMock,
      {
        hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      } as any,
      {
        sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
    const controller = new AccountsAdminController(accountsService as any);

    app = express();
    app.use(express.json());

    // Bind routes directly to controller methods, injecting a system_admin identity
    app.post('/accounts', async (req, res) => {
      try {
        const result = await controller.create(
          {
            userId: 1n,
            accountId: 1n,
            email: 'a',
            roleCode: 'system_admin' as any,
          },
          req.body,
        );
        res.status(201).json(result);
      } catch (err: any) {
        res.status(500).json({ message: err.message, stack: err.stack });
      }
    });

    app.patch('/accounts/:id', async (req, res) => {
      try {
        const result = await controller.update(
          {
            userId: 1n,
            accountId: 1n,
            email: 'a',
            roleCode: 'system_admin' as any,
          },
          req.params.id,
          req.body,
        );
        res.status(200).json(result);
      } catch (err: any) {
        res.status(500).json({ message: err.message, stack: err.stack });
      }
    });

    app.patch('/accounts/:id/deactivate', async (req, res) => {
      try {
        const result = await controller.deactivate(
          {
            userId: 1n,
            accountId: 1n,
            email: 'a',
            roleCode: 'system_admin' as any,
          },
          req.params.id,
        );
        res.status(200).json(result);
      } catch (err: any) {
        res.status(500).json({ message: err.message, stack: err.stack });
      }
    });
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /accounts creates an account', async () => {
    const tx = {
      role: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 5n }) },
      account: {
        create: jest.fn().mockResolvedValue({ id: 10n, name: 'NewCo' }),
      },
      user: { create: jest.fn().mockResolvedValue({ id: 11n }) },
      userRole: { create: jest.fn().mockResolvedValue({ id: 12n }) },
    };
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    );

    const res = await request(app)
      .post('/accounts')
      .send({
        name: 'NewCo',
        initialAdmin: {
          email: 'admin@newco.com',
          fullName: 'NewCo Admin',
          password: 'secure-password',
        },
      });
    // debug on failure
    if (res.status !== 201)
      console.error('POST /accounts error body:', res.body);

    expect(res.status).toBe(201);
    expect(tx.account.create).toHaveBeenCalledWith({
      data: { name: 'NewCo', nextPurchaseOrderNumber: 1000 },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        accountId: 10n,
        email: 'admin@newco.com',
        fullName: 'NewCo Admin',
        passwordHash: 'hashed-password',
        passwordChangedAt: expect.any(Date),
      },
    });
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { accountId: 10n, userId: 11n, roleId: 5n },
    });

    expect(res.body).toEqual({ id: '10', name: 'NewCo' });
  });

  it('PATCH /accounts/:id updates an account', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 20n, name: 'Old' });
    prismaMock.account.update.mockResolvedValue({ id: 20n, name: 'Updated' });

    const res = await request(app)
      .patch('/accounts/20')
      .send({ name: 'Updated' });
    if (res.status !== 200)
      console.error('PATCH /accounts/20 error body:', res.body);

    expect(res.status).toBe(200);
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 20n },
      data: { name: 'Updated', nextPurchaseOrderNumber: undefined },
    });

    expect(res.body).toEqual({ id: '20', name: 'Updated' });
  });

  it('PATCH /accounts/:id/deactivate deactivates an account', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 30n });

    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      await cb({
        user: { updateMany: jest.fn().mockResolvedValue({}) },
        accountSubscription: { updateMany: jest.fn().mockResolvedValue({}) },
      });
    });

    const res = await request(app).patch('/accounts/30/deactivate');
    if (res.status !== 200)
      console.error('PATCH /accounts/30/deactivate error body:', res.body);

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(res.body).toEqual({ id: '30' });
  });
});
