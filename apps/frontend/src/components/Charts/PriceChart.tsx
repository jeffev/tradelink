import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import type { IChartApi, Time } from 'lightweight-charts';
import type { PricePoint, IndicatorPoint, BacktestTradeResult } from '@/types';

interface Props {
  priceData: PricePoint[];
  indicators: Record<string, IndicatorPoint[]>;
  trades: BacktestTradeResult[];
  strategyType: string;
}

// ── Oscillator classification ─────────────────────────────────────────────────
const OSCILLATOR_PREFIXES = [
  'RSI', 'STOCH', 'MACD', 'CCI', 'ADX', 'WILLIAMS_R', 'OBV', 'ATR',
  'BBPCTB', 'SMA_CROSS', 'VWAP_CROSS', 'VOLUME_RATIO',
  'VP_POC_CROSS', 'VP_VAH_CROSS', 'VP_VAL_CROSS',
];
const isOscillator = (key: string) =>
  OSCILLATOR_PREFIXES.some((p) => key.toUpperCase().startsWith(p));

const getOscPrefix = (key: string) =>
  OSCILLATOR_PREFIXES.find((p) => key.toUpperCase().startsWith(p)) ?? key;

// ── Colors ────────────────────────────────────────────────────────────────────
const OVERLAY_FIXED: Record<string, string> = {
  fast_sma: '#f59e0b',
  slow_sma: '#3b82f6',
};
const OVERLAY_PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#a78bfa', '#f87171', '#34d399', '#fb923c'];

const getOverlayColor = (key: string, idx: number) =>
  OVERLAY_FIXED[key] ?? (key.startsWith('SMA_') ? '#f59e0b' : key === 'VWAP' ? '#06b6d4' : OVERLAY_PALETTE[idx % OVERLAY_PALETTE.length]);

const OSC_COLORS: Record<string, string> = {
  RSI: '#a78bfa', STOCH: '#38bdf8', MACD: '#fb923c', CCI: '#4ade80',
  ADX: '#f472b6', WILLIAMS_R: '#fbbf24', OBV: '#34d399', ATR: '#818cf8',
  BBPCTB: '#f0abfc', SMA_CROSS: '#f59e0b', VWAP_CROSS: '#06b6d4',
  VOLUME_RATIO: '#22d3ee', VP_POC_CROSS: '#f59e0b', VP_VAH_CROSS: '#4ade80', VP_VAL_CROSS: '#f87171',
};
const getOscColor = (key: string) => OSC_COLORS[getOscPrefix(key)] ?? '#a78bfa';

// ── Reference lines per oscillator ───────────────────────────────────────────
interface RefLine { value: number; color: string }
const OSC_REF_LINES: Record<string, RefLine[]> = {
  RSI:          [{ value: 30, color: '#10b981' }, { value: 70, color: '#ef4444' }],
  STOCH:        [{ value: 20, color: '#10b981' }, { value: 80, color: '#ef4444' }],
  MACD:         [{ value: 0,  color: '#6b7280' }],
  CCI:          [{ value: -100, color: '#10b981' }, { value: 100, color: '#ef4444' }],
  ADX:          [{ value: 25, color: '#f59e0b' }],
  WILLIAMS_R:   [{ value: -80, color: '#10b981' }, { value: -20, color: '#ef4444' }],
  BBPCTB:       [{ value: 0.2, color: '#10b981' }, { value: 0.8, color: '#ef4444' }],
  SMA_CROSS:    [{ value: 0, color: '#6b7280' }],
  VWAP_CROSS:   [{ value: 0, color: '#6b7280' }],
  VOLUME_RATIO: [{ value: 1, color: '#6b7280' }, { value: 1.5, color: '#10b981' }],
  VP_POC_CROSS: [{ value: 0, color: '#f59e0b' }],
  VP_VAH_CROSS: [{ value: 0, color: '#10b981' }],
  VP_VAL_CROSS: [{ value: 0, color: '#ef4444' }],
};

