import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('candles')
@Index(['symbol', 'interval', 'timestamp'], { unique: true })
export class Candle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  symbol: string;

  @Column({ default: '1d' })
  interval: string; // 1d, 1h, 15m

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column('decimal', { precision: 20, scale: 8 })
  open: number;

  @Column('decimal', { precision: 20, scale: 8 })
  high: number;

  @Column('decimal', { precision: 20, scale: 8 })
  low: number;

  @Column('decimal', { precision: 20, scale: 8 })
  close: number;

  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  volume: number;
}
