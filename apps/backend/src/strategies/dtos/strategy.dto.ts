import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { StrategyType } from '../strategy.entity';

export class CreateStrategyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(StrategyType)
  type?: StrategyType;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(StrategyType)
  type?: StrategyType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class StrategyResponseDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: StrategyType;
  isActive: boolean;
  parameters: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
