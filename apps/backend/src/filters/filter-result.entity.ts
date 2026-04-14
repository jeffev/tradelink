import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Filter } from './filter.entity';

@Entity('filter_results')
export class FilterResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filterId: string;

  @ManyToOne(() => Filter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'filterId' })
  filter: Filter;

  @Column()
  symbol: string;

  @Column({ default: false })
  passed: boolean;

  @Column({ type: 'simple-json', nullable: true })
  indicatorValues: Record<string, any>;

  @CreateDateColumn()
  scannedAt: Date;
}
