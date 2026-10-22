import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(accountId: bigint, dto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({
      data: { accountId, ...this.toData(dto), name: dto.name.trim() },
    });
  }

  findAll(accountId: bigint) {
    return this.prisma.productCategory.findMany({
      where: { accountId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async update(accountId: bigint, id: bigint, dto: UpdateProductCategoryDto) {
    const result = await this.prisma.productCategory.updateMany({
      where: { accountId, id },
      data: this.toData(dto),
    });
    if (!result.count)
      throw new NotFoundException('Product category not found.');
    return this.prisma.productCategory.findFirst({ where: { accountId, id } });
  }

  async remove(accountId: bigint, id: bigint) {
    const result = await this.prisma.productCategory.deleteMany({
      where: { accountId, id },
    });
    if (!result.count)
      throw new NotFoundException('Product category not found.');
    return { deleted: true };
  }

  private toData(dto: Partial<CreateProductCategoryDto>): {
    name?: string;
    description?: string | null;
    safetyStock?: Prisma.Decimal | null;
    targetDaysOfCover?: number | null;
    leadTimeDays?: number | null;
    minReorderQty?: Prisma.Decimal | null;
    locationCode?: string | null;
  } {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.safetyStock !== undefined
        ? {
            safetyStock:
              dto.safetyStock === null
                ? null
                : new Prisma.Decimal(dto.safetyStock),
          }
        : {}),
      ...(dto.targetDaysOfCover !== undefined
        ? { targetDaysOfCover: dto.targetDaysOfCover }
        : {}),
      ...(dto.leadTimeDays !== undefined
        ? { leadTimeDays: dto.leadTimeDays }
        : {}),
      ...(dto.minReorderQty !== undefined
        ? {
            minReorderQty:
              dto.minReorderQty === null
                ? null
                : new Prisma.Decimal(dto.minReorderQty),
          }
        : {}),
      ...(dto.locationCode !== undefined
        ? { locationCode: dto.locationCode?.trim() || null }
        : {}),
    };
  }
}
