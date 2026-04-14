import { useEffect, useState } from 'react';
import { strategiesService, type CreateStrategyPayload, type UpdateStrategyPayload } from '@/services/strategies.service';
import type { Strategy, StrategyType } from '@/types';
import Modal from '@/components/UI/Modal';
import Button from '@/components/UI/Button';
import { formatDate } from '@/utils/format';
import toast from 'react-hot-toast';

const STRATEGY_TYPES: { value: StrategyType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'trend_following', label: 'Trend Following' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'breakout', label: 'Breakout' },
  { value: 'scalping', label: 'Scalping' },
  { value: 'other', label: 'Outro' },
];

export default function StrategyList() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emptyForm: CreateStrategyPayload = { name: '', description: '', type: 'manual' };
  const [form, setForm] = useState<CreateStrategyPayload>(emptyForm);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setStrategies(await strategiesService.getAll());
    } catch {
      toast.error('Erro ao carregar estratégias');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const strategy = await strategiesService.create({ ...form, description: form.description || undefined });
      setStrategies((prev) => [strategy, ...prev]);
      setShowCreate(false);
      setForm(emptyForm);
      toast.success('Estratégia criada!');
    } catch {
      toast.error('Erro ao criar estratégia');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      const payload: UpdateStrategyPayload = { name: form.name, description: form.description, type: form.type };
      const updated = await strategiesService.update(editing.id, payload);
      setStrategies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditing(null);
      toast.success('Estratégia atualizada!');
    } catch {
      toast.error('Erro ao atualizar estratégia');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(strategy: Strategy) {
    try {
      const updated = await strategiesService.update(strategy.id, { isActive: !strategy.isActive });
      setStrategies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta estratégia?')) return;
    try {
      await strategiesService.remove(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      toast.success('Estratégia removida');
    } catch {
      toast.error('Erro ao remover estratégia');
    }
  }

  function openEdit(strategy: Strategy) {
    setEditing(strategy);
    setForm({ name: strategy.name, description: strategy.description ?? '', type: strategy.type });
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Estratégias</h2>
          <p className="text-sm text-gray-400 mt-0.5">{strategies.length} estratégia(s)</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }}>+ Nova Estratégia</Button>
      </div>

      {strategies.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">Nenhuma estratégia criada ainda.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Criar primeira estratégia</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <div key={strategy.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{strategy.name}</h3>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{strategy.type.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={() => handleToggle(strategy)}
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${strategy.isActive ? 'bg-green-900/50 text-green-400 hover:bg-green-900' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                >
                  {strategy.isActive ? 'Ativa' : 'Inativa'}
                </button>
              </div>
              {strategy.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{strategy.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-500">{formatDate(strategy.createdAt)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(strategy)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(strategy.id)}>✕</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showCreate || !!editing}
        onClose={() => { setShowCreate(false); setEditing(null); }}
        title={editing ? 'Editar Estratégia' : 'Nova Estratégia'}
      >
        <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nome</label>
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="Minha Estratégia"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as StrategyType }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {STRATEGY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Descrição (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Descreva sua estratégia..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setEditing(null); }}>Cancelar</Button>
            <Button type="submit" isLoading={submitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
