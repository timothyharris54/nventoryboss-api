import { Controller, Param, Patch, UseGuards, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { RecommendationsService } from '../services/recommendations.service';
import { RecommendationStatus } from '@prisma/client';

@Controller('planning/recommendations')
@UseGuards(JwtAuthGuard)
@ApiTags('Planning')
@ApiBearerAuth()
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Patch(':id/dismiss')
  async cancel(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.recommendationsService.dismiss(identity.accountId, id);
  }

  @Patch(':id/review')
  async review(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.recommendationsService.review(identity.accountId, id);
  }

  @Get('all')
  async findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.recommendationsService.findAll(identity.accountId);
  }

  @Get('open')
  async findOpen(@CurrentIdentity() identity: RequestIdentity) {
    return this.recommendationsService.findByStatus(
      identity.accountId,
      RecommendationStatus.open,
    );
  }
}
