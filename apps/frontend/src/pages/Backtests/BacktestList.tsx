import { useState, useEffect, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { backtestingService, type CreateBacktestPayload } from '@/services/backtesting.service';
import type { BacktestJob, BacktestStrategyType } from '@/types';
import Modal from '@/components/UI/Modal';
import Button from '@/components/UI/Button';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  running: 'text-blue-400 bg-blue-400/10',
  completed: 'text-green-400 bg-green-400/10',
  failed: 'text-red-400 bg-red-400/10',
};

const STRATEGY_LABELS: Record<BacktestStrategyType | string, string> = {
  sma_crossover: 'SMA Crossover',
  rsi: 'RSI',
  buy_and_hold: 'Buy & Hold',
  multi_indicator: 'Indicator Conditions',
};

// Short label for an indicator config used in the list table
function formatIndicatorTag(ind: { name: string; params: Record<string, unknown> }): string {
  const p = ind.params;
  switch (ind.name) {
    case 'RSI':        return `RSI ${p.period ?? 14}`;
    case 'MACD':       return 'MACD';
    case 'STOCH':      return `STOCH ${p.k_period ?? 14}`;
    case 'CCI':        return `CCI ${p.period ?? 20}`;
    case 'ADX':        return `ADX ${p.period ?? 14}`;
    case 'WILLIAMS_R': return `W%R ${p.period ?? 14}`;
    case 'ATR':        return `ATR ${p.period ?? 14}`;
    case 'OBV':        return 'OBV';
    case 'BBPCTB':     return `BB%B ${p.period ?? 20}`;
    case 'SMA_CROSS':    return `SMA ${p.period ?? 20}`;
    case 'VWAP_CROSS':   return 'VWAP';
    case 'VOLUME_RATIO': return `VolRatio ${p.period ?? 20}`;
    case 'VP_POC_CROSS': return `VP POC (${p.period ?? 'month'})`;
    case 'VP_VAH_CROSS': return `VP VAH (${p.period ?? 'month'})`;
    case 'VP_VAL_CROSS': return `VP VAL (${p.period ?? 'month'})`;
    default:             return ind.name;
  }
}

const TIMEFRAMES = [
  { value: '1d',  label: '1 Day' },
  { value: '1w',  label: '1 Week' },
  { value: '1mo', label: '1 Month' },
  { value: '1h',  label: '1 Hour' },
  { value: '15m', label: '15 Min' },
];

