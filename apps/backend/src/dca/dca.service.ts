import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DCAJob, DCAStatus } from './dca-job.entity';
import { CreateDCADto } from './dtos/create-dca.dto';
import { UserRole } from '../users/user.entity';

@Injectable()
export class DCAService {
  constructor(
    @InjectRepository(DCAJob)
    private jobRepo: Repository<DCAJob>,
    @InjectQueue('dca') private queue: Queue,
  ) {}

  async create(userId: string, dto: CreateDCADto): Promise<DCAJob> {
    const job = this.jobRepo.create({
      userId,
      symbol: dto.symbol.toUpperCase().trim(),
      startDate: dto.startDate,
      endDate: dto.endDate,
      amountPerPeriod: dto.amountPerPeriod,
      period: dto.period,
      dayOfMonth: dto.dayOfMonth ?? 1,
      conditions: dto.conditions?.length ? dto.conditions : null,
      conditionLogic: dto.conditionLogic ?? 'AND',
      indicators: dto.indicators?.length ? dto.indicators : null,
      status: DCAStatus.PENDING,
    });
    const saved = await this.jobRepo.save(job);
    await this.queue.add('run', { dcaJobId: saved.id });
    return saved;
  }

  async findAll(userId: string, role: string): Promise<DCAJob[]> {
    const where = role !== UserRole.ADMIN ? { userId } : {};
    return this.jobRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, role: string): Promise<DCAJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('DCA job not found');
    if (role !== UserRole.ADMIN && job.userId !== userId)
      throw new ForbiddenException('Access denied');
    return job;
  }

  async remove(id: string, userId: string, role: string): Promise<void> {
    const job = await this.findOne(id, userId, role);
    await this.jobRepo.remove(job);
  }
}
