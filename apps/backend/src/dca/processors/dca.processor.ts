import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import axios from 'axios';
import { DCAJob, DCAStatus, DCAResults } from '../dca-job.entity';

@Processor('dca')
export class DCAProcessor extends WorkerHost {
  private readonly logger = new Logger(DCAProcessor.name);
  private readonly workerUrl: string;

  constructor(
    @InjectRepository(DCAJob)
    private jobRepo: Repository<DCAJob>,
    private configService: ConfigService,
  ) {
    super();
    this.workerUrl = this.configService.get<string>('WORKER_URL', 'http://localhost:8000');
  }

  async process(job: Job<{ dcaJobId: string }>): Promise<void> {
    const { dcaJobId } = job.data;
    this.logger.log(`Processing DCA job ${dcaJobId}`);

    const dcaJob = await this.jobRepo.findOne({ where: { id: dcaJobId } });
    if (!dcaJob) {
      this.logger.warn(`DCA job ${dcaJobId} not found — skipping`);
      return;
    }

    dcaJob.status = DCAStatus.RUNNING;
    await this.jobRepo.save(dcaJob);

    try {
      const response = await axios.post<DCAResults>(
        `${this.workerUrl}/run-dca`,
        {
          symbol: dcaJob.symbol,
          start_date: dcaJob.startDate,
          end_date: dcaJob.endDate,
          amount_per_period: Number(dcaJob.amountPerPeriod),
          period: dcaJob.period,
          day_of_month: dcaJob.dayOfMonth,
          conditions: dcaJob.conditions ?? undefined,
          condition_logic: dcaJob.conditionLogic,
          indicators: dcaJob.indicators ?? undefined,
        },
        { timeout: 120_000 },
      );

      dcaJob.status = DCAStatus.COMPLETED;
      dcaJob.results = response.data;
      dcaJob.completedAt = new Date();
      this.logger.log(`DCA job ${dcaJobId} completed`);
    } catch (err: unknown) {
      dcaJob.status = DCAStatus.FAILED;
      if (axios.isAxiosError(err)) {
        dcaJob.errorMessage =
          (err.response?.data as { detail?: string })?.detail ?? err.message;
      } else {
        dcaJob.errorMessage = (err as Error).message;
      }
      this.logger.error(`DCA job ${dcaJobId} failed: ${dcaJob.errorMessage}`);
    }

    await this.jobRepo.save(dcaJob);
  }
}
