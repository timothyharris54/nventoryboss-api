import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductsService } from 'src/modules/products/products.service';
import { CreateProductDto } from 'src/modules/products/dto/create-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from 'src/modules/auth/decorators/current-identity.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';

@Controller('products')
@ApiTags('Products')
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create({
      accountId: BigInt(identity.accountId),
      createProductDto,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @CurrentIdentity() identity: RequestIdentity,
    @Query() query: GetProductsQueryDto,
  ) {
    return this.productsService.findAll(BigInt(identity.accountId), query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(
    @CurrentIdentity() identity: RequestIdentity,
    @Query() query: GetProductsQueryDto,
  ) {
    return this.productsService.search(BigInt(identity.accountId), query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('byId')
  findById(@CurrentIdentity() identity: RequestIdentity, productId: string) {
    return this.productsService.find(
      BigInt(identity.accountId),
      BigInt(productId),
    );
  }
}
