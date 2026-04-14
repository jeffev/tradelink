import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { filtersService } from '@/services/filters.service';
import type { FilterCondition } from '@/services/filters.service';

const INDICATOR_OPTIONS = [
  { value: 'PRICE', label: 'Preço' },
  { value: 'SMA', label: 'SMA' },
  { value: 'EMA', label: 'EMA' },
  { value: 'RSI', label: 'RSI' },
  { value: 'MACD', label: 'MACD' },
  { value: 'BB_UPPER', label: 'Bollinger Superior' },
  { value: 'BB_LOWER', label: 'Bollinger Inferior' },
  { value: 'ATR', label: 'ATR' },
  { value: 'STOCH_K', label: 'Estocástico %K' },
];

const OPERATOR_OPTIONS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'crosses_above', label: 'Cruza acima de' },
  { value: 'crosses_below', label: 'Cruza abaixo de' },
  { value: 'price_above_sma', label: 'Preço acima da SMA' },
  { value: 'price_below_sma', label: 'Preço abaixo da SMA' },
  { value: 'price_above_ema', label: 'Preço acima da EMA' },
  { value: 'price_below_ema', label: 'Preço abaixo da EMA' },
];

function defaultParamsForIndicator(indicator: string): Record<string, any> {
  switch (indicator) {
    case 'SMA': return { period: 20 };
    case 'EMA': return { period: 20 };
    case 'RSI': return { period: 14 };
    case 'MACD': return { fast: 12, slow: 26, signal: 9 };
    case 'BB_UPPER':
    case 'BB_LOWER': return { period: 20, std: 2 };
    case 'ATR': return { period: 14 };
    case 'STOCH_K': return { k_period: 14, d_period: 3 };
    default: return {};
  }
}

function emptyCondition(): FilterCondition {
  return { id: crypto.randomUUID(), indicator: 'RSI', params: { period: 14 }, operator: 'lt', value: 30 };
}

export default function FilterBuilder() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<FilterCondition[]>([emptyCondition()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    filtersService.get(id).then((f) => {
      setName(f.name);
      setDescription(f.description ?? '');
      setLogic(f.logic as 'AND' | 'OR');
      setConditions(f.conditions.length ? f.conditions : [emptyCondition()]);
    }).catch(() => toast.error('Filtro não encontrado')).finally(() => setLoading(false));
  }, [id]);

  function addCondition() {
    setConditions((prev) => [...prev, emptyCondition()]);
  }

  function removeCondition(condId: string) {
    setConditions((prev) => prev.filter((c) => c.id !== condId));
  }

  function updateCondition(condId: string, updates: Partial<FilterCondition>) {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        const updated = { ...c, ...updates };
        // Reset params when indicator changes
        if ('indicator' in updates) {
          updated.params = defaultParamsForIndicator(updates.indicator!);
          updated.value = null;
        }
        return updated;
      }),
    );
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Nome é obrigatório');
    if (!conditions.length) return toast.error('Adicione pelo menos uma condição');
    setSaving(true);
    try {
      if (isEdit && id) {
        await filtersService.update(id, { name, description, conditions, logic });
        toast.success('Filtro atualizado');
      } else {
        const f = await filtersService.create({ name, description, conditions, logic });
        toast.success('Filtro criado');
        navigate(`/filters/${f.id}/results`);
        return;
      }
      navigate('/filters');
    } catch {
      toast.error('Erro ao salvar filtro');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/filters')} className="text-gray-400 hover:text-gray-100 text-sm">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-100">
          {isEdit ? 'Editar Filtro' : 'Novo Filtro'}
        </h1>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: RSI Oversold + Preço acima da SMA"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2">Lógica</label>
          <div className="flex gap-2">
            {(['AND', 'OR'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLogic(l)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  logic === l
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {l}
              </button>
            ))}
            <span className="text-xs text-gray-500 self-center ml-2">
              {logic === 'AND' ? 'Todas as condições devem ser verdadeiras' : 'Pelo menos uma condição deve ser verdadeira'}
            </span>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">Condições</h2>
          <button
            onClick={addCondition}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            + Adicionar condição
          </button>
        </div>

        {conditions.map((cond, idx) => (
          <div key={cond.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">Condição {idx + 1}</span>
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(cond.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Indicator */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Indicador</label>
                <select
                  value={cond.indicator}
                  onChange={(e) => updateCondition(cond.id, { indicator: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  {INDICATOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Operador</label>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  {OPERATOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valor</label>
                <input
                  type="number"
                  value={cond.value ?? ''}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Ex: 30"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Params (JSON summary) */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Parâmetros</label>
                <div className="text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 min-h-[32px]">
                  {Object.entries(cond.params ?? {}).map(([k, v]) => `${k}:${v}`).join(', ') || '—'}
                </div>
              </div>
            </div>

            {/* Inline param edit */}
            {Object.keys(cond.params ?? {}).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.entries(cond.params ?? {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">{key}:</span>
                    <input
                      type="number"
                      value={val as number}
                      onChange={(e) =>
                        updateCondition(cond.id, {
                          params: { ...cond.params, [key]: parseFloat(e.target.value) || 1 },
                        })
                      }
                      className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Filtro'}
        </button>
        <button
          onClick={() => navigate('/filters')}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
