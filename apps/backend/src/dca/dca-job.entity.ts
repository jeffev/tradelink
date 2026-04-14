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

export enum DCAStatus {
  PENDING   = 'pending',
  RUNNING   = 'running',
  COMPLETED = 'completed',
  FAILED    = 'failed',
}

export interface DCAEquityPoint {
  date: string;
  value: number;
  invested: number;
}

export interface DCAPurchase {
  date: string;
  price: number;
  amount: number;
  shares: number;
  bought?: boolean;
}

export interface DCAStrategyResult {
  name: string;
  strategyType: 'fixed' | 'lump_sum' | 'conditional';
  totalInvested: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPct: number;
  avgCostBasis: number;
  sharesOwned: number;
  nPurchases: number;
  nSkipped?: number;
  purchases: DCAPurchase[];
  equityCurve: DCAEquityPoint[];
}

export interface DCAResults {
  strategies: DCAStrategyResult[];
  priceData: { date: string; open: number; high: number; low: number; close: number }[];
}

@Entity('dca_jobs')
export class DCAJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  symbol: string;

  @Column({ name: 'start_date' })
  startDate: string;

  @Column({ name: 'end_date' })
  endDate: string;

  @Column('decimal', { precision: 20, scale: 2, default: 500, name: 'amount_per_period' })
  amountPerPeriod: number;

  @Column({ default: 'monthly' })
  period: string;

  @Column({ default: 1, name: 'day_of_month' })
  dayOfMonth: number;

  @Column({ type: 'simple-json', nullable: true })
  conditions: Array<{ indicator: string; operator: string; value: number }> | null;

  @Column({ default: 'AND', name: 'condition_logic' })
  conditionLogic: string;

  @Column({ type: 'simple-json', nullable: true })
  indicators: Array<{ name: string; params: Record<string, unknown> }> | null;

  @Column({
    type: 'simple-enum',
    enum: DCAStatus,
    default: DCAStatus.PENDING,
  })
  status: DCAStatus;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  results: DCAResults | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
