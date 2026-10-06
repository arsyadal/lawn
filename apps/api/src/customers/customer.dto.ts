import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateCustomerDto {
  @IsString() @Length(1, 120) name!: string;
  @IsString() @Length(6, 30) phone!: string;
  @IsOptional() @IsEmail() @Length(3, 254) email?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @Length(6, 30) phone?: string;
  @IsOptional() @IsEmail() @Length(3, 254) email?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}
