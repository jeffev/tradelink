import { IsString, IsNumber, IsOptional, IsArray, IsIn, Min, Max } from 'class-validator';

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
  symbol: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  @Min(1)
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
  conditions?: DCAConditionDto[];

  @IsOptional()
  @IsString()
  @IsIn(['AND', 'OR'])
  conditionLogic?: string;

  @IsOptional()
  @IsArray()
  indicators?: DCAIndicatorDto[];
}
