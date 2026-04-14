import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { indicatorsService } from '@/services/indicators.service';
import type { IndicatorConfig, CalculateIndicatorsResult } from '@/services/indicators.service';

const AVAILABLE_INDICATORS: Array<{
  name: string;
  label: string;
  defaultParams: Record<string, any>;
  type: 'overlay' | 'oscillator' | 'special';
}> = [
  { name: 'SMA', label: 'SMA', defaultParams: { period: 20 }, type: 'overlay' },
  { name: 'EMA', label: 'EMA', defaultParams: { period: 20 }, type: 'overlay' },
  { name: 'BB', label: 'Bollinger Bands', defaultParams: { period: 20, std: 2 }, type: 'overlay' },
  { name: 'VWAP', label: 'VWAP', defaultParams: {}, type: 'overlay' },
  { name: 'SAR', label: 'Parabolic SAR', defaultParams: { iaf: 0.02, max_af: 0.2 }, type: 'overlay' },
  { name: 'PIVOT_POINTS', label: 'Pivot Points', defaultParams: {}, type: 'overlay' },

  { name: 'RSI', label: 'RSI', defaultParams: { period: 14 }, type: 'oscillator' },
  { name: 'MACD', label: 'MACD', defaultParams: { fast: 12, slow: 26, signal: 9 }, type: 'oscillator' },
  { name: 'ATR', label: 'ATR', defaultParams: { period: 14 }, type: 'oscillator' },
  { name: 'STOCH', label: 'Stochastic', defaultParams: { k_period: 14, d_period: 3 }, type: 'oscillator' },
  { name: 'CCI', label: 'CCI', defaultParams: { period: 20 }, type: 'oscillator' },
  { name: 'ADX', label: 'ADX', defaultParams: { period: 14 }, type: 'oscillator' },
  { name: 'WILLIAMS_R', label: 'Williams %R', defaultParams: { period: 14 }, type: 'oscillator' },

  { name: 'OBV', label: 'OBV', defaultParams: {}, type: 'oscillator' },
  { name: 'ICHIMOKU', label: 'Ichimoku Cloud', defaultParams: {}, type: 'special' },
];

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a78bfa', '#f87171', '#34d399', '#fb923c'];

