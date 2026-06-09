import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';

type ProductInput = {
  accountId: bigint;
  createProductDto: CreateProductDto;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  create(input: ProductInput) {
    const accountId = BigInt(input.accountId);
    const createProductDto = input.createProductDto;

    console.log('Creating product:', createProductDto);

    return this.prismaService.product.create({
      data: {
        accountId,
        sku: createProductDto.sku,
        name: createProductDto.name,
      },
    });
  }

  async findAll(accountId: bigint, query: GetProductsQueryDto = {}) {
    const take = query.take ?? 25;
    const skip = query.skip ?? 0;
    const search = query.q?.trim();

    return this.prismaService.product.findMany({
      where: {
        accountId,
        ...(search
          ? {
              OR: [
                {
                  sku: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ sku: 'asc' }, { id: 'asc' }],
      take,
      skip,
    });
  }

  async search(accountId: bigint, query: GetProductsQueryDto = {}) {
    const take = query.take ?? 25;
    const skip = query.skip ?? 0;
    const search = query.q?.trim();
    const where = {
      accountId,
      ...(search
        ? {
            OR: [
              {
                sku: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                name: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        orderBy: [{ sku: 'asc' }, { id: 'asc' }],
        take,
        skip,
      }),
      this.prismaService.product.count({
        where,
      }),
    ]);

    return {
      items,
      total,
      take,
      skip,
    };
  }

  async find(accountId: bigint, id: bigint) {
    return this.prismaService.product.findFirst({
      where: {
        accountId,
        id,
      },
      orderBy: { id: 'asc' },
    });
  }
}
