import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleCode } from '@prisma/client';
import { SalesDailyController } from './sales-daily.controller';
import { SalesDailyService } from '../../services/sales-daily.service';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';

describe('SalesDailyController', () => {
  let controller: SalesDailyController;

  const identity: RequestIdentity = {
    userId: 10n,
    accountId: 1n,
    email: 'test@example.com',
    roleCode: UserRoleCode.planner,
  };

  const salesDailyServiceMock = {
    rebuildForAccount: jest.fn(),
    rebuildForProduct: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesDailyController],
      providers: [
        {
          provide: SalesDailyService,
          useValue: salesDailyServiceMock,
        },
      ],
    }).compile();

    controller = module.get<SalesDailyController>(SalesDailyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
