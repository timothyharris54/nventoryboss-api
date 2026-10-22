import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { UpdatePlanningSettingsDto } from '../dto/update-planning-settings.dto';
import { PlanningSettingsService } from '../services/planning-settings.service';

@Controller('planning/settings')
@ApiTags('Planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlanningSettingsController {
  constructor(private readonly settings: PlanningSettingsService) {}

  @Get()
  get(@CurrentIdentity() identity: RequestIdentity) {
    return this.settings.getReplenishmentDefaults(identity.accountId);
  }

  @Patch()
  update(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: UpdatePlanningSettingsDto,
  ) {
    return this.settings.updateReplenishmentDefaults(identity.accountId, dto);
  }
}
