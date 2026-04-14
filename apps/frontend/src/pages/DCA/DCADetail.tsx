import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { dcaService } from '@/services/dca.service';
import type { DCAJob, DCAStrategyResult } from '@/types';

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', quarterly: 'Trimestral',
};

// Colors per strategy type
const STRATEGY_COLORS: Record<string, string> = {
  fixed:       '#3b82f6',  // blue
  lump_sum:    '#f59e0b',  // amber
  conditional: '#a78bfa',  // purple
};

const STRATEGY_AREA_COLORS: Record<string, string> = {
  fixed:       '#3b82f620',
  lump_sum:    '#f59e0b20',
  conditional: '#a78bfa20',
};

// Merge all equity curves into a single date-indexed array for Recharts
function mergeEquityCurves(strategies: DCAStrategyResult[]) {
  const dateMap = new Map<string, Record<string, number>>();

  for (const s of strategies) {
    const key = s.strategyType;
    for (const pt of s.equityCurve) {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date as unknown as number });
      const row = dateMap.get(pt.date)!;
      row[`value_${key}`] = pt.value;
      row[`invested_${key}`] = pt.invested;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    String(a.date) < String(b.date) ? -1 : 1,
  );
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ?? 'text-gray-100'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function StrategyCard({ s }: { s: DCAStrategyResult }) {
  const color = STRATEGY_COLORS[s.strategyType];
  const returnColor = s.totalReturn >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <h3 className="text-sm font-semibold text-gray-100">{s.name}</h3>
          </div>
          {s.nSkipped !== undefined && s.nSkipped > 0 && (
            <p className="text-[10px] text-gray-600 ml-4">{s.nSkipped} período(s) ignorado(s) por condição</p>
          )}
        </div>
        <span className={`text-xl font-bold ${returnColor}`}>{pct(s.totalReturnPct)}</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total aportado"  value={`$${fmt(s.totalInvested)}`} />
        <MetricCard label="Valor final"     value={`$${fmt(s.finalValue)}`} />
        <MetricCard
          label="Retorno"
          value={`$${fmt(Math.abs(s.totalReturn))}`}
          color={returnColor}
          sub={s.totalReturn >= 0 ? 'lucro' : 'prejuízo'}
        />
        <MetricCard label="Custo médio"  value={`$${s.avgCostBasis.toFixed(4)}`} sub={`${s.nPurchases} compra(s)`} />
      </div>

      {/* Purchase table (collapsed by default for lump sum) */}
      {s.purchases.length > 0 && s.strategyType !== 'lump_sum' && (
        <PurchaseTable purchases={s.purchases} />
      )}
    </div>
  );
}

