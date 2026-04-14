import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SavedIndicator } from './indicator.entity';
import { CalculateIndicatorsDto, SaveIndicatorDto } from './dtos/indicator.dto';

@Injectable()
export class IndicatorsService {
  private readonly workerUrl: string;

  constructor(
    @InjectRepository(SavedIndicator)
    private savedIndicatorRepo: Repository<SavedIndicator>,
    private configService: ConfigService,
  ) {
    this.workerUrl = this.configService.get<string>(
      'WORKER_URL',
      'http://localhost:8000',
    );
  }

  async calculate(dto: CalculateIndicatorsDto): Promise<any> {
    try {
      const response = await axios.post(`${this.workerUrl}/calculate-indicators`, {
        symbol: dto.symbol,
        indicators: dto.indicators,
        start_date: dto.startDate,
        end_date: dto.endDate,
        timeframe: dto.timeframe ?? '1d',
      });
      return response.data;
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.message;
      throw new BadRequestException(`Worker error: ${detail}`);
    }
  }

  async save(userId: string, dto: SaveIndicatorDto): Promise<SavedIndicator> {
    const indicator = this.savedIndicatorRepo.create({ userId, ...dto });
    return this.savedIndicatorRepo.save(indicator);
  }

  async findAll(userId: string): Promise<SavedIndicator[]> {
    return this.savedIndicatorRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const indicator = await this.savedIndicatorRepo.findOne({ where: { id } });
    if (!indicator) throw new NotFoundException('Indicator config not found');
    if (indicator.userId !== userId) throw new ForbiddenException();
    await this.savedIndicatorRepo.delete(id);
  }
}
