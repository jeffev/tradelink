import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export interface FilterCondition {
  id: string;
  indicator: string; // PRICE | SMA | EMA | RSI | MACD | BB_UPPER | BB_LOWER | ATR | STOCH_K
  params: Record<string, any>;
  operator: string; // gt | lt | gte | lte | eq | crosses_above | crosses_below | price_above_sma | price_below_sma
  value: number | null;
}

@Entity('filters')
export class Filter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'simple-json' })
  conditions: FilterCondition[];

  @Column({ default: 'AND' })
  logic: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
