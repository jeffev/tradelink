import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dcaService, type CreateDCAPayload } from '@/services/dca.service';
import type { DCAJob } from '@/types';
import Modal from '@/components/UI/Modal';
import Button from '@/components/UI/Button';

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-400/10',
  running:   'text-blue-400 bg-blue-400/10',
  completed: 'text-green-400 bg-green-400/10',
  failed:    'text-red-400 bg-red-400/10',
};

const PERIOD_LABELS: Record<string, string> = {
  weekly:    'Semanal',
  biweekly:  'Quinzenal',
  monthly:   'Mensal',
  quarterly: 'Trimestral',
};

// ── Oscillators for conditional DCA ──────────────────────────────────────────
const COND_INDICATORS = [
  { id: 'RSI',        label: 'RSI',         defaultPeriod: 14, defaultOp: '<',  defaultVal: '40',  params: (p: number) => ({ period: p }),                    key: (p: number) => `RSI_${p}` },
  { id: 'STOCH',      label: 'Stochastic',  defaultPeriod: 14, defaultOp: '<',  defaultVal: '25',  params: (p: number) => ({ k_period: p, d_period: 3 }),     key: (p: number) => `STOCH_${p}_3` },
  { id: 'CCI',        label: 'CCI',         defaultPeriod: 20, defaultOp: '<',  defaultVal: '-80', params: (p: number) => ({ period: p }),                    key: (p: number) => `CCI_${p}` },
  { id: 'WILLIAMS_R', label: 'Williams %R', defaultPeriod: 14, defaultOp: '<',  defaultVal: '-70', params: (p: number) => ({ period: p }),                    key: (p: number) => `WILLIAMS_R_${p}` },
] as const;

type CondIndId = typeof COND_INDICATORS[number]['id'];

interface CondIndicator {
  id: CondIndId;
  period: number;
  operator: string;
  value: string;
}

interface FormState {
  symbol: string;
  startDate: string;
  endDate: string;
  amountPerPeriod: string;
  period: string;
  dayOfMonth: string;
  condIndicators: CondIndicator[];
  condLogic: 'AND' | 'OR';
}

const INITIAL_FORM: FormState = {
  symbol: '',
  startDate: '2020-01-01',
  endDate: '2025-03-28',
  amountPerPeriod: '500',
  period: 'monthly',
  dayOfMonth: '1',
  condIndicators: [],
  condLogic: 'AND',
};

