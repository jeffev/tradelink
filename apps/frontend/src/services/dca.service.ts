import api from './api';
import type { DCAJob } from '@/types';

export interface DCACondition {
  indicator: string;
  operator: string;
  value: number;
}

export interface CreateDCAPayload {
  symbol: string;
  startDate: string;
  endDate: string;
  amountPerPeriod: number;
  period: string;
  dayOfMonth?: number;
  conditions?: DCACondition[];
  conditionLogic?: string;
  indicators?: Array<{ name: string; params: Record<string, unknown> }>;
}

export const dcaService = {
  create: (payload: CreateDCAPayload) =>
    api.post<DCAJob>('/dca', payload).then((r) => r.data),

  list: () =>
    api.get<DCAJob[]>('/dca').then((r) => r.data),

  get: (id: string) =>
    api.get<DCAJob>(`/dca/${id}`).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/dca/${id}`),
};
