import axios, { type AxiosError } from 'axios';
import type { ApiError } from '@/types';

// In production (Vercel), VITE_API_URL points to the Render backend.
// In development, falls back to '/api' which Vite proxies to localhost:3001.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

// The free Render backend sleeps when idle and takes ~30s to wake up.
// Pinging it as soon as the app loads overlaps that delay with the time
// the visitor spends reading the landing page or typing their login.
export function wakeUpBackend(): void {
  api.get('/health').catch(() => undefined);
}
