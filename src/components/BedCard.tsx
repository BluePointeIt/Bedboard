import React from 'react';
import { Icon } from './Icon';
import { cn } from '../lib/utils';
import type { Bed, Resident, Room, Wing } from '../types';

export interface BedWithDetails extends Bed {
  room: Room & { wing: Wing };
  resident?: Resident;
}

interface BedCardProps {
  bed: BedWithDetails;
  onClick?: () => void;
}

function getStatusStripColor(bed: BedWithDetails): string {
  const resident = bed.resident;

  // Out of service - Black
  if (bed.status === 'out_of_service') {
    return 'bg-gray-900';
  }

  // Isolation residents get split color (handled separately in render)
  if (resident?.is_isolation) {
    return ''; // Will use custom split strip
  }

  // Occupied - color by gender
  if (bed.status === 'occupied' && resident) {
    if (resident.gender === 'male') {
      return 'bg-primary-500';
    }
    if (resident.gender === 'female') {
      return 'bg-pink-400';
    }
    return 'bg-violet-500';
  }

  return '';
}

function IsolationStrip({ gender }: { gender: string }) {
  // Split color: left half is gender color, right half is yellow
  const genderColor = gender === 'male' ? 'bg-primary-500' : gender === 'female' ? 'bg-pink-400' : 'bg-violet-500';

  return (
    <div className="status-strip flex">
      <div className={cn('flex-1', genderColor)} />
      <div className="flex-1 bg-yellow-400" />
    </div>
  );
}

function getPayorDisplay(payor: string): string {
  const displays: Record<string, string> = {
    private: 'Private',
    medicare: 'Medicare',
    medicaid: 'Medicaid',
    managed_care: 'Managed Care',
    bed_hold: 'Bed Hold',
    hospice: 'Hospice',
  };
  return displays[payor] || 'Private';
}

function getPayorColor(bed: BedWithDetails): string {
  const resident = bed.resident;
  if (resident?.is_isolation) return 'text-yellow-500';
  if (resident?.gender === 'male') return 'text-primary-500';
  if (resident?.gender === 'female') return 'text-pink-500';
  return 'text-primary-500';
}

function getIsolationTypeDisplay(type: string | undefined): string {
  if (!type) return 'Isolation';
  const displays: Record<string, string> = {
    respiratory: 'Respiratory Precaution',
    contact: 'Contact Isolation',
    droplet: 'Droplet Precaution',
    airborne: 'Airborne Precaution',
  };
  return displays[type] || 'Isolation';
}

function formatAdmissionDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getRoomLabel(bed: BedWithDetails): string {
  const roomNumber = bed.room?.room_number || '';
  return `${roomNumber}-${bed.bed_letter}`;
}

export const BedCard = React.memo(function BedCard({ bed, onClick }: BedCardProps) {
  const resident = bed.resident;
  const isIsolation = resident?.is_isolation;
  const isClickable = !!onClick;
  const isVacant = bed.status === 'vacant';
  const isOutOfService = bed.status === 'out_of_service';
  const stripColor = getStatusStripColor(bed);
  const hasSharedBathroom = bed.room?.has_shared_bathroom;

  // Out of Service Card
  if (isOutOfService) {
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
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#4c739a] bg-slate-100 px-2 py-0.5 rounded">
                {getRoomLabel(bed)}
              </span>
              {hasSharedBathroom && (
                <span title="Shared Bathroom">
                  <Icon name="shower" size={14} className="text-slate-400" />
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 items-center justify-center py-4">
            <Icon name="construction" size={32} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-500 mt-2">
              {bed.out_of_service_reason || 'Maintenance'}
            </p>
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
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#4c739a] bg-slate-100 px-2 py-0.5 rounded">
                {getRoomLabel(bed)}
              </span>
              {hasSharedBathroom && (
                <span title="Shared Bathroom"><Icon name="shower" size={14} className="text-cyan-500" /></span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-center justify-center py-6">
            <p className="text-sm font-bold text-primary-500">VACANT</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className="px-3 py-1 bg-primary-500 text-white rounded text-[10px] font-bold uppercase hover:bg-primary-700 transition-colors"
            >
              Assign
            </button>
          </div>
          <div className="mt-auto pt-3 border-t border-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Ready for Intake</span>
          </div>
        </div>
      </div>
    );
  }

  // Occupied Bed Card (with resident)
  return (
    <div
      onClick={onClick}
      className={cn(
        'card-shadow flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200',
        isClickable && 'cursor-pointer'
      )}
    >
      {isIsolation ? (
        <IsolationStrip gender={resident?.gender || 'other'} />
      ) : (
        <div className={cn('status-strip', stripColor)} />
      )}
      <div className="p-4 flex flex-col h-full">
        {/* Room Badge & Menu */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#4c739a] bg-slate-100 px-2 py-0.5 rounded">
              {getRoomLabel(bed)}
            </span>
            {hasSharedBathroom && (
              <span title="Shared Bathroom"><Icon name="shower" size={14} className="text-cyan-500" /></span>
            )}
          </div>
          <Icon name="more_horiz" size={20} className="text-slate-300" />
        </div>

        {/* Resident Info */}
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-base font-bold text-[#0d141b] truncate">
            {resident?.first_name} {resident?.last_name}
          </p>
          {resident?.diagnosis && (
            <p className="text-xs text-[#0d141b] font-medium truncate" title={resident.diagnosis}>
              {resident.diagnosis}
            </p>
          )}
          {isIsolation ? (
            <p className="text-xs text-yellow-600 font-medium">
              {getIsolationTypeDisplay(resident?.isolation_type)}
            </p>
          ) : (
            <p className="text-xs text-[#4c739a]">
              Adm: {formatAdmissionDate(resident?.admission_date)}
            </p>
          )}
        </div>

        {/* Footer with Payor & Gender */}
        <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
          <span className={cn('text-[10px] uppercase font-bold', getPayorColor(bed))}>
            {isIsolation ? 'Isolation' : getPayorDisplay(resident?.payor || '')}
          </span>
          <div className="flex items-center gap-1">
            {isIsolation && (
              <Icon name="warning" size={16} className="text-yellow-500" />
            )}
            {resident?.gender === 'male' ? (
              <Icon name="male" size={16} className="text-primary-500" />
            ) : resident?.gender === 'female' ? (
              <Icon name="female" size={16} className="text-pink-400" />
            ) : (
              <Icon name="person" size={16} className="text-violet-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  // Only re-render if bed data or onClick reference changes
  return (
    prevProps.bed.id === nextProps.bed.id &&
    prevProps.bed.updated_at === nextProps.bed.updated_at &&
    prevProps.bed.status === nextProps.bed.status &&
    prevProps.bed.resident?.id === nextProps.bed.resident?.id &&
    prevProps.bed.resident?.updated_at === nextProps.bed.resident?.updated_at &&
    prevProps.onClick === nextProps.onClick
  );
});
