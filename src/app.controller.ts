import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('App')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      app: 'NVentory Boss',
      status: 'running',
      version: '0.1.5',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
