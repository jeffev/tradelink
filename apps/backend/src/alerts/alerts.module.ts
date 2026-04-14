import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceAlert } from './price-alert.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PriceAlert])],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}
