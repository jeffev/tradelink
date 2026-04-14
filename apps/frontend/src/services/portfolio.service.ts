import api from './api';
import type { PortfolioStats, DashboardInsights, Trade } from '@/types';

export const portfolioService = {
  async getStats(): Promise<PortfolioStats> {
    const { data } = await api.get<PortfolioStats>('/portfolio/stats');
    return data;
  },

  async getInsights(): Promise<DashboardInsights> {
    const { data } = await api.get<DashboardInsights>('/portfolio/insights');
    return data;
  },

  async getOpenPositions(): Promise<Trade[]> {
    const { data } = await api.get<Trade[]>('/portfolio/positions');
    return data;
  },
};
