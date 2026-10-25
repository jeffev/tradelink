import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  IsDateString,
  ArrayMaxSize,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { SYMBOL_MESSAGE, SYMBOL_PATTERN } from '../../shared/constants/market';

export class DCAConditionDto {
  @IsString() indicator: string;
  @IsString() operator: string;
  @IsNumber() value: number;
}

export class DCAIndicatorDto {
  @IsString() name: string;
  @IsOptional() params?: Record<string, unknown>;
}

export class CreateDCADto {
  @IsString()
  @Matches(SYMBOL_PATTERN, { message: SYMBOL_MESSAGE })
  symbol: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(1)
  @Max(1_000_000_000)
  amountPerPeriod: number;

  @IsString()
  @IsIn(['weekly', 'biweekly', 'monthly', 'quarterly'])
  period: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  conditions?: DCAConditionDto[];

  @IsOptional()
  @IsString()
  @IsIn(['AND', 'OR'])
  conditionLogic?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  indicators?: DCAIndicatorDto[];
}
