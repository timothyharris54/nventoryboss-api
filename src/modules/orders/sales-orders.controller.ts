import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestIdentity } from '../auth/interfaces/request-identity.interface';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrdersService } from './orders.service';

@Controller('sales/orders')
@ApiTags('Sales Orders')
@ApiBearerAuth()
export class SalesOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(
    @CurrentIdentity() identity: RequestIdentity,
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.ordersService.search(BigInt(identity.accountId), query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.ordersService.findOne(BigInt(identity.accountId), id);
  }
}
