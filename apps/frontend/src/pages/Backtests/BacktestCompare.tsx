import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { backtestingService } from '@/services/backtesting.service';
import type { BacktestJob } from '@/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const STRATEGY_LABELS: Record<string, string> = {
  sma_crossover: 'SMA Crossover',
  rsi: 'RSI',
  buy_and_hold: 'Buy & Hold',
};

interface MetricRow {
  label: string;
  key: keyof import('@/types').BacktestMetrics;
  fmt: (v: number) => string;
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Total Return %', key: 'totalReturnPct', fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
  { label: 'Ann. Return %', key: 'annualizedReturnPct', fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
  { label: 'Sharpe Ratio', key: 'sharpeRatio', fmt: (v) => v.toFixed(3) },
  { label: 'Sortino Ratio', key: 'sortinoRatio', fmt: (v) => v.toFixed(3) },
  { label: 'Max Drawdown %', key: 'maxDrawdownPct', fmt: (v) => `${v.toFixed(2)}%` },
  { label: 'Win Rate', key: 'winRate', fmt: (v) => `${v.toFixed(1)}%` },
  { label: 'Profit Factor', key: 'profitFactor', fmt: (v) => v.toFixed(3) },
  { label: 'Total Trades', key: 'totalTrades', fmt: (v) => String(v) },
];

export default function BacktestCompare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean);
  const [jobs, setJobs] = useState<BacktestJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ids.length) return;
    backtestingService
      .compare(ids)
      .then(setJobs)
      .catch(() => toast.error('Failed to load comparison'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;

  // Merge equity curves by date (normalise to % from start)
  const allDates = Array.from(
    new Set(jobs.flatMap((j) => j.results?.equityCurve.map((p) => p.date) ?? []))
  ).sort();

  const chartData = allDates.map((date) => {
    const row: Record<string, number | string> = { date };
    jobs.forEach((job, i) => {
      const point = job.results?.equityCurve.find((p) => p.date === date);
      if (point) {
        const pct = ((point.equity - Number(job.initialCapital)) / Number(job.initialCapital)) * 100;
        row[`job_${i}`] = parseFloat(pct.toFixed(2));
      }
    });
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/backtests')} className="text-gray-400 hover:text-gray-100">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-100">Backtest Comparison</h1>
      </div>

      {/* Normalized equity curve */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Equity Curve (% return)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}%`} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#9ca3af', fontSize: 12 }}
                formatter={(val) => { const n = Number(val); return [`${n >= 0 ? '+' : ''}${n.toFixed(2)}%`]; }}
              />
              <Legend />
              {jobs.map((job, i) => (
                <Line
                  key={job.id}
                  type="monotone"
                  dataKey={`job_${i}`}
                  name={`${job.symbol} (${STRATEGY_LABELS[job.strategyType] ?? job.strategyType})`}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metrics table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="px-4 py-3">Metric</th>
              {jobs.map((job, i) => (
                <th key={job.id} className="px-4 py-3" style={{ color: COLORS[i % COLORS.length] }}>
                  {job.symbol} ({STRATEGY_LABELS[job.strategyType] ?? job.strategyType})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-gray-800">
                <td className="px-4 py-2 text-gray-400">{row.label}</td>
                {jobs.map((job) => {
                  const val = job.results?.metrics[row.key];
                  return (
                    <td key={job.id} className="px-4 py-2 text-gray-100">
                      {val != null ? row.fmt(val as number) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
