import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  createChart,
  CrosshairMode,
  LineType,
  LineStyle,
} from 'lightweight-charts';
import type { IChartApi, Time } from 'lightweight-charts';
import { indicatorsService } from '@/services/indicators.service';
import type { IndicatorConfig, CalculateIndicatorsResult } from '@/services/indicators.service';

// ─── Indicator catalogue ─────────────────────────────────────────────────────

const AVAILABLE_INDICATORS: Array<{
  name: string;
  label: string;
  defaultParams: Record<string, any>;
  type: 'overlay' | 'oscillator' | 'special';
}> = [
  { name: 'SMA',           label: 'SMA',            defaultParams: { period: 20 },                          type: 'overlay'    },
  { name: 'EMA',           label: 'EMA',            defaultParams: { period: 20 },                          type: 'overlay'    },
  { name: 'BB',            label: 'Bollinger Bands', defaultParams: { period: 20, std: 2 },                  type: 'overlay'    },
  { name: 'VWAP',          label: 'VWAP',           defaultParams: {},                                       type: 'overlay'    },
  { name: 'SAR',           label: 'Parabolic SAR',  defaultParams: { iaf: 0.02, max_af: 0.2 },              type: 'overlay'    },
  { name: 'PIVOT_POINTS',  label: 'Pivot Points',   defaultParams: {},                                       type: 'overlay'    },
  { name: 'RSI',           label: 'RSI',            defaultParams: { period: 14 },                          type: 'oscillator' },
  { name: 'MACD',          label: 'MACD',           defaultParams: { fast: 12, slow: 26, signal: 9 },       type: 'oscillator' },
  { name: 'ATR',           label: 'ATR',            defaultParams: { period: 14 },                          type: 'oscillator' },
  { name: 'STOCH',         label: 'Stochastic',     defaultParams: { k_period: 14, d_period: 3 },           type: 'oscillator' },
  { name: 'CCI',           label: 'CCI',            defaultParams: { period: 20 },                          type: 'oscillator' },
  { name: 'ADX',           label: 'ADX',            defaultParams: { period: 14 },                          type: 'oscillator' },
  { name: 'WILLIAMS_R',    label: 'Williams %R',    defaultParams: { period: 14 },                          type: 'oscillator' },
  { name: 'OBV',           label: 'OBV',            defaultParams: {},                                       type: 'oscillator' },
  { name: 'ICHIMOKU',      label: 'Ichimoku Cloud', defaultParams: {},                                       type: 'special'    },
  { name: 'VOLUME_PROFILE',label: 'Volume Profile', defaultParams: { num_bins: 50, period: 'month' },       type: 'special'    },
];

// Colors for overlay series (cycles)
const OVERLAY_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a78bfa', '#f87171', '#34d399', '#fb923c'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today       = new Date().toISOString().split('T')[0];
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

function isOscillatorKey(key: string, data: CalculateIndicatorsResult['indicators'][string]): boolean {
  if (!data?.[0]) return false;
  if ('histogram' in data[0]) return true;                           // MACD
  if ('signal' in data[0] && !('tenkan' in data[0])) return true;   // STOCH
  return ['RSI_', 'ATR_', 'CCI_', 'ADX_', 'WILLIAMS_R_', 'OBV'].some((p) => key.startsWith(p));
}

