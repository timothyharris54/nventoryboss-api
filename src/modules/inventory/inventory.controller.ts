import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { OpeningBalanceDto } from 'src/modules/inventory/dto/opening-balance.dto';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetLedgerQueryDto } from 'src/modules/inventory/dto/get-ledger-query.dto';
import { GetBalanceQueryDto } from 'src/modules/inventory/dto/get-balance-query.dto';
import { CreateReservationDto } from 'src/modules/inventory/dto/create-reservation.dto';
import { GetReservationsQueryDto } from 'src/modules/inventory/dto/get-reservations-query.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiTags('Inventory')
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('opening-balance')
  async postOpeningBalance(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() openingBalanceDto: OpeningBalanceDto,
  ) {
    return this.inventoryService.postOpeningBalance({
      accountId: BigInt(identity.accountId),
      openingBalanceDto,
    });
  }

  @Get('balances')
  async getBalances(
    @CurrentIdentity() identity: RequestIdentity,
    @Query() filters: GetBalanceQueryDto,
  ) {
    return this.inventoryService.getBalances(identity.accountId, filters);
  }

  @Get('ledger')
  async getLedger(
    @CurrentIdentity() identity: RequestIdentity,
    @Query() query: GetLedgerQueryDto,
  ) {
    return this.inventoryService.getLedger(identity.accountId, query);
  }

  @Post('adjustments')
  async postAdjustments(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() adjustmentsDto: any,
  ) {
    return this.inventoryService.postAdjustmentEvent({
      accountId: BigInt(identity.accountId),
      adjustmentsDto,
    });
  }

  @Post('transfers')
  async postTransfers(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() transfersDto: any,
  ) {
    return this.inventoryService.postTransferEvent({
      accountId: BigInt(identity.accountId),
      transfersDto,
    });
  }

  @Post('reservations')
  async createReservation(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: CreateReservationDto,
  ) {
    return this.inventoryService.createReservation({
      accountId: BigInt(identity.accountId),
      createReservationDto: dto,
    });
  }

  @Get('reservations')
  async getReservations(
    @CurrentIdentity() identity: RequestIdentity,
    @Query() query: GetReservationsQueryDto,
  ) {
    return this.inventoryService.getReservations(identity.accountId, query);
  }

  @Post('reservations/:id/release')
  async releaseReservation(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.inventoryService.releaseReservation({
      accountId: identity.accountId,
      reservationId: id,
    });
  }

  @Post('reservations/:id/consume')
  async consumeReservation(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.inventoryService.consumeReservation({
      accountId: identity.accountId,
      reservationId: id,
    });
  }
}
