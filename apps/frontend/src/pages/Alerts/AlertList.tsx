import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { alertsService } from '@/services/alerts.service';
import type { PriceAlert, CreateAlertPayload, AlertType, AlertCondition } from '@/services/alerts.service';

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  PRICE: 'Preço',
  RSI: 'RSI',
  SMA_CROSS: 'SMA Cruzamento',
  EMA_CROSS: 'EMA Cruzamento',
  MACD_CROSS: 'MACD Cruzamento',
  BB_BREAKOUT: 'BB Rompimento',
};

const CONDITION_LABELS: Record<AlertCondition, string> = {
  ABOVE: 'Acima de',
  BELOW: 'Abaixo de',
  CROSSES_ABOVE: 'Cruza acima de',
  CROSSES_BELOW: 'Cruza abaixo de',
};

const ALERT_TYPES: AlertType[] = ['PRICE', 'RSI', 'SMA_CROSS', 'EMA_CROSS'];
const CONDITIONS: AlertCondition[] = ['ABOVE', 'BELOW', 'CROSSES_ABOVE', 'CROSSES_BELOW'];

const empty: CreateAlertPayload = {
  symbol: '',
  alertType: 'PRICE',
  condition: 'ABOVE',
  value: 0,
  params: {},
};

export default function AlertList() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState<CreateAlertPayload>(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    alertsService.list()
      .then(setAlerts)
      .catch(() => toast.error('Erro ao carregar alertas'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!form.symbol.trim()) return toast.error('Símbolo obrigatório');
    if (!form.value) return toast.error('Valor obrigatório');
    setSaving(true);
    try {
      const alert = await alertsService.create({ ...form, symbol: form.symbol.toUpperCase() });
      setAlerts((prev) => [alert, ...prev]);
      setForm(empty);
      setShowForm(false);
      toast.success('Alerta criado');
    } catch {
      toast.error('Erro ao criar alerta');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este alerta?')) return;
    try {
      await alertsService.remove(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success('Alerta removido');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function handleToggle(a: PriceAlert) {
    try {
      const updated = await alertsService.update(a.id, { isActive: !a.isActive });
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const { triggered, checked } = await alertsService.check();
      if (triggered.length > 0) {
        setAlerts((prev) =>
          prev.map((a) => {
            const t = triggered.find((tr) => tr.id === a.id);
            return t ? t : a;
          }),
        );
        toast.success(`${triggered.length} alerta${triggered.length !== 1 ? 's' : ''} disparado${triggered.length !== 1 ? 's' : ''}!`);
      } else {
        toast.success(`${checked} alerta${checked !== 1 ? 's' : ''} verificado${checked !== 1 ? 's' : ''} — nenhum disparado`);
      }
    } catch {
      toast.error('Erro ao verificar alertas');
    } finally {
      setChecking(false);
    }
  }

  function defaultParamsForType(type: AlertType): Record<string, any> {
    switch (type) {
      case 'RSI': return { period: 14 };
      case 'SMA_CROSS': return { period: 20 };
      case 'EMA_CROSS': return { period: 20 };
      default: return {};
    }
  }

  const active = alerts.filter((a) => a.isActive && !a.isTriggered);
  const triggered = alerts.filter((a) => a.isTriggered);
  const inactive = alerts.filter((a) => !a.isActive && !a.isTriggered);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Alertas</h1>
          <p className="text-sm text-gray-400 mt-1">Monitore preços e indicadores técnicos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            {checking ? 'Verificando...' : 'Verificar Agora'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Novo Alerta
          </button>
        </div>
      </div>

      {/* New alert form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-blue-800 p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Novo Alerta</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Símbolo *</label>
              <input
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                placeholder="AAPL"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tipo</label>
              <select
                value={form.alertType}
                onChange={(e) => setForm({ ...form, alertType: e.target.value as AlertType, params: defaultParamsForType(e.target.value as AlertType) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                {ALERT_TYPES.map((t) => (
                  <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Condição</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as AlertCondition })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Valor *</label>
              <input
                type="number"
                value={form.value || ''}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                placeholder="Ex: 150.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Params for non-price indicators */}
          {form.alertType !== 'PRICE' && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(form.params ?? {}).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{key}:</span>
                  <input
                    type="number"
                    value={val as number}
                    onChange={(e) => setForm({ ...form, params: { ...form.params, [key]: parseFloat(e.target.value) || 1 } })}
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Criando...' : 'Criar Alerta'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(empty); }}
              className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Carregando...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-400">Nenhum alerta configurado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {triggered.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-yellow-400 mb-2">Disparados</h2>
              <AlertTable alerts={triggered} onDelete={handleDelete} onToggle={handleToggle} />
            </div>
          )}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-green-400 mb-2">Ativos ({active.length})</h2>
              <AlertTable alerts={active} onDelete={handleDelete} onToggle={handleToggle} />
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Inativos ({inactive.length})</h2>
              <AlertTable alerts={inactive} onDelete={handleDelete} onToggle={handleToggle} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertTable({
  alerts,
  onDelete,
  onToggle,
}: {
  alerts: PriceAlert[];
  onDelete: (id: string) => void;
  onToggle: (a: PriceAlert) => void;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left p-3 text-xs text-gray-400 font-medium">Símbolo</th>
            <th className="text-left p-3 text-xs text-gray-400 font-medium">Tipo</th>
            <th className="text-left p-3 text-xs text-gray-400 font-medium">Condição</th>
            <th className="text-left p-3 text-xs text-gray-400 font-medium">Valor</th>
            <th className="text-left p-3 text-xs text-gray-400 font-medium">Status</th>
            <th className="text-left p-3 text-xs text-gray-400 font-medium">Criado</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="p-3 font-mono font-semibold text-gray-100">{a.symbol}</td>
              <td className="p-3 text-gray-300">{ALERT_TYPE_LABELS[a.alertType]}</td>
              <td className="p-3 text-gray-400">{CONDITION_LABELS[a.condition]}</td>
              <td className="p-3 text-gray-300">{a.value}</td>
              <td className="p-3">
                {a.isTriggered ? (
                  <span className="text-xs bg-yellow-900/30 border border-yellow-700 text-yellow-400 px-2 py-0.5 rounded-full">
                    Disparado
                  </span>
                ) : a.isActive ? (
                  <span className="text-xs bg-green-900/30 border border-green-700 text-green-400 px-2 py-0.5 rounded-full">
                    Ativo
                  </span>
                ) : (
                  <span className="text-xs bg-gray-800 border border-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                    Inativo
                  </span>
                )}
              </td>
              <td className="p-3 text-xs text-gray-500">
                {new Date(a.createdAt).toLocaleDateString('pt-BR')}
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {!a.isTriggered && (
                    <button
                      onClick={() => onToggle(a)}
                      className="text-xs text-gray-400 hover:text-gray-200"
                    >
                      {a.isActive ? 'Pausar' : 'Ativar'}
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remover
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
