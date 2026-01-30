import { Icon } from './Icon';
import type { WingWithStats } from '../types';

interface SideNavBarProps {
  wings: WingWithStats[];
  selectedWingId: string | null;
  onWingSelect: (wingId: string | null) => void;
  loading?: boolean;
}

const wingIcons: Record<string, string> = {
  rehab: 'corporate_fare',
  long_term: 'domain',
  hospice: 'apartment',
  memory_care: 'psychiatry',
};

export function SideNavBar({ wings, selectedWingId, onWingSelect, loading }: SideNavBarProps) {
  // Find wing with highest occupancy for alert
  const highOccupancyWing = wings.find((w) => w.occupancy_rate >= 90);

  return (
    <aside className="w-64 border-r border-[#e7edf3] bg-white flex flex-col p-4 overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-xs font-bold text-[#4c739a] uppercase tracking-wider mb-4 px-3">
          Facility Map
        </h3>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onWingSelect(null)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              selectedWingId === null
                ? 'bg-primary-500/10 text-primary-500 font-semibold'
                : 'text-[#4c739a] hover:bg-slate-50'
            }`}
          >
            <Icon name="grid_view" size={20} />
            <span className="text-sm">All Wings</span>
          </button>
          {loading ? (
            <div className="px-3 py-4 text-sm text-[#4c739a]">Loading wings...</div>
          ) : (
            wings.map((wing) => (
              <button
                key={wing.id}
                onClick={() => onWingSelect(wing.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  selectedWingId === wing.id
                    ? 'bg-primary-500/10 text-primary-500 font-semibold'
                    : 'text-[#4c739a] hover:bg-slate-50'
                }`}
              >
                <Icon name={wingIcons[wing.wing_type] || 'domain'} size={20} />
                <div className="flex flex-col items-start">
                  <span className="text-sm">{wing.name}</span>
                  <span className="text-xs opacity-70">
                    {wing.occupied_beds}/{wing.total_beds} beds
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {highOccupancyWing && (
        <div className="mt-auto pt-4 border-t border-[#e7edf3]">
          <div className="bg-primary-500/5 rounded-lg p-4">
            <p className="text-xs font-bold text-primary-500 mb-1">OCCUPANCY ALERT</p>
            <p className="text-xs text-[#4c739a] leading-tight">
              {highOccupancyWing.name} reached {Math.round(highOccupancyWing.occupancy_rate)}% capacity.
              Review pending transfers.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
