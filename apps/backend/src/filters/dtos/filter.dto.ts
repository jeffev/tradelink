import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SYMBOL_MESSAGE, SYMBOL_PATTERN } from '../../shared/constants/market';

/** Symbols one scan may cover: each one is a synchronous worker round-trip. */
export const MAX_SCAN_SYMBOLS = 30;

export class CreateFilterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: 'array' })
  @IsArray()
  @ArrayMaxSize(20)
  conditions: any[];

  @ApiProperty({ required: false, default: 'AND' })
  @IsIn(['AND', 'OR'])
  @IsOptional()
  logic?: string;
}

export class UpdateFilterDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, type: 'array' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsOptional()
  conditions?: any[];

  @ApiProperty({ required: false })
  @IsIn(['AND', 'OR'])
  @IsOptional()
  logic?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RunScanDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCAN_SYMBOLS)
  @IsString({ each: true })
  @Matches(SYMBOL_PATTERN, { each: true, message: SYMBOL_MESSAGE })
  symbols: string[];

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
