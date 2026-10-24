import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { In, LessThan, Like, MoreThan, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/user.entity';
import { AuthService } from '../auth/auth.service';
import { Ticker } from '../market-data/ticker.entity';
import { Candle } from '../market-data/candle.entity';
import {
  EmotionAtEntry,
  ExitReason,
  Trade,
  TradeSide,
  TradeStatus,
  TradeTimeframe,
  TradeTrend,
  AssetClass,
} from '../trades/trade.entity';
import { Strategy } from '../strategies/strategy.entity';
import {
  BacktestJob,
  BacktestStatus,
} from '../backtesting/backtest-job.entity';
import { DCAJob, DCAStatus } from '../dca/dca-job.entity';
import { Filter } from '../filters/filter.entity';
import { FilterResult } from '../filters/filter-result.entity';
import { FiltersService } from '../filters/filters.service';
import { PriceAlert } from '../alerts/price-alert.entity';
import { SavedIndicator } from '../indicators/indicator.entity';
import { UserSettings } from '../settings/settings.entity';
import {
  CLOSE_NOTES_LOSS,
  CLOSE_NOTES_WIN,
  DEMO_ALERTS,
  DEMO_BACKTESTS,
  DEMO_DCAS,
  DEMO_FILTERS,
  DEMO_SAVED_INDICATORS,
  DEMO_STRATEGIES,
  DEMO_TICKERS,
  DemoBacktest,
  DemoDCA,
  DemoStrategy,
  DemoTicker,
  ENTRY_NOTES,
} from './demo-data';

/** Visitor accounts live under this domain and are deleted after a day. */
export const DEMO_EMAIL_DOMAIN = 'demo.tradelink';
const VISITOR_EMAILS = `visitante-%@${DEMO_EMAIL_DOMAIN}`;
// Internal account that runs each demo backtest and DCA once; visitors copy
// its results instead of queueing the same slow jobs again.
const TEMPLATE_EMAIL = `modelo@${DEMO_EMAIL_DOMAIN}`;
const STALE_JOB_MS = 2 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const VISITOR_TTL_MS = DAY_MS;
const CAPITAL = 50_000;
const HISTORY_DAYS = 430;
const JOURNAL_DAYS = 270;
const CLOSED_TRADES = 96;
const OPEN_TRADES = 7;
const MAX_VISITORS_PER_IP_PER_HOUR = 8;
const MAX_LIVE_VISITORS = 500;
const MARKET_DATA_WAIT_MS = 25_000;
const MARKET_DATA_REFRESH_MS = 6 * 60 * 60 * 1000;

interface Bar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Deterministic generator: every visitor gets the same story. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Dice {
  constructor(private readonly next: () => number) {}
  float(min = 0, max = 1): number {
    return min + (max - min) * this.next();
  }
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }
}

function isoDay(date: Date): string {
  return date.toISOString().split('T')[0];
}

