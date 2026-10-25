import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Filter } from './filter.entity';
import { FilterResult } from './filter-result.entity';
import { CreateFilterDto, UpdateFilterDto, RunScanDto } from './dtos/filter.dto';
import { assertDateRange } from '../shared/constants/market';

// A scan is answered synchronously, one worker call per symbol.
const SCAN_TIMEOUT_MS = 45_000;
const MAX_SCAN_DAYS = 5 * 366;

@Injectable()
export class FiltersService {
  private readonly workerUrl: string;

  constructor(
    @InjectRepository(Filter) private filterRepo: Repository<Filter>,
    @InjectRepository(FilterResult) private resultRepo: Repository<FilterResult>,
    private configService: ConfigService,
  ) {
    this.workerUrl = this.configService.get<string>(
      'WORKER_URL',
      'http://localhost:8000',
    );
  }

  async create(userId: string, dto: CreateFilterDto): Promise<Filter> {
    const filter = this.filterRepo.create({
      userId,
      name: dto.name,
      description: dto.description,
      conditions: dto.conditions,
      logic: dto.logic ?? 'AND',
    });
    return this.filterRepo.save(filter);
  }

  async findAll(userId: string): Promise<Filter[]> {
    return this.filterRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Filter> {
    const filter = await this.filterRepo.findOne({ where: { id } });
    if (!filter) throw new NotFoundException('Filter not found');
    if (filter.userId !== userId) throw new ForbiddenException();
    return filter;
  }

  async update(id: string, userId: string, dto: UpdateFilterDto): Promise<Filter> {
    const filter = await this.findOne(id, userId);
    Object.assign(filter, dto);
    return this.filterRepo.save(filter);
  }

  async remove(id: string, userId: string): Promise<void> {
    const filter = await this.findOne(id, userId);
    await this.resultRepo.delete({ filterId: filter.id });
    await this.filterRepo.delete(filter.id);
  }

  async runScan(id: string, userId: string, dto: RunScanDto): Promise<FilterResult[]> {
    const filter = await this.findOne(id, userId);

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const startDate = dto.startDate ?? thirtyDaysAgo;
    const endDate = dto.endDate ?? today;
    assertDateRange(startDate, endDate, MAX_SCAN_DAYS);

    const results: FilterResult[] = [];

    for (const symbol of dto.symbols) {
      try {
        const response = await axios.post(`${this.workerUrl}/run-scanner`, {
          symbol: symbol.toUpperCase(),
          conditions: filter.conditions,
          logic: filter.logic,
          start_date: startDate,
          end_date: endDate,
        }, { timeout: SCAN_TIMEOUT_MS });

        const { passed, indicatorValues } = response.data;
        const result = this.resultRepo.create({
          filterId: filter.id,
          symbol: symbol.toUpperCase(),
          passed,
          indicatorValues,
        });
        results.push(await this.resultRepo.save(result));
      } catch (err: any) {
        const result = this.resultRepo.create({
          filterId: filter.id,
          symbol: symbol.toUpperCase(),
          passed: false,
          indicatorValues: {
            // Worker's own message, or a generic one: never the raw network error.
            error: err.response?.data?.detail ?? 'Market data worker unavailable',
          },
        });
        results.push(await this.resultRepo.save(result));
      }
    }

    return results;
  }

  async getResults(filterId: string, userId: string): Promise<FilterResult[]> {
    await this.findOne(filterId, userId);
    return this.resultRepo.find({
      where: { filterId },
      order: { scannedAt: 'DESC' },
      take: 200,
    });
  }
}
