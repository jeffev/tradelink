import api from './api';

export interface IndicatorConfig {
  name: string;
  params: Record<string, any>;
}

export interface CalculateIndicatorsPayload {
  symbol: string;
  indicators: IndicatorConfig[];
  startDate: string;
  endDate: string;
  timeframe?: string;
}

export interface IndicatorPoint {
  date?: string;
  value?: number;
  signal?: number;
  histogram?: number;
  upper?: number;
  lower?: number;
  // Pivot Points
  r2?: number;
  r1?: number;
  pivot?: number;
  s1?: number;
  s2?: number;
  // Ichimoku
  tenkan?: number;
  kijun?: number;
  senkou_a?: number;
  senkou_b?: number;
  chikou?: number;
  // Volume Profile — meta record (type === 'meta')
  type?: 'meta' | 'bin';
  poc?: number;
  vah?: number;
  val?: number;
  // Volume Profile — bin record (type === 'bin')
  price?: number;
  volume_pct?: number;
  is_hvn?: boolean;
  is_lvn?: boolean;
}

export interface CalculateIndicatorsResult {
  symbol: string;
  priceData: Array<{ date: string; open: number; high: number; low: number; close: number }>;
  indicators: Record<string, IndicatorPoint[]>;
}

export interface SavedIndicator {
  id: string;
  symbol: string;
  name: string;
  params: Record<string, any>;
  createdAt: string;
}

export const indicatorsService = {
  calculate: (payload: CalculateIndicatorsPayload) =>
    api.post<CalculateIndicatorsResult>('/indicators/calculate', payload).then((r) => r.data),

  list: () =>
    api.get<SavedIndicator[]>('/indicators').then((r) => r.data),

  save: (payload: Omit<SavedIndicator, 'id' | 'createdAt'>) =>
    api.post<SavedIndicator>('/indicators', payload).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/indicators/${id}`),
};
