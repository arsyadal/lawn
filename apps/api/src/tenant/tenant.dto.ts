import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional() @IsString() @Length(1, 160) businessName?: string;
  @IsOptional() @IsString() @Length(6, 30) phone?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
}
