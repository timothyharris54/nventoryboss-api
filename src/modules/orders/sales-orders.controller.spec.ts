import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleCode } from '@prisma/client';
import type { RequestIdentity } from '../auth/interfaces/request-identity.interface';
import { OrdersService } from './orders.service';
import { SalesOrdersController } from './sales-orders.controller';

describe('SalesOrdersController', () => {
  let controller: SalesOrdersController;
  const identity: RequestIdentity = {
    userId: 1n,
    accountId: 7n,
    email: 'buyer@example.com',
    roleCode: UserRoleCode.planner,
  };
  const ordersServiceMock = {
    search: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesOrdersController],
      providers: [{ provide: OrdersService, useValue: ordersServiceMock }],
    }).compile();

    controller = module.get<SalesOrdersController>(SalesOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('searches sales orders for the current account', async () => {
    const result = { items: [], total: 0, take: 25, skip: 0 };
    ordersServiceMock.search.mockResolvedValue(result);

    await expect(controller.search(identity, { q: '79377' })).resolves.toBe(
      result,
    );

    expect(ordersServiceMock.search).toHaveBeenCalledWith(7n, { q: '79377' });
  });

  it('finds one sales order for the current account', async () => {
    const result = { id: 11n };
    ordersServiceMock.findOne.mockResolvedValue(result);

    await expect(controller.findOne(identity, '11')).resolves.toBe(result);

    expect(ordersServiceMock.findOne).toHaveBeenCalledWith(7n, '11');
  });
});
