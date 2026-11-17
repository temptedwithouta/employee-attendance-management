import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { EmployeeStatus } from '../entity/employee';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEmployeeDto {
  @ApiProperty({ maxLength: 64 })
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(64)
  employeeNumber!: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ format: 'email', maxLength: 191 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  department!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  position!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 1024 })
  @IsString()
  @Matches(/\S/)
  @MinLength(12)
  @MaxLength(1024)
  initialPassword!: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(64)
  employeeNumber?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 191 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  position?: string;
}

export class ListEmployeesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ maxLength: 191 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: EmployeeStatus;
}
