import { IsOptional, IsNumber, IsString, Min, Max, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialCapital?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultBrokerage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}

export class SettingsResponseDto {
  userId: string;
  initialCapital: number;
  defaultBrokerage: number;
  currency: string;
  timezone: string;
  updatedAt: Date;
}
