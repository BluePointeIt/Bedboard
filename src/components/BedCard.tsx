import { AlertTriangle, Wrench, MoreHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import type { BedWithDetails } from '../types';

interface BedCardProps {
  bed: BedWithDetails;
  onClick?: () => void;
}

function getStatusStripColor(bed: BedWithDetails): string {
  const patient = bed.current_assignment?.patient;
  const isIsolation = bed.current_assignment?.is_isolation;

  // Not in service (maintenance) - Black
  if (bed.status === 'maintenance') {
    return 'bg-gray-900';
  }

  // Isolation - Yellow/Amber
  if (isIsolation) {
    return 'bg-yellow-400';
  }

  // Occupied beds - color by gender
  if (bed.status === 'occupied' && patient) {
    if (patient.gender === 'male') {
      return 'bg-[#137fec]';
    }
    if (patient.gender === 'female') {
      return 'bg-pink-400';
    }
    // Other gender - Purple
    return 'bg-violet-500';
  }

  return '';
}

function getCareLevel(bed: BedWithDetails): string {
  const patient = bed.current_assignment?.patient;
  if (!patient) return '';

  // Map payer type to care level display
  const careLevels: Record<string, string> = {
    private: 'High Care',
    medicare: 'Standard',
    medicaid: 'Standard',
    managed_care: 'Managed',
  };
  return patient.payer_type ? careLevels[patient.payer_type] || 'Standard' : 'Standard';
}

function getCareLevelColor(bed: BedWithDetails): string {
  const patient = bed.current_assignment?.patient;
  if (bed.current_assignment?.is_isolation) return 'text-yellow-500';
  if (patient?.gender === 'male') return 'text-[#137fec]';
  if (patient?.gender === 'female') return 'text-pink-500';
  return 'text-[#137fec]';
}

function formatAdmissionDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getRoomLabel(bed: BedWithDetails): string {
  const roomNumber = bed.room?.room_number || '';
  return `${roomNumber}-${bed.bed_number}`;
}

export function BedCard({ bed, onClick }: BedCardProps) {
  const patient = bed.current_assignment?.patient;
  const isIsolation = bed.current_assignment?.is_isolation;
  const isClickable = !!onClick;
  const isVacant = bed.status === 'available' || bed.status === 'cleaning';
  const isMaintenance = bed.status === 'maintenance';
  const stripColor = getStatusStripColor(bed);

  // Out of Service Card
  if (isMaintenance) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'card-shadow flex flex-col bg-slate-50 rounded-xl overflow-hidden border border-slate-200 opacity-80',
          isClickable && 'cursor-pointer'
        )}
      >
        <div className="status-strip bg-gray-900" />
        <div className="p-4 flex flex-col h-full grayscale">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-[#4c739a] bg-slate-100 px-2 py-0.5 rounded">
              {getRoomLabel(bed)}
            </span>
          </div>
          <div className="flex flex-col gap-1 items-center justify-center py-4">
            <Wrench className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-500 mt-2">Maintenance</p>
          </div>
          <div className="mt-auto pt-3 border-t border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-500">Unavailable</span>
          </div>
        </div>
      </div>
    );
  }

  // Vacant Bed Card
  if (isVacant) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'card-shadow flex flex-col bg-white rounded-xl overflow-hidden border-2 border-dashed border-slate-200',
          isClickable && 'cursor-pointer'
        )}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-[#4c739a] bg-slate-100 px-2 py-0.5 rounded">
              {getRoomLabel(bed)}
            </span>
          </div>
          <div className="flex flex-col gap-2 items-center justify-center py-6">
            <p className="text-sm font-bold text-[#137fec]">
              {bed.status === 'cleaning' ? 'CLEANING' : 'VACANT'}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className="px-3 py-1 bg-[#137fec] text-white rounded text-[10px] font-bold uppercase hover:bg-[#1171d4] transition-colors"
            >
              Assign
            </button>
          </div>
          <div className="mt-auto pt-3 border-t border-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {bed.status === 'cleaning' ? 'Being Cleaned' : 'Ready for Intake'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Occupied Bed Card (with patient)
  return (
    <div
      onClick={onClick}
      className={cn(
        'card-shadow flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200',
        isClickable && 'cursor-pointer'
      )}
    >
      <div className={cn('status-strip', stripColor)} />
      <div className="p-4 flex flex-col h-full">
        {/* Room Badge & Menu */}
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-bold text-[#4c739a] bg-slate-100 px-2 py-0.5 rounded">
            {getRoomLabel(bed)}
          </span>
          <MoreHorizontal className="w-5 h-5 text-slate-300" />
        </div>

        {/* Patient Info */}
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-base font-bold text-[#0d141b] truncate">
            {patient?.first_name} {patient?.last_name}
          </p>
          {isIsolation ? (
            <p className="text-xs text-yellow-600 font-medium">
              Respiratory Precaution
            </p>
          ) : (
            <p className="text-xs text-[#4c739a]">
              Adm: {formatAdmissionDate(bed.current_assignment?.assigned_at)}
            </p>
          )}
        </div>

        {/* Footer with Care Level & Gender */}
        <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
          <span className={cn('text-[10px] uppercase font-bold', getCareLevelColor(bed))}>
            {isIsolation ? 'Isolation' : getCareLevel(bed)}
          </span>
          {isIsolation ? (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          ) : patient?.gender === 'male' ? (
            <svg className="w-4 h-4 text-[#137fec]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9H15V22H13V16H11V22H9V9H3V7H21V9Z" />
            </svg>
          ) : patient?.gender === 'female' ? (
            <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM14.5 22H13V16H11V22H9.5L8.5 15H6V13L7 9H17L18 13V15H15.5L14.5 22Z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="4" r="2" />
              <path d="M15 22H13V16H11V22H9V9H3V7H21V9H15V22Z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
