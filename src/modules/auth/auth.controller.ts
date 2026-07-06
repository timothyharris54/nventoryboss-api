import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SwitchRoleDto } from 'src/modules/auth/dto/login.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from 'src/modules/auth/dto/password-recovery.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentIdentity } from './decorators/current-identity.decorator';
import type { RequestIdentity } from './interfaces/request-identity.interface';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password, dto.roleCode);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async getSession(@CurrentIdentity() identity: RequestIdentity) {
    return this.authService.getSession(identity);
  }

  @Post('switch-role')
  @UseGuards(JwtAuthGuard)
  async switchRole(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: SwitchRoleDto,
  ) {
    return this.authService.switchRole(identity, dto.roleCode);
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/complete')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
