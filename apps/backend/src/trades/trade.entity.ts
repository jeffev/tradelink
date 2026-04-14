import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Strategy } from '../strategies/strategy.entity';

export enum TradeSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum TradeStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum ExitReason {
  TP_HIT     = 'TP_HIT',
  SL_HIT     = 'SL_HIT',
  MANUAL     = 'MANUAL',
  TIMEOUT    = 'TIMEOUT',
  TRAIL_STOP = 'TRAIL_STOP',
}

export enum TradeTimeframe {
  M1  = '1m',
  M5  = '5m',
  M15 = '15m',
  H1  = '1h',
  H4  = '4h',
  D1  = '1d',
  W1  = '1w',
}

export enum TradeTrend {
  UPTREND   = 'UPTREND',
  DOWNTREND = 'DOWNTREND',
  SIDEWAYS  = 'SIDEWAYS',
}

export enum AssetClass {
  STOCKS  = 'STOCKS',
  CRYPTO  = 'CRYPTO',
  FOREX   = 'FOREX',
  FUTURES = 'FUTURES',
  ETF     = 'ETF',
  OPTIONS = 'OPTIONS',
}

export enum EmotionAtEntry {
  CALM      = 'CALM',
  FOMO      = 'FOMO',
  FEAR      = 'FEAR',
  REVENGE   = 'REVENGE',
  CONFIDENT = 'CONFIDENT',
}

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Strategy, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'strategy_id' })
  strategy: Strategy | null;

  @Column({ name: 'strategy_id', nullable: true })
  strategyId: string | null;

  @Column({ length: 20 })
  ticker: string;

  @Column({ type: 'simple-enum', enum: TradeSide })
  side: TradeSide;

  @Column({ type: 'simple-enum', enum: TradeStatus, default: TradeStatus.OPEN })
  status: TradeStatus;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  exitPrice: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quantity: number;

  @Column({ name: 'entry_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  entryAt: Date;

  @Column({ name: 'exit_at', type: 'timestamp', nullable: true })
  exitAt: Date | null;

  // ── Gestão da Operação ────────────────────────────────────────────────────

  @Column({ name: 'stop_loss', type: 'decimal', precision: 18, scale: 8, nullable: true })
  stopLoss: number | null;

  @Column({ name: 'take_profit', type: 'decimal', precision: 18, scale: 8, nullable: true })
  takeProfit: number | null;

  @Column({ name: 'exit_reason', type: 'simple-enum', enum: ExitReason, nullable: true })
  exitReason: ExitReason | null;

  // ── Contexto de Mercado ───────────────────────────────────────────────────

  @Column({ type: 'simple-enum', enum: TradeTimeframe, nullable: true })
  timeframe: TradeTimeframe | null;

  @Column({ type: 'text', nullable: true })
  setup: string | null;

  @Column({ type: 'simple-enum', enum: TradeTrend, nullable: true })
  trend: TradeTrend | null;

  @Column({ name: 'asset_class', type: 'simple-enum', enum: AssetClass, nullable: true })
  assetClass: AssetClass | null;

  // ── Psicologia & Qualidade ────────────────────────────────────────────────

  @Column({ name: 'confidence_level', type: 'int', nullable: true })
  confidenceLevel: number | null;

  @Column({ name: 'entry_quality', type: 'int', nullable: true })
  entryQuality: number | null;

  @Column({ name: 'emotion_at_entry', type: 'simple-enum', enum: EmotionAtEntry, nullable: true })
  emotionAtEntry: EmotionAtEntry | null;

  @Column({ name: 'moved_stop', type: 'boolean', nullable: true })
  movedStop: boolean | null;

  @Column({ name: 'entered_on_time', type: 'boolean', nullable: true })
  enteredOnTime: boolean | null;

  @Column({ type: 'boolean', nullable: true, name: 'followed_strategy' })
  followedStrategy: boolean | null;

  // ── Sizing & Risco Financeiro ─────────────────────────────────────────────

  @Column({ name: 'capital_pct', type: 'decimal', precision: 8, scale: 4, nullable: true })
  capitalPct: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  commission: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  slippage: number | null;

  // ── Notas ─────────────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true, name: 'close_notes' })
  closeNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Computed ──────────────────────────────────────────────────────────────

  get profitLoss(): number | null {
    if (this.exitPrice === null || this.exitPrice === undefined) return null;
    const mult = this.side === TradeSide.BUY ? 1 : -1;
    return mult * (Number(this.exitPrice) - Number(this.entryPrice)) * Number(this.quantity);
  }

  get profitLossPct(): number | null {
    if (this.exitPrice === null || this.exitPrice === undefined) return null;
    const mult = this.side === TradeSide.BUY ? 1 : -1;
    return mult * ((Number(this.exitPrice) - Number(this.entryPrice)) / Number(this.entryPrice)) * 100;
  }

  get riskAmount(): number | null {
    if (this.stopLoss === null || this.stopLoss === undefined) return null;
    const mult = this.side === TradeSide.BUY ? 1 : -1;
    return mult * (Number(this.entryPrice) - Number(this.stopLoss)) * Number(this.quantity);
  }

  get plannedRR(): number | null {
    if (this.stopLoss === null || this.takeProfit === null) return null;
    const risk   = Math.abs(Number(this.entryPrice) - Number(this.stopLoss));
    const reward = Math.abs(Number(this.takeProfit)  - Number(this.entryPrice));
    return risk > 0 ? reward / risk : null;
  }

  get realizedRR(): number | null {
    const pnl  = this.profitLoss;
    const risk = this.riskAmount;
    if (pnl === null || risk === null || risk === 0) return null;
    return pnl / Math.abs(risk);
  }
}
