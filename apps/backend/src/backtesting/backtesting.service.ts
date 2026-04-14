import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BacktestJob, BacktestStatus } from './backtest-job.entity';
import { CreateBacktestDto } from './dtos/backtesting.dto';
import { UserRole } from '../users/user.entity';

@Injectable()
export class BacktestingService {
  constructor(
    @InjectRepository(BacktestJob)
    private jobRepo: Repository<BacktestJob>,
    @InjectQueue('backtesting') private queue: Queue,
  ) {}

  async create(userId: string, dto: CreateBacktestDto): Promise<BacktestJob[]> {
    const jobs = await Promise.all(
      dto.symbols.map(async (symbol) => {
        const job = this.jobRepo.create({
          userId,
          symbol: symbol.toUpperCase().trim(),
          strategyType: dto.strategyType,
          strategyParams: dto.strategyParams ?? null,
          strategyId: dto.strategyId ?? null,
          startDate: dto.startDate,
          endDate: dto.endDate,
          initialCapital: dto.initialCapital ?? 10000,
          brokerageRate: dto.brokerageRate ?? 0,
          timeframe: dto.timeframe ?? '1d',
          indicators: dto.indicators ?? null,
          status: BacktestStatus.PENDING,
        });
        const saved = await this.jobRepo.save(job);
        await this.queue.add('run', { backtestJobId: saved.id });
        return saved;
      }),
    );
    return jobs;
  }

  async findAll(userId: string, role: string): Promise<BacktestJob[]> {
    const where = role !== UserRole.ADMIN ? { userId } : {};
    return this.jobRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, role: string): Promise<BacktestJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Backtest job ${id} not found`);
    if (role !== UserRole.ADMIN && job.userId !== userId) {
      throw new ForbiddenException();
    }
    return job;
  }

  async remove(id: string, userId: string, role: string): Promise<void> {
    const job = await this.findOne(id, userId, role);
    await this.jobRepo.delete({ id: job.id });
  }

  async compareJobs(
    ids: string[],
    userId: string,
    role: string,
  ): Promise<BacktestJob[]> {
    const jobs = await Promise.all(ids.map((id) => this.findOne(id, userId, role)));
    return jobs;
  }
}
