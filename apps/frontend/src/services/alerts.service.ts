import api from './api';

export type AlertType = 'PRICE' | 'RSI' | 'SMA_CROSS' | 'EMA_CROSS' | 'MACD_CROSS' | 'BB_BREAKOUT';
export type AlertCondition = 'ABOVE' | 'BELOW' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';

export interface PriceAlert {
  id: string;
  symbol: string;
  alertType: AlertType;
  condition: AlertCondition;
  value: number;
  params?: Record<string, any>;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface CreateAlertPayload {
  symbol: string;
  alertType: AlertType;
  condition: AlertCondition;
  value: number;
  params?: Record<string, any>;
}

export const alertsService = {
  list: () =>
    api.get<PriceAlert[]>('/alerts').then((r) => r.data),

  get: (id: string) =>
    api.get<PriceAlert>(`/alerts/${id}`).then((r) => r.data),

  create: (payload: CreateAlertPayload) =>
    api.post<PriceAlert>('/alerts', payload).then((r) => r.data),

  update: (id: string, payload: { isActive?: boolean; value?: number }) =>
    api.patch<PriceAlert>(`/alerts/${id}`, payload).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/alerts/${id}`),

  check: () =>
    api.get<{ triggered: PriceAlert[]; checked: number }>('/alerts/check').then((r) => r.data),
};
