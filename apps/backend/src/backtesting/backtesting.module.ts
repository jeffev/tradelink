import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BacktestJob } from './backtest-job.entity';
import { BacktestingService } from './backtesting.service';
import { BacktestingController } from './backtesting.controller';
import { BacktestProcessor } from './processors/backtest.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([BacktestJob]),
    BullModule.registerQueue({ name: 'backtesting' }),
  ],
  controllers: [BacktestingController],
  providers: [BacktestingService, BacktestProcessor],
})
export class BacktestingModule {}
