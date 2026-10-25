import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BacktestJob, BacktestStatus } from './backtest-job.entity';
import { CreateBacktestDto } from './dtos/backtesting.dto';
import { UserRole } from '../users/user.entity';
import { assertDateRange } from '../shared/constants/market';

// Jobs share one worker queue: cap how many a single user can have waiting.
// Jobs older than STALE_JOB_MS are ignored, so a crashed run cannot lock anyone out.
const STALE_JOB_MS = 2 * 60 * 60 * 1000;
const MAX_JOBS_IN_FLIGHT = 20;

@Injectable()
export class BacktestingService {
  constructor(
    @InjectRepository(BacktestJob)
    private jobRepo: Repository<BacktestJob>,
    @InjectQueue('backtesting') private queue: Queue,
  ) {}

  async create(userId: string, dto: CreateBacktestDto): Promise<BacktestJob[]> {
    assertDateRange(dto.startDate, dto.endDate);
    const inFlight = await this.jobRepo.count({
      where: {
        userId,
        status: In([BacktestStatus.PENDING, BacktestStatus.RUNNING]),
        createdAt: MoreThan(new Date(Date.now() - STALE_JOB_MS)),
      },
    });
    if (inFlight + dto.symbols.length > MAX_JOBS_IN_FLIGHT) {
      throw new HttpException(
        `At most ${MAX_JOBS_IN_FLIGHT} backtests can be queued at once. Wait for the current ones to finish.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

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
