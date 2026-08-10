import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { UserRoleCode } from '@prisma/client';

@Controller('accounts')
@ApiTags('Accounts')
@ApiBearerAuth()
@Roles(UserRoleCode.system_admin)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsAdminController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiCreatedResponse({ type: AccountResponseDto })
  @ApiForbiddenResponse({ description: 'Requires system_admin role' })
  create(@CurrentIdentity() identity: RequestIdentity, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiForbiddenResponse({ description: 'Requires system_admin role' })
  update(@CurrentIdentity() identity: RequestIdentity, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(BigInt(id), dto);
  }

  @Patch(':id/deactivate')
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiForbiddenResponse({ description: 'Requires system_admin role' })
  deactivate(@CurrentIdentity() identity: RequestIdentity, @Param('id') id: string) {
    return this.accountsService.deactivate(BigInt(id));
  }
}
