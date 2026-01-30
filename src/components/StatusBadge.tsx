import { cn } from '../lib/utils';
import type { BedStatus } from '../types';

interface StatusBadgeProps {
  status: BedStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<BedStatus, { label: string; className: string }> = {
  available: {
    label: 'Available',
    className: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30',
  },
  occupied: {
    label: 'Occupied',
    className: 'bg-[#137fec]/10 text-[#137fec] border-[#137fec]/30',
  },
  cleaning: {
    label: 'Cleaning',
    className: 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30',
  },
  maintenance: {
    label: 'Maintenance',
    className: 'bg-[#0d141b]/10 text-[#0d141b] border-[#0d141b]/30',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        config.className,
        sizeClasses[size]
      )}
    >
      {config.label}
    </span>
  );
}
