import api from './api';

export interface FilterCondition {
  id: string;
  indicator: string;
  params: Record<string, any>;
  operator: string;
  value: number | null;
}

export interface Filter {
  id: string;
  name: string;
  description?: string;
  conditions: FilterCondition[];
  logic: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterResult {
  id: string;
  filterId: string;
  symbol: string;
  passed: boolean;
  indicatorValues: Record<string, any>;
  scannedAt: string;
}

export interface CreateFilterPayload {
  name: string;
  description?: string;
  conditions: FilterCondition[];
  logic?: string;
}

export interface RunScanPayload {
  symbols: string[];
  startDate?: string;
  endDate?: string;
}

export const filtersService = {
  list: () =>
    api.get<Filter[]>('/filters').then((r) => r.data),

  get: (id: string) =>
    api.get<Filter>(`/filters/${id}`).then((r) => r.data),

  create: (payload: CreateFilterPayload) =>
    api.post<Filter>('/filters', payload).then((r) => r.data),

  update: (id: string, payload: Partial<CreateFilterPayload> & { isActive?: boolean }) =>
    api.patch<Filter>(`/filters/${id}`, payload).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/filters/${id}`),

  runScan: (id: string, payload: RunScanPayload) =>
    api.post<FilterResult[]>(`/filters/${id}/scan`, payload).then((r) => r.data),

  getResults: (id: string) =>
    api.get<FilterResult[]>(`/filters/${id}/results`).then((r) => r.data),
};
