import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RecommendationStatus } from '@prisma/client';

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(accountId: bigint) {
    return this.prisma.reorderRecommendation.findMany({
      where: {
        accountId,
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
  }

  async findByStatus(accountId: bigint, status: RecommendationStatus) {
    return this.prisma.reorderRecommendation.findMany({
      where: {
        accountId,
        status,
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
  }

  async review(accountId: bigint, id: string) {
    let recommendationId: bigint;

    try {
      recommendationId = BigInt(id);
    } catch {
      throw new BadRequestException('Invalid recommendation id');
    }

    const reviewedAt = new Date();

    const result = await this.prisma.reorderRecommendation.updateMany({
      where: {
        id: recommendationId,
        accountId,
        status: {
          equals: RecommendationStatus.open,
        },
      },
      data: {
        status: RecommendationStatus.reviewed,
        reviewedAt,
      },
    });

    if (result.count !== 1) {
      const existing = await this.prisma.reorderRecommendation.findFirst({
        where: {
          id: recommendationId,
          accountId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Recommendation not found');
      }

      throw new BadRequestException(
        `Recommendation cannot be reviewed from status ${existing.status}.`,
      );
    }

    return this.prisma.reorderRecommendation.findUnique({
      where: { id: recommendationId },
    });
  }

  async dismiss(accountId: bigint, id: string) {
    let recommendationId: bigint;

    try {
      recommendationId = BigInt(id);
    } catch {
      throw new BadRequestException('Invalid recommendation id');
    }

    const dismissedAt = new Date();

    const result = await this.prisma.reorderRecommendation.updateMany({
      where: {
        id: recommendationId,
        accountId,
        status: {
          in: [RecommendationStatus.open, RecommendationStatus.reviewed],
        },
      },
      data: {
        status: RecommendationStatus.dismissed,
        dismissedAt,
      },
    });

    if (result.count !== 1) {
      const existing = await this.prisma.reorderRecommendation.findFirst({
        where: {
          id: recommendationId,
          accountId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Recommendation not found');
      }

      throw new BadRequestException(
        `Recommendation cannot be dismissed from status ${existing.status}.`,
      );
    }

    return this.prisma.reorderRecommendation.findUnique({
      where: { id: recommendationId },
    });
  }
}
