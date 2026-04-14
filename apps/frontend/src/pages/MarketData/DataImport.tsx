import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { marketDataService } from '@/services/market-data.service';
import type { Ticker } from '@/types';
import Button from '@/components/UI/Button';

export default function DataImport() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);

  // Yahoo Finance fetch form
  const [fetchSymbol, setFetchSymbol] = useState('');
  const [fetchStart, setFetchStart] = useState('2022-01-01');
  const [fetchEnd, setFetchEnd] = useState('2023-12-31');
  const [fetchInterval, setFetchInterval] = useState('1d');
  const [fetching, setFetching] = useState(false);

  // CSV import form
  const [csvSymbol, setCsvSymbol] = useState('');
  const [csvInterval, setCsvInterval] = useState('1d');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTickers = useCallback(async () => {
    try {
      setTickers(await marketDataService.listTickers());
    } catch {
      toast.error('Failed to load tickers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickers(); }, [loadTickers]);

  const handleFetch = async () => {
    if (!fetchSymbol.trim()) return toast.error('Symbol is required');
    setFetching(true);
    try {
      const result = await marketDataService.fetchFromYahoo(
        fetchSymbol.trim().toUpperCase(),
        fetchStart,
        fetchEnd,
        fetchInterval,
      );
      toast.success(`Imported ${result.count} new candles`);
      loadTickers();
    } catch {
      toast.error('Failed to fetch data. Is the backtesting worker running?');
    } finally {
      setFetching(false);
    }
  };

  const handleImport = async () => {
    if (!csvSymbol.trim()) return toast.error('Symbol is required');
    if (!csvFile) return toast.error('Please select a CSV file');
    setImporting(true);
    try {
      const result = await marketDataService.importCsv(
        csvSymbol.trim().toUpperCase(),
        csvFile,
        csvInterval,
      );
      toast.success(`Imported ${result.count} new candles`);
      setCsvFile(null);
      setCsvSymbol('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadTickers();
    } catch {
      toast.error('Failed to import CSV. Check file format.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (symbol: string) => {
    if (!confirm(`Delete all data for ${symbol}?`)) return;
    try {
      await marketDataService.deleteTicker(symbol);
      toast.success(`Deleted ${symbol}`);
      loadTickers();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Market Data</h1>
        <p className="text-sm text-gray-400 mt-1">Import historical OHLCV data for backtesting</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fetch from Yahoo Finance */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">Fetch from Yahoo Finance</h2>
          <p className="text-xs text-gray-500">
            Requires the backtesting worker to be running (port 8000).
          </p>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Symbol *</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 uppercase"
              placeholder="AAPL"
              value={fetchSymbol}
              onChange={(e) => setFetchSymbol(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={fetchStart}
                onChange={(e) => setFetchStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                value={fetchEnd}
                onChange={(e) => setFetchEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Interval</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
              value={fetchInterval}
              onChange={(e) => setFetchInterval(e.target.value)}
            >
              <option value="1d">Daily (1d)</option>
              <option value="1h">Hourly (1h)</option>
              <option value="15m">15 Minutes (15m)</option>
            </select>
          </div>
          <Button isLoading={fetching} onClick={handleFetch} className="w-full">
            Fetch Data
          </Button>
        </div>

        {/* CSV Import */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">Import CSV</h2>
          <p className="text-xs text-gray-500">
            CSV must have columns: <code className="text-gray-400">timestamp, open, high, low, close, volume</code>
          </p>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Symbol *</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 uppercase"
              placeholder="AAPL"
              value={csvSymbol}
              onChange={(e) => setCsvSymbol(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Interval</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
              value={csvInterval}
              onChange={(e) => setCsvInterval(e.target.value)}
            >
              <option value="1d">Daily (1d)</option>
              <option value="1h">Hourly (1h)</option>
              <option value="15m">15 Minutes (15m)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">CSV File *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 file:cursor-pointer"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button isLoading={importing} onClick={handleImport} className="w-full">
            Import CSV
          </Button>
        </div>
      </div>

      {/* Ticker list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">
            Available Tickers ({tickers.length})
          </h2>
        </div>
        {loading ? (
          <p className="px-6 py-4 text-gray-400 text-sm">Loading...</p>
        ) : tickers.length === 0 ? (
          <p className="px-6 py-4 text-gray-500 text-sm">No tickers imported yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => (
                <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-2 font-mono font-semibold text-gray-100">{t.symbol}</td>
                  <td className="px-4 py-2 text-gray-300">{t.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-400">{t.assetType ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="danger" onClick={() => handleDelete(t.symbol)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
