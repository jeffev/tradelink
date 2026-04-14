import api from './api';
import type { User } from '@/types';

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export const usersService = {
  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/users/me');
    return data;
  },

  async updateMe(payload: UpdateProfilePayload): Promise<User> {
    const { data } = await api.patch<User>('/users/me', payload);
    return data;
  },
};
