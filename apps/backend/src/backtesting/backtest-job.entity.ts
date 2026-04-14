import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum BacktestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum BacktestStrategyType {
  SMA_CROSSOVER = 'sma_crossover',
  RSI = 'rsi',
  BUY_AND_HOLD = 'buy_and_hold',
  MULTI_INDICATOR = 'multi_indicator',
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface BacktestTradeResult {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'buy' | 'sell';
  pnl: number;
  pnlPct: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  avgRR: number;
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IndicatorPoint {
  date: string;
  value: number;
}

export interface BacktestResults {
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTradeResult[];
  priceData: PricePoint[];
  indicators: Record<string, IndicatorPoint[]>;
}

@Entity('backtest_jobs')
export class BacktestJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', nullable: true, name: 'strategy_id' })
  strategyId: string | null;

  @Column()
  symbol: string;

  @Column({
    type: 'simple-enum',
    enum: BacktestStrategyType,
    default: BacktestStrategyType.BUY_AND_HOLD,
    name: 'strategy_type',
  })
  strategyType: BacktestStrategyType;

  @Column({ type: 'simple-json', nullable: true, name: 'strategy_params' })
  strategyParams: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  indicators: Array<{ name: string; params: Record<string, unknown> }> | null;

  @Column({ name: 'start_date' })
  startDate: string; // ISO date string YYYY-MM-DD

  @Column({ name: 'end_date' })
  endDate: string;

  @Column('decimal', { precision: 20, scale: 2, default: 10000, name: 'initial_capital' })
  initialCapital: number;

  @Column('decimal', { precision: 5, scale: 4, default: 0, name: 'brokerage_rate' })
  brokerageRate: number;

  @Column({ type: 'varchar', default: '1d' })
  timeframe: string;

  @Column({
    type: 'simple-enum',
    enum: BacktestStatus,
    default: BacktestStatus.PENDING,
  })
  status: BacktestStatus;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  results: BacktestResults | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