// ─── Oscillators available for multi-indicator strategy ──────────────────────
const OSCILLATOR_INDICATORS = [
  { id: 'RSI',        label: 'RSI',         defaultPeriod: 14, entryOp: '<',  entryVal: '30',   exitOp: '>',  exitVal: '70',   hint: '< 30 compra · > 70 vende',             params: (p: number) => ({ period: p }),                               key: (p: number) => `RSI_${p}` },
  { id: 'STOCH',      label: 'Stochastic',  defaultPeriod: 14, entryOp: '<',  entryVal: '20',   exitOp: '>',  exitVal: '80',   hint: '< 20 compra · > 80 vende',             params: (p: number) => ({ k_period: p, d_period: 3, smooth_k: 3 }),  key: (p: number) => `STOCH_${p}_3` },
  { id: 'MACD',       label: 'MACD',        defaultPeriod: 12, entryOp: '>',  entryVal: '0',    exitOp: '<',  exitVal: '0',    hint: '> 0 compra · < 0 vende',               params: (_p: number) => ({ fast: 12, slow: 26, signal: 9 }),          key: (_p: number) => `MACD_12_26_9` },
  { id: 'CCI',        label: 'CCI',         defaultPeriod: 20, entryOp: '<',  entryVal: '-100', exitOp: '>',  exitVal: '100',  hint: '< -100 compra · > 100 vende',          params: (p: number) => ({ period: p }),                               key: (p: number) => `CCI_${p}` },
  { id: 'ADX',        label: 'ADX',         defaultPeriod: 14, entryOp: '>',  entryVal: '25',   exitOp: '<',  exitVal: '20',   hint: '> 25 tendência forte · < 20 fraca',    params: (p: number) => ({ period: p }),                               key: (p: number) => `ADX_${p}` },
  { id: 'WILLIAMS_R', label: 'Williams %R', defaultPeriod: 14, entryOp: '<',  entryVal: '-80',  exitOp: '>',  exitVal: '-20',  hint: '< -80 compra · > -20 vende',           params: (p: number) => ({ period: p }),                               key: (p: number) => `WILLIAMS_R_${p}` },
  { id: 'ATR',        label: 'ATR',         defaultPeriod: 14, entryOp: '>',  entryVal: '1',    exitOp: '<',  exitVal: '0.5',  hint: '> valor = volatilidade alta (em $)',    params: (p: number) => ({ period: p }),                               key: (p: number) => `ATR_${p}` },
  { id: 'OBV',        label: 'OBV',         defaultPeriod: 0,  entryOp: '>',  entryVal: '0',    exitOp: '<',  exitVal: '0',    hint: '> 0 fluxo comprador · < 0 vendedor',   params: (_p: number) => ({}),                                         key: (_p: number) => `OBV` },
  { id: 'BBPCTB',     label: 'BB %B',       defaultPeriod: 20, entryOp: '<',  entryVal: '0.2',  exitOp: '>',  exitVal: '0.8',  hint: '< 0.2 banda inferior · > 0.8 superior', params: (p: number) => ({ period: p }),                               key: (p: number) => `BBPCTB_${p}` },
  { id: 'SMA_CROSS',    label: 'SMA',         defaultPeriod: 20, entryOp: '>',  entryVal: '0',   exitOp: '<',  exitVal: '0',   hint: '> 0 preço acima da SMA (compra) · < 0 abaixo (venda)',           params: (p: number) => ({ period: p }),  key: (p: number) => `SMA_CROSS_${p}` },
  { id: 'VWAP_CROSS',  label: 'VWAP',        defaultPeriod: 0,  entryOp: '>',  entryVal: '0',   exitOp: '<',  exitVal: '0',   hint: '> 0 preço acima do VWAP (compra) · < 0 abaixo (venda)',          params: (_p: number) => ({}),            key: (_p: number) => `VWAP_CROSS` },
  { id: 'VOLUME_RATIO',label: 'Vol Ratio',   defaultPeriod: 20, entryOp: '>',  entryVal: '1.5', exitOp: '<',  exitVal: '0.8', hint: '> 1.5 volume acima da média (confirma sinal) · < 0.8 volume fraco', params: (p: number) => ({ period: p }),  key: (p: number) => `VOLUME_RATIO_${p}` },
  { id: 'VP_POC_CROSS',label: 'VP POC',      defaultPeriod: 0,  entryOp: '>',  entryVal: '0',   exitOp: '<',  exitVal: '0',   hint: 'preço cruza acima do POC (compra) · abaixo (venda)',               params: (_p: number) => ({}),            key: (_p: number) => `VP_POC_CROSS` },
  { id: 'VP_VAH_CROSS',label: 'VP VAH',      defaultPeriod: 0,  entryOp: '>',  entryVal: '0',   exitOp: '<',  exitVal: '0',   hint: 'preço cruza acima do VAH (breakout) · abaixo (venda)',             params: (_p: number) => ({}),            key: (_p: number) => `VP_VAH_CROSS` },
  { id: 'VP_VAL_CROSS',label: 'VP VAL',      defaultPeriod: 0,  entryOp: '<',  entryVal: '0',   exitOp: '>',  exitVal: '0',   hint: 'preço cruza abaixo do VAL (suporte rompido) · acima (compra)',     params: (_p: number) => ({}),            key: (_p: number) => `VP_VAL_CROSS` },
] as const;

type OscillatorId = typeof OSCILLATOR_INDICATORS[number]['id'];

interface StrategyIndicator {
  id: OscillatorId;
  period: number;
  entryOp: string;
  entryVal: string;
  exitOp: string;
  exitVal: string;
}

interface FormState {
  strategyType: BacktestStrategyType;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: string;
  brokerageRate: string;
  strategyId: string;
  strategyIndicators: StrategyIndicator[];
  entryLogic: 'AND' | 'OR';
  exitLogic: 'AND' | 'OR';
  vpPeriod: string;
}

const INITIAL_FORM: FormState = {
  strategyType: 'multi_indicator',
  timeframe: '1d',
  startDate: '2024-01-01',
  endDate: '2025-03-28',
  initialCapital: '10000',
  brokerageRate: '0.001',
  strategyId: '',
  strategyIndicators: [],
  entryLogic: 'AND',
  exitLogic: 'AND',
  vpPeriod: 'month',
};


