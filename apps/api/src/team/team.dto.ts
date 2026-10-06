import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { USER_ROLES } from '@lawn/contracts';

export class CreateTeamMemberDto {
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Length(3, 40) @Matches(/^[a-zA-Z0-9._-]+$/) username!: string;
  @IsString() @Length(1, 120) displayName!: string;
  @IsString() @Length(12, 200) password!: string;
  @IsIn(USER_ROLES) role!: (typeof USER_ROLES)[number];
}

export class UpdateTeamMemberDto {
  @IsOptional() @IsString() @Length(1, 120) displayName?: string;
  @IsOptional() @IsIn(USER_ROLES) role?: (typeof USER_ROLES)[number];
  @IsOptional() @IsBoolean() active?: boolean;
}
