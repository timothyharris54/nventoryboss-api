import { SubscriptionStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertAccountSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  planCode!: string;

  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string | null;

  @IsOptional()
  @IsDateString()
  currentPeriodStartsAt?: string | null;

  @IsOptional()
  @IsDateString()
  currentPeriodEndsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @IsDateString()
  cancelledAt?: string | null;
}
