import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';

/** Opens a visitor account with sample data. Hidden when the server has no demo. */
export default function DemoButton({ className = '' }: { className?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const enterDemo = useAuthStore((s) => s.enterDemo);
  const navigate = useNavigate();

  useEffect(() => {
    authService.demoEnabled().then(setEnabled).catch(() => undefined);
  }, []);

  if (!enabled) return null;

  async function handleClick() {
    setLoading(true);
    try {
      await enterDemo();
      navigate('/dashboard');
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      const msg = error.response?.data?.message ?? 'Não foi possível abrir a demonstração';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`font-semibold rounded-xl transition-colors text-sm border border-emerald-700/60 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-60 disabled:cursor-wait ${className}`}
    >
      {loading ? 'Preparando a conta de demonstração…' : 'Entrar como visitante'}
    </button>
  );
}
