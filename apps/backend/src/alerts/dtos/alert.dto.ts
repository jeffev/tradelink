import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertType, AlertCondition } from '../price-alert.entity';
import { SYMBOL_MESSAGE, SYMBOL_PATTERN } from '../../shared/constants/market';

export class CreateAlertDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(SYMBOL_PATTERN, { message: SYMBOL_MESSAGE })
  symbol: string;

  @ApiProperty({ enum: AlertType })
  @IsEnum(AlertType)
  alertType: AlertType;

  @ApiProperty({ enum: AlertCondition })
  @IsEnum(AlertCondition)
  condition: AlertCondition;

  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  params?: Record<string, any>;
}

export class UpdateAlertDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  value?: number;
}