const BASE_OPTS = {
  layout:          { background: { color: '#111827' }, textColor: '#9ca3af', fontSize: 11 },
  grid:            { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
  crosshair:       { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#374151' },
  timeScale:       { borderColor: '#374151', timeVisible: false },
  handleScroll: true,
  handleScale:  true,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PriceChart({ priceData, indicators, trades }: Props) {
  const [chartHeight, setChartHeight] = useState(420);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const oscContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const chartsRef        = useRef<IChartApi[]>([]);

  // Derived key lists — needed both in render (containers) and useEffect (charts)
  const allKeys     = Object.keys(indicators).filter((k) => !['rsi', 'oversold', 'overbought'].includes(k));
  const overlayKeys = allKeys.filter((k) => !isOscillator(k));
  const oscKeys     = allKeys.filter((k) => isOscillator(k));

  // Build date → value maps (+ signal / histogram sub-series)
  const seriesMaps: Record<string, Record<string, number>> = {};
  for (const key of allKeys) {
    seriesMaps[key] = {};
    for (const pt of indicators[key]) {
      if (!pt.date) continue;
      if (pt.value     !== undefined) seriesMaps[key][pt.date]           = pt.value;
      if (pt.signal    !== undefined) { const k = `${key}_signal`; (seriesMaps[k] ??= {})[pt.date] = pt.signal; }
      if (pt.histogram !== undefined) { const k = `${key}_hist`;   (seriesMaps[k] ??= {})[pt.date] = pt.histogram; }
    }
  }

  useEffect(() => {
    const mainEl = mainContainerRef.current;
    if (!priceData.length || !mainEl) return;

    // Destroy previous charts
    chartsRef.current.forEach((c) => { try { c.remove(); } catch (_) {} });
    chartsRef.current = [];

    // ── Main chart ─────────────────────────────────────────────────────────
    const mainChart = createChart(mainEl, { ...BASE_OPTS, width: mainEl.clientWidth, height: chartHeight });
    chartsRef.current.push(mainChart);

    // Candlestick
    const candles = mainChart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    candles.setData(priceData.map((p) => ({ time: p.date as Time, open: p.open, high: p.high, low: p.low, close: p.close })));

    // Trade markers
    if (trades.length > 0) {
      const markers = [
        ...trades.map((t) => ({ time: t.entryDate as Time, position: 'belowBar' as const, color: '#10b981', shape: 'arrowUp'   as const, text: 'B' })),
        ...trades.map((t) => ({ time: t.exitDate  as Time, position: 'aboveBar' as const, color: '#ef4444', shape: 'arrowDown' as const, text: 'S' })),
      ].sort((a, b) => (a.time < b.time ? -1 : 1));
      candles.setMarkers(markers);
    }

    // Overlay indicator lines
    overlayKeys.forEach((key, idx) => {
      const line = mainChart.addLineSeries({ color: getOverlayColor(key, idx), lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const pts = Object.entries(seriesMaps[key] ?? {})
        .map(([d, v]) => ({ time: d as Time, value: v }))
        .sort((a, b) => (a.time < b.time ? -1 : 1));
      line.setData(pts);
    });

    // ── Oscillator sub-charts ──────────────────────────────────────────────
    const allCharts: IChartApi[] = [mainChart];

    for (const key of oscKeys) {
      const el = oscContainersRef.current.get(key);
      if (!el) continue;

      const chart = createChart(el, { ...BASE_OPTS, width: mainEl.clientWidth, height: 120 });
      chartsRef.current.push(chart);
      allCharts.push(chart);

      const prefix   = getOscPrefix(key);
      const color    = getOscColor(key);
      const refLines = OSC_REF_LINES[prefix] ?? [];

      // Reference lines
      refLines.forEach((rl) => {
        const s = chart.addLineSeries({ color: rl.color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        s.setData(priceData.map((p) => ({ time: p.date as Time, value: rl.value })));
      });

      // MACD histogram
      const histKey = `${key}_hist`;
      if (seriesMaps[histKey]) {
        const hist = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
        hist.setData(
          Object.entries(seriesMaps[histKey])
            .map(([d, v]) => ({ time: d as Time, value: v, color: v >= 0 ? '#10b98166' : '#ef444466' }))
            .sort((a, b) => (a.time < b.time ? -1 : 1)),
        );
      }

      // Main line
      const mainLine = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
      mainLine.setData(
        Object.entries(seriesMaps[key] ?? {})
          .map(([d, v]) => ({ time: d as Time, value: v }))
          .sort((a, b) => (a.time < b.time ? -1 : 1)),
      );

      // Signal line (Stochastic D / MACD signal)
      const sigKey = `${key}_signal`;
      if (seriesMaps[sigKey]) {
        const sigLine = chart.addLineSeries({ color: '#e2e8f0', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        sigLine.setData(
          Object.entries(seriesMaps[sigKey])
            .map(([d, v]) => ({ time: d as Time, value: v }))
            .sort((a, b) => (a.time < b.time ? -1 : 1)),
        );
      }
    }

    // ── Sync pan / zoom ────────────────────────────────────────────────────
    let syncing = false;
    allCharts.forEach((src) => {
      src.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return;
        syncing = true;
        allCharts.forEach((dst) => { if (dst !== src) dst.timeScale().setVisibleLogicalRange(range); });
        syncing = false;
      });
    });

    // ── Responsive resize ──────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceData, indicators, trades, chartHeight]);

  if (!priceData.length) return null;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
            Compra
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
            Venda
          </span>
          {overlayKeys.map((k, i) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: getOverlayColor(k, i) }} />
              <span>{k}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600 mr-1">Altura:</span>
          {([300, 420, 600, 800] as const).map((h) => (
            <button key={h} onClick={() => setChartHeight(h)}
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

      {/* Charts */}
      <div className="rounded-lg overflow-hidden border border-gray-800">
        <div ref={mainContainerRef} />

        {oscKeys.map((key) => (
          <div key={key} className="border-t border-gray-800">
            <div className="px-3 pt-1.5 pb-0.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wide" style={{ color: getOscColor(key) }}>
                {key}
              </span>
            </div>
            <div ref={(el) => {
              if (el) oscContainersRef.current.set(key, el);
              else    oscContainersRef.current.delete(key);
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}
