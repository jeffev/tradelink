import api from './api';
import type { BacktestJob, BacktestStrategyType } from '@/types';

export interface IndicatorConfig {
  name: string;
  params: Record<string, any>;
}

export interface CreateBacktestPayload {
  symbols: string[];
  strategyType: BacktestStrategyType;
  strategyParams?: Record<string, unknown>;
  startDate: string;
  endDate: string;
  initialCapital?: number;
  brokerageRate?: number;
  timeframe?: string;
  strategyId?: string;
  indicators?: IndicatorConfig[];
}

export const backtestingService = {
  create: (payload: CreateBacktestPayload) =>
    api.post<BacktestJob[]>('/backtesting', payload).then((r) => r.data),

  list: () =>
    api.get<BacktestJob[]>('/backtesting').then((r) => r.data),

  get: (id: string) =>
    api.get<BacktestJob>(`/backtesting/${id}`).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/backtesting/${id}`),

  compare: (ids: string[]) =>
    api.get<BacktestJob[]>('/backtesting/compare', { params: { ids } }).then((r) => r.data),

  // Poll until job is completed or failed (max 120s)
  poll: async (id: string, intervalMs = 2000, maxAttempts = 60): Promise<BacktestJob> => {
    for (let i = 0; i < maxAttempts; i++) {
      const job = await backtestingService.get(id);
      if (job.status === 'completed' || job.status === 'failed') return job;
      await new Promise((res) => setTimeout(res, intervalMs));
    }
    throw new Error('Backtest timed out');
  },
};
