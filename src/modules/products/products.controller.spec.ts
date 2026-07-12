import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsServiceMock: {
    find: jest.Mock;
    renderProductDetailView: jest.Mock;
  };

  beforeEach(async () => {
    productsServiceMock = {
      find: jest.fn(),
      renderProductDetailView: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: ProductsService, useValue: productsServiceMock },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('renders a product detail view with the image URL when available', async () => {
    productsServiceMock.find.mockResolvedValue({
      id: 10n,
      name: 'Toy Bone',
      sku: 'TOY-1',
      imageUrl: 'https://example.com/toy.jpg',
    });
    productsServiceMock.renderProductDetailView.mockReturnValue({
      found: true,
      product: {
        id: '10',
        name: 'Toy Bone',
        imageUrl: 'https://example.com/toy.jpg',
        thumbnail: {
          url: 'https://example.com/toy.jpg',
          width: 220,
          height: 220,
        },
      },
    });

    const result = await controller.viewProduct(
      { accountId: 1n } as any,
      '10',
    );

    expect(productsServiceMock.find).toHaveBeenCalledWith(1n, 10n);
    expect(productsServiceMock.renderProductDetailView).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://example.com/toy.jpg',
      }),
    );
    expect(result).toEqual({
      found: true,
      product: {
        id: '10',
        name: 'Toy Bone',
        imageUrl: 'https://example.com/toy.jpg',
        thumbnail: {
          url: 'https://example.com/toy.jpg',
          width: 220,
          height: 220,
        },
      },
    });
  });
});
