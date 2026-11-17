import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 191 })
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @ApiProperty({ format: 'password', minLength: 1, maxLength: 1024 })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password!: string;
}
