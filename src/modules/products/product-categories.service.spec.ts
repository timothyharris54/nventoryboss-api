import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ProductCategoriesService } from './product-categories.service';

describe('ProductCategoriesService', () => {
  const prismaMock = {
    productCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  let service: ProductCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductCategoriesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(ProductCategoriesService);
    jest.clearAllMocks();
  });

  it('creates an account-scoped category with planning defaults', async () => {
    await service.create(7n, {
      name: ' Treats ',
      safetyStock: '10',
      targetDaysOfCover: 21,
      leadTimeDays: 4,
      minReorderQty: '6',
    });

    expect(prismaMock.productCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 7n,
        name: 'Treats',
        targetDaysOfCover: 21,
        leadTimeDays: 4,
      }),
    });
  });

  it('lists only categories belonging to the account', async () => {
    await service.findAll(7n);
    expect(prismaMock.productCategory.findMany).toHaveBeenCalledWith({
      where: { accountId: 7n },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  });
});
