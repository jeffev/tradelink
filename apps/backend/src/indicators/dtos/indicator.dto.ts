import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsObject,
  IsDateString,
  IsIn,
  ArrayMaxSize,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SYMBOL_MESSAGE, SYMBOL_PATTERN, TIMEFRAMES } from '../../shared/constants/market';

export class CalculateIndicatorsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(SYMBOL_PATTERN, { message: SYMBOL_MESSAGE })
  symbol: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  @ArrayMaxSize(15)
  indicators: Array<{ name: string; params: Record<string, any> }>;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false })
  @IsIn(TIMEFRAMES)
  @IsOptional()
  timeframe?: string;
}

export class SaveIndicatorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(SYMBOL_PATTERN, { message: SYMBOL_MESSAGE })
  symbol: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @ApiProperty()
  @IsObject()
  params: Record<string, any>;
}