const VP_CROSS_IDS = ['VP_POC_CROSS', 'VP_VAH_CROSS', 'VP_VAL_CROSS'] as string[];
const VP_PERIODS = [
  { value: 'week',    label: 'Sem' },
  { value: 'month',   label: 'Mês' },
  { value: 'quarter', label: 'Trim' },
  { value: 'year',    label: 'Ano' },
  { value: 'full',    label: 'Tudo' },
];

// ─── Multi-indicator strategy builder ────────────────────────────────────────
function MultiIndicatorBuilder({
  value, entryLogic, exitLogic, vpPeriod, onChange, onLogicChange, onVpPeriodChange,
}: {
  value: StrategyIndicator[];
  entryLogic: 'AND' | 'OR';
  exitLogic: 'AND' | 'OR';
  vpPeriod: string;
  onChange: (v: StrategyIndicator[]) => void;
  onLogicChange: (entry: 'AND' | 'OR', exit: 'AND' | 'OR') => void;
  onVpPeriodChange: (p: string) => void;
}) {
  const toggle = (def: typeof OSCILLATOR_INDICATORS[number]) => {
    if (value.some((v) => v.id === def.id)) {
      onChange(value.filter((v) => v.id !== def.id));
    } else {
      onChange([...value, { id: def.id, period: def.defaultPeriod, entryOp: def.entryOp, entryVal: def.entryVal, exitOp: def.exitOp, exitVal: def.exitVal }]);
    }
  };
  const update = (id: OscillatorId, patch: Partial<StrategyIndicator>) =>
    onChange(value.map((v) => v.id === id ? { ...v, ...patch } : v));

  const OPS = ['<', '<=', '>', '>=', '='];
  const showPeriod = (id: OscillatorId) =>
    !(['MACD', 'OBV', 'VWAP_CROSS', 'VP_POC_CROSS', 'VP_VAH_CROSS', 'VP_VAL_CROSS'] as string[]).includes(id);
  // Crossover indicators have implicit fixed conditions (> 0 = above, < 0 = below)
  const isCrossover = (id: OscillatorId) =>
    (['SMA_CROSS', 'VWAP_CROSS', 'VP_POC_CROSS', 'VP_VAH_CROSS', 'VP_VAL_CROSS'] as string[]).includes(id);

  const hasVpCross = value.some((v) => VP_CROSS_IDS.includes(v.id));

  return (
    <div className="space-y-3">
      {/* Picker */}
      <div className="flex flex-wrap gap-1.5">
        {OSCILLATOR_INDICATORS.map((def) => {
          const active = value.some((v) => v.id === def.id);
          return (
            <button key={def.id} type="button" onClick={() => toggle(def)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${active
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
            >
              {active ? '✓ ' : '+ '}{def.label}
            </button>
          );
        })}
      </div>

      {/* VP period selector — shown when any VP cross indicator is active */}
      {hasVpCross && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/20 border border-amber-800/40 rounded-lg">
          <span className="text-[11px] text-amber-400/80 font-medium whitespace-nowrap">Período VP:</span>
          <div className="flex gap-1">
            {VP_PERIODS.map((p) => (
              <button key={p.value} type="button" onClick={() => onVpPeriodChange(p.value)}
                className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${vpPeriod === p.value
                  ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-gray-600 italic">janela de cálculo do Volume Profile</span>
        </div>
      )}

      {/* Cards per indicator */}
      {value.map((si) => {
        const def = OSCILLATOR_INDICATORS.find((d) => d.id === si.id)!;
        return (
          <div key={si.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-200">{def.label}</span>
              <div className="flex items-center gap-2">
                {showPeriod(si.id) && (
                  <>
                    <span className="text-xs text-gray-500">Período</span>
                    <input type="number" min={2} value={si.period}
                      onChange={(e) => update(si.id, { period: Number(e.target.value) })}
                      className="w-14 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-100 text-center"
                    />
                  </>
                )}
                <button type="button" onClick={() => toggle(def)}
                  className="text-gray-600 hover:text-red-400 text-sm leading-none ml-1">✕</button>
              </div>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-gray-600 italic">{def.hint}</p>

            {/* Conditions row — hidden for crossover indicators (logic is always close vs line) */}
            {isCrossover(si.id) && (
              <p className="text-[10px] text-blue-400/70 italic">
                {VP_CROSS_IDS.includes(si.id)
                  ? `Compra quando preço cruza acima do nível VP · Venda quando cruza abaixo · Período: ${vpPeriod}`
                  : 'Compra quando o preço cruza acima · Venda quando cruza abaixo'}
              </p>
            )}
            {!isCrossover(si.id) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-green-500 uppercase font-medium">Entrada (compra)</p>
                  <div className="flex gap-1">
                    <select value={si.entryOp} onChange={(e) => update(si.id, { entryOp: e.target.value })}
                      className="bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-gray-100 w-14">
                      {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input type="number" value={si.entryVal}
                      onChange={(e) => update(si.id, { entryVal: e.target.value })}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 min-w-0"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-red-500 uppercase font-medium">Saída (venda)</p>
                  <div className="flex gap-1">
                    <select value={si.exitOp} onChange={(e) => update(si.id, { exitOp: e.target.value })}
                      className="bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-gray-100 w-14">
                      {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input type="number" value={si.exitVal}
                      onChange={(e) => update(si.id, { exitVal: e.target.value })}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 min-w-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Logic toggles — only show when 2+ indicators */}
      {value.length >= 2 && (
        <div className="flex gap-4 pt-1">
          {(['entry', 'exit'] as const).map((side) => {
            const logic = side === 'entry' ? entryLogic : exitLogic;
            return (
              <div key={side} className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">{side === 'entry' ? 'Entrada' : 'Saída'}:</span>
                {(['AND', 'OR'] as const).map((l) => (
                  <button key={l} type="button"
                    onClick={() => onLogicChange(side === 'entry' ? l : entryLogic, side === 'exit' ? l : exitLogic)}
                    className={`px-2.5 py-0.5 text-xs rounded border transition-colors ${logic === l
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                  >{l}</button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-gray-600 italic">Selecione ao menos um indicador acima.</p>
      )}
    </div>
  );
}

// ─── Ticker tag input ─────────────────────────────────────────────────────────
function TickerTagInput({
  tickers,
  onChange,
}: {
  tickers: string[];
  onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.toUpperCase().trim())
      .filter((s) => s && !tickers.includes(s));
    if (tickers.length + parts.length > 10) {
      toast.error('Maximum 10 tickers at once');
      return;
    }
    if (parts.length) onChange([...tickers, ...parts]);
    setInput('');
  };

  const remove = (ticker: string) => onChange(tickers.filter((t) => t !== ticker));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key)) {
      e.preventDefault();
      if (input.trim()) add(input);
    } else if (e.key === 'Backspace' && !input && tickers.length) {
      remove(tickers[tickers.length - 1]);
    }
  };

  return (
    <div
      className="min-h-[42px] w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tickers.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 bg-blue-600/30 text-blue-300 text-xs font-mono px-2 py-0.5 rounded"
        >
          {t}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(t); }}
            className="text-blue-400 hover:text-white leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-gray-100 uppercase placeholder-gray-500"
        placeholder={tickers.length === 0 ? 'AAPL, MSFT… (Enter or comma to add)' : ''}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) add(input); }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BacktestList() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<BacktestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [tickers, setTickers] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const jobsData = await backtestingService.list();
      setJobs(jobsData);
    } catch {
      toast.error('Failed to load backtests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [jobs, load]);

  const buildParams = (f: FormState): Record<string, unknown> => {
    const entry_conditions = f.strategyIndicators.map((si) => {
      const def = OSCILLATOR_INDICATORS.find((d) => d.id === si.id)!;
      return { indicator: def.key(si.period), operator: si.entryOp, value: Number(si.entryVal) };
    });
    const exit_conditions = f.strategyIndicators.map((si) => {
      const def = OSCILLATOR_INDICATORS.find((d) => d.id === si.id)!;
      return { indicator: def.key(si.period), operator: si.exitOp, value: Number(si.exitVal) };
    });
    return { entry_conditions, exit_conditions, entry_logic: f.entryLogic, exit_logic: f.exitLogic };
  };

  const handleCreate = async () => {
    if (!tickers.length) return toast.error('Add at least one ticker');
    if (!form.strategyIndicators.length) return toast.error('Selecione ao menos um indicador');
    setSubmitting(true);
    try {
      const indicatorList = form.strategyIndicators.map((si) => {
        const def = OSCILLATOR_INDICATORS.find((d) => d.id === si.id)!;
        const baseParams = def.params(si.period);
        const params = VP_CROSS_IDS.includes(si.id)
          ? { ...baseParams, period: form.vpPeriod }
          : baseParams;
        return { name: si.id, params };
      });

      const payload: CreateBacktestPayload = {
        symbols: tickers,
        strategyType: form.strategyType,
        strategyParams: buildParams(form),
        startDate: form.startDate,
        endDate: form.endDate,
        initialCapital: Number(form.initialCapital),
        brokerageRate: Number(form.brokerageRate),
        timeframe: form.timeframe,
        strategyId: form.strategyId || undefined,
        indicators: indicatorList.length > 0 ? indicatorList : undefined,
      };
      const created = await backtestingService.create(payload);
      toast.success(
        created.length === 1
          ? 'Backtest queued!'
          : `${created.length} backtests queued!`,
      );
      setShowCreate(false);
      setForm(INITIAL_FORM);
      setTickers([]);
      load();
    } catch {
      toast.error('Failed to create backtest');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this backtest?')) return;
    try {
      await backtestingService.remove(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Backtests</h1>
          <p className="text-sm text-gray-400 mt-1">Test strategies against historical data</p>
        </div>
        <div className="flex gap-2">
          {compareIds.length >= 2 && (
            <Button variant="secondary" onClick={() => navigate(`/backtests/compare?ids=${compareIds.join(',')}`)}>
              Compare ({compareIds.length})
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}>New Backtest</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-400">No backtests yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Strategy</th>
                <th className="px-4 py-3">Indicadores</th>
                <th className="px-4 py-3">Timeframe</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Capital</th>
                <th className="px-4 py-3">Return</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    {job.status === 'completed' && (
                      <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={compareIds.includes(job.id)}
                        onChange={() => toggleCompare(job.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-100">{job.symbol}</td>
                  <td className="px-4 py-3 text-gray-300">{STRATEGY_LABELS[job.strategyType]}</td>
                  <td className="px-4 py-3">
                    {job.indicators?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {job.indicators.slice(0, 5).map((ind, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-blue-600/15 text-blue-300 border border-blue-800/50">
                            {formatIndicatorTag(ind)}
                          </span>
                        ))}
                        {job.indicators.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-gray-800 text-gray-500 border border-gray-700">
                            +{job.indicators.length - 5}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-300 border border-gray-700">
                      {job.timeframe ?? '1d'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {job.startDate} → {job.endDate}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    ${Number(job.initialCapital).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {job.results ? (
                      <span className={job.results.metrics.totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {job.results.metrics.totalReturnPct >= 0 ? '+' : ''}
                        {job.results.metrics.totalReturnPct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2 justify-end">
                    {job.status === 'completed' && (
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/backtests/${job.id}`)}>
                        View
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(job.id)}>
                      Del
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setTickers([]); setForm(INITIAL_FORM); }} title="Novo Backtest">
        <div className="space-y-4">

          {/* Tickers */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Tickers <span className="text-gray-600">(máx. 10 — Enter ou vírgula)</span>
            </label>
            <TickerTagInput tickers={tickers} onChange={setTickers} />
          </div>

          {/* Timeframe + Datas */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data início</label>
              <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data fim</label>
              <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>

          {/* Capital + Corretagem */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Capital inicial ($)</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.initialCapital} onChange={(e) => setForm({ ...form, initialCapital: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Taxa corretagem</label>
              <input type="number" step="0.0001" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.brokerageRate} onChange={(e) => setForm({ ...form, brokerageRate: e.target.value })} />
            </div>
          </div>

          {/* Indicadores */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Indicadores da estratégia</label>
            <MultiIndicatorBuilder
              value={form.strategyIndicators}
              entryLogic={form.entryLogic}
              exitLogic={form.exitLogic}
              vpPeriod={form.vpPeriod}
              onChange={(strategyIndicators) => setForm({ ...form, strategyIndicators })}
              onLogicChange={(entryLogic, exitLogic) => setForm({ ...form, entryLogic, exitLogic })}
              onVpPeriodChange={(vpPeriod) => setForm({ ...form, vpPeriod })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setTickers([]); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button
              isLoading={submitting}
              disabled={!tickers.length || !form.strategyIndicators.length}
              onClick={handleCreate}
            >
              {tickers.length > 1 ? `Rodar ${tickers.length} Backtests` : 'Rodar Backtest'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
