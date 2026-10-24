import { create } from 'zustand';
import type { User } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  enterDemo: () => Promise<void>;
  logout: () => void;
  init: () => void;
}

// Read synchronously: if this waited for an effect, ProtectedRoute would
// redirect to /login on every page reload before the session was restored.
function readSession(): User | null {
  const token = localStorage.getItem('access_token');
  const userRaw = localStorage.getItem('user');
  if (!token || !userRaw) return null;
  try {
    return JSON.parse(userRaw) as User;
  } catch {
    return null;
  }
}

const initialUser = readSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: initialUser !== null,
  isLoading: false,

  init: () => {
    const token = localStorage.getItem('access_token');
    const userRaw = localStorage.getItem('user');
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        set({ user, isAuthenticated: true });
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(email, password);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      set({ user: response.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, firstName, lastName) => {
    set({ isLoading: true });
    try {
      const response = await authService.register(email, password, firstName, lastName);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      set({ user: response.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  enterDemo: async () => {
    set({ isLoading: true });
    try {
      const response = await authService.demo();
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      set({ user: response.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
}));
