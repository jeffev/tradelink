import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { Ticker } from './ticker.entity';
import { Candle } from './candle.entity';
import { FetchCandlesDto } from './dtos/market-data.dto';
import { assertDateRange } from '../shared/constants/market';

// Candles are shared by every user: one fetch may add at most ~10 years of daily bars.
const MAX_FETCH_DAYS = 10 * 366;

@Injectable()
export class MarketDataService {
  private readonly workerUrl: string;

  constructor(
    @InjectRepository(Ticker) private tickerRepo: Repository<Ticker>,
    @InjectRepository(Candle) private candleRepo: Repository<Candle>,
    private configService: ConfigService,
  ) {
    this.workerUrl = this.configService.get<string>(
      'WORKER_URL',
      'http://localhost:8000',
    );
  }

  async listTickers(): Promise<Ticker[]> {
    return this.tickerRepo.find({ order: { symbol: 'ASC' } });
  }

  async fetchAndStore(dto: FetchCandlesDto): Promise<{ count: number }> {
    const { symbol, interval = '1d', startDate, endDate } = dto;
    assertDateRange(startDate, endDate, MAX_FETCH_DAYS);

    let candles: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;

    try {
      const response = await axios.post(`${this.workerUrl}/fetch-candles`, {
        symbol,
        interval,
        start_date: startDate,
        end_date: endDate,
      }, { timeout: 120_000 });
      candles = response.data.candles;
    } catch {
      throw new BadRequestException(
        `Failed to fetch market data from worker for ${symbol}. Is the backtesting worker running?`,
      );
    }

    // Upsert ticker
    let ticker = await this.tickerRepo.findOne({ where: { symbol } });
    if (!ticker) {
      ticker = this.tickerRepo.create({ symbol });
      await this.tickerRepo.save(ticker);
    }

    // Insert new candles in batches; existing (symbol, interval, timestamp) rows win.
    let inserted = 0;
    const rows = candles.map((c) => ({
      symbol,
      interval,
      timestamp: new Date(c.timestamp),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const result = await this.candleRepo
        .createQueryBuilder()
        .insert()
        .into(Candle)
        .values(rows.slice(i, i + 200))
        .orIgnore()
        .execute();
      inserted += Array.isArray(result.raw) ? result.raw.length : 0;
    }

    return { count: inserted };
  }

  async importCsv(
    symbol: string,
    interval: string = '1d',
    fileBuffer: Buffer,
  ): Promise<{ count: number }> {
    let records: Array<Record<string, string>>;
    try {
      records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<Record<string, string>>;
    } catch {
      throw new BadRequestException('Invalid CSV format');
    }

    const required = ['timestamp', 'open', 'high', 'low', 'close'];
    const columns = Object.keys(records[0] ?? {}).map((k) => k.toLowerCase());
    for (const col of required) {
      if (!columns.includes(col)) {
        throw new BadRequestException(`CSV must have columns: ${required.join(', ')}`);
      }
    }

    let ticker = await this.tickerRepo.findOne({ where: { symbol: symbol.toUpperCase() } });
    if (!ticker) {
      ticker = this.tickerRepo.create({ symbol: symbol.toUpperCase() });
      await this.tickerRepo.save(ticker);
    }

    let inserted = 0;
    for (const row of records) {
      const normalised: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalised[k.toLowerCase()] = v;
      }

      const ts = new Date(normalised['timestamp'] || normalised['date']);
      if (isNaN(ts.getTime())) continue;

      const existing = await this.candleRepo.findOne({
        where: { symbol: symbol.toUpperCase(), interval, timestamp: ts },
      });
      if (!existing) {
        await this.candleRepo.save(
          this.candleRepo.create({
            symbol: symbol.toUpperCase(),
            interval,
            timestamp: ts,
            open: parseFloat(normalised['open']),
            high: parseFloat(normalised['high']),
            low: parseFloat(normalised['low']),
            close: parseFloat(normalised['close']),
            volume: parseFloat(normalised['volume'] ?? '0'),
          }),
        );
        inserted++;
      }
    }

    return { count: inserted };
  }

  async getCandles(
    symbol: string,
    interval: string = '1d',
    startDate?: string,
    endDate?: string,
  ): Promise<Candle[]> {
    const ticker = await this.tickerRepo.findOne({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!ticker) throw new NotFoundException(`Ticker ${symbol} not found`);

    const qb = this.candleRepo
      .createQueryBuilder('c')
      .where('c.symbol = :symbol', { symbol: symbol.toUpperCase() })
      .andWhere('c.interval = :interval', { interval })
      .orderBy('c.timestamp', 'ASC');

    if (startDate) qb.andWhere('c.timestamp >= :startDate', { startDate });
    if (endDate) qb.andWhere('c.timestamp <= :endDate', { endDate });

    return qb.getMany();
  }

  async deleteTicker(symbol: string): Promise<void> {
    const ticker = await this.tickerRepo.findOne({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!ticker) throw new NotFoundException(`Ticker ${symbol} not found`);

    await this.candleRepo.delete({ symbol: symbol.toUpperCase() });
    await this.tickerRepo.delete({ id: ticker.id });
  }
}
