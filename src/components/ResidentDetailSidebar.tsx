import { X } from 'lucide-react';
import { Icon } from './Icon';
import { cn } from '../lib/utils';
import type { Resident } from '../types';

interface BedInfo {
  roomNumber: string;
  bedLetter: string;
  wingName: string;
}

interface ResidentDetailSidebarProps {
  resident: Resident;
  bedInfo?: BedInfo;
  onClose: () => void;
  onSetIsolation: () => void;
  onDischarge: () => void;
  onEditProfile: () => void;
  onTransfer: () => void;
  onUnassign?: () => void;
}

function getStatusStripColor(gender: string, isIsolation: boolean): string {
  if (isIsolation) {
    return 'bg-yellow-400';
  }
  if (gender === 'male') {
    return 'bg-primary-500';
  }
  if (gender === 'female') {
    return 'bg-pink-400';
  }
  return 'bg-violet-500';
}

function getAvatarColor(gender: string): string {
  if (gender === 'male') {
    return 'bg-primary-100 text-primary-600';
  }
  if (gender === 'female') {
    return 'bg-pink-100 text-pink-600';
  }
  return 'bg-violet-100 text-violet-600';
}

function getPayorBadgeStyle(payor: string): string {
  const styles: Record<string, string> = {
    private: 'bg-green-100 text-green-700',
    medicare: 'bg-blue-100 text-blue-700',
    medicaid: 'bg-purple-100 text-purple-700',
    managed_care: 'bg-orange-100 text-orange-700',
    bed_hold: 'bg-gray-100 text-gray-700',
    hospice: 'bg-pink-100 text-pink-700',
  };
  return styles[payor] || 'bg-gray-100 text-gray-700';
}

