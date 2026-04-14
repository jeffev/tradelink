interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  valueClass?: string;
}

export default function StatCard({ label, value, subValue, valueClass = 'text-white' }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  );
}
