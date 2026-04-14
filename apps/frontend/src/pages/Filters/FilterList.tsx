import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { filtersService } from '@/services/filters.service';
import type { Filter } from '@/services/filters.service';

export default function FilterList() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    filtersService.list()
      .then(setFilters)
      .catch(() => toast.error('Erro ao carregar filtros'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover filtro "${name}"?`)) return;
    try {
      await filtersService.remove(id);
      setFilters((prev) => prev.filter((f) => f.id !== id));
      toast.success('Filtro removido');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function handleToggleActive(f: Filter) {
    try {
      const updated = await filtersService.update(f.id, { isActive: !f.isActive });
      setFilters((prev) => prev.map((x) => (x.id === f.id ? updated : x)));
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Filtros de Mercado</h1>
          <p className="text-sm text-gray-400 mt-1">Crie filtros baseados em indicadores técnicos</p>
        </div>
        <button
          onClick={() => navigate('/filters/new')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Novo Filtro
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Carregando...</div>
      ) : filters.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-400">Nenhum filtro criado ainda.</p>
          <button
            onClick={() => navigate('/filters/new')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
          >
            Criar primeiro filtro
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((f) => (
            <div key={f.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-100">{f.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      f.isActive
                        ? 'bg-green-900/30 border-green-700 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}>
                      {f.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {f.logic} • {f.conditions.length} condição{f.conditions.length !== 1 ? 'ões' : ''}
                    </span>
                  </div>
                  {f.description && (
                    <p className="text-xs text-gray-500 mt-1">{f.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.conditions.map((c, i) => (
                      <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                        {c.indicator} {c.operator} {c.value ?? ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/filters/${f.id}/results`)}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Scanner
                  </button>
                  <button
                    onClick={() => navigate(`/filters/${f.id}/edit`)}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(f)}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                  >
                    {f.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(f.id, f.name)}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
