import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Strategy } from './strategy.entity';
import { StrategiesService } from './strategies.service';
import { StrategiesController } from './strategies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Strategy])],
  controllers: [StrategiesController],
  providers: [StrategiesService],
  exports: [StrategiesService],
})
export class StrategiesModule {}
