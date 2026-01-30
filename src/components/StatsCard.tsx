import { cn } from '../lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export function StatsCard({
  title,
  value,
  subtitle,
  change,
  changeType = 'neutral',
}: StatsCardProps) {
  const changeColor = changeType === 'positive'
    ? 'text-[#078838]'
    : changeType === 'negative'
    ? 'text-[#e73908]'
    : 'text-[#137fec]';

  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-1 rounded-xl p-6 bg-white border border-[#cfdbe7]">
      <p className="text-[#4c739a] text-sm font-medium">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-[#0d141b]">{value}</p>
        {change && (
          <span className={cn('text-sm font-medium', changeColor)}>{change}</span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-[#4c739a]">{subtitle}</p>
      )}
    </div>
  );
}
