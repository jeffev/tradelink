import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 10000 })
  initialCapital: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  defaultBrokerage: number;

  @Column({ length: 10, default: 'USD' })
  currency: string;

  @Column({ length: 50, default: 'America/Sao_Paulo' })
  timezone: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