function PurchaseTable({ purchases }: { purchases: DCAStrategyResult['purchases'] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? purchases : purchases.slice(0, 5);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-gray-500 hover:text-gray-300 mb-2 transition-colors"
      >
        {expanded ? '▲ Ocultar compras' : `▼ Ver compras (${purchases.length})`}
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-1 pr-3">Data</th>
                <th className="pb-1 pr-3">Preço</th>
                <th className="pb-1 pr-3">Aporte</th>
                <th className="pb-1">Cotas</th>
                {purchases.some((p) => 'bought' in p) && <th className="pb-1 pl-2">Status</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={i} className={`border-b border-gray-800/50 ${p.bought === false ? 'opacity-40' : ''}`}>
                  <td className="py-1 pr-3 text-gray-400 font-mono">{p.date}</td>
                  <td className="py-1 pr-3 text-gray-300">${p.price.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-gray-300">${p.amount.toFixed(2)}</td>
                  <td className="py-1 text-gray-400">{p.shares.toFixed(4)}</td>
                  {p.bought !== undefined && (
                    <td className="py-1 pl-2">
                      {p.bought
                        ? <span className="text-green-500">✓</span>
                        : <span className="text-gray-600">–</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!expanded && purchases.length > 5 && (
            <p className="text-xs text-gray-600 mt-1">+{purchases.length - 5} mais…</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DCADetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<DCAJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    dcaService.get(id)
      .then(setJob)
      .catch(() => toast.error('Falha ao carregar simulação'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>;
  if (!job) return <div className="text-gray-400 text-sm">Não encontrado</div>;

  const strategies = job.results?.strategies ?? [];
  const chartData = strategies.length ? mergeEquityCurves(strategies) : [];

  const hasConditional = strategies.some((s) => s.strategyType === 'conditional');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/dca')} className="text-gray-400 hover:text-gray-100 text-sm">
          ← Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            {job.symbol} — DCA {PERIOD_LABELS[job.period] ?? job.period}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {job.startDate} → {job.endDate}
            {' · '}${Number(job.amountPerPeriod).toLocaleString()}/período
            {job.conditions?.length ? ` · ${job.conditions.length} condição(ões)` : ''}
          </p>
        </div>
      </div>

      {job.status === 'failed' && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {job.errorMessage ?? 'Simulação falhou'}
        </div>
      )}

      {(job.status === 'running' || job.status === 'pending') && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-blue-400 animate-pulse">Simulação em andamento...</p>
        </div>
      )}

      {job.status === 'completed' && strategies.length > 0 && (
        <>
          {/* ── Comparison chart ────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-1">Comparativo de Crescimento</h2>
            <p className="text-xs text-gray-600 mb-4">Valor da carteira ao longo do tempo vs total aportado</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    width={62}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(val, name) => {
                      const k = String(name);
                      const type = k.replace('value_', '').replace('invested_', '');
                      const isInvested = k.startsWith('invested_');
                      const label = isInvested
                        ? `Aportado (${type})`
                        : `Valor (${strategies.find((s) => s.strategyType === type)?.name ?? type})`;
                      return [`$${fmt(Number(val))}`, label];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const type = value.replace('value_', '');
                      const s = strategies.find((s) => s.strategyType === type);
                      return <span style={{ color: '#9ca3af', fontSize: 11 }}>{s?.name ?? value}</span>;
                    }}
                  />

                  {/* Invested lines (dashed) */}
                  {strategies.map((s) => (
                    <Line
                      key={`invested_${s.strategyType}`}
                      type="stepAfter"
                      dataKey={`invested_${s.strategyType}`}
                      stroke={STRATEGY_COLORS[s.strategyType]}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      dot={false}
                      legendType="none"
                      connectNulls
                    />
                  ))}

                  {/* Value areas */}
                  {strategies.map((s) => (
                    <Area
                      key={`value_${s.strategyType}`}
                      type="monotone"
                      dataKey={`value_${s.strategyType}`}
                      stroke={STRATEGY_COLORS[s.strategyType]}
                      strokeWidth={2}
                      fill={STRATEGY_AREA_COLORS[s.strategyType]}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 justify-center">
              {strategies.map((s) => (
                <span key={s.strategyType} className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: STRATEGY_COLORS[s.strategyType] }} />
                  {s.name}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-0.5 inline-block border-t border-dashed border-gray-600" />
                Total aportado
              </span>
            </div>
          </div>

          {/* ── Strategy cards ───────────────────────────────────────────────── */}
          <div className="space-y-4">
            {strategies.map((s) => (
              <StrategyCard key={s.strategyType} s={s} />
            ))}
          </div>

          {/* ── Conditional conditions summary ───────────────────────────────── */}
          {hasConditional && job.conditions?.length && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Condições do DCA condicional</p>
              <div className="flex flex-wrap gap-2">
                {job.conditions.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs font-mono text-gray-200">
                    <span className="text-gray-400">{c.indicator}</span>
                    <span className="text-yellow-400">{c.operator}</span>
                    <span>{c.value}</span>
                  </span>
                ))}
                {job.conditions.length > 1 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-700">
                    {job.conditionLogic}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
