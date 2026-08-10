import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { AddressesAdminController } from './addresses.admin.controller';

@Module({
  controllers: [AddressesController, AddressesAdminController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
