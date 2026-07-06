import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { SalesRefreshDto } from './dto/sales-refresh.dto';
import { SalesRefreshService } from './sales-refresh.service';

@Controller('accounts/current')
@UseGuards(JwtAuthGuard)
@ApiTags('Accounts')
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly salesRefreshService: SalesRefreshService) {}

  @Post('sales-refresh')
  @HttpCode(HttpStatus.OK)
  refreshSales(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: SalesRefreshDto,
  ) {
    return this.salesRefreshService.refreshForAccount(identity.accountId, dto);
  }
}
