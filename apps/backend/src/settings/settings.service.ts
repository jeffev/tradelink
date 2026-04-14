import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './settings.entity';
import { UpdateSettingsDto, SettingsResponseDto } from './dtos/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settingsRepository: Repository<UserSettings>,
  ) {}

  async getOrCreate(userId: string): Promise<SettingsResponseDto> {
    let settings = await this.settingsRepository.findOne({ where: { userId } });
    if (!settings) {
      settings = await this.settingsRepository.save(
        this.settingsRepository.create({ userId }),
      );
    }
    return this.toDto(settings);
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    let settings = await this.settingsRepository.findOne({ where: { userId } });
    if (!settings) {
      settings = this.settingsRepository.create({ userId });
    }
    Object.assign(settings, dto);
    const saved = await this.settingsRepository.save(settings);
    return this.toDto(saved);
  }

  private toDto(s: UserSettings): SettingsResponseDto {
    return {
      userId: s.userId,
      initialCapital: Number(s.initialCapital),
      defaultBrokerage: Number(s.defaultBrokerage),
      currency: s.currency,
      timezone: s.timezone,
      updatedAt: s.updatedAt,
    };
  }
}
