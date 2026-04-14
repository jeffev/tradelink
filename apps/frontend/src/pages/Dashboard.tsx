import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { portfolioService } from '@/services/portfolio.service';
import { tradesService } from '@/services/trades.service';
import { strategiesService } from '@/services/strategies.service';
import type { PortfolioStats, DashboardInsights, Trade, Strategy } from '@/types';
import StatCard from '@/components/UI/StatCard';
import { formatCurrency, formatPercent, pnlColor, formatDate } from '@/utils/format';
import toast from 'react-hot-toast';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-white text-base">{children}</h3>;
}

function formatHoldingTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)} dias`;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

const PnlTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const pnl = payload[0]?.value ?? 0;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>P&L: {formatCurrency(pnl)}</p>
      {payload[1] && <p className="text-blue-400">Win: {payload[1].value?.toFixed(0)}%</p>}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      portfolioService.getStats(),
      portfolioService.getInsights(),
      tradesService.getAll(),
      strategiesService.getAll(),
    ])
      .then(([statsData, insightsData, tradesData, strategiesData]) => {
        setStats(statsData);
        setInsights(insightsData);
        setRecentTrades(tradesData.slice(0, 5));
        setStrategies(strategiesData);
      })
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-gray-400">Carregando...</div>
      </div>
    );
  }

  const hasTrades = (stats?.closedTrades ?? 0) > 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <p className="text-sm text-gray-400 mt-0.5">Visão geral do seu portfólio</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="P&L Total"
          value={stats ? formatCurrency(stats.totalProfitLoss) : '—'}
          subValue={stats ? formatPercent(stats.totalProfitLossPct) : undefined}
          valueClass={pnlColor(stats?.totalProfitLoss ?? null)}
        />
        <StatCard
          label="Win Rate"
          value={stats ? `${stats.winRate.toFixed(1)}%` : '—'}
          subValue={stats ? `${stats.winningTrades}W / ${stats.losingTrades}L` : undefined}
        />
        <StatCard
          label="Trades"
          value={stats?.totalTrades ?? 0}
          subValue={stats ? `${stats.openTrades} abertos` : undefined}
        />
        <StatCard
          label="Estratégias"
          value={strategies.filter(s => s.isActive).length}
          subValue={`${strategies.length} total`}
        />
      </div>

      {/* Psychology Section */}
      {stats && (stats.tradesFollowed + stats.tradesNotFollowed) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Psicologia do Trader</SectionTitle>
            <span className="text-xs text-gray-500">{stats.tradesFollowed + stats.tradesNotFollowed} trades avaliados</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400">Disciplina — seguiu a estratégia</span>
              <span className={`text-sm font-bold ${stats.disciplineRate >= 70 ? 'text-green-400' : stats.disciplineRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.disciplineRate.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${stats.disciplineRate >= 70 ? 'bg-green-500' : stats.disciplineRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${stats.disciplineRate}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              {stats.tradesFollowed} seguiu · {stats.tradesNotFollowed} não seguiu
              {stats.tradesUntagged > 0 ? ` · ${stats.tradesUntagged} sem avaliação` : ''}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Win Rate', vF: stats.tradesFollowed > 0 ? `${stats.winRateFollowing.toFixed(0)}%` : '—', vN: stats.tradesNotFollowed > 0 ? `${stats.winRateNotFollowing.toFixed(0)}%` : '—', diff: stats.tradesFollowed > 0 && stats.tradesNotFollowed > 0 ? stats.winRateFollowing - stats.winRateNotFollowing : null, unit: 'pp' },
              { label: 'P&L Médio', vF: stats.avgPnlFollowing != null ? formatCurrency(stats.avgPnlFollowing) : '—', vN: stats.avgPnlNotFollowing != null ? formatCurrency(stats.avgPnlNotFollowing) : '—', diff: stats.avgPnlFollowing != null && stats.avgPnlNotFollowing != null ? stats.avgPnlFollowing - stats.avgPnlNotFollowing : null, unit: '' },
              { label: 'P&L Total', vF: formatCurrency(stats.totalPnlFollowing), vN: formatCurrency(stats.totalPnlNotFollowing), diff: null, unit: '' },
            ].map(card => (
              <div key={card.label} className="bg-gray-800/60 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{card.label}</p>
                <div className="flex justify-between"><span className="text-[11px] text-green-400">Seguiu</span><span className="text-sm font-semibold text-green-400">{card.vF}</span></div>
                <div className="flex justify-between"><span className="text-[11px] text-red-400">Não seguiu</span><span className="text-sm font-semibold text-red-400">{card.vN}</span></div>
                {card.diff != null && (
                  <p className={`text-[10px] font-medium ${card.diff >= 0 ? 'text-green-500' : 'text-orange-400'}`}>
                    {card.diff >= 0 ? `+${card.diff.toFixed(0)}${card.unit} ao seguir` : `${card.diff.toFixed(0)}${card.unit} ao seguir`}
                  </p>
                )}
              </div>
            ))}
          </div>
          {stats.tradesFollowed > 0 && stats.tradesNotFollowed > 0 && (() => {
            const betterWr  = stats.winRateFollowing > stats.winRateNotFollowing;
            const betterPnl = (stats.avgPnlFollowing ?? 0) > (stats.avgPnlNotFollowing ?? 0);
            if (betterWr && betterPnl) return <p className="text-xs text-green-400 bg-green-900/20 border border-green-900/40 rounded-lg px-3 py-2">Seguir a estratégia melhora tanto o win rate quanto o P&L médio. Continue assim.</p>;
            if (!betterWr && !betterPnl) return <p className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-900/40 rounded-lg px-3 py-2">Trades fora da estratégia estão performando melhor. Pode ser hora de revisar as regras.</p>;
            return <p className="text-xs text-blue-400 bg-blue-900/20 border border-blue-900/40 rounded-lg px-3 py-2">Resultado misto. Analise os trades individualmente para identificar padrões.</p>;
          })()}
        </div>
      )}

      {/* ── Performance Temporal ─────────────────────────────────────────── */}
      {insights && hasTrades && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-6">
          <SectionTitle>Performance Temporal</SectionTitle>

          {/* P&L por dia da semana */}
          {insights.pnlByDayOfWeek.some(d => d.trades > 0) && (
            <div>
              <p className="text-xs text-gray-400 mb-3">P&L por dia da semana</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={insights.pnlByDayOfWeek} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
                  <Tooltip content={<PnlTooltip />} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {insights.pnlByDayOfWeek.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={entry.trades === 0 ? 0.2 : 0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-7 gap-1 mt-2">
                {insights.pnlByDayOfWeek.map(d => (
                  <div key={d.day} className="text-center">
                    {d.trades > 0 && <p className="text-[9px] text-gray-500">{d.winRate.toFixed(0)}% WR</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* P&L por hora */}
          {insights.pnlByHour.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">P&L por hora de entrada</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={insights.pnlByHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
                  <Tooltip content={<PnlTooltip />} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                    {insights.pnlByHour.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* P&L por mês */}
          {insights.pnlByMonth.length > 1 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">P&L mensal</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={insights.pnlByMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatMonth} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
                  <Tooltip content={<PnlTooltip />} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {insights.pnlByMonth.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Melhor e pior mês */}
              {insights.pnlByMonth.length >= 2 && (() => {
                const best  = [...insights.pnlByMonth].sort((a, b) => b.pnl - a.pnl)[0];
                const worst = [...insights.pnlByMonth].sort((a, b) => a.pnl - b.pnl)[0];
                return (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-green-900/20 border border-green-900/40 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-green-500">Melhor mês</p>
                      <p className="text-sm font-semibold text-green-400">{formatMonth(best.month)}</p>
                      <p className="text-xs text-green-400">{formatCurrency(best.pnl)}</p>
                    </div>
                    <div className="bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-red-500">Pior mês</p>
                      <p className="text-sm font-semibold text-red-400">{formatMonth(worst.month)}</p>
                      <p className="text-xs text-red-400">{formatCurrency(worst.pnl)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Evolução da disciplina */}
          {insights.disciplineByMonth.length > 1 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Evolução da disciplina (% seguiu)</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={insights.disciplineByMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatMonth} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={40} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(0)}%`, 'Disciplina']} labelFormatter={(label) => formatMonth(String(label))} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                  <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                  <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Gestão de Risco ──────────────────────────────────────────────── */}
      {insights && hasTrades && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <SectionTitle>Gestão de Risco</SectionTitle>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tempo médio no trade */}
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Tempo médio</p>
              <p className="text-lg font-bold text-gray-100">
                {insights.avgHoldingTimeHours != null ? formatHoldingTime(insights.avgHoldingTimeHours) : '—'}
              </p>
              <p className="text-[10px] text-gray-500">por trade fechado</p>
            </div>

            {/* Trades abertos há muito tempo */}
            <div className={`rounded-lg p-3 ${insights.longOpenTrades > 0 ? 'bg-yellow-900/20 border border-yellow-900/40' : 'bg-gray-800/60'}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Posições longas</p>
              <p className={`text-lg font-bold ${insights.longOpenTrades > 0 ? 'text-yellow-400' : 'text-gray-100'}`}>
                {insights.longOpenTrades}
              </p>
              <p className="text-[10px] text-gray-500">abertas há +7 dias</p>
            </div>

            {/* Buy vs Sell */}
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Direção</p>
              <div className="flex items-center gap-1 mb-1">
                <div
                  className="h-2 rounded-l-full bg-green-500"
                  style={{ width: `${(insights.buyCount / (insights.buyCount + insights.sellCount || 1)) * 100}%`, minWidth: 4 }}
                />
                <div
                  className="h-2 rounded-r-full bg-red-500"
                  style={{ width: `${(insights.sellCount / (insights.buyCount + insights.sellCount || 1)) * 100}%`, minWidth: 4 }}
                />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-green-400">{insights.buyCount} buy</span>
                <span className="text-red-400">{insights.sellCount} sell</span>
              </div>
            </div>

            {/* Expectativa */}
            <div className={`rounded-lg p-3 ${insights.expectedValue != null && insights.expectedValue > 0 ? 'bg-green-900/20 border border-green-900/40' : insights.expectedValue != null ? 'bg-red-900/20 border border-red-900/40' : 'bg-gray-800/60'}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Expectativa</p>
              <p className={`text-lg font-bold ${insights.expectedValue == null ? 'text-gray-400' : insights.expectedValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {insights.expectedValue != null ? formatCurrency(insights.expectedValue) : '—'}
              </p>
              <p className="text-[10px] text-gray-500">por trade (EV)</p>
            </div>
          </div>

          {/* Exit Reason Rates */}
          {(insights.slHitRate > 0 || insights.tpHitRate > 0) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-800">
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Take Profit</p>
                <p className="text-lg font-bold text-green-400">{insights.tpHitRate.toFixed(0)}%</p>
                <p className="text-[10px] text-gray-500">trades com TP</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Stop Loss</p>
                <p className="text-lg font-bold text-red-400">{insights.slHitRate.toFixed(0)}%</p>
                <p className="text-[10px] text-gray-500">trades com SL</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">R:R Planejado</p>
                <p className="text-lg font-bold text-blue-400">{insights.avgPlannedRR != null ? insights.avgPlannedRR.toFixed(2) : '—'}</p>
                <p className="text-[10px] text-gray-500">média</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">R:R Realizado</p>
                <p className="text-lg font-bold text-purple-400">{insights.avgRealizedRR != null ? insights.avgRealizedRR.toFixed(2) : '—'}</p>
                <p className="text-[10px] text-gray-500">média</p>
              </div>
            </div>
          )}

          {/* Slippage & Commissions */}
          {(insights.avgSlippage != null || insights.avgCommission != null) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-800">
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Slippage médio</p>
                <p className="text-lg font-bold text-red-400">{insights.avgSlippage != null ? formatCurrency(insights.avgSlippage) : '—'}</p>
                <p className="text-[10px] text-gray-500">por trade</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Comissão média</p>
                <p className="text-lg font-bold text-orange-400">{insights.avgCommission != null ? formatCurrency(insights.avgCommission) : '—'}</p>
                <p className="text-[10px] text-gray-500">por trade</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total comissões</p>
                <p className="text-lg font-bold text-orange-400">{formatCurrency(insights.totalCommissionPaid)}</p>
                <p className="text-[10px] text-gray-500">todos os trades</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total slippage</p>
                <p className="text-lg font-bold text-red-400">{formatCurrency(insights.totalSlippageLost)}</p>
                <p className="text-[10px] text-gray-500">todos os trades</p>
              </div>
            </div>
          )}

          {/* Top tickers */}
          {insights.topTickers.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Concentração por ativo (top {insights.topTickers.length})</p>
              <div className="space-y-2">
                {insights.topTickers.map(t => (
                  <div key={t.ticker} className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-gray-200 w-14">{t.ticker}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{
                          width: `${Math.min(100, (Math.abs(t.pnl) / (insights.topTickers[0] ? Math.abs(insights.topTickers[0].pnl) || 1 : 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-20 text-right ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(t.pnl)}</span>
                    <span className="text-[10px] text-gray-500 w-14 text-right">{t.trades} trades</span>
                    <span className="text-[10px] text-gray-500 w-14 text-right">{t.winRate.toFixed(0)}% WR</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aprendizado ──────────────────────────────────────────────────── */}
      {insights && hasTrades && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <SectionTitle>Aprendizado</SectionTitle>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cobertura de notas */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Documentação de trades (closeNotes)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${insights.tradesWithNotes + insights.tradesWithoutNotes > 0
                        ? (insights.tradesWithNotes / (insights.tradesWithNotes + insights.tradesWithoutNotes)) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-blue-400 w-10 text-right">
                  {insights.tradesWithNotes + insights.tradesWithoutNotes > 0
                    ? `${((insights.tradesWithNotes / (insights.tradesWithNotes + insights.tradesWithoutNotes)) * 100).toFixed(0)}%`
                    : '—'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                {insights.tradesWithNotes} documentados · {insights.tradesWithoutNotes} sem notas
              </p>
            </div>

            {/* Desvios que ganharam */}
            {insights.disciplineBreaksTotal > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Desvios de estratégia que ganharam</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold text-orange-400">
                    {insights.disciplineBreaksWon}/{insights.disciplineBreaksTotal}
                  </p>
                  <p className="text-xs text-gray-500">
                    ({insights.disciplineBreaksTotal > 0
                      ? ((insights.disciplineBreaksWon / insights.disciplineBreaksTotal) * 100).toFixed(0)
                      : 0}% dos desvios lucraram)
                  </p>
                </div>
                <p className="text-[10px] text-gray-500">
                  {insights.disciplineBreaksWon > insights.disciplineBreaksTotal / 2
                    ? 'Muitos desvios lucrando — verifique se a estratégia precisa de ajuste.'
                    : 'A maioria dos desvios resultou em prejuízo. A estratégia está certa.'}
                </p>
              </div>
            )}
          </div>

          {/* Win rate por tipo de estratégia */}
          {insights.winRateByStrategyType.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Win rate por tipo de estratégia</p>
              <div className="space-y-2">
                {insights.winRateByStrategyType.map(s => (
                  <div key={s.type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 capitalize w-36 truncate">
                      {s.type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.winRate >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${s.winRate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-10 text-right ${s.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.winRate.toFixed(0)}%
                    </span>
                    <span className={`text-xs w-20 text-right ${s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(s.pnl)}
                    </span>
                    <span className="text-[10px] text-gray-500 w-14 text-right">{s.trades} trades</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Psicologia Expandida ────────────────────────────────────────── */}
      {insights && hasTrades && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <SectionTitle>Psicologia Expandida</SectionTitle>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Confiança média</p>
              <p className="text-lg font-bold text-blue-400">
                {insights.avgConfidenceLevel != null ? `${insights.avgConfidenceLevel.toFixed(1)}/5` : '—'}
              </p>
              <p className="text-[10px] text-gray-500">ao entrar</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Qualidade entrada</p>
              <p className="text-lg font-bold text-green-400">
                {insights.avgEntryQuality != null ? `${insights.avgEntryQuality.toFixed(1)}/5` : '—'}
              </p>
              <p className="text-[10px] text-gray-500">média</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Stop moveu</p>
              <p className="text-lg font-bold text-orange-400">{insights.movedStopCount}</p>
              <p className="text-[10px] text-gray-500">ajustes</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Entrada no tempo</p>
              <p className="text-lg font-bold text-purple-400">
                {insights.enteredOnTimeRate.toFixed(0)}%
              </p>
              <p className="text-[10px] text-gray-500">segundo plano</p>
            </div>
          </div>

          {/* Emotion Breakdown */}
          {insights.emotionBreakdown.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Performance por emoção</p>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {insights.emotionBreakdown.map(e => {
                  const emotionColors: Record<string, string> = {
                    CALM: 'bg-blue-900/30 border-blue-900/60 text-blue-300',
                    FOMO: 'bg-red-900/30 border-red-900/60 text-red-300',
                    FEAR: 'bg-orange-900/30 border-orange-900/60 text-orange-300',
                    REVENGE: 'bg-purple-900/30 border-purple-900/60 text-purple-300',
                    CONFIDENT: 'bg-green-900/30 border-green-900/60 text-green-300',
                  };
                  return (
                    <div key={e.emotion} className={`border rounded-lg p-3 ${emotionColors[e.emotion] || 'bg-gray-800/60'}`}>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{e.emotion}</p>
                      <p className="text-xs font-semibold mb-1">{e.count} trades</p>
                      <p className={`text-sm font-bold ${e.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {e.winRate.toFixed(0)}% WR
                      </p>
                      <p className="text-[10px] text-gray-400">{formatCurrency(e.avgPnl)}/td</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Contexto do Trade ────────────────────────────────────────────── */}
      {insights && hasTrades && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <SectionTitle>Contexto do Trade</SectionTitle>

          {/* Timeframe Performance */}
          {insights.timeframeBreakdown.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Performance por timeframe</p>
              <div className="space-y-2">
                {insights.timeframeBreakdown.map(tf => (
                  <div key={tf.timeframe} className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-gray-300 w-12">{tf.timeframe}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tf.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{
                          width: `${Math.min(100, (Math.abs(tf.pnl) / (insights.timeframeBreakdown[0] ? Math.abs(insights.timeframeBreakdown[0].pnl) || 1 : 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-20 text-right ${tf.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(tf.pnl)}
                    </span>
                    <span className="text-[10px] text-gray-500 w-16 text-right">{tf.winRate.toFixed(0)}% · {tf.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Asset Class Performance */}
          {insights.assetClassBreakdown.length > 0 && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-3">Performance por classe de ativo</p>
              <div className="space-y-2">
                {insights.assetClassBreakdown.map(ac => (
                  <div key={ac.assetClass} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-300 w-24 truncate">{ac.assetClass}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ac.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{
                          width: `${Math.min(100, (Math.abs(ac.pnl) / (insights.assetClassBreakdown[0] ? Math.abs(insights.assetClassBreakdown[0].pnl) || 1 : 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-20 text-right ${ac.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(ac.pnl)}
                    </span>
                    <span className="text-[10px] text-gray-500 w-16 text-right">{ac.winRate.toFixed(0)}% · {ac.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend Performance */}
          {insights.trendBreakdown.length > 0 && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-3">Performance por tendência</p>
              <div className="space-y-2">
                {insights.trendBreakdown.map(tr => (
                  <div key={tr.trend} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-300 w-24 truncate">{tr.trend}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tr.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{
                          width: `${Math.min(100, (Math.abs(tr.pnl) / (insights.trendBreakdown[0] ? Math.abs(insights.trendBreakdown[0].pnl) || 1 : 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-20 text-right ${tr.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(tr.pnl)}
                    </span>
                    <span className="text-[10px] text-gray-500 w-16 text-right">{tr.winRate.toFixed(0)}% · {tr.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most Profitable Setup */}
          {insights.mostProfitableSetup && (
            <div className="bg-green-900/20 border border-green-900/40 rounded-lg p-3 mt-4">
              <p className="text-[10px] text-green-500 uppercase tracking-wide mb-1">Setup mais lucrativo</p>
              <p className="text-sm font-semibold text-green-300">{insights.mostProfitableSetup.setup}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className={`text-sm ${insights.mostProfitableSetup.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(insights.mostProfitableSetup.pnl)}
                </span>
                <span className="text-xs text-gray-400">
                  {insights.mostProfitableSetup.winRate.toFixed(0)}% WR
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sizing ──────────────────────────────────────────────────────── */}
      {insights && hasTrades && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <SectionTitle>Gestão de Tamanho (Sizing)</SectionTitle>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">% capital médio</p>
              <p className="text-lg font-bold text-blue-400">
                {insights.avgCapitalPct != null ? `${insights.avgCapitalPct.toFixed(2)}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-500">por trade</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total comissões</p>
              <p className={`text-lg font-bold ${insights.totalCommissionPaid >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {formatCurrency(insights.totalCommissionPaid)}
              </p>
              <p className="text-[10px] text-gray-500">custos de operação</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total slippage</p>
              <p className={`text-lg font-bold ${insights.totalSlippageLost >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(insights.totalSlippageLost)}
              </p>
              <p className="text-[10px] text-gray-500">perda por slippage</p>
            </div>
          </div>

          {(insights.totalCommissionPaid > 0 || insights.totalSlippageLost > 0) && (
            <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3">
              <p className="text-xs text-yellow-300">
                Cutos totais: <span className="font-bold">{formatCurrency(insights.totalCommissionPaid + Math.abs(insights.totalSlippageLost))}</span>
              </p>
              <p className="text-[10px] text-yellow-400 mt-1">
                Reduza comissões e slippage melhorando sua execução e escolhendo brokers com spreads menores.
              </p>
            </div>
          )}
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trades */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Trades Recentes</h3>
            <Link to="/trades" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Ver todos
            </Link>
          </div>
          {recentTrades.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhum trade ainda.</p>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <span className="font-medium text-white text-sm">{trade.ticker}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded uppercase ${trade.side === 'buy' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {trade.side}
                    </span>
                    <span className={`ml-2 text-xs ${trade.status === 'open' ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {trade.status === 'open' ? 'Aberto' : 'Fechado'}
                    </span>
                  </div>
                  <div className="text-right">
                    {trade.profitLoss !== null ? (
                      <p className={`text-sm font-medium ${pnlColor(trade.profitLoss)}`}>
                        {formatCurrency(trade.profitLoss)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">{formatDate(trade.entryAt)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strategies */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Estratégias</h3>
            <Link to="/strategies" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Gerenciar
            </Link>
          </div>
          {strategies.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhuma estratégia criada.</p>
          ) : (
            <div className="space-y-2">
              {strategies.slice(0, 5).map((strategy) => (
                <div key={strategy.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{strategy.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{strategy.type.replace('_', ' ')}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${strategy.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {strategy.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
