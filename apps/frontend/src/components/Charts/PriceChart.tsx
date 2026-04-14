import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from 'recharts';
import type { PricePoint, IndicatorPoint, BacktestTradeResult } from '@/types';

interface Props {
  priceData: PricePoint[];
  indicators: Record<string, IndicatorPoint[]>;
  trades: BacktestTradeResult[];
  strategyType: string;
}

// ── Overlay indicators (same price scale) ────────────────────────────────────
const OVERLAY_COLORS: Record<string, string> = {
  fast_sma: '#f59e0b',
  slow_sma: '#3b82f6',
};
const OVERLAY_LABELS: Record<string, string> = {
  fast_sma: 'Fast SMA',
  slow_sma: 'Slow SMA',
};

// ── Oscillator config ─────────────────────────────────────────────────────────
const OSCILLATOR_PREFIXES = ['RSI', 'STOCH', 'MACD', 'CCI', 'ADX', 'WILLIAMS_R', 'OBV', 'ATR', 'BBPCTB', 'SMA_CROSS', 'VWAP_CROSS'];
const isOscillator = (key: string) =>
  OSCILLATOR_PREFIXES.some((p) => key.toUpperCase().startsWith(p));

const getPrefix = (key: string) =>
  OSCILLATOR_PREFIXES.find((p) => key.toUpperCase().startsWith(p)) ?? key;

interface RefLine { value: number; color: string; label?: string }

const OSC_REF_LINES: Record<string, RefLine[]> = {
  RSI:       [{ value: 30, color: '#10b981', label: '30' }, { value: 70, color: '#ef4444', label: '70' }],
  STOCH:     [{ value: 20, color: '#10b981', label: '20' }, { value: 80, color: '#ef4444', label: '80' }],
  MACD:      [{ value: 0,  color: '#6b7280' }],
  CCI:       [{ value: -100, color: '#10b981', label: '-100' }, { value: 100, color: '#ef4444', label: '100' }],
  ADX:       [{ value: 25, color: '#f59e0b', label: '25' }],
  WILLIAMS_R:[{ value: -80, color: '#10b981', label: '-80' }, { value: -20, color: '#ef4444', label: '-20' }],
  BBPCTB:    [{ value: 0.2, color: '#10b981', label: '0.2' }, { value: 0.8, color: '#ef4444', label: '0.8' }],
  SMA_CROSS: [{ value: 0, color: '#6b7280' }],
  VWAP_CROSS:[{ value: 0, color: '#6b7280' }],
};

const OSC_DOMAIN: Record<string, [number | 'auto', number | 'auto']> = {
  RSI:       [0, 100],
  STOCH:     [0, 100],
  ADX:       [0, 100],
  WILLIAMS_R:[-100, 0],
  BBPCTB:    [0, 1.2],
};

const OSC_MAIN_COLOR: Record<string, string> = {
  RSI:       '#a78bfa',
  STOCH:     '#38bdf8',
  MACD:      '#fb923c',
  CCI:       '#4ade80',
  ADX:       '#f472b6',
  WILLIAMS_R:'#fbbf24',
  OBV:       '#34d399',
  ATR:       '#818cf8',
  BBPCTB:    '#f0abfc',
  SMA_CROSS: '#f59e0b',
  VWAP_CROSS:'#06b6d4',
};
const OSC_SIGNAL_COLOR = '#e2e8f0'; // white-ish for signal lines

const getOverlayColor = (key: string): string => {
  if (OVERLAY_COLORS[key]) return OVERLAY_COLORS[key];
  if (key.startsWith('SMA_')) return '#f59e0b';   // amber — SMA_20, SMA_50, etc.
  if (key === 'VWAP') return '#06b6d4';            // cyan
  return '#a78bfa';
};

// Sync ID so all charts respond to the same hover event
const SYNC_ID = 'backtest-chart';

// ── Trade marker dots ─────────────────────────────────────────────────────────
function EntryDot(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return (
    <polygon
      points={`${cx},${cy - 7} ${cx - 5},${cy + 3} ${cx + 5},${cy + 3}`}
      fill="#10b981" stroke="#fff" strokeWidth={1}
    />
  );
}
function ExitDot(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return (
    <polygon
      points={`${cx},${cy + 7} ${cx - 5},${cy - 3} ${cx + 5},${cy - 3}`}
      fill="#ef4444" stroke="#fff" strokeWidth={1}
    />
  );
}

// ── Shared tooltip style ──────────────────────────────────────────────────────
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  borderRadius: 6,
  fontSize: 12,
};

