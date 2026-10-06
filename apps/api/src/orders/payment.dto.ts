import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { PAYMENT_METHODS } from '@lawn/contracts';

export class RecordPaymentDto {
  @IsIn(['PAYMENT', 'REFUND']) type!: 'PAYMENT' | 'REFUND';
  @IsInt() @Min(1) @Max(2_000_000_000) amount!: number;
  @IsIn(PAYMENT_METHODS) method!: (typeof PAYMENT_METHODS)[number];
  @IsOptional() @IsString() @Length(1, 200) referenceNumber?: string;
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
  @IsOptional() @IsISO8601({ strict: true }) occurredAt?: string;
}
