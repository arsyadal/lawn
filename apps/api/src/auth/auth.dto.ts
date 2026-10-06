import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 254)
  identifier!: string;

  @IsString()
  @Length(8, 200)
  password!: string;
}
