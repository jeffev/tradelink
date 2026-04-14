import api from './api';
import type { Strategy, StrategyType } from '@/types';

export interface CreateStrategyPayload {
  name: string;
  description?: string;
  type?: StrategyType;
  parameters?: Record<string, unknown>;
}

export interface UpdateStrategyPayload {
  name?: string;
  description?: string;
  type?: StrategyType;
  isActive?: boolean;
  parameters?: Record<string, unknown>;
}

export const strategiesService = {
  async getAll(): Promise<Strategy[]> {
    const { data } = await api.get<Strategy[]>('/strategies');
    return data;
  },

  async getOne(id: string): Promise<Strategy> {
    const { data } = await api.get<Strategy>(`/strategies/${id}`);
    return data;
  },

  async create(payload: CreateStrategyPayload): Promise<Strategy> {
    const { data } = await api.post<Strategy>('/strategies', payload);
    return data;
  },

  async update(id: string, payload: UpdateStrategyPayload): Promise<Strategy> {
    const { data } = await api.patch<Strategy>(`/strategies/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/strategies/${id}`);
  },
};
