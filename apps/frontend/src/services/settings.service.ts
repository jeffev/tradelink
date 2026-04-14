import api from './api';

export interface AppSettings {
  userId: string;
  initialCapital: number;
  defaultBrokerage: number;
  currency: string;
  timezone: string;
  updatedAt: string;
}

export interface UpdateSettingsPayload {
  initialCapital?: number;
  defaultBrokerage?: number;
  currency?: string;
  timezone?: string;
}

export const settingsService = {
  async get(): Promise<AppSettings> {
    const { data } = await api.get<AppSettings>('/settings');
    return data;
  },

  async update(payload: UpdateSettingsPayload): Promise<AppSettings> {
    const { data } = await api.patch<AppSettings>('/settings', payload);
    return data;
  },
};
