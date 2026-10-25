import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus } from './trade.entity';
import { CreateTradeDto, CloseTradeDto, UpdateTradeDto, TradeResponseDto } from './dtos/trade.dto';
import { UserRole } from '../users/user.entity';
import { Strategy } from '../strategies/strategy.entity';

@Injectable()
export class TradesService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
  ) {}

  async create(userId: string, dto: CreateTradeDto): Promise<TradeResponseDto> {
    await this.assertOwnStrategy(dto.strategyId, userId);
    const trade = this.tradeRepository.create({
      userId,
      ticker:         dto.ticker.toUpperCase(),
      side:           dto.side,
      entryPrice:     dto.entryPrice,
      quantity:       dto.quantity,
      strategyId:     dto.strategyId     ?? null,
      entryAt:        dto.entryAt        ? new Date(dto.entryAt) : new Date(),
      notes:          dto.notes          ?? null,
      exitPrice:      null,
      exitAt:         null,
      status:         TradeStatus.OPEN,
      // Gestão
      stopLoss:       dto.stopLoss       ?? null,
      takeProfit:     dto.takeProfit     ?? null,
      // Contexto
      timeframe:      dto.timeframe      ?? null,
      setup:          dto.setup          ?? null,
      trend:          dto.trend          ?? null,
      assetClass:     dto.assetClass     ?? null,
      // Psicologia
      confidenceLevel:  dto.confidenceLevel  ?? null,
      emotionAtEntry:   dto.emotionAtEntry   ?? null,
      enteredOnTime:    dto.enteredOnTime    ?? null,
      // Sizing
      capitalPct:     dto.capitalPct     ?? null,
      commission:     dto.commission     ?? null,
    });
    const saved = await this.tradeRepository.save(trade);
    return this.toResponseDto(saved);
  }

  async findAll(userId: string, role: UserRole): Promise<TradeResponseDto[]> {
    const where = role === UserRole.ADMIN ? {} : { userId };
    const trades = await this.tradeRepository.find({ where, order: { entryAt: 'DESC' } });
    return trades.map(t => this.toResponseDto(t));
  }

  async findOne(id: string, userId: string, role: UserRole): Promise<TradeResponseDto> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (role !== UserRole.ADMIN && trade.userId !== userId) throw new ForbiddenException('Access denied');
    return this.toResponseDto(trade);
  }

  async close(id: string, userId: string, role: UserRole, dto: CloseTradeDto): Promise<TradeResponseDto> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (role !== UserRole.ADMIN && trade.userId !== userId) throw new ForbiddenException('Access denied');
    if (trade.status === TradeStatus.CLOSED) throw new BadRequestException('Trade is already closed');
    await this.assertOwnStrategy(dto.strategyId, trade.userId);

    trade.exitPrice      = dto.exitPrice;
    trade.exitAt         = dto.exitAt ? new Date(dto.exitAt) : new Date();
    trade.status         = TradeStatus.CLOSED;
    if (dto.strategyId      !== undefined) trade.strategyId      = dto.strategyId;
    if (dto.notes           !== undefined) trade.notes           = dto.notes;
    if (dto.followedStrategy!== undefined) trade.followedStrategy= dto.followedStrategy;
    if (dto.closeNotes      !== undefined) trade.closeNotes      = dto.closeNotes;
    if (dto.exitReason      !== undefined) trade.exitReason      = dto.exitReason;
    if (dto.entryQuality    !== undefined) trade.entryQuality    = dto.entryQuality;
    if (dto.movedStop       !== undefined) trade.movedStop       = dto.movedStop;
    if (dto.enteredOnTime   !== undefined) trade.enteredOnTime   = dto.enteredOnTime;
    if (dto.slippage        !== undefined) trade.slippage        = dto.slippage;

    const updated = await this.tradeRepository.save(trade);
    return this.toResponseDto(updated);
  }

  async update(id: string, userId: string, role: UserRole, dto: UpdateTradeDto): Promise<TradeResponseDto> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (role !== UserRole.ADMIN && trade.userId !== userId) throw new ForbiddenException('Access denied');
    await this.assertOwnStrategy(dto.strategyId, trade.userId);

    if (dto.ticker          !== undefined) trade.ticker          = dto.ticker.toUpperCase();
    if (dto.side            !== undefined) trade.side            = dto.side;
    if (dto.entryPrice      !== undefined) trade.entryPrice      = dto.entryPrice;
    if (dto.exitPrice       !== undefined) trade.exitPrice       = dto.exitPrice;
    if (dto.quantity        !== undefined) trade.quantity        = dto.quantity;
    if (dto.status          !== undefined) trade.status          = dto.status;
    if (dto.strategyId      !== undefined) trade.strategyId      = dto.strategyId;
    if (dto.entryAt         !== undefined) trade.entryAt         = new Date(dto.entryAt);
    if (dto.exitAt          !== undefined) trade.exitAt          = new Date(dto.exitAt);
    if (dto.notes           !== undefined) trade.notes           = dto.notes;
    if (dto.followedStrategy!== undefined) trade.followedStrategy= dto.followedStrategy;
    if (dto.closeNotes      !== undefined) trade.closeNotes      = dto.closeNotes;
    if (dto.stopLoss        !== undefined) trade.stopLoss        = dto.stopLoss;
    if (dto.takeProfit      !== undefined) trade.takeProfit      = dto.takeProfit;
    if (dto.exitReason      !== undefined) trade.exitReason      = dto.exitReason;
    if (dto.timeframe       !== undefined) trade.timeframe       = dto.timeframe;
    if (dto.setup           !== undefined) trade.setup           = dto.setup;
    if (dto.trend           !== undefined) trade.trend           = dto.trend;
    if (dto.assetClass      !== undefined) trade.assetClass      = dto.assetClass;
    if (dto.confidenceLevel !== undefined) trade.confidenceLevel = dto.confidenceLevel;
    if (dto.entryQuality    !== undefined) trade.entryQuality    = dto.entryQuality;
    if (dto.emotionAtEntry  !== undefined) trade.emotionAtEntry  = dto.emotionAtEntry;
    if (dto.movedStop       !== undefined) trade.movedStop       = dto.movedStop;
    if (dto.enteredOnTime   !== undefined) trade.enteredOnTime   = dto.enteredOnTime;
    if (dto.capitalPct      !== undefined) trade.capitalPct      = dto.capitalPct;
    if (dto.commission      !== undefined) trade.commission      = dto.commission;
    if (dto.slippage        !== undefined) trade.slippage        = dto.slippage;

    const updated = await this.tradeRepository.save(trade);
    return this.toResponseDto(updated);
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (role !== UserRole.ADMIN && trade.userId !== userId) throw new ForbiddenException('Access denied');
    await this.tradeRepository.remove(trade);
  }

  /** A trade may only point at a strategy of the trade's owner. */
  private async assertOwnStrategy(strategyId: string | null | undefined, userId: string): Promise<void> {
    if (!strategyId) return;
    const owned = await this.tradeRepository.manager.existsBy(Strategy, { id: strategyId, userId });
    if (!owned) throw new BadRequestException('Strategy not found');
  }

  private toResponseDto(trade: Trade): TradeResponseDto {
    return {
      id:               trade.id,
      userId:           trade.userId,
      strategyId:       trade.strategyId,
      ticker:           trade.ticker,
      side:             trade.side,
      status:           trade.status,
      entryPrice:       Number(trade.entryPrice),
      exitPrice:        trade.exitPrice   !== null ? Number(trade.exitPrice)   : null,
      quantity:         Number(trade.quantity),
      entryAt:          trade.entryAt,
      exitAt:           trade.exitAt,
      notes:            trade.notes,
      followedStrategy: trade.followedStrategy,
      closeNotes:       trade.closeNotes,
      profitLoss:       trade.profitLoss,
      profitLossPct:    trade.profitLossPct,
      riskAmount:       trade.riskAmount,
      plannedRR:        trade.plannedRR,
      realizedRR:       trade.realizedRR,
      stopLoss:         trade.stopLoss    !== null ? Number(trade.stopLoss)    : null,
      takeProfit:       trade.takeProfit  !== null ? Number(trade.takeProfit)  : null,
      exitReason:       trade.exitReason,
      timeframe:        trade.timeframe,
      setup:            trade.setup,
      trend:            trade.trend,
      assetClass:       trade.assetClass,
      confidenceLevel:  trade.confidenceLevel,
      entryQuality:     trade.entryQuality,
      emotionAtEntry:   trade.emotionAtEntry,
      movedStop:        trade.movedStop,
      enteredOnTime:    trade.enteredOnTime,
      capitalPct:       trade.capitalPct  !== null ? Number(trade.capitalPct)  : null,
      commission:       trade.commission  !== null ? Number(trade.commission)  : null,
      slippage:         trade.slippage    !== null ? Number(trade.slippage)    : null,
      createdAt:        trade.createdAt,
      updatedAt:        trade.updatedAt,
    };
  }
}
