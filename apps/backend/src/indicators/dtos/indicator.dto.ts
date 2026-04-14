import { IsString, IsNotEmpty, IsArray, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateIndicatorsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  indicators: Array<{ name: string; params: Record<string, any> }>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  timeframe?: string;
}

export class SaveIndicatorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsObject()
  params: Record<string, any>;
}