export default function PriceChart({ priceData, indicators, trades }: Props) {
  if (!priceData.length) return null;

  // Split all indicator keys into overlays vs oscillators
  const allKeys = Object.keys(indicators).filter(
    (k) => k !== 'rsi' && k !== 'oversold' && k !== 'overbought',
  );
  const overlayKeys  = allKeys.filter((k) => !isOscillator(k));
  const oscKeys      = allKeys.filter((k) => isOscillator(k));

  // Build flat series map: key → { date → value }
  // Also generate derived keys for signal/histogram sub-series
  const seriesMaps: Record<string, Record<string, number>> = {};
  for (const key of allKeys) {
    seriesMaps[key] = {};
    for (const pt of indicators[key]) {
      if (pt.value !== undefined)     seriesMaps[key][pt.date] = pt.value;
      if (pt.signal !== undefined) {
        const sigKey = `${key}_signal`;
        seriesMaps[sigKey] ??= {};
        seriesMaps[sigKey][pt.date] = pt.signal;
      }
      if (pt.histogram !== undefined) {
        const histKey = `${key}_hist`;
        seriesMaps[histKey] ??= {};
        seriesMaps[histKey][pt.date] = pt.histogram;
      }
    }
  }

  // Unified row array (single source of truth for all charts)
  const chartData = priceData.map((p) => {
    const row: Record<string, unknown> = { date: p.date, close: p.close };
    for (const [seriesKey, map] of Object.entries(seriesMaps)) {
      const v = map[p.date];
      if (v !== undefined) row[seriesKey] = v;
    }
    return row;
  });

  // Price chart Y domain — only price + overlay indicators
  const priceValues = priceData.map((p) => p.close);
  for (const key of overlayKeys) {
    Object.values(seriesMaps[key] ?? {}).forEach((v) => priceValues.push(v));
  }
  const minY = Math.min(...priceValues) * 0.97;
  const maxY = Math.max(...priceValues) * 1.03;

  const hasOscillators = oscKeys.length > 0;

  return (
    <div className="space-y-0">

      {/* ── Price chart ─────────────────────────────────────────────────────── */}
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId={SYNC_ID} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              interval="preserveStartEnd"
              hide={hasOscillators}
            />
            <YAxis
              domain={[minY, maxY]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={70}
            />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(val, name) => {
                const k = String(name);
                return [`$${Number(val).toFixed(2)}`, OVERLAY_LABELS[k] ?? k];
              }}
            />

            {/* Close price */}
            <Line type="monotone" dataKey="close" stroke="#6b7280" strokeWidth={1.5} dot={false} legendType="none" />

            {/* Overlay indicators */}
            {overlayKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={getOverlayColor(key)}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}

            {/* Trade entry markers */}
            {trades.map((t, i) => (
              <ReferenceDot key={`e${i}`} x={t.entryDate} y={t.entryPrice} r={0} shape={<EntryDot />} />
            ))}
            {/* Trade exit markers */}
            {trades.map((t, i) => (
              <ReferenceDot key={`x${i}`} x={t.exitDate} y={t.exitPrice} r={0} shape={<ExitDot />} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Oscillator sub-charts ───────────────────────────────────────────── */}
      {oscKeys.map((key, idx) => {
        const prefix     = getPrefix(key);
        const mainColor  = OSC_MAIN_COLOR[prefix] ?? '#a78bfa';
        const refLines   = OSC_REF_LINES[prefix] ?? [];
        const domain     = OSC_DOMAIN[prefix] ?? (['auto', 'auto'] as [string, string]);
        const isLast     = idx === oscKeys.length - 1;
        const signalKey  = `${key}_signal`;
        const histKey    = `${key}_hist`;
        const hasSignal  = Boolean(seriesMaps[signalKey]);
        const hasHist    = Boolean(seriesMaps[histKey]);
        const isMacd     = prefix === 'MACD';

        return (
          <div key={key} className="border-t border-gray-800">
            {/* Sub-chart label row */}
            <div className="flex items-center gap-2 px-2 pt-1.5 pb-0.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wide" style={{ color: mainColor }}>
                {key}
              </span>
              {hasSignal && !isMacd && (
                <span className="text-[9px] text-gray-500">K/D</span>
              )}
              {refLines.map((rl) => (
                <span key={rl.value} className="text-[9px]" style={{ color: rl.color }}>
                  {rl.label ?? rl.value}
                </span>
              ))}
            </div>

            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} syncId={SYNC_ID} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    hide={!isLast}
                  />
                  <YAxis
                    domain={domain}
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(v: number) => {
                      const abs = Math.abs(v);
                      if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                      if (abs >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
                      return v.toFixed(1);
                    }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(val, name) => {
                      const k = String(name);
                      const label = k === signalKey ? `${key} Signal` : k === histKey ? `${key} Hist` : key;
                      return [Number(val).toFixed(2), label];
                    }}
                  />

                  {/* Reference lines (oversold/overbought/zero) */}
                  {refLines.map((rl) => (
                    <ReferenceLine
                      key={rl.value}
                      y={rl.value}
                      stroke={rl.color}
                      strokeDasharray="4 2"
                      strokeWidth={1}
                    />
                  ))}

                  {/* MACD histogram as bars */}
                  {isMacd && hasHist && (
                    <Bar
                      dataKey={histKey}
                      fill="#6b7280"
                      opacity={0.5}
                      isAnimationActive={false}
                    />
                  )}

                  {/* Main indicator line */}
                  <Line
                    type="monotone"
                    dataKey={key}
                    stroke={mainColor}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />

                  {/* Signal line (MACD signal / Stochastic D) */}
                  {hasSignal && (
                    <Line
                      type="monotone"
                      dataKey={signalKey}
                      stroke={OSC_SIGNAL_COLOR}
                      strokeWidth={1}
                      dot={false}
                      connectNulls
                      strokeDasharray="3 2"
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {/* ── Entry / Exit legend ─────────────────────────────────────────────── */}
      <div className="flex gap-4 justify-center pt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-green-400" />
          Entry
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-400" />
          Exit
        </span>
      </div>
    </div>
  );
}
