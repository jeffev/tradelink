import { useEffect, useState } from 'react';
import { tradesService, type CreateTradePayload, type CloseTradePayload } from '@/services/trades.service';
import { strategiesService } from '@/services/strategies.service';
import type { Trade, Strategy, ExitReason, TradeTimeframe, TradeTrend, AssetClass, EmotionAtEntry } from '@/types';
import Modal from '@/components/UI/Modal';
import Button from '@/components/UI/Button';
import { formatCurrency, formatPercent, formatDate, pnlColor } from '@/utils/format';
import toast from 'react-hot-toast';

// ── Label maps ────────────────────────────────────────────────────────────────

const TIMEFRAME_LABELS: Record<TradeTimeframe, string> = {
  '1m': '1 min', '5m': '5 min', '15m': '15 min',
  '1h': '1h', '4h': '4h', '1d': 'Diário', '1w': 'Semanal',
};
const TREND_LABELS: Record<TradeTrend, string> = {
  UPTREND: 'Alta', DOWNTREND: 'Baixa', SIDEWAYS: 'Lateral',
};
const ASSET_LABELS: Record<AssetClass, string> = {
  STOCKS: 'Ações', CRYPTO: 'Cripto', FOREX: 'Forex',
  FUTURES: 'Futuros', ETF: 'ETF', OPTIONS: 'Opções',
};
const EMOTION_LABELS: Record<EmotionAtEntry, string> = {
  CALM: 'Calmo', FOMO: 'FOMO', FEAR: 'Medo',
  REVENGE: 'Vingança', CONFIDENT: 'Confiante',
};
const EMOTION_COLORS: Record<EmotionAtEntry, string> = {
  CALM: 'text-green-400', FOMO: 'text-orange-400', FEAR: 'text-red-400',
  REVENGE: 'text-red-500', CONFIDENT: 'text-blue-400',
};
const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  TP_HIT: 'Alvo batido', SL_HIT: 'Stop batido',
  MANUAL: 'Manual', TIMEOUT: 'Timeout', TRAIL_STOP: 'Trail stop',
};

// ── Star rating component ─────────────────────────────────────────────────────

function StarRating({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`text-lg leading-none transition-colors ${n <= (value ?? 0) ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'}`}
          >
            ★
          </button>
        ))}
        {value && <span className="text-xs text-gray-500 self-center ml-1">{value}/5</span>}
      </div>
    </div>
  );
}

// ── Tri-state button (yes / no / unset) ──────────────────────────────────────

