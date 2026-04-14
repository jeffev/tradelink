import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import axios from 'axios';
import { BacktestJob, BacktestStatus, BacktestResults } from '../backtest-job.entity';

@Processor('backtesting')
export class BacktestProcessor extends WorkerHost {
  private readonly logger = new Logger(BacktestProcessor.name);
  private readonly workerUrl: string;

  constructor(
    @InjectRepository(BacktestJob)
    private jobRepo: Repository<BacktestJob>,
    private configService: ConfigService,
  ) {
    super();
    this.workerUrl = this.configService.get<string>(
      'WORKER_URL',
      'http://localhost:8000',
    );
  }

  async process(job: Job<{ backtestJobId: string }>): Promise<void> {
    const { backtestJobId } = job.data;
    this.logger.log(`Processing backtest job ${backtestJobId}`);

    const backtestJob = await this.jobRepo.findOne({
      where: { id: backtestJobId },
    });

    if (!backtestJob) {
      this.logger.warn(`Backtest job ${backtestJobId} not found — skipping`);
      return;
    }

    // Mark as running
    backtestJob.status = BacktestStatus.RUNNING;
    await this.jobRepo.save(backtestJob);

    try {
      const response = await axios.post<BacktestResults>(
        `${this.workerUrl}/run-backtest`,
        {
          symbol: backtestJob.symbol,
          strategy_type: backtestJob.strategyType,
          strategy_params: backtestJob.strategyParams ?? {},
          start_date: backtestJob.startDate,
          end_date: backtestJob.endDate,
          initial_capital: Number(backtestJob.initialCapital),
          brokerage_rate: Number(backtestJob.brokerageRate),
          timeframe: backtestJob.timeframe ?? '1d',
          indicators: backtestJob.indicators ?? undefined,
        },
        { timeout: 120_000 },
      );

      backtestJob.status = BacktestStatus.COMPLETED;
      backtestJob.results = response.data;
      backtestJob.completedAt = new Date();
      this.logger.log(`Backtest job ${backtestJobId} completed`);
    } catch (err: unknown) {
      backtestJob.status = BacktestStatus.FAILED;
      if (axios.isAxiosError(err)) {
        backtestJob.errorMessage =
          (err.response?.data as { detail?: string })?.detail ?? err.message;
      } else {
        backtestJob.errorMessage = (err as Error).message;
      }
      this.logger.error(
        `Backtest job ${backtestJobId} failed: ${backtestJob.errorMessage}`,
      );
    }

    await this.jobRepo.save(backtestJob);
  }
}
