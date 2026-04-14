import api from './api';
import type { Ticker, Candle } from '@/types';

export const marketDataService = {
  listTickers: () =>
    api.get<Ticker[]>('/market-data/tickers').then((r) => r.data),

  fetchFromYahoo: (symbol: string, startDate: string, endDate: string, interval = '1d') =>
    api
      .post<{ count: number }>('/market-data/fetch', { symbol, startDate, endDate, interval })
      .then((r) => r.data),

  importCsv: (symbol: string, file: File, interval = '1d') => {
    const form = new FormData();
    form.append('file', file);
    form.append('symbol', symbol);
    form.append('interval', interval);
    return api
      .post<{ count: number }>('/market-data/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getCandles: (symbol: string, interval = '1d', startDate?: string, endDate?: string) =>
    api
      .get<Candle[]>(`/market-data/tickers/${symbol}/candles`, {
        params: { interval, startDate, endDate },
      })
      .then((r) => r.data),

  deleteTicker: (symbol: string) =>
    api.delete(`/market-data/tickers/${symbol}`),
};
