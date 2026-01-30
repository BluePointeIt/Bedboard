import type { ReactNode } from 'react';

interface BedGridProps {
  children: ReactNode;
}

export function BedGrid({ children }: BedGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {children}
    </div>
  );
}
