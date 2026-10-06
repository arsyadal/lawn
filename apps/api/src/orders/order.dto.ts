import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import type { OrderStatus as ContractOrderStatus, PaymentMethod as ContractPaymentMethod } from '@lawn/contracts';

export class CreateOrderItemDto {
  @IsUUID() serviceId!: string;
  @IsString() @Length(1, 100) brand!: string;
  @IsString() @Length(1, 100) model!: string;
  @IsString() @Length(1, 100) color!: string;
  @IsOptional() @IsString() @Length(1, 30) size?: string;
  @IsOptional() @IsString() @Length(1, 2000) conditionNotes?: string;
  @IsOptional() @IsString() @Length(1, 2000) specialRequest?: string;
}

export class InitialPaymentDto {
  @IsInt() @Min(1) @Max(2_000_000_000) amount!: number;
  @IsEnum(PaymentMethod) method!: ContractPaymentMethod;
  @IsOptional() @IsString() @Length(1, 200) referenceNumber?: string;
}

export class CreateOrderDto {
  @IsUUID() customerId!: string;
  @IsISO8601({ strict: true }) estimatedCompletion!: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) discount?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
  @IsOptional() @ValidateNested() @Type(() => InitialPaymentDto) initialPayment?: InitialPaymentDto;
}

export class UpdateOrderItemPriceDto {
  @IsUUID() itemId!: string;
  @IsInt() @Min(0) @Max(2_000_000_000) price!: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsISO8601({ strict: true }) estimatedCompletion?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) discount?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => UpdateOrderItemPriceDto)
  itemPrices?: UpdateOrderItemPriceDto[];
}

export class TransitionOrderDto {
  @IsEnum(OrderStatus) status!: ContractOrderStatus;
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
}

export class UpdateTreatmentNotesDto {
  @IsOptional() @IsString() @Length(1, 2000) treatmentNotes?: string;
}
