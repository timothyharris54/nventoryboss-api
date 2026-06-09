import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return app status feedback', () => {
      expect(appController.getHello()).toEqual({
        app: 'Nventory Boss',
        status: 'running',
        version: '0.0.5',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });
});
