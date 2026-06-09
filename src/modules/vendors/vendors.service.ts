import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

type VendorInput = {
  accountId: bigint;
  createVendorDto: CreateVendorDto;
};

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: VendorInput) {
    const accountId = input.accountId;
    const dto = input.createVendorDto;

    return this.prisma.vendor.create({
      data: {
        accountId,
        name: dto.name,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        defaultLeadTimeDays: dto.defaultLeadTimeDays,
        paymentTerms: dto.paymentTerms,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
    });
  }

  async findAll(accountId: bigint) {
    return this.prisma.vendor.findMany({
      where: {
        accountId,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async update(input: {
    accountId: bigint;
    id: bigint;
    updateVendorDto: UpdateVendorDto;
  }) {
    const { accountId, id, updateVendorDto } = input;

    // Check if the vendor exists and belongs to the account
    const existingVendor = await this.prisma.vendor.findFirst({
      where: {
        id,
        accountId,
      },
    }); // Changed to lowercase
    if (!existingVendor) {
      throw new NotFoundException('Vendor not found');
    }

    return this.prisma.vendor.update({
      where: {
        id,
        accountId,
      },
      data: {
        ...updateVendorDto,
      },
    });
  }
}
