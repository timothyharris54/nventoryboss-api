import { PartialType } from '@nestjs/swagger';
import { CreateEcommerceConnectionDto } from './create-ecommerce-connection.dto';

export class UpdateEcommerceConnectionDto extends PartialType(
  CreateEcommerceConnectionDto,
) {}
