import api from './api';
import type { AuthResponse } from '@/types';

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },

  /** Throwaway visitor account filled with sample data. */
  async demo(): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/demo');
    return data;
  },

  async demoEnabled(): Promise<boolean> {
    const { data } = await api.get<{ enabled: boolean }>('/auth/demo');
    return data.enabled;
  },

  async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', { email, password, firstName, lastName });
    return data;
  },
};