const today = new Date().toISOString().split('T')[0];
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function IndicatorChart() {
  const [symbol, setSymbol] = useState('AAPL');
  const [startDate, setStartDate] = useState(sixMonthsAgo);
  const [endDate, setEndDate] = useState(today);
  const [timeframe, setTimeframe] = useState('1d');
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorConfig[]>([
    { name: 'SMA', params: { period: 20 } },
    { name: 'RSI', params: { period: 14 } },
  ]);
  const [result, setResult] = useState<CalculateIndicatorsResult | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleIndicator(name: string, defaultParams: Record<string, any>) {
    setSelectedIndicators((prev) => {
      const exists = prev.find((i) => i.name === name);
      if (exists) return prev.filter((i) => i.name !== name);
      return [...prev, { name, params: defaultParams }];
    });
  }

  async function handleCalculate() {
    if (!symbol.trim()) return toast.error('Enter a symbol');
    if (!selectedIndicators.length) return toast.error('Select at least one indicator');
    setLoading(true);
    try {
      const data = await indicatorsService.calculate({
        symbol: symbol.toUpperCase(),
        indicators: selectedIndicators,
        startDate,
        endDate,
        timeframe,
      });
      setResult(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to calculate indicators');
    } finally {
      setLoading(false);
    }
  }

  const overlayKeys = result
    ? Object.keys(result.indicators).filter((k) => {
        const data = result.indicators[k];
        return data[0] && !('histogram' in data[0]) && !('signal' in data[0]) && !('tenkan' in data[0]) && !('pivot' in data[0]) && AVAILABLE_INDICATORS.find(
          (i) => k.startsWith(i.name.replace('_', '')) && i.type === 'overlay',
        );
      })
    : [];

  const oscillatorKeys = result
    ? Object.keys(result.indicators).filter((k) => {
        const data = result.indicators[k];
        if (!data[0]) return false;
        if ('histogram' in data[0]) return true;
        if ('signal' in data[0] && !('tenkan' in data[0])) return true;
        return AVAILABLE_INDICATORS.find(
          (i) => k.startsWith(i.name.replace('_', '')) && i.type === 'oscillator',
        );
      })
    : [];

  const specialKeys = result
    ? Object.keys(result.indicators).filter((k) => {
        const data = result.indicators[k];
        if (!data[0]) return false;
        return ('tenkan' in data[0]) || ('pivot' in data[0]);
      })
    : [];

  // Merge price + overlay indicators into one array for the price chart
  const priceChartData = result
    ? result.priceData.map((p) => {
        const row: Record<string, any> = { date: p.date, close: p.close };
        for (const key of overlayKeys) {
          const pt = result.indicators[key].find((x) => x.date === p.date);
          if (pt) {
            if ('upper' in pt) {
              // Bollinger Bands
              row[`${key}_upper`] = pt.upper;
              row[key] = pt.value;
              row[`${key}_lower`] = pt.lower;
            } else if ('r2' in pt) {
              // Pivot Points
              const pivot = pt as unknown as { r2: number; r1: number; pivot: number; s1: number; s2: number };
              row[`${key}_r2`] = pivot.r2;
              row[`${key}_r1`] = pivot.r1;
              row[key] = pivot.pivot;
              row[`${key}_s1`] = pivot.s1;
              row[`${key}_s2`] = pivot.s2;
            } else {
              // SMA, EMA, VWAP, SAR
              row[key] = pt.value;
            }
          }
        }
        return row;
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Indicadores Técnicos</h1>
        <p className="text-sm text-gray-400 mt-1">Calcule e visualize indicadores em qualquer ativo</p>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Símbolo</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="1d">Diário</option>
              <option value="1w">Semanal</option>
              <option value="1mo">Mensal</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-2">Indicadores</p>
          <div className="space-y-3">
            {/* Overlay Indicators */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-semibold">Overlay</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_INDICATORS.filter(i => i.type === 'overlay').map((ind) => {
                  const active = selectedIndicators.some((i) => i.name === ind.name);
                  return (
                    <button
                      key={ind.name}
                      onClick={() => toggleIndicator(ind.name, ind.defaultParams)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {ind.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Oscillator Indicators */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-semibold">Osciladores</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_INDICATORS.filter(i => i.type === 'oscillator').map((ind) => {
                  const active = selectedIndicators.some((i) => i.name === ind.name);
                  return (
                    <button
                      key={ind.name}
                      onClick={() => toggleIndicator(ind.name, ind.defaultParams)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {ind.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Indicators */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-semibold">Especiais</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_INDICATORS.filter(i => i.type === 'special').map((ind) => {
                  const active = selectedIndicators.some((i) => i.name === ind.name);
                  return (
                    <button
                      key={ind.name}
                      onClick={() => toggleIndicator(ind.name, ind.defaultParams)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {ind.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      {/* Price + Overlay chart */}
      {result && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-medium text-gray-300 mb-4">
              {result.symbol} — Preço {overlayKeys.length > 0 && `+ ${overlayKeys.join(', ')}`}
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={priceChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={65} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(v) => [`$${Number(v).toFixed(2)}`]}
                  />
                  <Legend formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>} />
                  <Line type="monotone" dataKey="close" stroke="#6b7280" strokeWidth={1.5} dot={false} name="Preço" legendType="none" />
                  {overlayKeys.map((key, i) => {
                    const isBB = key.startsWith('BB_');
                    const isPivot = key.startsWith('PIVOT');
                    if (isBB) {
                      return [
                        <Line key={`${key}_upper`} type="monotone" dataKey={`${key}_upper`} stroke={COLORS[i % COLORS.length]} strokeWidth={1} dot={false} name={`${key} Upper`} strokeDasharray="4 2" connectNulls />,
                        <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} name={`${key} Mid`} connectNulls />,
                        <Line key={`${key}_lower`} type="monotone" dataKey={`${key}_lower`} stroke={COLORS[i % COLORS.length]} strokeWidth={1} dot={false} name={`${key} Lower`} strokeDasharray="4 2" connectNulls />,
                      ];
                    }
                    if (isPivot) {
                      return [
                        <Line key={`${key}_r2`} type="monotone" dataKey={`${key}_r2`} stroke="#ef4444" strokeWidth={1} dot={false} name={`${key} R2`} strokeDasharray="3 3" connectNulls />,
                        <Line key={`${key}_r1`} type="monotone" dataKey={`${key}_r1`} stroke="#f97316" strokeWidth={1.5} dot={false} name={`${key} R1`} connectNulls />,
                        <Line key={key} type="monotone" dataKey={key} stroke="#eab308" strokeWidth={1.5} dot={false} name={`${key} Pivot`} connectNulls />,
                        <Line key={`${key}_s1`} type="monotone" dataKey={`${key}_s1`} stroke="#3b82f6" strokeWidth={1.5} dot={false} name={`${key} S1`} connectNulls />,
                        <Line key={`${key}_s2`} type="monotone" dataKey={`${key}_s2`} stroke="#10b981" strokeWidth={1} dot={false} name={`${key} S2`} strokeDasharray="3 3" connectNulls />,
                      ];
                    }
                    return (
                      <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} name={key} connectNulls />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Oscillator charts */}
          {oscillatorKeys.map((key, i) => {
            const data = result.indicators[key];
            const isMacd = data[0] && 'histogram' in data[0];
            const isStoch = data[0] && 'signal' in data[0] && !isMacd;

            return (
              <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h2 className="text-sm font-medium text-gray-300 mb-4">{key}</h2>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} width={50} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: '#9ca3af' }}
                      />
                      {/* RSI reference lines */}
                      {key.startsWith('RSI') && (
                        <>
                          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
                          <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
                        </>
                      )}
                      {/* Stoch reference lines */}
                      {key.startsWith('STOCH') && (
                        <>
                          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
                          <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" />
                        </>
                      )}
                      {/* CCI reference lines */}
                      {key.startsWith('CCI') && (
                        <>
                          <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" />
                          <ReferenceLine y={-100} stroke="#10b981" strokeDasharray="3 3" />
                        </>
                      )}
                      {/* Williams %R reference lines */}
                      {key.startsWith('WILLIAMS') && (
                        <>
                          <ReferenceLine y={-20} stroke="#ef4444" strokeDasharray="3 3" />
                          <ReferenceLine y={-80} stroke="#10b981" strokeDasharray="3 3" />
                        </>
                      )}
                      <Line type="monotone" dataKey="value" stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} name={key} connectNulls />
                      {(isStoch || isMacd) && (
                        <Line type="monotone" dataKey="signal" stroke="#f87171" strokeWidth={1.5} dot={false} name="Signal" connectNulls />
                      )}
                      {isMacd && (
                        <Bar dataKey="histogram" fill="#6b7280" name="Histogram" />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}

          {/* Special charts: Ichimoku, Pivot Points */}
          {specialKeys.map((key) => {
            const data = result.indicators[key];
            const isIchimoku = data[0] && 'tenkan' in data[0];
            const isPivots = data[0] && 'pivot' in data[0];

            if (isIchimoku) {
              return (
                <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <h2 className="text-sm font-medium text-gray-300 mb-4">{key}</h2>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} width={50} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: '#9ca3af' }}
                        />
                        <Line type="monotone" dataKey="tenkan" stroke="#f97316" strokeWidth={1.5} dot={false} name="Tenkan" connectNulls />
                        <Line type="monotone" dataKey="kijun" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Kijun" connectNulls />
                        <Line type="monotone" dataKey="senkou_a" stroke="#10b981" strokeWidth={1} dot={false} name="Senkou A" strokeDasharray="4 2" connectNulls />
                        <Line type="monotone" dataKey="senkou_b" stroke="#ef4444" strokeWidth={1} dot={false} name="Senkou B" strokeDasharray="4 2" connectNulls />
                        <Line type="monotone" dataKey="chikou" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="Chikou" connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            if (isPivots) {
              return (
                <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <h2 className="text-sm font-medium text-gray-300 mb-4">{key}</h2>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} width={50} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: '#9ca3af' }}
                        />
                        <Line type="monotone" dataKey="r2" stroke="#ef4444" strokeWidth={1} dot={false} name="R2" strokeDasharray="3 3" connectNulls />
                        <Line type="monotone" dataKey="r1" stroke="#f97316" strokeWidth={1.5} dot={false} name="R1" connectNulls />
                        <Line type="monotone" dataKey="pivot" stroke="#eab308" strokeWidth={2} dot={false} name="Pivot" connectNulls />
                        <Line type="monotone" dataKey="s1" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="S1" connectNulls />
                        <Line type="monotone" dataKey="s2" stroke="#10b981" strokeWidth={1} dot={false} name="S2" strokeDasharray="3 3" connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
