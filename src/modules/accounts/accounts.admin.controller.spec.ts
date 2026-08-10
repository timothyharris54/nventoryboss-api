import { Test, TestingModule } from '@nestjs/testing';
import { AccountsAdminController } from './accounts.admin.controller';
import { AccountsService } from './accounts.service';

describe('AccountsAdminController', () => {
  let controller: AccountsAdminController;

  const accountsServiceMock = {
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsAdminController],
      providers: [
        {
          provide: AccountsService,
          useValue: accountsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AccountsAdminController>(AccountsAdminController);
  });

  it('calls service.create', async () => {
    accountsServiceMock.create.mockResolvedValue({ id: 1n, name: 'A' });

    const dto = { name: 'A' } as any;
    const result = await controller.create({} as any, dto);

    expect(accountsServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 1n, name: 'A' });
  });

  it('calls service.update', async () => {
    accountsServiceMock.update.mockResolvedValue({ id: 2n, name: 'B' });

    const dto = { name: 'B' } as any;
    const result = await controller.update({} as any, '2', dto);

    expect(accountsServiceMock.update).toHaveBeenCalledWith(2n, dto);
    expect(result).toEqual({ id: 2n, name: 'B' });
  });

  it('calls service.deactivate', async () => {
    accountsServiceMock.deactivate.mockResolvedValue({ id: 3n });

    const result = await controller.deactivate({} as any, '3');

    expect(accountsServiceMock.deactivate).toHaveBeenCalledWith(3n);
    expect(result).toEqual({ id: 3n });
  });
});
