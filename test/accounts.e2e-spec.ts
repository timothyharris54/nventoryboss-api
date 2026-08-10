import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRoleCode } from '@prisma/client';

describe('Accounts admin (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let nonAdminAuthToken: string;

  const prismaMock = {
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
  } as any;

  beforeAll(async () => {
    if (!('toJSON' in BigInt.prototype)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (BigInt.prototype as any).toJSON = function () {
        return this.toString();
      };
    }

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
    authToken = sign(
      {
        sub: '1',
        accountId: '1',
        email: 'admin@example.com',
        roleCode: UserRoleCode.system_admin,
      },
      process.env.JWT_SECRET,
    );
    nonAdminAuthToken = sign(
      {
        sub: '2',
        accountId: '1',
        email: 'user@example.com',
        roleCode: UserRoleCode.planner,
      },
      process.env.JWT_SECRET,
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an account via POST /accounts', async () => {
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

    const response = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'NewCo',
        initialAdmin: {
          email: 'admin@newco.com',
          fullName: 'NewCo Admin',
          password: 'secure-password',
        },
      })
      .expect(201);

    expect(tx.account.create).toHaveBeenCalledWith({
      data: { name: 'NewCo', nextPurchaseOrderNumber: 1000 },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        accountId: 10n,
        email: 'admin@newco.com',
        fullName: 'NewCo Admin',
        passwordHash: expect.stringMatching(/^scrypt\$/),
        passwordChangedAt: expect.any(Date),
      },
    });
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { accountId: 10n, userId: 11n, roleId: 5n },
    });
    expect(response.body).toEqual({ id: '10', name: 'NewCo' });
  });

  it('updates an account via PATCH /accounts/:id', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 20n, name: 'Old' });
    prismaMock.account.update.mockResolvedValue({ id: 20n, name: 'Updated' });

    const response = await request(app.getHttpServer())
      .patch('/accounts/20')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated' })
      .expect(200);

    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 20n },
      data: { name: 'Updated', nextPurchaseOrderNumber: undefined },
    });
    expect(response.body).toEqual({ id: '20', name: 'Updated' });
  });

  it('deactivates an account via PATCH /accounts/:id/deactivate', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ id: 30n });
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { updateMany: jest.fn().mockResolvedValue({}) },
        accountSubscription: { updateMany: jest.fn().mockResolvedValue({}) },
      });
    });

    const response = await request(app.getHttpServer())
      .patch('/accounts/30/deactivate')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(response.body).toEqual({ id: '30' });
  });

  it('rejects non-admin users with 403', async () => {
    await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${nonAdminAuthToken}`)
      .send({ name: 'BlockedCo' })
      .expect(403);
  });
});
