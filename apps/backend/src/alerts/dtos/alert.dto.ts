import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertType, AlertCondition } from '../price-alert.entity';

export class CreateAlertDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
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
