import { cn } from '../lib/utils';
import type { Resident } from '../types';
import { Icon } from './Icon';

interface BedInfo {
  roomNumber: string;
  bedLetter: string;
  wingName: string;
}

interface ResidentCardProps {
  resident: Resident;
  bedInfo?: BedInfo;
  isSelected: boolean;
  onClick: () => void;
  onAssignBed?: () => void;
}

function IsolationStrip({ gender }: { gender: string }) {
  const genderColor = gender === 'male' ? 'bg-primary-500' : gender === 'female' ? 'bg-pink-400' : 'bg-violet-500';

  return (
    <div className="h-1 flex rounded-t-xl overflow-hidden">
      <div className={cn('flex-1', genderColor)} />
      <div className="flex-1 bg-yellow-400" />
    </div>
  );
}

function getStatusStripColor(gender: string): string {
  if (gender === 'male') {
    return 'bg-primary-500';
  }
  if (gender === 'female') {
    return 'bg-pink-400';
  }
  return 'bg-violet-500';
}

export function ResidentCard({ resident, bedInfo, isSelected, onClick, onAssignBed }: ResidentCardProps) {
  const isIsolation = resident.is_isolation;
  const isUnassigned = !bedInfo;

  const handleAssignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAssignBed?.();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 cursor-pointer transition-all hover:shadow-md shadow-sm',
        isSelected && 'ring-2 ring-primary-500 ring-offset-2'
      )}
    >
      {isIsolation ? (
        <IsolationStrip gender={resident.gender} />
      ) : (
        <div className={cn('h-1 rounded-t-xl', getStatusStripColor(resident.gender))} />
      )}
      <div className="p-6">
        <p className="text-xs font-bold text-slate-400 mb-1">
          {bedInfo ? `BED ${bedInfo.roomNumber}-${bedInfo.bedLetter}` : 'UNASSIGNED'}
        </p>
        <p className="text-lg font-bold text-slate-900 truncate">
          {resident.first_name} {resident.last_name}
        </p>
        {isUnassigned && onAssignBed && (
          <button
            onClick={handleAssignClick}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Icon name="bed" size={16} />
            Assign Bed
          </button>
        )}
      </div>
    </div>
  );
}
