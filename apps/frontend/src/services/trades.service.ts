import api from './api';
import type { Trade, TradeSide, ExitReason, TradeTimeframe, TradeTrend, AssetClass, EmotionAtEntry } from '@/types';

export interface CreateTradePayload {
  ticker: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  strategyId?: string;
  entryAt?: string;
  notes?: string;
  // Gestão
  stopLoss?: number;
  takeProfit?: number;
  // Contexto
  timeframe?: TradeTimeframe;
  setup?: string;
  trend?: TradeTrend;
  assetClass?: AssetClass;
  // Psicologia
  confidenceLevel?: number;
  emotionAtEntry?: EmotionAtEntry;
  enteredOnTime?: boolean;
  // Sizing
  capitalPct?: number;
  commission?: number;
}

export interface CloseTradePayload {
  exitPrice: number;
  exitAt?: string;
  notes?: string;
  strategyId?: string;
  followedStrategy?: boolean | null;
  closeNotes?: string;
  // Gestão
  exitReason?: ExitReason;
  // Psicologia
  entryQuality?: number;
  movedStop?: boolean;
  enteredOnTime?: boolean;
  // Custos
  slippage?: number;
}

export const tradesService = {
  async getAll(): Promise<Trade[]> {
    const { data } = await api.get<Trade[]>('/trades');
    return data;
  },

  async getOne(id: string): Promise<Trade> {
    const { data } = await api.get<Trade>(`/trades/${id}`);
    return data;
  },

  async create(payload: CreateTradePayload): Promise<Trade> {
    const { data } = await api.post<Trade>('/trades', payload);
    return data;
  },

  async close(id: string, payload: CloseTradePayload): Promise<Trade> {
    const { data } = await api.post<Trade>(`/trades/${id}/close`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/trades/${id}`);
  },
};
