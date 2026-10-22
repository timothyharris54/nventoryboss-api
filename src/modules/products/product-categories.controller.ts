import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategoriesService } from './product-categories.service';

@Controller('product-categories')
@ApiTags('Product Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ProductCategoriesController {
  constructor(private readonly categories: ProductCategoriesService) {}

  @Post()
  create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.categories.create(identity.accountId, dto);
  }

  @Get()
  findAll(@CurrentIdentity() identity: RequestIdentity) {
    return this.categories.findAll(identity.accountId);
  }

  @Patch(':id')
  update(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.categories.update(identity.accountId, BigInt(id), dto);
  }

  @Delete(':id')
  remove(
    @CurrentIdentity() identity: RequestIdentity,
    @Param('id') id: string,
  ) {
    return this.categories.remove(identity.accountId, BigInt(id));
  }
}
