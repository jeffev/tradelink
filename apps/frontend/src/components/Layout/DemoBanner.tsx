import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { isDemoUser } from '@/utils/demo';

export default function DemoBanner() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  if (!isDemoUser(user?.email)) return null;

  return (
    <div className="bg-emerald-950/60 border-b border-emerald-800/50 px-6 py-2 text-xs text-emerald-200 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        Conta de visitante: trades, backtests e alertas são dados de exemplo, com cotações reais.
        Mexa à vontade — a conta é apagada em 24 horas.
      </span>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/register');
        }}
        className="underline underline-offset-2 hover:text-white"
      >
        Criar conta própria
      </button>
    </div>
  );
}
