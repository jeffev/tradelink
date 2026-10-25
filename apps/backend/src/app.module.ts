import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StrategiesModule } from './strategies/strategies.module';
import { TradesModule } from './trades/trades.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { SettingsModule } from './settings/settings.module';
import { MarketDataModule } from './market-data/market-data.module';
import { BacktestingModule } from './backtesting/backtesting.module';
import { DCAModule } from './dca/dca.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { FiltersModule } from './filters/filters.module';
import { AlertsModule } from './alerts/alerts.module';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        // Upstash and other cloud Redis providers use a full URL (rediss://...)
        const connection = redisUrl
          ? {
              url: redisUrl,
              lazyConnect: true,
              maxRetriesPerRequest: null,
              enableOfflineQueue: false,
              // Upstash uses rediss:// (TLS) — ioredis needs explicit tls options
              ...(redisUrl.startsWith('rediss://') && { tls: { rejectUnauthorized: false } }),
            }
          : {
              host: configService.get<string>('REDIS_HOST', 'localhost'),
              port: configService.get<number>('REDIS_PORT', 6379),
              lazyConnect: true,
              maxRetriesPerRequest: null,
              enableOfflineQueue: false,
              retryStrategy: (times: number) => Math.min(times * 500, 10_000),
            };
        return { connection };
      },
      inject: [ConfigService],
    }),
    // Per-IP request budget (req.ip is the client: main.ts trusts the proxy hop).
    // Expensive or sensitive routes tighten it with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule,
    UsersModule,
    StrategiesModule,
    TradesModule,
    PortfolioModule,
    SettingsModule,
    MarketDataModule,
    BacktestingModule,
    DCAModule,
    IndicatorsModule,
    FiltersModule,
    AlertsModule,
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
