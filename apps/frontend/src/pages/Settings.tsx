import { useEffect, useState } from 'react';
import { settingsService, type AppSettings, type UpdateSettingsPayload } from '@/services/settings.service';
import Button from '@/components/UI/Button';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';

const CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP'];
const TIMEZONES = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
];

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [form, setForm] = useState<UpdateSettingsPayload>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.get()
      .then((data) => {
        setSettings(data);
        setForm({
          initialCapital: data.initialCapital,
          defaultBrokerage: data.defaultBrokerage,
          currency: data.currency,
          timezone: data.timezone,
        });
      })
      .catch(() => toast.error('Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await settingsService.update(form);
      setSettings(updated);
      toast.success('Configurações salvas!');
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      const msg = error.response?.data?.message ?? 'Erro ao salvar configurações';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>;

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Configurações</h2>
        <p className="text-sm text-gray-400 mt-0.5">Preferências da sua conta de trading</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Trading */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-white">Trading</h3>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Capital Inicial (referência)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                {form.currency ?? settings?.currency ?? 'USD'}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.initialCapital ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, initialCapital: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-14 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Usado para calcular retorno % sobre capital</p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Corretagem Padrão (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.0001"
              value={form.defaultBrokerage ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, defaultBrokerage: Number(e.target.value) }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="ex: 0.0025 (0.25%)"
            />
            <p className="text-xs text-gray-500 mt-1">Aplicado automaticamente ao calcular resultado líquido</p>
          </div>
        </div>

        {/* Locale */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-white">Regional</h3>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Moeda</label>
            <select
              value={form.currency ?? settings?.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Fuso Horário</label>
            <select
              value={form.timezone ?? settings?.timezone}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={saving}>Salvar Configurações</Button>
        </div>
      </form>
    </div>
  );
}
