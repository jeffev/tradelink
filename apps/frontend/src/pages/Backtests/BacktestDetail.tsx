import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { backtestingService } from '@/services/backtesting.service';
import type { BacktestJob } from '@/types';
import EquityCurve from '@/components/Charts/EquityCurve';
import DrawdownChart from '@/components/Charts/DrawdownChart';
import StatsTable from '@/components/Charts/StatsTable';
import PriceChart from '@/components/Charts/PriceChart';
import RSIChart from '@/components/Charts/RSIChart';

const STRATEGY_LABELS: Record<string, string> = {
  sma_crossover: 'SMA Crossover',
  rsi: 'RSI',
  buy_and_hold: 'Buy & Hold',
  multi_indicator: 'Multi-Indicador',
};

interface Condition { indicator: string; operator: string; value: number; }

function MultiIndicatorParams({ params }: { params: Record<string, unknown> }) {
  const entry = (params.entry_conditions ?? []) as Condition[];
  const exit  = (params.exit_conditions  ?? []) as Condition[];
  const entryLogic = (params.entry_logic ?? 'AND') as string;
  const exitLogic  = (params.exit_logic  ?? 'AND') as string;

  const badge = (logic: string) => (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-700">{logic}</span>
  );
  const condRow = (c: Condition) => (
    <span key={`${c.indicator}${c.operator}${c.value}`}
      className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs font-mono text-gray-200">
      <span className="text-gray-400">{c.indicator}</span>
      <span className="text-yellow-400">{c.operator}</span>
      <span>{c.value}</span>
    </span>
  );

  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-green-500 font-medium">Entrada:</span>
        {entry.map(condRow)}
        {entry.length > 1 && badge(entryLogic)}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-red-500 font-medium">Saída:</span>
        {exit.map(condRow)}
        {exit.length > 1 && badge(exitLogic)}
      </div>
    </div>
  );
}

export default function BacktestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<BacktestJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    backtestingService
      .get(id)
      .then(setJob)
      .catch(() => toast.error('Failed to load backtest'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  if (!job) return <div className="text-gray-400 text-sm">Not found</div>;

  const metrics = job.results?.metrics;
  const equityCurve = job.results?.equityCurve ?? [];
  const trades = job.results?.trades ?? [];
  const priceData = job.results?.priceData ?? [];
  const indicators = job.results?.indicators ?? {};

  const rsiData = indicators['rsi'] ?? [];
  const oversoldLevel = job.strategyParams?.oversold as number | undefined;
  const overboughtLevel = job.strategyParams?.overbought as number | undefined;

  const isMulti = job.strategyType === 'multi_indicator';

  // For simple strategies, show params as inline text; hide for multi (rendered separately)
  const HIDDEN_PARAM_KEYS = new Set(['entry_conditions', 'exit_conditions', 'entry_logic', 'exit_logic']);
  const paramsLabel = !isMulti && job.strategyParams && Object.keys(job.strategyParams).length > 0
    ? Object.entries(job.strategyParams)
        .filter(([k]) => !HIDDEN_PARAM_KEYS.has(k))
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
        .join(' · ')
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/backtests')} className="text-gray-400 hover:text-gray-100 text-sm">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            {job.symbol} — {STRATEGY_LABELS[job.strategyType] ?? job.strategyType}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-mono text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 mr-2">
              {job.timeframe ?? '1d'}
            </span>
            {job.startDate} → {job.endDate}
            {' · '}${Number(job.initialCapital).toLocaleString()} capital
            {paramsLabel && <span className="ml-2 text-gray-500">({paramsLabel})</span>}
          </p>
        </div>
      </div>

      {/* Multi-indicator conditions panel */}
      {isMulti && job.strategyParams && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase font-medium mb-2">Condições da estratégia</p>
          <MultiIndicatorParams params={job.strategyParams as Record<string, unknown>} />
        </div>
      )}

      {job.status === 'failed' && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {job.errorMessage ?? 'Backtest failed'}
        </div>
      )}

      {(job.status === 'running' || job.status === 'pending') ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-blue-400 animate-pulse">Backtest in progress...</p>
        </div>
      ) : metrics ? (
        <>
          {/* Price chart with trade markers + indicator overlay */}
          {priceData.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">
                Price Chart
                {Object.keys(indicators).filter(k => !['rsi','oversold','overbought'].includes(k)).length > 0 && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    + {Object.keys(indicators).filter(k => !['rsi','oversold','overbought'].includes(k)).map(k =>
                      k === 'fast_sma' ? 'Fast SMA' : k === 'slow_sma' ? 'Slow SMA' : k
                    ).join(' & ')}
                  </span>
                )}
              </h2>
              <PriceChart
                priceData={priceData}
                indicators={indicators}
                trades={trades}
                strategyType={job.strategyType}
              />
            </div>
          )}

          {/* RSI chart — only for RSI strategy */}
          {job.strategyType === 'rsi' && rsiData.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">RSI Indicator</h2>
              <RSIChart
                rsiData={rsiData}
                oversold={oversoldLevel ?? 30}
                overbought={overboughtLevel ?? 70}
              />
            </div>
          )}

          {/* Performance metrics */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Performance Metrics</h2>
            <StatsTable metrics={metrics} />
          </div>

          {/* Equity curve */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Equity Curve</h2>
            <EquityCurve data={equityCurve} initialCapital={Number(job.initialCapital)} />
          </div>

          {/* Drawdown */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Drawdown</h2>
            <DrawdownChart data={equityCurve} />
          </div>

          {/* Trades table */}
          {trades.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-300">
                  Trades ({trades.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-gray-400">
                      <th className="px-4 py-3">Entry</th>
                      <th className="px-4 py-3">Exit</th>
                      <th className="px-4 py-3">Side</th>
                      <th className="px-4 py-3">Entry Price</th>
                      <th className="px-4 py-3">Exit Price</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">P&L</th>
                      <th className="px-4 py-3">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40">
                        <td className="px-4 py-2 text-gray-300 text-xs">{t.entryDate}</td>
                        <td className="px-4 py-2 text-gray-300 text-xs">{t.exitDate}</td>
                        <td className="px-4 py-2">
                          <span className={t.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                            {t.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-300">${t.entryPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-gray-300">${t.exitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-gray-400">{t.quantity.toFixed(4)}</td>
                        <td className={`px-4 py-2 font-medium ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </td>
                        <td className={`px-4 py-2 ${t.pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
