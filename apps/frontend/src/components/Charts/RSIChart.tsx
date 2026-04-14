import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { IndicatorPoint } from '@/types';

interface Props {
  rsiData: IndicatorPoint[];
  oversold?: number;
  overbought?: number;
}

export default function RSIChart({ rsiData, oversold = 30, overbought = 70 }: Props) {
  if (!rsiData.length) return null;

  return (
    <div className="h-40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-400">RSI ({rsiData.length} points)</span>
        <div className="flex gap-3 text-xs">
          <span className="text-green-400">Oversold &lt; {oversold}</span>
          <span className="text-red-400">Overbought &gt; {overbought}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rsiData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          {/* Shaded overbought zone */}
          <ReferenceArea y1={overbought} y2={100} fill="#ef4444" fillOpacity={0.08} />
          {/* Shaded oversold zone */}
          <ReferenceArea y1={0} y2={oversold} fill="#10b981" fillOpacity={0.08} />

          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, oversold, 50, overbought, 100]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(val) => [Number(val).toFixed(2), 'RSI']}
          />

          {/* Overbought / oversold reference lines */}
          <ReferenceLine y={overbought} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={oversold} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="2 4" strokeWidth={1} />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#a78bfa"
            strokeWidth={1.5}
            dot={false}
            name="RSI"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
