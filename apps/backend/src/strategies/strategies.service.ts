import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy } from './strategy.entity';
import { CreateStrategyDto, UpdateStrategyDto, StrategyResponseDto } from './dtos/strategy.dto';
import { UserRole } from '../users/user.entity';

@Injectable()
export class StrategiesService {
  constructor(
    @InjectRepository(Strategy)
    private readonly strategyRepository: Repository<Strategy>,
  ) {}

  async create(userId: string, dto: CreateStrategyDto): Promise<StrategyResponseDto> {
    const strategy = this.strategyRepository.create({
      ...dto,
      userId,
      description: dto.description ?? null,
      parameters: dto.parameters ?? null,
    });
    const saved = await this.strategyRepository.save(strategy);
    return this.toResponseDto(saved);
  }

  async findAll(userId: string, role: UserRole): Promise<StrategyResponseDto[]> {
    const where = role === UserRole.ADMIN ? {} : { userId };
    const strategies = await this.strategyRepository.find({ where, order: { createdAt: 'DESC' } });
    return strategies.map(s => this.toResponseDto(s));
  }

  async findOne(id: string, userId: string, role: UserRole): Promise<StrategyResponseDto> {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) throw new NotFoundException('Strategy not found');
    if (role !== UserRole.ADMIN && strategy.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.toResponseDto(strategy);
  }

  async update(id: string, userId: string, role: UserRole, dto: UpdateStrategyDto): Promise<StrategyResponseDto> {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) throw new NotFoundException('Strategy not found');
    if (role !== UserRole.ADMIN && strategy.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    Object.assign(strategy, dto);
    const updated = await this.strategyRepository.save(strategy);
    return this.toResponseDto(updated);
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) throw new NotFoundException('Strategy not found');
    if (role !== UserRole.ADMIN && strategy.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.strategyRepository.remove(strategy);
  }

  private toResponseDto(strategy: Strategy): StrategyResponseDto {
    return {
      id: strategy.id,
      userId: strategy.userId,
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      isActive: strategy.isActive,
      parameters: strategy.parameters,
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt,
    };
  }
}
