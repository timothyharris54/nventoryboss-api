import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AddressesService } from './addresses.service';

describe('AddressesService', () => {
  const prismaMock = {
    address: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  let service: AddressesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AddressesService(prismaMock as unknown as PrismaService);
  });

  it('creates a normalized address for the account', async () => {
    prismaMock.address.create.mockResolvedValue({ id: 10n });

    await service.create(7n, {
      addressTypeCode: ' business ',
      label: ' ',
      addressLine1: ' 123 Main Street ',
      city: ' Atlanta ',
      region: ' GA ',
      postalCode: ' 30303 ',
      countryCode: ' us ',
    });

    expect(prismaMock.address.create).toHaveBeenCalledWith({
      data: {
        accountId: 7n,
        addressTypeCode: 'business',
        label: null,
        recipientName: undefined,
        companyName: undefined,
        addressLine1: '123 Main Street',
        addressLine2: undefined,
        city: 'Atlanta',
        region: 'GA',
        postalCode: '30303',
        countryCode: 'US',
      },
    });
  });

  it('lists only addresses belonging to the account', async () => {
    prismaMock.address.findMany.mockResolvedValue([]);

    await service.findAll(7n);

    expect(prismaMock.address.findMany).toHaveBeenCalledWith({
      where: { accountId: 7n },
      orderBy: [{ addressTypeCode: 'asc' }, { id: 'asc' }],
    });
  });

  it('rejects access to an address outside the account', async () => {
    prismaMock.address.findFirst.mockResolvedValue(null);

    await expect(service.findOne(7n, 99n)).rejects.toThrow(NotFoundException);
    expect(prismaMock.address.findFirst).toHaveBeenCalledWith({
      where: { accountId: 7n, id: 99n },
    });
  });

  it('updates an address after verifying account ownership', async () => {
    prismaMock.address.findFirst.mockResolvedValue({ id: 10n, accountId: 7n });
    prismaMock.address.update.mockResolvedValue({ id: 10n });

    await service.update(7n, 10n, { city: ' Savannah ', addressLine2: null });

    expect(prismaMock.address.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: {
        addressTypeCode: undefined,
        label: undefined,
        recipientName: undefined,
        companyName: undefined,
        addressLine1: undefined,
        addressLine2: null,
        city: 'Savannah',
        region: undefined,
        postalCode: undefined,
        countryCode: undefined,
      },
    });
  });

  it('deletes an address after verifying account ownership', async () => {
    prismaMock.address.findFirst.mockResolvedValue({ id: 10n, accountId: 7n });
    prismaMock.address.delete.mockResolvedValue({ id: 10n });

    await service.remove(7n, 10n);

    expect(prismaMock.address.delete).toHaveBeenCalledWith({
      where: { id: 10n },
    });
  });
});
