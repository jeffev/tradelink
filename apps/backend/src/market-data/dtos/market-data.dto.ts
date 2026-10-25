import { IsString, IsIn, IsDateString, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SYMBOL_MESSAGE, SYMBOL_PATTERN } from '../../shared/constants/market';

export class FetchCandlesDto {
  @ApiProperty({ example: 'AAPL' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(SYMBOL_PATTERN, { message: SYMBOL_MESSAGE })
  symbol: string;

  @ApiPropertyOptional({ example: '1d', enum: ['1d', '1h', '15m'] })
  @IsOptional()
  @IsIn(['1d', '1h', '15m'])
  interval?: string;

  @ApiProperty({ example: '2023-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2023-12-31' })
  @IsDateString()
  endDate: string;
}

export class CandleResponseDto {
  symbol: string;
  interval: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TickerResponseDto {
  id: string;
  symbol: string;
  name: string | null;
  assetType: string | null;
  exchange: string | null;
  createdAt: Date;
}