function getPayorLabel(payor: string): string {
  const labels: Record<string, string> = {
    private: 'Private',
    medicare: 'Medicare',
    medicaid: 'Medicaid',
    managed_care: 'Managed Care',
    bed_hold: 'Bed Hold',
    hospice: 'Hospice',
  };
  return labels[payor] || payor;
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function calculateAge(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ResidentDetailSidebar({
  resident,
  bedInfo,
  onClose,
  onSetIsolation,
  onDischarge,
  onEditProfile,
  onTransfer,
  onUnassign,
}: ResidentDetailSidebarProps) {
  const age = calculateAge(resident.date_of_birth);
  const isActive = resident.status === 'active';

  // Using inline padding style to ensure it's applied
  const sectionPadding = { paddingLeft: '24px', paddingRight: '24px' };
  const sectionPaddingY = { paddingTop: '24px', paddingBottom: '24px' };
  const fullPadding = { padding: '24px' };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status Header Strip */}
      <div className={cn('h-2 w-full flex-shrink-0', getStatusStripColor(resident.gender, resident.is_isolation))} />

      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Header Section */}
        <div className="border-b border-slate-100" style={{ ...sectionPadding, ...sectionPaddingY }}>
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col">
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded w-fit mb-1',
                  bedInfo ? 'bg-primary-500/10 text-primary-500' : 'bg-yellow-500/10 text-yellow-600'
                )}
              >
                {bedInfo ? 'Occupied' : 'Unassigned'}
              </span>
              <h2 className="text-2xl font-bold text-slate-900">
                {bedInfo ? `Bed ${bedInfo.roomNumber}-${bedInfo.bedLetter}` : 'No Bed Assigned'}
              </h2>
              {bedInfo?.wingName && (
                <p className="text-slate-500 text-sm">{bedInfo.wingName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 flex-shrink-0"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Profile Header Component */}
          <div className="flex items-center gap-5 bg-slate-50 p-4 rounded-xl">
            <div
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-white shadow-sm flex-shrink-0',
                getAvatarColor(resident.gender)
              )}
            >
              {getInitials(resident.first_name, resident.last_name)}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xl font-bold text-slate-900 leading-tight">
                {resident.first_name} {resident.last_name}
              </p>
              {resident.medical_record_number && (
                <p className="text-slate-500 text-sm font-medium">
                  MRN: {resident.medical_record_number}
                </p>
              )}
              <div className="flex gap-2 mt-2">
                {age !== null && (
                  <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full">
                    Age: {age}
                  </span>
                )}
                <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full capitalize">
                  {resident.gender}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats / Details Grid */}
        <div className="flex flex-wrap gap-3 border-b border-slate-100" style={{ ...sectionPadding, ...sectionPaddingY }}>
          <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Admitted</p>
            <p className="text-slate-900 font-bold text-base">
              {formatDate(resident.admission_date)}
            </p>
          </div>
          <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Payor</p>
            <span
              className={cn(
                'inline-flex px-2 py-0.5 rounded-full text-xs font-bold w-fit',
                getPayorBadgeStyle(resident.payor)
              )}
            >
              {getPayorLabel(resident.payor)}
            </span>
          </div>
          <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Diagnosis</p>
            <p
              className="text-slate-900 font-bold text-base truncate"
              title={resident.diagnosis || '-'}
            >
              {resident.diagnosis || '-'}
            </p>
          </div>
        </div>

        {/* Bed Management Section */}
        {isActive && (
          <div style={{ ...sectionPadding, ...sectionPaddingY }}>
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Icon name="bed" size={18} />
              Bed Management
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onSetIsolation}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all',
                  resident.is_isolation
                    ? 'border-yellow-400 bg-yellow-50 hover:bg-yellow-100'
                    : 'border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50'
                )}
              >
                <Icon name="warning" size={18} className="text-yellow-500" />
                <span className="text-sm font-bold text-yellow-600">
                  {resident.is_isolation ? 'Remove Isolation' : 'Set Isolation'}
                </span>
              </button>
              <button
                className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition-all"
                disabled
              >
                <Icon name="construction" size={18} className="text-slate-600" />
                <span className="text-sm font-bold text-slate-600">Out of Service</span>
              </button>
            </div>
          </div>
        )}

        {/* Medical Alerts Section */}
        {resident.is_isolation && (
          <div style={{ paddingLeft: '24px', paddingRight: '24px', paddingBottom: '24px' }}>
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <Icon name="priority_high" size={20} />
                <span className="text-xs font-bold uppercase">Medical Alert</span>
              </div>
              <p className="text-sm text-red-800 font-medium">
                {getIsolationTypeDisplay(resident.isolation_type)} - Patient requires isolation precautions.
              </p>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="flex-1" style={{ ...sectionPadding, paddingBottom: '40px' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Notes</h3>
            <button className="text-primary-500 text-xs font-bold hover:underline">
              Add Note
            </button>
          </div>
          {resident.notes ? (
            <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {resident.notes}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No notes recorded</p>
          )}
        </div>
      </div>

      {/* Footer Action Buttons */}
      {isActive && (
        <div className="flex-shrink-0 border-t border-slate-100 bg-slate-50" style={fullPadding}>
          <div className="flex gap-3 mb-3">
            <button
              onClick={onTransfer}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg bg-primary-500 text-white font-bold text-sm shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-colors"
            >
              <Icon name={bedInfo ? "swap_horiz" : "bed"} size={18} />
              {bedInfo ? 'Transfer Bed' : 'Assign Bed'}
            </button>
            <button
              onClick={onEditProfile}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              <Icon name="edit" size={18} />
              Edit Profile
            </button>
          </div>
          {bedInfo && onUnassign && (
            <button
              onClick={onUnassign}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors mb-3"
            >
              <Icon name="bed" size={18} />
              Unassign Bed
            </button>
          )}
          <button
            onClick={onDischarge}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-red-200 bg-white text-red-600 font-bold text-sm hover:bg-red-50 transition-colors"
          >
            <Icon name="logout" size={18} />
            Discharge Resident
          </button>
        </div>
      )}
    </div>
  );
}