function ConditionBuilder({
  value, logic, onChange, onLogicChange,
}: {
  value: CondIndicator[];
  logic: 'AND' | 'OR';
  onChange: (v: CondIndicator[]) => void;
  onLogicChange: (l: 'AND' | 'OR') => void;
}) {
  const toggle = (def: typeof COND_INDICATORS[number]) => {
    if (value.some((v) => v.id === def.id)) {
      onChange(value.filter((v) => v.id !== def.id));
    } else {
      onChange([...value, { id: def.id, period: def.defaultPeriod, operator: def.defaultOp, value: def.defaultVal }]);
    }
  };
  const update = (id: CondIndId, patch: Partial<CondIndicator>) =>
    onChange(value.map((v) => v.id === id ? { ...v, ...patch } : v));

  const OPS = ['<', '<=', '>', '>='];

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Opcional: aportar somente quando indicador estiver numa condição (ex: RSI &lt; 40 = compra na queda)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {COND_INDICATORS.map((def) => {
          const active = value.some((v) => v.id === def.id);
          return (
            <button key={def.id} type="button" onClick={() => toggle(def)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${active
                ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
            >
              {active ? '✓ ' : '+ '}{def.label}
            </button>
          );
        })}
      </div>

      {value.map((ci) => {
        const def = COND_INDICATORS.find((d) => d.id === ci.id)!;
        return (
          <div key={ci.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-200">{def.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Período</span>
                <input type="number" min={2} value={ci.period}
                  onChange={(e) => update(ci.id, { period: Number(e.target.value) })}
                  className="w-14 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-100 text-center"
                />
                <button type="button" onClick={() => toggle(def)}
                  className="text-gray-600 hover:text-red-400 text-sm leading-none">✕</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Aportar quando</span>
              <select value={ci.operator} onChange={(e) => update(ci.id, { operator: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-gray-100 w-14">
                {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <input type="number" value={ci.value}
                onChange={(e) => update(ci.id, { value: e.target.value })}
                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100"
              />
            </div>
          </div>
        );
      })}

      {value.length >= 2 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Lógica:</span>
          {(['AND', 'OR'] as const).map((l) => (
            <button key={l} type="button" onClick={() => onLogicChange(l)}
              className={`px-2.5 py-0.5 text-xs rounded border transition-colors ${logic === l
                ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
            >{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DCAList() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<DCAJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const load = useCallback(async () => {
    try {
      setJobs(await dcaService.list());
    } catch {
      toast.error('Falha ao carregar simulações DCA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [jobs, load]);

  const handleCreate = async () => {
    if (!form.symbol.trim()) return toast.error('Informe o ticker');
    setSubmitting(true);
    try {
      const hasConditions = form.condIndicators.length > 0;
      const conditions = hasConditions
        ? form.condIndicators.map((ci) => {
            const def = COND_INDICATORS.find((d) => d.id === ci.id)!;
            return { indicator: def.key(ci.period), operator: ci.operator, value: Number(ci.value) };
          })
        : undefined;
      const indicators = hasConditions
        ? form.condIndicators.map((ci) => {
            const def = COND_INDICATORS.find((d) => d.id === ci.id)!;
            return { name: ci.id, params: def.params(ci.period) as Record<string, unknown> };
          })
        : undefined;

      const payload: CreateDCAPayload = {
        symbol: form.symbol.toUpperCase().trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        amountPerPeriod: Number(form.amountPerPeriod),
        period: form.period,
        dayOfMonth: Number(form.dayOfMonth),
        conditions,
        conditionLogic: hasConditions ? form.condLogic : undefined,
        indicators,
      };
      await dcaService.create(payload);
      toast.success('Simulação DCA em fila!');
      setShowCreate(false);
      setForm(INITIAL_FORM);
      load();
    } catch {
      toast.error('Falha ao criar simulação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir simulação?')) return;
    try {
      await dcaService.remove(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success('Excluído');
    } catch {
      toast.error('Falha ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">DCA & Aportes</h1>
          <p className="text-sm text-gray-400 mt-1">Compare estratégias de aporte periódico vs Lump Sum</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Nova Simulação</Button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Carregando...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-400 mb-2">Nenhuma simulação ainda.</p>
          <p className="text-sm text-gray-600">Crie uma para comparar DCA vs Lump Sum.</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-3">Ticker</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Aporte</th>
                <th className="px-4 py-3">Intervalo</th>
                <th className="px-4 py-3">Condicional</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-100">{job.symbol}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{job.startDate} → {job.endDate}</td>
                  <td className="px-4 py-3 text-gray-300">${Number(job.amountPerPeriod).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-300 border border-gray-700">
                      {PERIOD_LABELS[job.period] ?? job.period}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {job.conditions?.length ? `${job.conditions.length} condição(ões)` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2 justify-end">
                    {job.status === 'completed' && (
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/dca/${job.id}`)}>
                        Ver
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(job.id)}>Del</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setForm(INITIAL_FORM); }} title="Nova Simulação DCA">
        <div className="space-y-4">

          {/* Ticker */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ticker</label>
            <input
              type="text"
              placeholder="AAPL, MSFT, BTC-USD…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 uppercase placeholder-gray-500"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
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

          {/* Aporte + Frequência + Dia */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Aporte ($)</label>
              <input type="number" min={1} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.amountPerPeriod} onChange={(e) => setForm({ ...form, amountPerPeriod: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Frequência</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
              </select>
            </div>
            {(form.period === 'monthly' || form.period === 'quarterly') && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Dia do mês</label>
                <input type="number" min={1} max={28} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                  value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
              </div>
            )}
          </div>

          {/* Condicional */}
          <div className="border-t border-gray-800 pt-4">
            <label className="block text-xs text-gray-400 mb-2">Condição de aporte (opcional)</label>
            <ConditionBuilder
              value={form.condIndicators}
              logic={form.condLogic}
              onChange={(condIndicators) => setForm({ ...form, condIndicators })}
              onLogicChange={(condLogic) => setForm({ ...form, condLogic })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button
              isLoading={submitting}
              disabled={!form.symbol.trim() || !form.amountPerPeriod || Number(form.amountPerPeriod) <= 0}
              onClick={handleCreate}
            >
              Simular
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
