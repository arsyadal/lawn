import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() @Length(1, 1000) description?: string;
  @IsInt() @Min(0) @Max(2_000_000_000) price!: number;
  @IsOptional() @IsInt() @Min(1) @Max(525_600) estimatedMinutes?: number;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @Length(1, 1000) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) price?: number;
  @IsOptional() @IsInt() @Min(1) @Max(525_600) estimatedMinutes?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