function TriState({ value, onChange, label, yesLabel = 'Sim', noLabel = 'Não' }: {
  value: boolean | null; onChange: (v: boolean | null) => void;
  label: string; yesLabel?: string; noLabel?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex gap-1">
        {([
          { v: true,  l: yesLabel, cls: 'border-green-500 bg-green-500/20 text-green-300' },
          { v: false, l: noLabel,  cls: 'border-red-500 bg-red-500/20 text-red-300' },
          { v: null,  l: '—',      cls: 'border-gray-600 bg-gray-700 text-gray-400' },
        ] as const).map(opt => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium transition-colors ${
              value === opt.v ? opt.cls : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-500'
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-gray-400 mb-1">{children}</label>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 ${props.className ?? ''}`}
    />
  );
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 ${props.className ?? ''}`}
    />
  );
}
function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] text-gray-600 uppercase tracking-wider whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

// ── Default form values ───────────────────────────────────────────────────────

const defaultCreate = (): CreateTradePayload => ({
  ticker: '', side: 'buy', entryPrice: 0, quantity: 0,
  strategyId: undefined, notes: '',
  stopLoss: undefined, takeProfit: undefined,
  timeframe: undefined, setup: undefined, trend: undefined, assetClass: undefined,
  confidenceLevel: undefined, emotionAtEntry: undefined, enteredOnTime: undefined,
  capitalPct: undefined, commission: undefined,
});

const defaultClose = (): CloseTradePayload => ({
  exitPrice: 0, strategyId: undefined,
  followedStrategy: null, closeNotes: '',
  exitReason: undefined,
  entryQuality: undefined, movedStop: undefined, enteredOnTime: undefined,
  slippage: undefined,
});

// ── Main component ────────────────────────────────────────────────────────────

export default function TradeList() {
  const [trades, setTrades]       = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateTradePayload>(defaultCreate());
  const [closeForm,  setCloseForm]  = useState<CloseTradePayload>(defaultClose());

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [tradesData, strategiesData] = await Promise.all([tradesService.getAll(), strategiesService.getAll()]);
      setTrades(tradesData);
      setStrategies(strategiesData);
    } catch {
      toast.error('Erro ao carregar trades');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const trade = await tradesService.create({
        ...createForm,
        ticker:     createForm.ticker.toUpperCase(),
        strategyId: createForm.strategyId  || undefined,
        notes:      createForm.notes       || undefined,
        setup:      createForm.setup       || undefined,
      });
      setTrades(prev => [trade, ...prev]);
      setShowCreate(false);
      setCreateForm(defaultCreate());
      toast.success('Trade criado!');
    } catch {
      toast.error('Erro ao criar trade');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!closingTrade) return;
    setSubmitting(true);
    try {
      const updated = await tradesService.close(closingTrade.id, {
        ...closeForm,
        strategyId:      closeForm.strategyId      || undefined,
        followedStrategy:closeForm.followedStrategy ?? undefined,
        closeNotes:      closeForm.closeNotes       || undefined,
      });
      setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
      setClosingTrade(null);
      setCloseForm(defaultClose());
      toast.success('Trade fechado!');
    } catch {
      toast.error('Erro ao fechar trade');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este trade?')) return;
    try {
      await tradesService.remove(id);
      setTrades(prev => prev.filter(t => t.id !== id));
      toast.success('Trade removido');
    } catch {
      toast.error('Erro ao remover trade');
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Trades</h2>
          <p className="text-sm text-gray-400 mt-0.5">{trades.length} trade(s) registrado(s)</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Novo Trade</Button>
      </div>

      {trades.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">Nenhum trade registrado ainda.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Criar primeiro trade</Button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
                <th className="text-left px-4 py-3">Ticker</th>
                <th className="text-left px-4 py-3">Lado</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Estratégia</th>
                <th className="text-right px-4 py-3">Entrada</th>
                <th className="text-right px-4 py-3">SL / TP</th>
                <th className="text-right px-4 py-3">R:R</th>
                <th className="text-right px-4 py-3">P&L</th>
                <th className="text-right px-4 py-3">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {trades.map(trade => (
                <>
                  <tr
                    key={trade.id}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === trade.id ? null : trade.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{trade.ticker}</div>
                      {trade.assetClass && <div className="text-[10px] text-gray-500">{ASSET_LABELS[trade.assetClass]}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs uppercase font-medium ${trade.side === 'buy' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${trade.status === 'open' ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {trade.status === 'open' ? 'Aberto' : 'Fechado'}
                      </span>
                      {trade.exitReason && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{EXIT_REASON_LABELS[trade.exitReason]}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {trade.strategyId ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-blue-300 truncate max-w-[120px]">
                            {strategies.find(s => s.id === trade.strategyId)?.name ?? '—'}
                          </span>
                          {trade.status === 'closed' && (
                            trade.followedStrategy === true  ? <span className="text-[10px] text-green-400">✓ Seguiu</span> :
                            trade.followedStrategy === false ? <span className="text-[10px] text-red-400">✗ Não seguiu</span> : null
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-gray-300">{formatCurrency(trade.entryPrice)}</div>
                      {trade.exitPrice && <div className="text-xs text-gray-500">{formatCurrency(trade.exitPrice)}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {trade.stopLoss   && <div className="text-red-400">SL {formatCurrency(trade.stopLoss)}</div>}
                      {trade.takeProfit && <div className="text-green-400">TP {formatCurrency(trade.takeProfit)}</div>}
                      {!trade.stopLoss && !trade.takeProfit && <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {trade.plannedRR != null  && <div className="text-gray-400">Plan: {trade.plannedRR.toFixed(2)}R</div>}
                      {trade.realizedRR != null && <div className={trade.realizedRR >= 0 ? 'text-green-400' : 'text-red-400'}>Real: {trade.realizedRR.toFixed(2)}R</div>}
                      {trade.plannedRR == null && trade.realizedRR == null && <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {trade.profitLoss !== null ? (
                        <div>
                          <span className={`font-medium ${pnlColor(trade.profitLoss)}`}>{formatCurrency(trade.profitLoss)}</span>
                          <div className="text-xs text-gray-500">{formatPercent(trade.profitLossPct ?? 0)}</div>
                        </div>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{formatDate(trade.entryAt)}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {trade.status === 'open' && (
                          <Button size="sm" variant="secondary" onClick={() => {
                            setClosingTrade(trade);
                            setCloseForm({ ...defaultClose(), exitPrice: trade.entryPrice, strategyId: trade.strategyId ?? undefined });
                          }}>
                            Fechar
                          </Button>
                        )}
                        <Button size="sm" variant="danger" onClick={() => handleDelete(trade.id)}>✕</Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedRow === trade.id && (
                    <tr key={`${trade.id}-detail`} className="bg-gray-800/40 border-b border-gray-800">
                      <td colSpan={10} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          {trade.timeframe    && <div><span className="text-gray-500">Timeframe:</span> <span className="text-gray-300">{TIMEFRAME_LABELS[trade.timeframe]}</span></div>}
                          {trade.trend        && <div><span className="text-gray-500">Tendência:</span> <span className="text-gray-300">{TREND_LABELS[trade.trend]}</span></div>}
                          {trade.setup        && <div><span className="text-gray-500">Setup:</span> <span className="text-gray-300">{trade.setup}</span></div>}
                          {trade.emotionAtEntry && <div><span className="text-gray-500">Emoção:</span> <span className={EMOTION_COLORS[trade.emotionAtEntry]}>{EMOTION_LABELS[trade.emotionAtEntry]}</span></div>}
                          {trade.confidenceLevel && <div><span className="text-gray-500">Confiança:</span> <span className="text-yellow-400">{'★'.repeat(trade.confidenceLevel)}{'☆'.repeat(5 - trade.confidenceLevel)}</span></div>}
                          {trade.entryQuality  && <div><span className="text-gray-500">Qualidade entrada:</span> <span className="text-yellow-400">{'★'.repeat(trade.entryQuality)}{'☆'.repeat(5 - trade.entryQuality)}</span></div>}
                          {trade.enteredOnTime !== null && <div><span className="text-gray-500">Entrou na hora:</span> <span className={trade.enteredOnTime ? 'text-green-400' : 'text-red-400'}>{trade.enteredOnTime ? 'Sim' : 'Não'}</span></div>}
                          {trade.movedStop !== null && <div><span className="text-gray-500">Moveu stop:</span> <span className={trade.movedStop ? 'text-red-400' : 'text-green-400'}>{trade.movedStop ? 'Sim ⚠' : 'Não'}</span></div>}
                          {trade.capitalPct   && <div><span className="text-gray-500">Capital alocado:</span> <span className="text-gray-300">{trade.capitalPct}%</span></div>}
                          {trade.riskAmount   && <div><span className="text-gray-500">Risco R$:</span> <span className="text-red-400">{formatCurrency(trade.riskAmount)}</span></div>}
                          {trade.commission   && <div><span className="text-gray-500">Comissão:</span> <span className="text-gray-300">{formatCurrency(trade.commission)}</span></div>}
                          {trade.slippage     && <div><span className="text-gray-500">Slippage:</span> <span className="text-gray-300">{formatCurrency(trade.slippage)}</span></div>}
                          {trade.notes        && <div className="col-span-2"><span className="text-gray-500">Notas:</span> <span className="text-gray-300">{trade.notes}</span></div>}
                          {trade.closeNotes   && <div className="col-span-2"><span className="text-gray-500">Obs. fechamento:</span> <span className="text-gray-300">{trade.closeNotes}</span></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Trade Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Novo Trade">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

          <SectionDivider>Dados principais</SectionDivider>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Ticker *</FieldLabel>
              <Input required value={createForm.ticker} onChange={e => setCreateForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" />
            </div>
            <div>
              <FieldLabel>Lado *</FieldLabel>
              <Select value={createForm.side} onChange={e => setCreateForm(p => ({ ...p, side: e.target.value as 'buy' | 'sell' }))}>
                <option value="buy">Compra</option>
                <option value="sell">Venda</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Preço de entrada *</FieldLabel>
              <Input type="number" required min="0" step="0.01" value={createForm.entryPrice || ''} onChange={e => setCreateForm(p => ({ ...p, entryPrice: Number(e.target.value) }))} />
            </div>
            <div>
              <FieldLabel>Quantidade *</FieldLabel>
              <Input type="number" required min="0" step="0.01" value={createForm.quantity || ''} onChange={e => setCreateForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
            </div>
          </div>

          <SectionDivider>Gestão da operação</SectionDivider>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Stop Loss</FieldLabel>
              <Input type="number" min="0" step="0.01" value={createForm.stopLoss ?? ''} onChange={e => setCreateForm(p => ({ ...p, stopLoss: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Preço de stop" />
            </div>
            <div>
              <FieldLabel>Take Profit</FieldLabel>
              <Input type="number" min="0" step="0.01" value={createForm.takeProfit ?? ''} onChange={e => setCreateForm(p => ({ ...p, takeProfit: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Preço alvo" />
            </div>
          </div>
          {createForm.stopLoss && createForm.takeProfit && createForm.entryPrice > 0 && (
            <p className="text-xs text-blue-400 bg-blue-900/20 border border-blue-900/40 rounded-lg px-3 py-2">
              R:R planejado: {(Math.abs(createForm.takeProfit - createForm.entryPrice) / Math.abs(createForm.entryPrice - createForm.stopLoss)).toFixed(2)}R
            </p>
          )}

          <SectionDivider>Contexto de mercado</SectionDivider>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Classe de ativo</FieldLabel>
              <Select value={createForm.assetClass ?? ''} onChange={e => setCreateForm(p => ({ ...p, assetClass: e.target.value as AssetClass || undefined }))}>
                <option value="">— Selecione —</option>
                {(Object.keys(ASSET_LABELS) as AssetClass[]).map(k => <option key={k} value={k}>{ASSET_LABELS[k]}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Timeframe</FieldLabel>
              <Select value={createForm.timeframe ?? ''} onChange={e => setCreateForm(p => ({ ...p, timeframe: e.target.value as TradeTimeframe || undefined }))}>
                <option value="">— Selecione —</option>
                {(Object.keys(TIMEFRAME_LABELS) as TradeTimeframe[]).map(k => <option key={k} value={k}>{TIMEFRAME_LABELS[k]}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Tendência</FieldLabel>
              <Select value={createForm.trend ?? ''} onChange={e => setCreateForm(p => ({ ...p, trend: e.target.value as TradeTrend || undefined }))}>
                <option value="">— Selecione —</option>
                {(Object.keys(TREND_LABELS) as TradeTrend[]).map(k => <option key={k} value={k}>{TREND_LABELS[k]}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Setup</FieldLabel>
              <Input value={createForm.setup ?? ''} onChange={e => setCreateForm(p => ({ ...p, setup: e.target.value || undefined }))} placeholder="Ex: Pullback na média" />
            </div>
          </div>

          <SectionDivider>Psicologia</SectionDivider>
          <div>
            <FieldLabel>Emoção ao entrar</FieldLabel>
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(EMOTION_LABELS) as EmotionAtEntry[]).map(k => (
                <button key={k} type="button"
                  onClick={() => setCreateForm(p => ({ ...p, emotionAtEntry: p.emotionAtEntry === k ? undefined : k }))}
                  className={`px-2 py-1 rounded-lg border text-xs transition-colors ${createForm.emotionAtEntry === k ? `border-blue-500 bg-blue-500/20 ${EMOTION_COLORS[k]}` : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-500'}`}>
                  {EMOTION_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StarRating value={createForm.confidenceLevel ?? null} onChange={v => setCreateForm(p => ({ ...p, confidenceLevel: v ?? undefined }))} label="Grau de confiança (1–5)" />
            <TriState value={createForm.enteredOnTime ?? null} onChange={v => setCreateForm(p => ({ ...p, enteredOnTime: v ?? undefined }))} label="Entrou na hora certa?" />
          </div>

          <SectionDivider>Sizing & Risco</SectionDivider>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>% capital</FieldLabel>
              <Input type="number" min="0" max="100" step="0.1" value={createForm.capitalPct ?? ''} onChange={e => setCreateForm(p => ({ ...p, capitalPct: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Ex: 2.5" />
            </div>
            <div>
              <FieldLabel>Comissão R$</FieldLabel>
              <Input type="number" min="0" step="0.01" value={createForm.commission ?? ''} onChange={e => setCreateForm(p => ({ ...p, commission: e.target.value ? Number(e.target.value) : undefined }))} placeholder="0.00" />
            </div>
            <div>
              <FieldLabel>Estratégia</FieldLabel>
              <Select value={createForm.strategyId ?? ''} onChange={e => setCreateForm(p => ({ ...p, strategyId: e.target.value || undefined }))}>
                <option value="">— Nenhuma —</option>
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
          </div>

          <SectionDivider>Notas</SectionDivider>
          <div>
            <FieldLabel>Data/Hora de entrada (opcional)</FieldLabel>
            <Input type="datetime-local" value={createForm.entryAt ?? ''} onChange={e => setCreateForm(p => ({ ...p, entryAt: e.target.value || undefined }))} />
          </div>
          <div>
            <FieldLabel>Notas (opcional)</FieldLabel>
            <textarea value={createForm.notes ?? ''} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" isLoading={submitting}>Criar Trade</Button>
          </div>
        </form>
      </Modal>

      {/* ── Close Trade Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={!!closingTrade} onClose={() => setClosingTrade(null)} title={`Fechar Trade — ${closingTrade?.ticker}`}>
        <form onSubmit={handleClose} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

          <SectionDivider>Dados de saída</SectionDivider>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Preço de saída *</FieldLabel>
              <Input type="number" required min="0" step="0.01" value={closeForm.exitPrice || ''} onChange={e => setCloseForm(p => ({ ...p, exitPrice: Number(e.target.value) }))} />
            </div>
            <div>
              <FieldLabel>Motivo de saída</FieldLabel>
              <Select value={closeForm.exitReason ?? ''} onChange={e => setCloseForm(p => ({ ...p, exitReason: e.target.value as ExitReason || undefined }))}>
                <option value="">— Selecione —</option>
                {(Object.keys(EXIT_REASON_LABELS) as ExitReason[]).map(k => <option key={k} value={k}>{EXIT_REASON_LABELS[k]}</option>)}
              </Select>
            </div>
          </div>

          <SectionDivider>Estratégia</SectionDivider>
          <div>
            <FieldLabel>Estratégia usada</FieldLabel>
            <Select value={closeForm.strategyId ?? closingTrade?.strategyId ?? ''} onChange={e => setCloseForm(p => ({ ...p, strategyId: e.target.value || undefined }))}>
              <option value="">— Nenhuma —</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <TriState value={closeForm.followedStrategy ?? null} onChange={v => setCloseForm(p => ({ ...p, followedStrategy: v }))} label="Seguiu as regras da estratégia?" yesLabel="✓ Sim" noLabel="✗ Não" />

          <SectionDivider>Avaliação psicológica</SectionDivider>
          <div className="grid grid-cols-2 gap-3">
            <StarRating value={closeForm.entryQuality ?? null} onChange={v => setCloseForm(p => ({ ...p, entryQuality: v ?? undefined }))} label="Qualidade da entrada (1–5)" />
            <TriState value={closeForm.movedStop ?? null} onChange={v => setCloseForm(p => ({ ...p, movedStop: v ?? undefined }))} label="Moveu o stop durante?" yesLabel="Sim ⚠" noLabel="Não" />
          </div>
          <TriState value={closeForm.enteredOnTime ?? null} onChange={v => setCloseForm(p => ({ ...p, enteredOnTime: v ?? undefined }))} label="Entrou na hora certa?" />

          <SectionDivider>Custos</SectionDivider>
          <div>
            <FieldLabel>Slippage R$</FieldLabel>
            <Input type="number" min="0" step="0.01" value={closeForm.slippage ?? ''} onChange={e => setCloseForm(p => ({ ...p, slippage: e.target.value ? Number(e.target.value) : undefined }))} placeholder="0.00" />
          </div>

          <SectionDivider>Observações</SectionDivider>
          <div>
            <FieldLabel>Observações de fechamento</FieldLabel>
            <textarea value={closeForm.closeNotes ?? ''} onChange={e => setCloseForm(p => ({ ...p, closeNotes: e.target.value }))} rows={3}
              placeholder="Motivo da saída, lições aprendidas..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none placeholder-gray-600" />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setClosingTrade(null)}>Cancelar</Button>
            <Button type="submit" isLoading={submitting}>Confirmar Fechamento</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
