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

export enum AlertType {
  PRICE = 'PRICE',
  RSI = 'RSI',
  SMA_CROSS = 'SMA_CROSS',
  EMA_CROSS = 'EMA_CROSS',
  MACD_CROSS = 'MACD_CROSS',
  BB_BREAKOUT = 'BB_BREAKOUT',
}

export enum AlertCondition {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
  CROSSES_ABOVE = 'CROSSES_ABOVE',
  CROSSES_BELOW = 'CROSSES_BELOW',
}

@Entity('price_alerts')
export class PriceAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  symbol: string;

  @Column({ type: 'simple-enum', enum: AlertType, default: AlertType.PRICE })
  alertType: AlertType;

  @Column({ type: 'simple-enum', enum: AlertCondition })
  condition: AlertCondition;

  @Column({ type: 'float' })
  value: number;

  @Column({ type: 'simple-json', nullable: true })
  params: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isTriggered: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  triggeredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
