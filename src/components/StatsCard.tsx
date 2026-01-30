import { cn } from '../lib/utils';

type StatsCardVariant = 'default' | 'male' | 'female' | 'isolation' | 'outOfService';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  variant?: StatsCardVariant;
}

export function StatsCard({
  title,
  value,
  subtitle,
  change,
  changeType = 'neutral',
  variant = 'default',
}: StatsCardProps) {
  // Background and text colors based on variant
  const variantStyles: Record<StatsCardVariant, { bg: string; title: string; value: string; change: string }> = {
    default: {
      bg: 'bg-white border border-[#cfdbe7]',
      title: 'text-[#4c739a]',
      value: 'text-[#0d141b]',
      change: changeType === 'positive' ? 'text-[#078838]' : changeType === 'negative' ? 'text-[#e73908]' : 'text-[#137fec]',
    },
    male: {
      bg: 'bg-primary-500',
      title: 'text-white/80',
      value: 'text-white',
      change: 'text-white/90',
    },
    female: {
      bg: 'bg-pink-400',
      title: 'text-white/80',
      value: 'text-white',
      change: 'text-white/90',
    },
    isolation: {
      bg: 'bg-gradient-to-r from-primary-500 via-yellow-400 to-pink-400',
      title: 'text-white/90 drop-shadow-sm',
      value: 'text-white drop-shadow-sm',
      change: 'text-white/90 drop-shadow-sm',
    },
    outOfService: {
      bg: 'bg-gray-900',
      title: 'text-white/70',
      value: 'text-white',
      change: 'text-white/80',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn('flex min-w-[200px] flex-1 flex-col gap-1 rounded-xl p-6', styles.bg)}>
      <p className={cn('text-sm font-medium', styles.title)}>{title}</p>
      <div className="flex items-baseline gap-2">
        <p className={cn('text-2xl font-bold', styles.value)}>{value}</p>
        {change && (
          <span className={cn('text-sm font-medium', styles.change)}>{change}</span>
        )}
      </div>
      {subtitle && (
        <p className={cn('text-xs', styles.title)}>{subtitle}</p>
      )}
    </div>
  );
}
