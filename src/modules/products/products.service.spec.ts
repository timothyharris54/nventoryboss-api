import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaMock: {
    product?: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      product: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('persists the image URL when creating a product', async () => {
    prismaMock.product?.create.mockResolvedValue({
      id: 1n,
      sku: 'SKU-1',
      name: 'Widget',
      imageUrl: 'https://example.com/widget.jpg',
    });

    await service.create({
      accountId: 7n,
      createProductDto: {
        sku: 'SKU-1',
        name: 'Widget',
        imageUrl: 'https://example.com/widget.jpg',
      } as any,
    });

    expect(prismaMock.product?.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 7n,
        sku: 'SKU-1',
        name: 'Widget',
        imageUrl: 'https://example.com/widget.jpg',
      }),
    });
  });

  it('updates a product image URL for the current account', async () => {
    prismaMock.product?.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.product?.findFirst.mockResolvedValue({
      id: 42n,
      sku: 'SKU-2',
      name: 'Gizmo',
      imageUrl: 'https://example.com/gizmo.jpg',
    });

    await service.update(7n, 42n, {
      imageUrl: 'https://example.com/gizmo.jpg',
    } as any);

    expect(prismaMock.product?.updateMany).toHaveBeenCalledWith({
      where: { accountId: 7n, id: 42n },
      data: { imageUrl: 'https://example.com/gizmo.jpg' },
    });
    expect(prismaMock.product?.findFirst).toHaveBeenCalledWith({
      where: { accountId: 7n, id: 42n },
    });
  });
});
