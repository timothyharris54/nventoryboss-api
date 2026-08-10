import { UserRoleCode } from '@prisma/client';
import { ROLES_KEY } from 'src/modules/auth/decorators/roles.decorator';
import { AddressesAdminController } from './addresses.admin.controller';
import { AddressesService } from './addresses.service';

describe('AddressesAdminController', () => {
  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  let controller: AddressesAdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AddressesAdminController(
      serviceMock as unknown as AddressesService,
    );
  });

  it('requires the system_admin role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AddressesAdminController)).toEqual([
      UserRoleCode.system_admin,
    ]);
  });

  it('uses the account id route parameter for every operation', async () => {
    const createDto = {
      addressTypeCode: 'business',
      addressLine1: '123 Main Street',
      city: 'Atlanta',
      countryCode: 'US',
    };
    const updateDto = { city: 'Savannah' };

    await controller.findAll('7');
    await controller.findOne('7', '10');
    await controller.create('7', createDto);
    await controller.update('7', '10', updateDto);
    await controller.remove('7', '10');

    expect(serviceMock.findAll).toHaveBeenCalledWith(7n);
    expect(serviceMock.findOne).toHaveBeenCalledWith(7n, 10n);
    expect(serviceMock.create).toHaveBeenCalledWith(7n, createDto);
    expect(serviceMock.update).toHaveBeenCalledWith(7n, 10n, updateDto);
    expect(serviceMock.remove).toHaveBeenCalledWith(7n, 10n);
  });
});
