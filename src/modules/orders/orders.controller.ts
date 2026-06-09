import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create({
      accountId: BigInt(identity.accountId),
      createOrderDto,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancel(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.ordersService.cancel(identity.accountId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.ordersService.findAll(identity.accountId);
  }
}
