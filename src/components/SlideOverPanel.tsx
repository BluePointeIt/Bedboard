import { useEffect } from 'react';
import { cn } from '../lib/utils';
import type { ReactNode } from 'react';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export function SlideOverPanel({
  isOpen,
  onClose,
  children,
  width = 'w-[480px] max-w-full',
}: SlideOverPanelProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 bg-white shadow-2xl border-l border-slate-200 flex flex-col',
          'transform transition-transform duration-300 ease-out',
          width
        )}
      >
        {children}
      </aside>
    </div>
  );
}
