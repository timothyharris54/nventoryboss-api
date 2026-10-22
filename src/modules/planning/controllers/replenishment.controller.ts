import {
  Controller,
  Param,
  Post,
  Query,
  BadRequestException,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReplenishmentEngineService } from 'src/modules/planning/services/replenishment-engine.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';

@Controller('planning/replenishment')
@UseGuards(JwtAuthGuard)
@ApiTags('Planning')
@ApiBearerAuth()
export class ReplenishmentController {
  constructor(
    private readonly replenishmentEngineService: ReplenishmentEngineService,
  ) {}

  @Post('product/:productId')
  async generateForProduct(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('productId') productIdParam: string,
    @Query('locationCode') locationCode?: string,
    @Query('dryRun') dryRunParam?: string,
  ) {
    const productId = this.parseBigInt(productIdParam, 'productId');
    const dryRun = this.parseBooleanQuery(dryRunParam);

    return this.replenishmentEngineService.generateForProduct(
      identity.accountId,
      productId,
      locationCode,
      dryRun,
    );
  }

  @Post('run')
  async generateForAccount(
    @CurrentIdentity() identity: RequestIdentity,
    @Query('locationCode') locationCode?: string,
    @Query('dryRun') dryRunParam?: string,
  ) {
    const dryRun = this.parseBooleanQuery(dryRunParam);
    return this.replenishmentEngineService.generateForAccount(
      identity.accountId,
      locationCode,
      dryRun,
    );
  }

  private parseBigInt(value: string, fieldName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}.`);
    }
  }

  private parseBooleanQuery(value?: string): boolean {
    if (value === undefined) return false;
    return value === 'true';
  }
}
