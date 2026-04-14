import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import AppLayout from '@/components/Layout/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import TradeList from '@/pages/Trades/TradeList';
import StrategyList from '@/pages/Strategies/StrategyList';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import BacktestList from '@/pages/Backtests/BacktestList';
import BacktestDetail from '@/pages/Backtests/BacktestDetail';
import BacktestCompare from '@/pages/Backtests/BacktestCompare';
import DataImport from '@/pages/MarketData/DataImport';
import IndicatorChart from '@/pages/Indicators/IndicatorChart';
import IndicatorHelp from '@/pages/Help/IndicatorHelp';
import FilterList from '@/pages/Filters/FilterList';
import FilterBuilder from '@/pages/Filters/FilterBuilder';
import FilterResults from '@/pages/Filters/FilterResults';
import AlertList from '@/pages/Alerts/AlertList';
import DCAList from '@/pages/DCA/DCAList';
import DCADetail from '@/pages/DCA/DCADetail';
import Landing from '@/pages/Landing';

export default function App() {
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes — pathless layout wrapper */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="trades" element={<TradeList />} />
          <Route path="strategies" element={<StrategyList />} />
          <Route path="backtests" element={<BacktestList />} />
          <Route path="backtests/compare" element={<BacktestCompare />} />
          <Route path="backtests/:id" element={<BacktestDetail />} />
          <Route path="market-data" element={<DataImport />} />
          <Route path="indicators" element={<IndicatorChart />} />
          <Route path="help/indicators" element={<IndicatorHelp />} />
          <Route path="filters" element={<FilterList />} />
          <Route path="filters/new" element={<FilterBuilder />} />
          <Route path="filters/:id/edit" element={<FilterBuilder />} />
          <Route path="filters/:id/results" element={<FilterResults />} />
          <Route path="alerts" element={<AlertList />} />
          <Route path="dca" element={<DCAList />} />
          <Route path="dca/:id" element={<DCADetail />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
