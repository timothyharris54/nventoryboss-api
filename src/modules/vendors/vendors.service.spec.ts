import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('VendorsService', () => {
  let service: VendorsService;

  const prismaMock = {
    vendor: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    vendorPlatform: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('updates a vendor with account scoping', async () => {
      const existingVendor = {
        id: 10n,
        accountId: 1n,
        name: 'Old Vendor',
      };
      const updateVendorDto = {
        name: 'Updated Vendor',
        contactEmail: 'buyer@example.com',
        defaultLeadTimeDays: 7,
        isActive: true,
      };
      const updatedVendor = {
        ...existingVendor,
        ...updateVendorDto,
      };

      prismaMock.vendor.findFirst.mockResolvedValue(existingVendor);
      prismaMock.vendor.update.mockResolvedValue(updatedVendor);

      const result = await service.update({
        accountId: 1n,
        id: 10n,
        updateVendorDto,
      });

      expect(prismaMock.vendor.findFirst).toHaveBeenCalledWith({
        where: {
          id: 10n,
          accountId: 1n,
        },
      });
      expect(prismaMock.vendor.update).toHaveBeenCalledWith({
        where: {
          id: 10n,
          accountId: 1n,
        },
        data: updateVendorDto,
        include: {
          platform: true,
        },
      });
      expect(result).toEqual(updatedVendor);
    });

    it('throws NotFoundException when the vendor is not in the account', async () => {
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      await expect(
        service.update({
          accountId: 1n,
          id: 10n,
          updateVendorDto: { name: 'Updated Vendor' },
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.vendor.update).not.toHaveBeenCalled();
    });
  });

  describe('platforms', () => {
    it('creates a platform and redacts credentials', async () => {
      prismaMock.vendorPlatform.create.mockResolvedValue({
        id: 20n,
        accountId: 1n,
        name: 'Faire.com',
        credentials: {
          password: 'secret',
        },
        isActive: true,
      });

      const result = await service.createPlatform({
        accountId: 1n,
        dto: {
          name: ' Faire.com ',
          paymentTerms: '60 Days Net',
          credentials: {
            password: 'secret',
          },
        },
      });

      expect(prismaMock.vendorPlatform.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 1n,
          name: 'Faire.com',
          paymentTerms: '60 Days Net',
          credentials: {
            password: 'secret',
          },
        }),
      });
      expect(result).toMatchObject({
        id: 20n,
        hasCredentials: true,
        credentialKeys: ['password'],
      });
      expect(result).not.toHaveProperty('credentials');
    });

    it('maps duplicate platform names to ConflictException', async () => {
      prismaMock.vendorPlatform.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.createPlatform({
          accountId: 1n,
          dto: {
            name: 'Faire.com',
          },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('maps duplicate platform names on update to ConflictException', async () => {
      prismaMock.vendorPlatform.findFirst.mockResolvedValue({
        id: 20n,
        accountId: 1n,
      });
      prismaMock.vendorPlatform.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.updatePlatform({
          accountId: 1n,
          id: 20n,
          dto: {
            name: 'Faire.com',
          },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('assigns a vendor to an account-scoped platform', async () => {
      prismaMock.vendorPlatform.findFirst.mockResolvedValue({ id: 20n });
      prismaMock.vendor.create.mockResolvedValue({
        id: 10n,
        accountId: 1n,
        platformId: 20n,
        name: 'Dexas',
      });

      await service.create({
        accountId: 1n,
        createVendorDto: {
          name: 'Dexas',
          platformId: '20',
        },
      });

      expect(prismaMock.vendorPlatform.findFirst).toHaveBeenCalledWith({
        where: {
          id: 20n,
          accountId: 1n,
        },
        select: {
          id: true,
        },
      });
      expect(prismaMock.vendor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 1n,
          platformId: 20n,
          name: 'Dexas',
        }),
      });
    });
  });
});
