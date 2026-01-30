interface LegendItem {
  color: string;
  label: string;
  border?: boolean;
}

const legendItems: LegendItem[] = [
  { color: 'bg-primary-500', label: 'Male' },
  { color: 'bg-pink-400', label: 'Female' },
  { color: 'bg-yellow-400', label: 'Isolation' },
  { color: 'bg-gray-900', label: 'Out of Service' },
  { color: 'bg-slate-100', label: 'Vacant', border: true },
];

export function FilterLegend() {
  return (
    <div className="flex gap-3 flex-wrap">
      {legendItems.map((item) => (
        <div
          key={item.label}
          className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3"
        >
          <div
            className={`w-3 h-3 rounded-full ${item.color} ${
              item.border ? 'border border-slate-300' : ''
            }`}
          />
          <p className="text-xs font-semibold">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
