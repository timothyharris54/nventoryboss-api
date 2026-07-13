import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  const prismaMock = {
    reorderRecommendation: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  describe('findAll', () => {
    it('returns all recommendations for the account ordered by id asc', async () => {
      const rows = [
        { id: 1n, accountId: 10n },
        { id: 2n, accountId: 10n },
      ];

      prismaMock.reorderRecommendation.findMany.mockResolvedValue(rows);

      const result = await service.findAll(10n);

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 10n,
          product: { excludeFromPlanning: false },
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      });

      expect(result).toEqual(rows);
    });
  });

  describe('findByStatus', () => {
    it('returns recommendations for the account filtered by status', async () => {
      const rows = [
        { id: 3n, accountId: 10n, status: RecommendationStatus.open },
      ];

      prismaMock.reorderRecommendation.findMany.mockResolvedValue(rows);

      const result = await service.findByStatus(10n, RecommendationStatus.open);

      expect(prismaMock.reorderRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 10n,
          status: RecommendationStatus.open,
          product: { excludeFromPlanning: false },
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      });

      expect(result).toEqual(rows);
    });
  });

  describe('review', () => {
    it('reviews an open recommendation', async () => {
      const reviewedRow = {
        id: 4n,
        accountId: 10n,
        status: RecommendationStatus.reviewed,
        reviewedAt: new Date(),
      };

      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 1,
      });
      prismaMock.reorderRecommendation.findUnique.mockResolvedValue(
        reviewedRow,
      );

      const result: Awaited<ReturnType<RecommendationsService['review']>> =
        await service.review(10n, '4');

      expect(prismaMock.reorderRecommendation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 4n,
          accountId: 10n,
          status: {
            equals: RecommendationStatus.open,
          },
        },
        data: {
          status: RecommendationStatus.reviewed,
          reviewedAt: expect.any(Date) as Date,
        },
      });

      expect(prismaMock.reorderRecommendation.findUnique).toHaveBeenCalledWith({
        where: { id: 4n },
      });

      expect(result).toEqual(reviewedRow);
    });

    it('throws BadRequestException for invalid recommendation id', async () => {
      await expect(service.review(10n, 'abc')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        prismaMock.reorderRecommendation.updateMany,
      ).not.toHaveBeenCalled();
      expect(prismaMock.reorderRecommendation.findFirst).not.toHaveBeenCalled();
      expect(
        prismaMock.reorderRecommendation.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when recommendation is not found for the account', async () => {
      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.reorderRecommendation.findFirst.mockResolvedValue(null);

      await expect(service.review(10n, '4')).rejects.toThrow(NotFoundException);

      expect(prismaMock.reorderRecommendation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 4n,
          accountId: 10n,
        },
        select: {
          id: true,
          status: true,
        },
      });
    });

    it('throws BadRequestException when recommendation is not in open status', async () => {
      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.reorderRecommendation.findFirst.mockResolvedValue({
        id: 4n,
        status: RecommendationStatus.converted,
      });

      await expect(service.review(10n, '4')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.review(10n, '4')).rejects.toThrow(
        'Recommendation cannot be reviewed from status converted.',
      );
    });
  });

  describe('dismiss', () => {
    it('dismisses an open recommendation', async () => {
      const dismissedRow = {
        id: 5n,
        accountId: 10n,
        status: RecommendationStatus.dismissed,
        dismissedAt: new Date(),
      };

      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 1,
      });
      prismaMock.reorderRecommendation.findUnique.mockResolvedValue(
        dismissedRow,
      );

      const result: Awaited<ReturnType<RecommendationsService['dismiss']>> =
        await service.dismiss(10n, '5');

      expect(prismaMock.reorderRecommendation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 5n,
          accountId: 10n,
          status: {
            in: [RecommendationStatus.open, RecommendationStatus.reviewed],
          },
        },
        data: {
          status: RecommendationStatus.dismissed,
          dismissedAt: expect.any(Date) as Date,
        },
      });

      expect(prismaMock.reorderRecommendation.findUnique).toHaveBeenCalledWith({
        where: { id: 5n },
      });

      expect(result).toEqual(dismissedRow);
    });

    it('dismisses a reviewed recommendation', async () => {
      const dismissedRow = {
        id: 6n,
        accountId: 10n,
        status: RecommendationStatus.dismissed,
        dismissedAt: new Date(),
      };

      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 1,
      });
      prismaMock.reorderRecommendation.findUnique.mockResolvedValue(
        dismissedRow,
      );

      const result: Awaited<ReturnType<RecommendationsService['dismiss']>> =
        await service.dismiss(10n, '6');

      expect(prismaMock.reorderRecommendation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 6n,
          accountId: 10n,
          status: {
            in: [RecommendationStatus.open, RecommendationStatus.reviewed],
          },
        },
        data: {
          status: RecommendationStatus.dismissed,
          dismissedAt: expect.any(Date) as Date,
        },
      });

      expect(result).toEqual(dismissedRow);
    });

    it('throws BadRequestException for invalid recommendation id', async () => {
      await expect(service.dismiss(10n, 'bad-id')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        prismaMock.reorderRecommendation.updateMany,
      ).not.toHaveBeenCalled();
      expect(prismaMock.reorderRecommendation.findFirst).not.toHaveBeenCalled();
      expect(
        prismaMock.reorderRecommendation.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when recommendation is not found for the account', async () => {
      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.reorderRecommendation.findFirst.mockResolvedValue(null);

      await expect(service.dismiss(10n, '5')).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.reorderRecommendation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 5n,
          accountId: 10n,
        },
        select: {
          id: true,
          status: true,
        },
      });
    });

    it('throws BadRequestException when recommendation is in a terminal status', async () => {
      prismaMock.reorderRecommendation.updateMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.reorderRecommendation.findFirst.mockResolvedValue({
        id: 5n,
        status: RecommendationStatus.converted,
      });

      await expect(service.dismiss(10n, '5')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.dismiss(10n, '5')).rejects.toThrow(
        'Recommendation cannot be dismissed from status converted.',
      );
    });
  });
});
