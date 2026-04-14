import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BacktestStrategyType } from '../backtest-job.entity';

export class IndicatorConfigDto {
  @ApiProperty({ example: 'SMA' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: { period: 20 } })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class CreateBacktestDto {
  @ApiProperty({ example: ['AAPL', 'MSFT'], description: 'One or more ticker symbols' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  symbols: string[];

  @ApiProperty({ enum: BacktestStrategyType, example: BacktestStrategyType.SMA_CROSSOVER })
  @IsEnum(BacktestStrategyType)
  strategyType: BacktestStrategyType;

  @ApiPropertyOptional({ example: { fast_period: 20, slow_period: 50 } })
  @IsOptional()
  @IsObject()
  strategyParams?: Record<string, unknown>;

  @ApiProperty({ example: '2022-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2023-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  initialCapital?: number;

  @ApiPropertyOptional({ example: 0.001, description: 'Brokerage rate as decimal (e.g. 0.001 = 0.1%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.1)
  brokerageRate?: number;

  @ApiPropertyOptional({
    example: '1d',
    enum: ['1d', '1w', '1mo', '1h', '15m'],
    description: 'Candle timeframe',
  })
  @IsOptional()
  @IsString()
  timeframe?: string;

  @ApiPropertyOptional({ example: 'strategy-uuid' })
  @IsOptional()
  @IsString()
  strategyId?: string;

  @ApiPropertyOptional({ type: [IndicatorConfigDto], description: 'List of indicators to calculate' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  indicators?: IndicatorConfigDto[];
}

export class BacktestJobResponseDto {
  id: string;
  userId: string;
  strategyId: string | null;
  symbol: string;
  strategyType: string;
  strategyParams: Record<string, unknown> | null;
  startDate: string;
  endDate: string;
  initialCapital: number;
  brokerageRate: number;
  timeframe: string;
  status: string;
  errorMessage: string | null;
  results: unknown | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
