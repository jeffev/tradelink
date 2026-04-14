import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/trades', label: 'Trades', icon: '💹' },
  { to: '/strategies', label: 'Estratégias', icon: '🎯' },
  { to: '/backtests', label: 'Backtests', icon: '🔬' },
  { to: '/dca', label: 'DCA & Aportes', icon: '💰' },
  { to: '/market-data', label: 'Market Data', icon: '📈' },
  { to: '/indicators', label: 'Indicadores', icon: '📉' },
  { to: '/filters', label: 'Filtros', icon: '🔍' },
  { to: '/alerts', label: 'Alertas', icon: '🔔' },
  { to: '/help/indicators', label: 'Guia de Indicadores', icon: '📖' },
  { to: '/profile', label: 'Perfil', icon: '👤' },
  { to: '/settings', label: 'Configurações', icon: '⚙️' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Tradelink</h1>
        <p className="text-xs text-gray-400 mt-1">Trading Platform</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
            {user?.firstName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors px-1 py-1"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
