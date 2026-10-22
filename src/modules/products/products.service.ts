import { BadRequestException, Injectable } from '@nestjs/common';
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

  async create(input: ProductInput) {
    const accountId = BigInt(input.accountId);
    const createProductDto = input.createProductDto;

    const categoryId = await this.resolveCategoryId(
      accountId,
      createProductDto.categoryId,
    );
    return this.prismaService.product.create({
      data: {
        accountId,
        sku: createProductDto.sku,
        name: createProductDto.name,
        imageUrl: createProductDto.imageUrl ?? null,
        excludeFromPlanning: createProductDto.excludeFromPlanning ?? false,
        categoryId,
      },
    });
  }

  async findAll(accountId: bigint, query: GetProductsQueryDto = {}) {
    const take = query.take ?? 25;
    const skip = query.skip ?? 0;
    const search = query.q?.trim();

    const products = await this.prismaService.product.findMany({
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
      include: { category: true },
      orderBy: [{ sku: 'asc' }, { id: 'asc' }],
      take,
      skip,
    });

    return products.map((product) => this.formatProductSummary(product));
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
        include: { category: true },
        orderBy: [{ sku: 'asc' }, { id: 'asc' }],
        take,
        skip,
      }),
      this.prismaService.product.count({
        where,
      }),
    ]);

    return {
      items: items.map((product) => this.formatProductSummary(product)),
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
      include: { category: true },
    });
  }

  async update(accountId: bigint, id: bigint, dto: Partial<CreateProductDto>) {
    const categoryId =
      dto.categoryId !== undefined
        ? await this.resolveCategoryId(accountId, dto.categoryId)
        : undefined;
    const result = await this.prismaService.product.updateMany({
      where: {
        accountId,
        id,
      },
      data: {
        ...(dto.sku ? { sku: dto.sku } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl ?? null }
          : {}),
        ...(dto.excludeFromPlanning !== undefined
          ? { excludeFromPlanning: dto.excludeFromPlanning }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId } : {}),
      },
    });

    if (result.count === 1 && dto.excludeFromPlanning === true) {
      await this.prismaService.reorderRecommendation.updateMany({
        where: {
          accountId,
          productId: id,
          status: { in: ['open', 'reviewed'] },
        },
        data: { status: 'superseded' },
      });
    }

    return this.prismaService.product.findFirst({
      where: {
        accountId,
        id,
      },
      include: { category: true },
    });
  }

  renderProductDetailView(
    product: {
      id?: bigint | number | null;
      name?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
      excludeFromPlanning?: boolean | null;
      category?: { id: bigint; name: string } | null;
    } | null,
  ) {
    if (!product) {
      return {
        found: false,
        product: null,
      };
    }

    return {
      found: true,
      product: this.formatProductSummary(product),
    };
  }

  private formatProductSummary(product: {
    id?: bigint | number | null;
    name?: string | null;
    sku?: string | null;
    imageUrl?: string | null;
    excludeFromPlanning?: boolean | null;
    category?: { id: bigint; name: string } | null;
  }) {
    return {
      id: product.id?.toString?.() ?? product.id,
      name: product.name ?? null,
      sku: product.sku ?? null,
      imageUrl: product.imageUrl ?? null,
      excludeFromPlanning: product.excludeFromPlanning ?? false,
      category: product.category
        ? { id: product.category.id.toString(), name: product.category.name }
        : null,
      thumbnail: product.imageUrl
        ? {
            url: product.imageUrl,
            width: 220,
            height: 220,
          }
        : null,
    };
  }

  private async resolveCategoryId(accountId: bigint, value?: string | null) {
    if (!value) return null;
    let categoryId: bigint;
    try {
      categoryId = BigInt(value);
    } catch {
      throw new BadRequestException('Invalid categoryId.');
    }
    const category = await this.prismaService.productCategory.findFirst({
      where: { accountId, id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(
        'Product category was not found for this account.',
      );
    }
    return category.id;
  }
}
