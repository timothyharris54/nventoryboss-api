import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

describe('AddressesController', () => {
  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const identity = {
    userId: 2n,
    accountId: 7n,
    email: 'user@example.com',
    roleCode: 'account_admin' as const,
  };
  let controller: AddressesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AddressesController(
      serviceMock as unknown as AddressesService,
    );
  });

  it('passes the authenticated account to create', async () => {
    const dto = {
      addressTypeCode: 'business',
      addressLine1: '123 Main Street',
      city: 'Atlanta',
      countryCode: 'US',
    };

    await controller.create(identity, dto);

    expect(serviceMock.create).toHaveBeenCalledWith(7n, dto);
  });

  it('passes the authenticated account to each scoped operation', async () => {
    await controller.findAll(identity);
    await controller.findOne(identity, '10');
    await controller.update(identity, '10', { city: 'Savannah' });
    await controller.remove(identity, '10');

    expect(serviceMock.findAll).toHaveBeenCalledWith(7n);
    expect(serviceMock.findOne).toHaveBeenCalledWith(7n, 10n);
    expect(serviceMock.update).toHaveBeenCalledWith(7n, 10n, {
      city: 'Savannah',
    });
    expect(serviceMock.remove).toHaveBeenCalledWith(7n, 10n);
  });
});