const BASE_CHART_OPTS = {
  layout:  { background: { color: '#111827' }, textColor: '#9ca3af', fontSize: 11 },
  grid:    { vertLines: { color: '#1f2937' },  horzLines: { color: '#1f2937' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#374151' },
  timeScale: { borderColor: '#374151', timeVisible: false },
  handleScroll: true,
  handleScale: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IndicatorChart() {
  const [symbol,             setSymbol]             = useState('AAPL');
  const [startDate,          setStartDate]          = useState(sixMonthsAgo);
  const [endDate,            setEndDate]            = useState(today);
  const [timeframe,          setTimeframe]          = useState('1d');
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorConfig[]>([
    { name: 'SMA', params: { period: 20 } },
    { name: 'RSI', params: { period: 14 } },
  ]);
  const [result,      setResult]      = useState<CalculateIndicatorsResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [chartHeight, setChartHeight] = useState(420);

  // Chart DOM refs
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const oscContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const chartsRef        = useRef<IChartApi[]>([]);

  // ── Toggle indicator button ──────────────────────────────────────────────
  function toggleIndicator(name: string, defaultParams: Record<string, any>) {
    setSelectedIndicators((prev) => {
      const exists = prev.find((i) => i.name === name);
      if (exists) return prev.filter((i) => i.name !== name);
      return [...prev, { name, params: defaultParams }];
    });
  }

  // ── Calculate ────────────────────────────────────────────────────────────
  async function handleCalculate() {
    if (!symbol.trim())             return toast.error('Enter a symbol');
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

  // ── Compute oscillator keys for rendering container divs ─────────────────
  const oscKeys = result
    ? Object.keys(result.indicators).filter((k) => isOscillatorKey(k, result.indicators[k]))
    : [];

  // ── Build / rebuild charts whenever result changes ────────────────────────
  useEffect(() => {
    if (!result || !mainContainerRef.current) return;

    // Destroy previous charts
    chartsRef.current.forEach((c) => { try { c.remove(); } catch (_) {} });
    chartsRef.current = [];

    const inds   = result.indicators;
    const allKeys = Object.keys(inds);

    // Classify overlay keys (go on main chart)
    const mainOverlayKeys = allKeys.filter(
      (k) => k !== 'VOLUME_PROFILE' && !isOscillatorKey(k, inds[k]),
    );
    const oscillatorKeys = allKeys.filter((k) => isOscillatorKey(k, inds[k]));

    // VP time series
    const vpRaw  = inds['VOLUME_PROFILE'];
    const hasVP  = vpRaw?.[0] && 'poc' in vpRaw[0];

    // ── Main chart ──────────────────────────────────────────────────────────
    const mainEl    = mainContainerRef.current;
    const mainChart = createChart(mainEl, {
      ...BASE_CHART_OPTS,
      width:  mainEl.clientWidth,
      height: chartHeight,
    });
    chartsRef.current.push(mainChart);

    // Candlestick series
    const candleSeries = mainChart.addCandlestickSeries({
      upColor:      '#10b981',
      downColor:    '#ef4444',
      borderVisible: false,
      wickUpColor:  '#10b981',
      wickDownColor:'#ef4444',
    });
    candleSeries.setData(
      result.priceData.map((p) => ({
        time:  p.date as Time,
        open:  p.open,
        high:  p.high,
        low:   p.low,
        close: p.close,
      })),
    );

    // Overlay series
    let colorIdx = 0;
    for (const key of mainOverlayKeys) {
      const data = inds[key];
      if (!data?.length) continue;
      const color = OVERLAY_COLORS[colorIdx++ % OVERLAY_COLORS.length];

      if (data[0] && 'tenkan' in data[0]) {
        // ── Ichimoku ─────────────────────────────────────────────────────
        const fields  = ['tenkan', 'kijun', 'senkou_a', 'senkou_b', 'chikou'] as const;
        const colors  = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#a78bfa'];
        const widths  = [2, 2, 1, 1, 2] as const;
        const dashes  = [false, false, true, true, false];
        const labels  = ['Tenkan', 'Kijun', 'Senkou A', 'Senkou B', 'Chikou'];
        fields.forEach((f, i) => {
          const s = mainChart.addLineSeries({
            color: colors[i],
            lineWidth: widths[i],
            lineStyle: dashes[i] ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: i === 0,
            title: labels[i],
          });
          s.setData(
            data
              .filter((d) => d[f] != null && d.date)
              .map((d)  => ({ time: d.date as Time, value: d[f] as number })),
          );
        });

      } else if (data[0] && 'pivot' in data[0]) {
        // ── Pivot Points ─────────────────────────────────────────────────
        const fields  = ['r2', 'r1', 'pivot', 's1', 's2'] as const;
        const colors  = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#10b981'];
        const widths  = [1, 2, 2, 2, 1] as const;
        const dashes  = [true, false, false, false, true];
        const labels  = ['R2', 'R1', 'Pivot', 'S1', 'S2'];
        fields.forEach((f, i) => {
          const s = mainChart.addLineSeries({
            color: colors[i],
            lineWidth: widths[i],
            lineStyle: dashes[i] ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
            title: labels[i],
          });
          s.setData(
            data
              .filter((d) => d[f] != null && d.date)
              .map((d)  => ({ time: d.date as Time, value: d[f] as number })),
          );
        });

      } else if (data[0] && 'upper' in data[0]) {
        // ── Bollinger Bands ───────────────────────────────────────────────
        const bands = [
          { key: 'upper', dash: true,  label: `${key} Upper` },
          { key: 'value', dash: false, label: key             },
          { key: 'lower', dash: true,  label: `${key} Lower` },
        ] as const;
        bands.forEach(({ key: k, dash, label }, i) => {
          const s = mainChart.addLineSeries({
            color,
            lineWidth: i === 1 ? 2 : 1,
            lineStyle: dash ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: i === 1,
            title: label,
          });
          s.setData(
            data
              .filter((d) => d[k] != null && d.date)
              .map((d)  => ({ time: d.date as Time, value: d[k] as number })),
          );
        });

      } else {
        // ── Simple line (SMA, EMA, VWAP, SAR) ────────────────────────────
        const s = mainChart.addLineSeries({
          color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: key,
        });
        s.setData(
          data
            .filter((d) => d.value != null && d.date)
            .map((d)  => ({ time: d.date as Time, value: d.value as number })),
        );
      }
    }

    // ── Volume Profile step lines ───────────────────────────────────────────
    if (hasVP && vpRaw) {
      const vpMap = new Map(vpRaw.map((d) => [d.date, d]));
      const toSeries = (field: 'poc' | 'vah' | 'val') =>
        result.priceData
          .filter((p) => vpMap.has(p.date))
          .map((p)    => ({ time: p.date as Time, value: vpMap.get(p.date)![field] as number }));

      const pocS = mainChart.addLineSeries({ color: '#f59e0b', lineWidth: 2,   lineType: LineType.WithSteps, lineStyle: LineStyle.Solid,  priceLineVisible: false, title: 'VP POC' });
      const vahS = mainChart.addLineSeries({ color: '#10b981', lineWidth: 2, lineType: LineType.WithSteps, lineStyle: LineStyle.Dashed, priceLineVisible: false, title: 'VP VAH' });
      const valS = mainChart.addLineSeries({ color: '#ef4444', lineWidth: 2, lineType: LineType.WithSteps, lineStyle: LineStyle.Dashed, priceLineVisible: false, title: 'VP VAL' });
      pocS.setData(toSeries('poc'));
      vahS.setData(toSeries('vah'));
      valS.setData(toSeries('val'));
    }

    // ── Oscillator charts ───────────────────────────────────────────────────
    for (const key of oscillatorKeys) {
      const el = oscContainersRef.current.get(key);
      if (!el) continue;
      const data = inds[key];
      if (!data?.length) continue;

      const oscChart = createChart(el, {
        ...BASE_CHART_OPTS,
        width:  el.clientWidth,
        height: 150,
        timeScale: { ...BASE_CHART_OPTS.timeScale, visible: false },
      });
      chartsRef.current.push(oscChart);

      const isMacd  = data[0] && 'histogram' in data[0];
      const isStoch = data[0] && 'signal' in data[0] && !isMacd;

      if (isMacd) {
        const macdLine   = oscChart.addLineSeries({ color: '#3b82f6', lineWidth: 2, priceLineVisible: false, title: 'MACD'   });
        const signalLine = oscChart.addLineSeries({ color: '#f87171', lineWidth: 2, priceLineVisible: false, title: 'Signal' });
        const histSeries = oscChart.addHistogramSeries({ priceLineVisible: false, title: 'Hist' });

        macdLine.setData(  data.filter((d) => d.value     != null && d.date).map((d) => ({ time: d.date as Time, value: d.value     as number })));
        signalLine.setData(data.filter((d) => d.signal    != null && d.date).map((d) => ({ time: d.date as Time, value: d.signal    as number })));
        histSeries.setData(data.filter((d) => d.histogram != null && d.date).map((d) => ({
          time:  d.date as Time,
          value: d.histogram as number,
          color: (d.histogram as number) >= 0 ? '#10b981' : '#ef4444',
        })));

      } else if (isStoch) {
        const kLine = oscChart.addLineSeries({ color: '#3b82f6', lineWidth: 2, priceLineVisible: false, title: 'K' });
        const dLine = oscChart.addLineSeries({ color: '#f87171', lineWidth: 2, priceLineVisible: false, title: 'D' });
        kLine.setData(data.filter((d) => d.value  != null && d.date).map((d) => ({ time: d.date as Time, value: d.value  as number })));
        dLine.setData(data.filter((d) => d.signal != null && d.date).map((d) => ({ time: d.date as Time, value: d.signal as number })));
        kLine.createPriceLine({ price: 80, color: '#ef4444', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        kLine.createPriceLine({ price: 20, color: '#10b981', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });

      } else {
        const s = oscChart.addLineSeries({ color: '#3b82f6', lineWidth: 2, priceLineVisible: false, title: key });
        s.setData(data.filter((d) => d.value != null && d.date).map((d) => ({ time: d.date as Time, value: d.value as number })));

        if (key.startsWith('RSI')) {
          s.createPriceLine({ price: 70, color: '#ef4444', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
          s.createPriceLine({ price: 30, color: '#10b981', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        } else if (key.startsWith('CCI')) {
          s.createPriceLine({ price:  100, color: '#ef4444', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
          s.createPriceLine({ price: -100, color: '#10b981', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        } else if (key.startsWith('WILLIAMS')) {
          s.createPriceLine({ price: -20, color: '#ef4444', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
          s.createPriceLine({ price: -80, color: '#10b981', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        }
      }
    }

    // ── Sync all charts (zoom / pan) ────────────────────────────────────────
    const allCharts = chartsRef.current;
    allCharts.forEach((chart) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range === null) return;
        allCharts.forEach((other) => {
          if (other !== chart) other.timeScale().setVisibleLogicalRange(range);
        });
      });
    });

    // ── Responsive resize ────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mainContainerRef.current?.clientWidth;
      if (!w) return;
      allCharts.forEach((c) => c.applyOptions({ width: w }));
    });
    ro.observe(mainEl);

    return () => {
      ro.disconnect();
      chartsRef.current.forEach((c) => { try { c.remove(); } catch (_) {} });
      chartsRef.current = [];
    };
  }, [result, chartHeight]);

  // ─── Render ───────────────────────────────────────────────────────────────
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

        {/* Indicator selector */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Indicadores</p>
          <div className="space-y-3">
            {(['overlay', 'oscillator', 'special'] as const).map((type) => (
              <div key={type}>
                <p className="text-xs text-gray-500 mb-1 font-semibold capitalize">
                  {type === 'overlay' ? 'Overlay' : type === 'oscillator' ? 'Osciladores' : 'Especiais'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_INDICATORS.filter((i) => i.type === type).map((ind) => {
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

                {/* VP period selector */}
                {type === 'special' && selectedIndicators.some((i) => i.name === 'VOLUME_PROFILE') && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Período VP:</span>
                    {(['week', 'month', 'quarter', 'year', 'full'] as const).map((p) => {
                      const vpConfig  = selectedIndicators.find((i) => i.name === 'VOLUME_PROFILE');
                      const current   = (vpConfig?.params?.period ?? 'month') as string;
                      return (
                        <button
                          key={p}
                          onClick={() =>
                            setSelectedIndicators((prev) =>
                              prev.map((i) =>
                                i.name === 'VOLUME_PROFILE'
                                  ? { ...i, params: { ...i.params, period: p } }
                                  : i,
                              ),
                            )
                          }
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            current === p
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {p === 'week' ? 'Sem' : p === 'month' ? 'Mês' : p === 'quarter' ? 'Trim' : p === 'year' ? 'Ano' : 'Tudo'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
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

      {/* Chart area */}
      {result && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
            <span className="text-xs text-gray-500 font-mono">{result.symbol}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600 mr-1">Altura:</span>
              {([300, 420, 600, 800] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setChartHeight(h)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    chartHeight === h
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {h === 300 ? 'P' : h === 420 ? 'M' : h === 600 ? 'G' : 'GG'}
                </button>
              ))}
            </div>
          </div>

          {/* Price + overlay chart */}
          <div ref={mainContainerRef} />

          {/* Oscillator charts — one per key */}
          {oscKeys.map((key) => (
            <div key={key} className="border-t border-gray-800">
              <div className="px-3 pt-1.5 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">{key}</span>
              </div>
              <div
                ref={(el) => {
                  if (el) oscContainersRef.current.set(key, el);
                  else    oscContainersRef.current.delete(key);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
