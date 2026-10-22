import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleCode } from '@prisma/client';
import { CHANNEL_SYNCHRONIZATION_ROLES } from 'src/modules/auth/constants/channel-synchronization-roles';
import { ROLES_KEY } from 'src/modules/auth/decorators/roles.decorator';
import { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { AccountsController } from './accounts.controller';
import { SalesRefreshService } from './sales-refresh.service';

describe('AccountsController', () => {
  let controller: AccountsController;

  const salesRefreshServiceMock = {
    refreshForAccount: jest.fn(),
  };

  const identity: RequestIdentity = {
    userId: 10n,
    accountId: 1n,
    email: 'timothy.harris54@gmail.com',
    roleCode: UserRoleCode.planner,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: SalesRefreshService,
          useValue: salesRefreshServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    jest.clearAllMocks();
  });

  it('calls refreshForAccount with the current account', async () => {
    salesRefreshServiceMock.refreshForAccount.mockResolvedValue({ ok: true });

    const dto = { runReplenishment: true };
    const result = await controller.refreshSales(identity, dto);

    expect(salesRefreshServiceMock.refreshForAccount).toHaveBeenCalledWith(
      1n,
      dto,
    );
    expect(result).toEqual({ ok: true });
  });

  it('restricts sales refresh to channel synchronization roles', () => {
    const handler = Object.getOwnPropertyDescriptor(
      AccountsController.prototype,
      'refreshSales',
    )?.value as object;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(
      CHANNEL_SYNCHRONIZATION_ROLES,
    );
  });
});
