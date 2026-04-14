import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedIndicator } from './indicator.entity';
import { IndicatorsService } from './indicators.service';
import { IndicatorsController } from './indicators.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedIndicator])],
  providers: [IndicatorsService],
  controllers: [IndicatorsController],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
