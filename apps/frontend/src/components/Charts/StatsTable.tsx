import type { BacktestMetrics } from '@/types';

interface Props {
  metrics: BacktestMetrics;
}


function Row({ label, value, colorize = false }: { label: string; value: string; colorize?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-800 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={colorize ? (value.startsWith('-') ? 'text-red-400' : 'text-green-400') : 'text-gray-100'}>
        {value}
      </span>
    </div>
  );
}

export default function StatsTable({ metrics }: Props) {
  const fmt = (n: number, digits = 2) => n.toFixed(digits);
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}%`;
  const cur = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
      {/* Returns */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Returns</p>
        <Row label="Total Return" value={cur(metrics.totalReturn)} colorize />
        <Row label="Total Return %" value={pct(metrics.totalReturnPct)} colorize />
        <Row label="Annualized Return" value={pct(metrics.annualizedReturnPct)} colorize />
        <Row label="Max Drawdown" value={`${fmt(metrics.maxDrawdownPct)}%`} />
      </div>

      {/* Risk */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Risk Metrics</p>
        <Row label="Sharpe Ratio" value={fmt(metrics.sharpeRatio, 3)} />
        <Row label="Sortino Ratio" value={fmt(metrics.sortinoRatio, 3)} />
        <Row label="Calmar Ratio" value={fmt(metrics.calmarRatio, 3)} />
        <Row label="Profit Factor" value={fmt(metrics.profitFactor, 3)} />
      </div>

      {/* Trades */}
      <div className="mt-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Trades</p>
        <Row label="Total Trades" value={String(metrics.totalTrades)} />
        <Row label="Win Rate" value={`${fmt(metrics.winRate)}%`} />
        <Row
          label="Winning / Losing"
          value={`${metrics.winningTrades} / ${metrics.losingTrades}`}
        />
        <Row label="Avg R/R" value={fmt(metrics.avgRR, 3)} />
      </div>

      {/* Avg */}
      <div className="mt-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Avg per Trade</p>
        <Row label="Avg Win" value={cur(metrics.avgWin)} />
        <Row label="Avg Loss" value={cur(metrics.avgLoss)} />
      </div>
    </div>
  );
}
