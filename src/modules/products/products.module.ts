import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductCategoriesService } from './product-categories.service';

@Module({
  providers: [ProductsService, ProductCategoriesService],
  controllers: [ProductsController, ProductCategoriesController],
  exports: [ProductsService, ProductCategoriesService],
})
export class ProductsModule {}
