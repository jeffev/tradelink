import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PriceAlert, AlertType } from './price-alert.entity';
import { CreateAlertDto, UpdateAlertDto } from './dtos/alert.dto';

@Injectable()
export class AlertsService {
  private readonly workerUrl: string;

  constructor(
    @InjectRepository(PriceAlert) private alertRepo: Repository<PriceAlert>,
    private configService: ConfigService,
  ) {
    this.workerUrl = this.configService.get<string>(
      'WORKER_URL',
      'http://localhost:8000',
    );
  }

  async create(userId: string, dto: CreateAlertDto): Promise<PriceAlert> {
    const alert = this.alertRepo.create({ userId, ...dto });
    return this.alertRepo.save(alert);
  }

  async findAll(userId: string): Promise<PriceAlert[]> {
    return this.alertRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<PriceAlert> {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.userId !== userId) throw new ForbiddenException();
    return alert;
  }

  async update(id: string, userId: string, dto: UpdateAlertDto): Promise<PriceAlert> {
    const alert = await this.findOne(id, userId);
    Object.assign(alert, dto);
    return this.alertRepo.save(alert);
  }

  async remove(id: string, userId: string): Promise<void> {
    const alert = await this.findOne(id, userId);
    await this.alertRepo.delete(alert.id);
  }

  async checkAlerts(userId: string): Promise<{ triggered: PriceAlert[]; checked: number }> {
    const activeAlerts = await this.alertRepo.find({
      where: { userId, isActive: true, isTriggered: false },
    });

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const triggered: PriceAlert[] = [];

    for (const alert of activeAlerts) {
      const condition = this._buildConditionFromAlert(alert);
      if (!condition) continue;

      try {
        const response = await axios.post(`${this.workerUrl}/run-scanner`, {
          symbol: alert.symbol,
          conditions: [condition],
          logic: 'AND',
          start_date: thirtyDaysAgo,
          end_date: today,
        });

        if (response.data.passed) {
          alert.isTriggered = true;
          alert.triggeredAt = new Date();
          await this.alertRepo.save(alert);
          triggered.push(alert);
        }
      } catch {
        // Skip if worker fails for this symbol
      }
    }

    return { triggered, checked: activeAlerts.length };
  }

  private _buildConditionFromAlert(alert: PriceAlert): any {
    const operatorMap: Record<string, string> = {
      ABOVE: 'gt',
      BELOW: 'lt',
      CROSSES_ABOVE: 'crosses_above',
      CROSSES_BELOW: 'crosses_below',
    };
    const operator = operatorMap[alert.condition];

    if (alert.alertType === AlertType.PRICE) {
      return { indicator: 'PRICE', params: {}, operator, value: alert.value };
    }
    if (alert.alertType === AlertType.RSI) {
      return {
        indicator: 'RSI',
        params: alert.params ?? { period: 14 },
        operator,
        value: alert.value,
      };
    }
    if (alert.alertType === AlertType.SMA_CROSS) {
      return {
        indicator: 'SMA',
        params: alert.params ?? { period: 20 },
        operator,
        value: alert.value,
      };
    }
    if (alert.alertType === AlertType.EMA_CROSS) {
      return {
        indicator: 'EMA',
        params: alert.params ?? { period: 20 },
        operator,
        value: alert.value,
      };
    }
    return null;
  }
}
