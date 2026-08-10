import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  create(accountId: bigint, dto: CreateAddressDto) {
    return this.prisma.address.create({
      data: {
        accountId,
        addressTypeCode: dto.addressTypeCode.trim(),
        label: this.normalizeOptional(dto.label),
        recipientName: this.normalizeOptional(dto.recipientName),
        companyName: this.normalizeOptional(dto.companyName),
        addressLine1: dto.addressLine1.trim(),
        addressLine2: this.normalizeOptional(dto.addressLine2),
        city: dto.city.trim(),
        region: this.normalizeOptional(dto.region),
        postalCode: this.normalizeOptional(dto.postalCode),
        countryCode: dto.countryCode.trim().toUpperCase(),
      },
    });
  }

  findAll(accountId: bigint) {
    return this.prisma.address.findMany({
      where: { accountId },
      orderBy: [{ addressTypeCode: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(accountId: bigint, id: bigint) {
    const address = await this.prisma.address.findFirst({
      where: { accountId, id },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async update(accountId: bigint, id: bigint, dto: UpdateAddressDto) {
    await this.findOne(accountId, id);

    return this.prisma.address.update({
      where: { id },
      data: this.toAddressUpdateData(dto),
    });
  }

  async remove(accountId: bigint, id: bigint) {
    await this.findOne(accountId, id);

    return this.prisma.address.delete({ where: { id } });
  }

  private toAddressUpdateData(
    dto: UpdateAddressDto,
  ): Prisma.AddressUncheckedUpdateInput {
    return {
      addressTypeCode: this.normalizeRequired(dto.addressTypeCode),
      label: this.normalizeOptional(dto.label),
      recipientName: this.normalizeOptional(dto.recipientName),
      companyName: this.normalizeOptional(dto.companyName),
      addressLine1: this.normalizeRequired(dto.addressLine1),
      addressLine2: this.normalizeOptional(dto.addressLine2),
      city: this.normalizeRequired(dto.city),
      region: this.normalizeOptional(dto.region),
      postalCode: this.normalizeOptional(dto.postalCode),
      countryCode: dto.countryCode?.trim().toUpperCase(),
    };
  }

  private normalizeRequired(value: string | undefined) {
    return value?.trim();
  }

  private normalizeOptional(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = value.trim();
    return normalized || null;
  }
}
