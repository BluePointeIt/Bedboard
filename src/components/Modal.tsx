import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full bg-white rounded-xl shadow-xl border border-[#e7edf3]',
          sizeClasses[size]
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#e7edf3]">
          <h2 className="text-lg font-bold text-[#0d141b]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#4c739a] hover:text-[#0d141b] hover:bg-[#e7edf3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
