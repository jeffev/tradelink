import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { FiltersModule } from '../filters/filters.module';
import { User } from '../users/user.entity';
import { Ticker } from '../market-data/ticker.entity';
import { Candle } from '../market-data/candle.entity';
import { Trade } from '../trades/trade.entity';
import { Strategy } from '../strategies/strategy.entity';
import { BacktestJob } from '../backtesting/backtest-job.entity';
import { DCAJob } from '../dca/dca-job.entity';
import { Filter } from '../filters/filter.entity';
import { FilterResult } from '../filters/filter-result.entity';
import { PriceAlert } from '../alerts/price-alert.entity';
import { SavedIndicator } from '../indicators/indicator.entity';
import { UserSettings } from '../settings/settings.entity';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Ticker,
      Candle,
      Trade,
      Strategy,
      BacktestJob,
      DCAJob,
      Filter,
      FilterResult,
      PriceAlert,
      SavedIndicator,
      UserSettings,
    ]),
    BullModule.registerQueue({ name: 'backtesting' }, { name: 'dca' }),
    AuthModule,
    FiltersModule,
  ],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
