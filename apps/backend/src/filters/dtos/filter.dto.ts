import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFilterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: 'array' })
  @IsArray()
  conditions: any[];

  @ApiProperty({ required: false, default: 'AND' })
  @IsString()
  @IsOptional()
  logic?: string;
}

export class UpdateFilterDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, type: 'array' })
  @IsArray()
  @IsOptional()
  conditions?: any[];

  @ApiProperty({ required: false })
  @IsString()
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
  symbols: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  endDate?: string;
}
