import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
@Roles(UserRoleCode.system_admin)
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.usersService.findAll(identity.accountId);
  }

  @Get('roles')
  listRoles() {
    return this.usersService.listRoles();
  }

  @Post()
  create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.create(identity.accountId, createUserDto);
  }

  @Patch(':id')
  update(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(
      identity.accountId,
      BigInt(id),
      updateUserDto,
    );
  }

  @Patch(':id/disable')
  disable(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.usersService.disable(identity.accountId, BigInt(id));
  }
}
