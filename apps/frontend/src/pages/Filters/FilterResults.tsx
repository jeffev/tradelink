import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { filtersService } from '@/services/filters.service';
import type { Filter, FilterResult } from '@/services/filters.service';

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT'];

export default function FilterResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [results, setResults] = useState<FilterResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS.join(', '));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      filtersService.get(id),
      filtersService.getResults(id),
    ])
      .then(([f, r]) => {
        setFilter(f);
        setResults(r);
      })
      .catch(() => toast.error('Erro ao carregar filtro'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleScan() {
    if (!id) return;
    const symbolList = symbols.split(/[\s,]+/).filter(Boolean).map((s) => s.toUpperCase());
    if (!symbolList.length) return toast.error('Informe pelo menos um símbolo');
    setScanning(true);
    try {
      const res = await filtersService.runScan(id, { symbols: symbolList });
      setResults(res);
      const passed = res.filter((r) => r.passed).length;
      toast.success(`Scan concluído: ${passed}/${res.length} passaram`);
    } catch {
      toast.error('Erro no scanner');
    } finally {
      setScanning(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>;
  if (!filter) return <div className="text-gray-400 text-sm">Filtro não encontrado</div>;

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/filters')} className="text-gray-400 hover:text-gray-100 text-sm">
          ← Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{filter.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {filter.logic} • {filter.conditions.length} condição{filter.conditions.length !== 1 ? 'ões' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate(`/filters/${id}/edit`)}
          className="ml-auto text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
        >
          Editar Filtro
        </button>
      </div>

      {/* Conditions summary */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <p className="text-xs text-gray-400 mb-2">Condições ({filter.logic})</p>
        <div className="flex flex-wrap gap-2">
          {filter.conditions.map((c, i) => (
            <span key={i} className="text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded text-gray-300">
              {c.indicator}
              {Object.entries(c.params ?? {}).length > 0 && (
                <span className="text-gray-500 ml-1">
                  ({Object.entries(c.params ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')})
                </span>
              )}
              {' '}
              <span className="text-blue-400">{c.operator}</span>
              {' '}
              {c.value !== null && c.value !== undefined ? c.value : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Scanner control */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
        <p className="text-sm font-medium text-gray-300">Executar Scanner</p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Símbolos (separados por vírgula ou espaço)
          </label>
          <textarea
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {scanning ? 'Escaneando...' : 'Executar Scanner'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-100">{results.length}</p>
              <p className="text-xs text-gray-400 mt-1">Total Scaneados</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-green-900/50 p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{passed.length}</p>
              <p className="text-xs text-gray-400 mt-1">Passaram</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-red-900/50 p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{failed.length}</p>
              <p className="text-xs text-gray-400 mt-1">Não Passaram</p>
            </div>
          </div>

          {/* Passed symbols */}
          {passed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-green-400 mb-2">Passaram no Filtro</h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-3 text-xs text-gray-400 font-medium">Símbolo</th>
                      <th className="text-left p-3 text-xs text-gray-400 font-medium">Preço</th>
                      <th className="text-left p-3 text-xs text-gray-400 font-medium">Indicadores</th>
                      <th className="text-left p-3 text-xs text-gray-400 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passed.map((r) => (
                      <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-3 font-mono font-semibold text-green-400">{r.symbol}</td>
                        <td className="p-3 text-gray-300">
                          {r.indicatorValues?.price != null
                            ? `$${Number(r.indicatorValues.price).toFixed(2)}`
                            : '—'}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(r.indicatorValues ?? {})
                              .filter(([k]) => k !== 'price' && !k.includes('error'))
                              .slice(0, 4)
                              .map(([k, v]) => (
                                <span key={k} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                                  {k}: {typeof v === 'number' ? v.toFixed(2) : v}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-gray-500">
                          {new Date(r.scannedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Failed symbols (collapsed) */}
          {failed.length > 0 && (
            <details className="group">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-400 select-none">
                {failed.length} símbolo{failed.length !== 1 ? 's' : ''} não passou{failed.length !== 1 ? 'ram' : ''} ▾
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {failed.map((r) => (
                  <span
                    key={r.id}
                    title={r.indicatorValues?.error ?? ''}
                    className="text-xs bg-gray-900 border border-gray-700 text-gray-500 px-2 py-1 rounded font-mono"
                  >
                    {r.symbol}
                    {r.indicatorValues?.error && ' ⚠'}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
