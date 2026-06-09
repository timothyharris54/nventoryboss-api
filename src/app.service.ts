import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '<h1>Welcome to Nventory Boss!</h1>';
  }
}