function roundPrice(value: number): number {
  if (value >= 1000) return Math.round(value * 100) / 100;
  if (value >= 10) return Math.round(value * 100) / 100;
  return Math.round(value * 100000) / 100000;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoService.name);
  private readonly workerUrl: string;
  private readonly enabled: boolean;
  private marketData: Promise<void> | null = null;
  private marketDataStartedAt = 0;
  private warming: Promise<void> | null = null;
  private readonly scansStartedAt = new Map<string, number>();
  private readonly attemptsByIp = new Map<string, number[]>();

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly filtersService: FiltersService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Ticker) private readonly tickers: Repository<Ticker>,
    @InjectRepository(Candle) private readonly candles: Repository<Candle>,
    @InjectRepository(Trade) private readonly trades: Repository<Trade>,
    @InjectRepository(Strategy)
    private readonly strategies: Repository<Strategy>,
    @InjectRepository(BacktestJob)
    private readonly backtests: Repository<BacktestJob>,
    @InjectRepository(DCAJob) private readonly dcaJobs: Repository<DCAJob>,
    @InjectRepository(Filter) private readonly filters: Repository<Filter>,
    @InjectRepository(FilterResult)
    private readonly filterResults: Repository<FilterResult>,
    @InjectRepository(PriceAlert)
    private readonly alerts: Repository<PriceAlert>,
    @InjectRepository(SavedIndicator)
    private readonly savedIndicators: Repository<SavedIndicator>,
    @InjectRepository(UserSettings)
    private readonly settings: Repository<UserSettings>,
    @InjectQueue('backtesting') private readonly backtestQueue: Queue,
    @InjectQueue('dca') private readonly dcaQueue: Queue,
  ) {
    this.workerUrl = this.config.get<string>(
      'WORKER_URL',
      'http://localhost:8000',
    );
    this.enabled = this.config.get<string>('DEMO_ENABLED', 'true') !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onApplicationBootstrap(): void {
    // Warm candles and job results so the first visitor does not wait for them.
    if (!this.enabled) return;
    void this.ensureMarketData().then(() => this.kickWarmUp());
  }

  // ── Visitor ────────────────────────────────────────────────────────────────

  async createVisitor(ip: string) {
    if (!this.enabled) {
      throw new HttpException(
        'Demo desativada neste servidor.',
        HttpStatus.NOT_FOUND,
      );
    }
    this.throttle(ip);
    await this.removeExpiredVisitors();

    const live = await this.users.count({
      where: { email: Like(VISITOR_EMAILS) },
    });
    if (live >= MAX_LIVE_VISITORS) {
      throw new HttpException(
        'Muitos visitantes agora. Tente de novo em alguns minutos.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Only the very first visitor waits for the download; later ones use what
    // is stored while the refresh runs in the background.
    const refresh = this.ensureMarketData();
    if (!(await this.hasMarketData())) {
      await Promise.race([
        refresh,
        new Promise((resolve) => setTimeout(resolve, MARKET_DATA_WAIT_MS)),
      ]);
    }

    const user = await this.users.save(
      this.users.create({
        email: `visitante-${randomUUID().slice(0, 8)}@${DEMO_EMAIL_DOMAIN}`,
        firstName: 'Visitante',
        lastName: 'Demo',
        // Nobody logs in with this password: the session comes from the token below.
        password: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
        role: UserRole.TRADER,
      }),
    );

    this.kickWarmUp();
    try {
      await this.seed(user.id);
    } catch (err) {
      await this.users.delete({ id: user.id });
      throw err;
    }

    return this.authService.login({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  }

  private throttle(ip: string): void {
    const now = Date.now();
    const recent = (this.attemptsByIp.get(ip) ?? []).filter(
      (t) => now - t < 60 * 60 * 1000,
    );
    if (recent.length >= MAX_VISITORS_PER_IP_PER_HOUR) {
      throw new HttpException(
        'Limite de contas de visitante atingido. Tente de novo mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.attemptsByIp.set(ip, recent);
    if (this.attemptsByIp.size > 10_000) this.attemptsByIp.clear();
  }

  async removeExpiredVisitors(): Promise<number> {
    const expired = await this.users.find({
      select: { id: true },
      where: {
        email: Like(VISITOR_EMAILS),
        createdAt: LessThan(new Date(Date.now() - VISITOR_TTL_MS)),
      },
    });
    if (!expired.length) return 0;
    // Everything the visitor owns goes with the user (ON DELETE CASCADE).
    await this.users.delete({ id: In(expired.map((u) => u.id)) });
    return expired.length;
  }

  // ── Shared market data ─────────────────────────────────────────────────────

  ensureMarketData(): Promise<void> {
    const stale =
      Date.now() - this.marketDataStartedAt > MARKET_DATA_REFRESH_MS;
    if (!this.marketData || stale) {
      this.marketDataStartedAt = Date.now();
      this.marketData = this.downloadMarketData().catch((err: Error) => {
        this.logger.warn(`Demo market data incomplete: ${err.message}`);
        this.marketDataStartedAt = 0;
      });
    }
    return this.marketData;
  }

  private async hasMarketData(): Promise<boolean> {
    const rows = await this.candles
      .createQueryBuilder('c')
      .select('c.symbol', 'symbol')
      .addSelect('COUNT(*)', 'n')
      .where('c.interval = :interval', { interval: '1d' })
      .andWhere('c.symbol IN (:...symbols)', {
        symbols: DEMO_TICKERS.map((t) => t.symbol),
      })
      .groupBy('c.symbol')
      .getRawMany<{ symbol: string; n: string }>();
    return (
      rows.length === DEMO_TICKERS.length &&
      rows.every((r) => Number(r.n) >= 60)
    );
  }

  private async downloadMarketData(): Promise<void> {
    const today = new Date();
    for (const t of DEMO_TICKERS) {
      const existing = await this.tickers.findOne({
        where: { symbol: t.symbol },
      });
      if (!existing) {
        await this.tickers.save(
          this.tickers.create({
            symbol: t.symbol,
            name: t.name,
            assetType: t.assetType,
            exchange: t.exchange,
          }),
        );
      } else if (!existing.name) {
        await this.tickers.update(existing.id, {
          name: t.name,
          assetType: t.assetType,
          exchange: t.exchange,
        });
      }

      const latest = await this.candles.findOne({
        where: { symbol: t.symbol, interval: '1d' },
        order: { timestamp: 'DESC' },
      });
      if (
        latest &&
        today.getTime() - new Date(latest.timestamp).getTime() < 3 * DAY_MS
      ) {
        continue;
      }
      const start = latest
        ? new Date(new Date(latest.timestamp).getTime() + DAY_MS)
        : new Date(today.getTime() - HISTORY_DAYS * DAY_MS);

      try {
        const { data } = await axios.post<{
          candles: Array<{
            timestamp: string;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
          }>;
        }>(
          `${this.workerUrl}/fetch-candles`,
          {
            symbol: t.symbol,
            interval: '1d',
            start_date: isoDay(start),
            end_date: isoDay(today),
          },
          { timeout: 180_000 },
        );
        const rows = data.candles.map((c) => ({
          symbol: t.symbol,
          interval: '1d',
          timestamp: new Date(c.timestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume ?? 0,
        }));
        for (let i = 0; i < rows.length; i += 200) {
          await this.candles
            .createQueryBuilder()
            .insert()
            .into(Candle)
            .values(rows.slice(i, i + 200))
            .orIgnore()
            .execute();
        }
      } catch (err) {
        this.logger.warn(
          `Could not download candles for ${t.symbol}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async loadBars(ticker: DemoTicker, dice: Dice): Promise<Bar[]> {
    const since = new Date(Date.now() - HISTORY_DAYS * DAY_MS);
    const rows = await this.candles.find({
      where: {
        symbol: ticker.symbol,
        interval: '1d',
        timestamp: MoreThan(since),
      },
      order: { timestamp: 'ASC' },
    });
    if (rows.length >= 60) {
      return rows.map((r) => ({
        date: new Date(r.timestamp),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
      }));
    }
    return this.syntheticBars(ticker, dice);
  }

  /** Random walk ending at the fallback price, used only when downloads fail. */
  private syntheticBars(ticker: DemoTicker, dice: Dice): Bar[] {
    const tradesWeekends = ticker.assetClass === AssetClass.CRYPTO;
    const vol =
      ticker.assetClass === AssetClass.CRYPTO
        ? 0.03
        : ticker.assetClass === AssetClass.FOREX
          ? 0.004
          : 0.017;
    const days: Date[] = [];
    for (let d = HISTORY_DAYS; d >= 1; d--) {
      const date = new Date(Date.now() - d * DAY_MS);
      date.setUTCHours(0, 0, 0, 0);
      const wd = date.getUTCDay();
      if (tradesWeekends || (wd !== 0 && wd !== 6)) days.push(date);
    }
    const closes = new Array<number>(days.length);
    let price = ticker.fallbackPrice;
    for (let i = days.length - 1; i >= 0; i--) {
      closes[i] = price;
      price = price / (1 + dice.float(-vol, vol) + vol * 0.04);
    }
    return days.map((date, i) => {
      const close = closes[i];
      const open = i > 0 ? closes[i - 1] : close;
      const span = Math.abs(close - open) + close * vol * dice.float(0.2, 0.8);
      return {
        date,
        open,
        close,
        high: Math.max(open, close) + span / 2,
        low: Math.min(open, close) - span / 2,
      };
    });
  }

  // ── Seed ───────────────────────────────────────────────────────────────────

  private async seed(userId: string): Promise<void> {
    const dice = new Dice(mulberry32(20261024));

    await this.settings.insert({
      userId,
      initialCapital: CAPITAL,
      defaultBrokerage: 0.001,
      currency: 'USD',
      timezone: 'America/Sao_Paulo',
    });

    const strategyIds = new Map<string, string>();
    for (const [i, s] of DEMO_STRATEGIES.entries()) {
      const saved = await this.strategies.save(
        this.strategies.create({
          userId,
          name: s.name,
          description: s.description,
          type: s.type,
          isActive: s.isActive,
          parameters: s.parameters,
          createdAt: new Date(Date.now() - (300 - i * 12) * DAY_MS),
        }),
      );
      strategyIds.set(s.key, saved.id);
    }

    const bars = new Map<string, Bar[]>();
    for (const t of DEMO_TICKERS)
      bars.set(t.symbol, await this.loadBars(t, dice));

    const trades = this.buildTrades(userId, dice, bars, strategyIds);
    for (let i = 0; i < trades.length; i += 50) {
      await this.trades.save(this.trades.create(trades.slice(i, i + 50)));
    }

    await this.seedAlerts(userId, bars);
    await this.savedIndicators.save(
      this.savedIndicators.create(
        DEMO_SAVED_INDICATORS.map((ind) => ({ userId, ...ind })),
      ),
    );
    await this.seedBacktests(userId, strategyIds);
    await this.seedDCA(userId);
    await this.seedFilters(userId);
  }

  private buildTrades(
    userId: string,
    dice: Dice,
    bars: Map<string, Bar[]>,
    strategyIds: Map<string, string>,
  ): Partial<Trade>[] {
    const now = Date.now();
    const journalStart = now - JOURNAL_DAYS * DAY_MS;
    const scalpEnd = now - 80 * DAY_MS; // the scalp strategy was shelved
    const result: Partial<Trade>[] = [];

    for (let n = 0; n < CLOSED_TRADES; n++) {
      const ticker = dice.weighted(DEMO_TICKERS, (t) => t.weight);
      const series = bars.get(ticker.symbol)!;
      const firstIdx = Math.max(
        25,
        series.findIndex((b) => b.date.getTime() >= journalStart),
      );
      const lastIdx = series.length - 4;
      if (firstIdx < 0 || firstIdx >= lastIdx) continue;

      const strategy = this.strategyFor(ticker, dice);
      // Discipline improves over time: early trades break the plan more often.
      const progress = n / CLOSED_TRADES;
      const followed: boolean | null = dice.chance(0.08)
        ? null
        : dice.chance(0.55 + progress * 0.3);
      const disciplined = followed !== false;
      const wantWin = dice.chance(disciplined ? 0.66 : 0.36);

      const intraday = strategy?.key === 'scalp';
      const timeframe = strategy
        ? dice.pick(strategy.timeframes)
        : TradeTimeframe.D1;
      const maxHold =
        timeframe === TradeTimeframe.H1
          ? 2
          : timeframe === TradeTimeframe.H4
            ? 5
            : 12;

      // Look for a bar where a long trade matches the wanted outcome; the
      // trader is long-biased and only goes short when nothing fits.
      let entryIdx = 0;
      let exitIdx = 0;
      let entry = 0;
      let exit = 0;
      let side = TradeSide.BUY;
      for (let attempt = 0; attempt < 8; attempt++) {
        const hi = intraday
          ? Math.min(
              lastIdx,
              series.findIndex((b) => b.date.getTime() >= scalpEnd) - 1,
            )
          : lastIdx;
        if (hi <= firstIdx) break;
        entryIdx = dice.int(firstIdx, hi);
        exitIdx = intraday
          ? entryIdx
          : Math.min(entryIdx + dice.int(1, maxHold), series.length - 2);
        const bar = series[entryIdx];
        entry = intraday
          ? bar.open * (1 + dice.float(-0.002, 0.002))
          : bar.close;
        exit = intraday ? dice.float(bar.low, bar.high) : series[exitIdx].close;
        // Skip outlier moves: one crash day would dominate the whole journal.
        if (
          attempt < 7 &&
          Math.abs(exit - entry) / entry > this.maxMove(ticker)
        )
          continue;
        const longWins = exit > entry;
        if (longWins === wantWin) {
          side = TradeSide.BUY;
          break;
        }
        if (attempt === 7) side = TradeSide.SELL;
      }
      if (!entry) continue;

      result.push(
        this.closedTrade({
          userId,
          dice,
          ticker,
          strategy,
          strategyId: strategy ? strategyIds.get(strategy.key)! : null,
          series,
          entryIdx,
          exitIdx,
          entry,
          exit,
          side,
          followed,
          timeframe: intraday
            ? dice.pick([TradeTimeframe.M5, TradeTimeframe.M15])
            : timeframe,
        }),
      );
    }

    // Open positions: recent entries in different tickers.
    const openTickers = [...DEMO_TICKERS]
      .sort(() => dice.float(-1, 1))
      .slice(0, OPEN_TRADES);
    for (const ticker of openTickers) {
      const series = bars.get(ticker.symbol)!;
      const entryIdx = series.length - 1 - dice.int(1, 12);
      const entry = series[entryIdx].close;
      const strategy = this.strategyFor(ticker, dice, true);
      const side = dice.chance(0.85) ? TradeSide.BUY : TradeSide.SELL;
      const dir = side === TradeSide.BUY ? 1 : -1;
      const riskPct = this.riskPct(ticker, dice);
      result.push({
        userId,
        strategyId: strategy ? strategyIds.get(strategy.key)! : null,
        ticker: ticker.symbol,
        side,
        status: TradeStatus.OPEN,
        entryPrice: roundPrice(entry),
        exitPrice: null,
        quantity: this.quantity(ticker, entry, 10, dice),
        entryAt: this.withHour(series[entryIdx].date, ticker, dice),
        exitAt: null,
        stopLoss: roundPrice(entry * (1 - dir * riskPct)),
        takeProfit: roundPrice(entry * (1 + dir * riskPct * dice.float(2, 3))),
        timeframe: strategy ? strategy.timeframes[0] : TradeTimeframe.D1,
        setup: strategy ? dice.pick(strategy.setups) : null,
        trend: this.trendAt(series, entryIdx),
        assetClass: ticker.assetClass,
        confidenceLevel: dice.int(3, 5),
        entryQuality: dice.int(3, 5),
        emotionAtEntry: dice.pick([
          EmotionAtEntry.CALM,
          EmotionAtEntry.CONFIDENT,
        ]),
        movedStop: false,
        enteredOnTime: true,
        followedStrategy: true,
        capitalPct: Math.round(dice.float(5, 12) * 100) / 100,
        commission: this.commission(ticker, entry, 1, dice),
        slippage: null,
        notes: dice.pick(ENTRY_NOTES),
        closeNotes: null,
      });
    }

    return result;
  }

  private closedTrade(p: {
    userId: string;
    dice: Dice;
    ticker: DemoTicker;
    strategy: DemoStrategy | null;
    strategyId: string | null;
    series: Bar[];
    entryIdx: number;
    exitIdx: number;
    entry: number;
    exit: number;
    side: TradeSide;
    followed: boolean | null;
    timeframe: TradeTimeframe;
  }): Partial<Trade> {
    const { dice, ticker, strategy, series, entry, exit, side, followed } = p;
    const dir = side === TradeSide.BUY ? 1 : -1;
    const move = (exit - entry) * dir;
    const won = move > 0;
    const disciplined = followed !== false;

    // Stops and targets consistent with the exit that really happened.
    let stopLoss: number;
    let takeProfit: number;
    let exitReason: ExitReason;
    const minRisk = entry * this.riskPct(p.ticker, dice) * 0.5;
    if (won) {
      const reason = dice.weighted(
        [ExitReason.TP_HIT, ExitReason.TRAIL_STOP, ExitReason.MANUAL],
        (r) =>
          r === ExitReason.TP_HIT ? 6 : r === ExitReason.TRAIL_STOP ? 2 : 2,
      );
      const risk = Math.max(
        minRisk,
        Math.abs(move) /
          (reason === ExitReason.TP_HIT
            ? dice.float(1.6, 2.6)
            : dice.float(0.8, 1.6)),
      );
      stopLoss = entry - dir * risk;
      takeProfit = reason === ExitReason.TP_HIT ? exit : entry + dir * risk * 2;
      exitReason = reason;
    } else {
      const reason = disciplined
        ? dice.weighted(
            [ExitReason.SL_HIT, ExitReason.MANUAL, ExitReason.TIMEOUT],
            (r) => (r === ExitReason.SL_HIT ? 7 : 2),
          )
        : dice.weighted([ExitReason.SL_HIT, ExitReason.MANUAL], (r) =>
            r === ExitReason.SL_HIT ? 4 : 3,
          );
      const risk = Math.max(
        minRisk,
        reason === ExitReason.SL_HIT
          ? Math.abs(move)
          : Math.abs(move) * dice.float(1.1, 2),
      );
      stopLoss = reason === ExitReason.SL_HIT ? exit : entry - dir * risk;
      takeProfit = entry + dir * risk * dice.float(1.8, 2.6);
      exitReason = reason;
    }

    const capitalPct = disciplined ? dice.float(5, 15) : dice.float(14, 32);
    const quantity = this.quantity(ticker, entry, capitalPct, dice);
    const emotion = disciplined
      ? dice.weighted(
          [EmotionAtEntry.CALM, EmotionAtEntry.CONFIDENT, EmotionAtEntry.FEAR],
          (e) =>
            e === EmotionAtEntry.CALM
              ? 55
              : e === EmotionAtEntry.CONFIDENT
                ? 35
                : 10,
        )
      : dice.weighted(
          [
            EmotionAtEntry.FOMO,
            EmotionAtEntry.REVENGE,
            EmotionAtEntry.FEAR,
            EmotionAtEntry.CONFIDENT,
          ],
          (e) =>
            e === EmotionAtEntry.FOMO
              ? 40
              : e === EmotionAtEntry.REVENGE
                ? 25
                : e === EmotionAtEntry.FEAR
                  ? 20
                  : 15,
        );

    const entryAt = this.withHour(series[p.entryIdx].date, ticker, dice);
    let exitAt = this.withHour(series[p.exitIdx].date, ticker, dice);
    if (exitAt <= entryAt)
      exitAt = new Date(entryAt.getTime() + dice.int(15, 240) * 60 * 1000);

    return {
      userId: p.userId,
      strategyId: p.strategyId,
      ticker: ticker.symbol,
      side,
      status: TradeStatus.CLOSED,
      entryPrice: roundPrice(entry),
      exitPrice: roundPrice(exit),
      quantity,
      entryAt,
      exitAt,
      stopLoss: roundPrice(stopLoss),
      takeProfit: roundPrice(takeProfit),
      exitReason,
      timeframe: p.timeframe,
      setup: strategy ? dice.pick(strategy.setups) : 'Sem setup — impulso',
      trend: this.trendAt(series, p.entryIdx),
      assetClass: ticker.assetClass,
      confidenceLevel: disciplined ? dice.int(3, 5) : dice.int(1, 4),
      entryQuality: disciplined ? dice.int(3, 5) : dice.int(1, 3),
      emotionAtEntry: emotion,
      movedStop: disciplined ? dice.chance(0.05) : dice.chance(0.45),
      enteredOnTime: disciplined ? dice.chance(0.85) : dice.chance(0.45),
      followedStrategy: followed,
      capitalPct: Math.round(capitalPct * 100) / 100,
      commission: this.commission(ticker, entry * quantity, 2, dice),
      slippage:
        Math.round(entry * quantity * dice.float(0, 0.0012) * 100) / 100,
      notes: dice.chance(0.75) ? dice.pick(ENTRY_NOTES) : null,
      closeNotes: dice.chance(0.6)
        ? dice.pick(won ? CLOSE_NOTES_WIN : CLOSE_NOTES_LOSS)
        : null,
    };
  }

  private strategyFor(
    ticker: DemoTicker,
    dice: Dice,
    swingOnly = false,
  ): DemoStrategy | null {
    if (!swingOnly && dice.chance(0.07)) return null;
    const byKey = (key: string) => DEMO_STRATEGIES.find((s) => s.key === key)!;
    if (ticker.assetClass === AssetClass.CRYPTO) {
      return dice.chance(0.8) ? byKey('swing-cripto') : byKey('breakout');
    }
    if (ticker.assetClass === AssetClass.FOREX)
      return dice.pick([byKey('pullback'), byKey('breakout')]);
    const options = swingOnly
      ? ['pullback', 'breakout', 'ifr']
      : ['pullback', 'pullback', 'breakout', 'ifr', 'scalp'];
    return byKey(dice.pick(options));
  }

  private maxMove(ticker: DemoTicker): number {
    if (ticker.assetClass === AssetClass.CRYPTO) return 0.1;
    if (ticker.assetClass === AssetClass.FOREX) return 0.012;
    return 0.06;
  }

  private riskPct(ticker: DemoTicker, dice: Dice): number {
    if (ticker.assetClass === AssetClass.CRYPTO) return dice.float(0.03, 0.07);
    if (ticker.assetClass === AssetClass.FOREX) return dice.float(0.004, 0.009);
    return dice.float(0.015, 0.04);
  }

  private quantity(
    ticker: DemoTicker,
    price: number,
    capitalPct: number,
    dice: Dice,
  ): number {
    const notional = (CAPITAL * capitalPct) / 100;
    if (ticker.assetClass === AssetClass.CRYPTO)
      return Math.max(0.001, Math.round((notional / price) * 10000) / 10000);
    if (ticker.assetClass === AssetClass.FOREX)
      return Math.max(
        1000,
        Math.round((notional * dice.float(2, 4)) / price / 1000) * 1000,
      );
    return Math.max(1, Math.floor(notional / price));
  }

  private commission(
    ticker: DemoTicker,
    notional: number,
    sides: number,
    dice: Dice,
  ): number {
    const perSide =
      ticker.assetClass === AssetClass.CRYPTO
        ? notional * 0.001
        : ticker.assetClass === AssetClass.FOREX
          ? 3
          : dice.float(0.5, 2.5);
    return Math.round(perSide * sides * 100) / 100;
  }

  private withHour(day: Date, ticker: DemoTicker, dice: Dice): Date {
    const d = new Date(day);
    const minutes =
      ticker.assetClass === AssetClass.CRYPTO
        ? dice.int(0, 23 * 60)
        : ticker.assetClass === AssetClass.FOREX
          ? dice.int(7 * 60, 16 * 60)
          : dice.int(13 * 60 + 35, 19 * 60 + 50); // NYSE session in UTC
    d.setUTCHours(0, minutes, 0, 0);
    return d;
  }

  private trendAt(series: Bar[], idx: number): TradeTrend {
    const past = series[Math.max(0, idx - 20)].close;
    const change = (series[idx].close - past) / past;
    if (change > 0.03) return TradeTrend.UPTREND;
    if (change < -0.03) return TradeTrend.DOWNTREND;
    return TradeTrend.SIDEWAYS;
  }

  private async seedAlerts(
    userId: string,
    bars: Map<string, Bar[]>,
  ): Promise<void> {
    await this.alerts.save(
      this.alerts.create(
        DEMO_ALERTS.map((a) => {
          const series = bars.get(a.symbol);
          const last = series?.[series.length - 1]?.close ?? 0;
          return {
            userId,
            symbol: a.symbol,
            alertType: a.alertType,
            condition: a.condition,
            value: a.relativeToPrice ? roundPrice(last * a.value) : a.value,
            params: a.params ?? {},
            isActive: a.isActive,
            isTriggered: a.triggeredDaysAgo !== null,
            triggeredAt:
              a.triggeredDaysAgo !== null
                ? new Date(Date.now() - a.triggeredDaysAgo * DAY_MS)
                : (null as unknown as Date),
          };
        }),
      ),
    );
  }

  // ── Backtests and DCA ──────────────────────────────────────────────────────

  private kickWarmUp(): void {
    if (this.warming) return;
    this.warming = this.warmJobCache()
      .catch((err: Error) =>
        this.logger.warn(`Demo warm-up failed: ${err.message}`),
      )
      .finally(() => (this.warming = null));
  }

  /** Runs every demo job once under the template account, if not done yet. */
  private async warmJobCache(): Promise<void> {
    let template = await this.users.findOne({
      where: { email: TEMPLATE_EMAIL },
    });
    if (!template) {
      template = await this.users.save(
        this.users.create({
          email: TEMPLATE_EMAIL,
          firstName: 'Modelo',
          lastName: 'Demo',
          password: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
          role: UserRole.TRADER,
        }),
      );
    }
    const userId = template.id;
    const inFlight = [BacktestStatus.PENDING, BacktestStatus.RUNNING];
    const since = new Date(Date.now() - STALE_JOB_MS);

    for (const b of DEMO_BACKTESTS) {
      if (await this.findCachedBacktest(b)) continue;
      const running = await this.backtests.findOne({
        where: {
          userId,
          symbol: b.symbol,
          strategyType: b.strategyType,
          status: In(inFlight),
          createdAt: MoreThan(since),
        },
      });
      if (running) continue;
      const job = await this.backtests.save(
        this.backtests.create(this.backtestRow(userId, b, null, null)),
      );
      await this.backtestQueue.add('run', { backtestJobId: job.id });
    }
    for (const d of DEMO_DCAS) {
      if (await this.findCachedDCA(d)) continue;
      const running = await this.dcaJobs.findOne({
        where: {
          userId,
          symbol: d.symbol,
          period: d.period,
          status: In([DCAStatus.PENDING, DCAStatus.RUNNING]),
          createdAt: MoreThan(since),
        },
      });
      if (running) continue;
      const job = await this.dcaJobs.save(
        this.dcaJobs.create(this.dcaRow(userId, d, null)),
      );
      await this.dcaQueue.add('run', { dcaJobId: job.id });
    }
  }

  private async findCachedBacktest(
    b: DemoBacktest,
  ): Promise<BacktestJob | undefined> {
    const candidates = await this.backtests.find({
      where: {
        symbol: b.symbol,
        strategyType: b.strategyType,
        startDate: b.startDate,
        endDate: b.endDate,
        timeframe: '1d',
        status: BacktestStatus.COMPLETED,
      },
      order: { completedAt: 'DESC' },
      take: 10,
    });
    return candidates.find(
      (c) =>
        sameJson(c.strategyParams, b.strategyParams) &&
        sameJson(c.indicators, b.indicators) &&
        Number(c.initialCapital) === b.initialCapital &&
        Number(c.brokerageRate) === b.brokerageRate,
    );
  }

  private async findCachedDCA(d: DemoDCA): Promise<DCAJob | undefined> {
    const candidates = await this.dcaJobs.find({
      where: {
        symbol: d.symbol,
        startDate: d.startDate,
        endDate: d.endDate,
        period: d.period,
        status: DCAStatus.COMPLETED,
      },
      order: { completedAt: 'DESC' },
      take: 10,
    });
    return candidates.find(
      (c) =>
        Number(c.amountPerPeriod) === d.amountPerPeriod &&
        c.dayOfMonth === d.dayOfMonth &&
        sameJson(c.conditions, d.conditions) &&
        sameJson(c.indicators, d.indicators),
    );
  }

  private backtestRow(
    userId: string,
    b: DemoBacktest,
    strategyId: string | null,
    cached: BacktestJob | null,
    createdAt = new Date(),
  ): Partial<BacktestJob> {
    return {
      userId,
      symbol: b.symbol,
      strategyType: b.strategyType,
      strategyParams: b.strategyParams,
      strategyId,
      indicators: b.indicators,
      startDate: b.startDate,
      endDate: b.endDate,
      initialCapital: b.initialCapital,
      brokerageRate: b.brokerageRate,
      timeframe: '1d',
      status: cached ? BacktestStatus.COMPLETED : BacktestStatus.PENDING,
      results: cached?.results ?? null,
      completedAt: cached ? new Date(createdAt.getTime() + 20_000) : null,
      createdAt,
    };
  }

  private dcaRow(
    userId: string,
    d: DemoDCA,
    cached: DCAJob | null,
    createdAt = new Date(),
  ): Partial<DCAJob> {
    return {
      userId,
      ...d,
      status: cached ? DCAStatus.COMPLETED : DCAStatus.PENDING,
      results: cached?.results ?? null,
      completedAt: cached ? new Date(createdAt.getTime() + 15_000) : null,
      createdAt,
    };
  }

  /**
   * Copies finished results of the template account. Jobs still running there
   * are skipped: the worker handles one request at a time, and a queue of
   * identical jobs per visitor would starve it.
   */
  private async seedBacktests(
    userId: string,
    strategyIds: Map<string, string>,
  ): Promise<void> {
    const strategyByType: Record<string, string | undefined> = {
      sma_crossover: strategyIds.get('pullback'),
      rsi: strategyIds.get('ifr'),
    };
    for (const [i, b] of DEMO_BACKTESTS.entries()) {
      const cached = await this.findCachedBacktest(b);
      if (!cached) continue;
      const createdAt = new Date(Date.now() - (40 - i * 4) * DAY_MS);
      await this.backtests.save(
        this.backtests.create(
          this.backtestRow(
            userId,
            b,
            strategyByType[b.strategyType] ?? null,
            cached,
            createdAt,
          ),
        ),
      );
    }
  }

  private async seedDCA(userId: string): Promise<void> {
    for (const [i, d] of DEMO_DCAS.entries()) {
      const cached = await this.findCachedDCA(d);
      if (!cached) continue;
      const createdAt = new Date(Date.now() - (20 - i * 5) * DAY_MS);
      await this.dcaJobs.save(
        this.dcaJobs.create(this.dcaRow(userId, d, cached, createdAt)),
      );
    }
  }

  private async seedFilters(userId: string): Promise<void> {
    const fresh = new Date(Date.now() - 6 * 60 * 60 * 1000);
    for (const f of DEMO_FILTERS) {
      const filter = await this.filters.save(
        this.filters.create({
          userId,
          name: f.name,
          description: f.description,
          logic: f.logic,
          isActive: true,
          conditions: f.conditions.map((c) => ({ id: randomUUID(), ...c })),
        }),
      );
      if (!f.scanSymbols.length) continue;

      const cached = await this.filterResults
        .createQueryBuilder('r')
        .innerJoin('r.filter', 'f')
        .innerJoin('f.user', 'u')
        .where('f.name = :name', { name: f.name })
        .andWhere('u.email LIKE :domain', { domain: `%@${DEMO_EMAIL_DOMAIN}` })
        .andWhere('r.scannedAt > :fresh', { fresh })
        .orderBy('r.scannedAt', 'DESC')
        .getMany();
      const latestBySymbol = new Map<string, FilterResult>();
      for (const r of cached)
        if (!latestBySymbol.has(r.symbol)) latestBySymbol.set(r.symbol, r);

      if (
        f.scanSymbols.every(
          (s) =>
            latestBySymbol.has(s) &&
            !latestBySymbol.get(s)!.indicatorValues?.error,
        )
      ) {
        await this.filterResults.insert(
          f.scanSymbols.map((s) => ({
            filterId: filter.id,
            symbol: s,
            passed: latestBySymbol.get(s)!.passed,
            indicatorValues: latestBySymbol.get(s)!.indicatorValues,
          })),
        );
        continue;
      }

      // The scan calls the worker once per symbol; it runs after the response,
      // at most once every 10 minutes per filter across all visitors.
      const lastScan = this.scansStartedAt.get(f.name) ?? 0;
      if (Date.now() - lastScan < 10 * 60 * 1000) continue;
      this.scansStartedAt.set(f.name, Date.now());
      const startDate = isoDay(new Date(Date.now() - 365 * DAY_MS));
      void this.filtersService
        .runScan(filter.id, userId, { symbols: f.scanSymbols, startDate })
        .catch((err: Error) =>
          this.logger.warn(`Demo scan failed: ${err.message}`),
        );
    }
  }
}
