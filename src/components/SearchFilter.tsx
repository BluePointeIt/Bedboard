import { Search, Filter } from 'lucide-react';
import type { BedStatus, FilterOptions } from '../types';
import type { Ward } from '../types';

interface SearchFilterProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  wards: Ward[];
}

export function SearchFilter({
  filters,
  onFiltersChange,
  wards,
}: SearchFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4c739a]" />
        <input
          type="text"
          placeholder="Search beds, rooms, or patients..."
          value={filters.search || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#cfdbe7] bg-white text-sm placeholder:text-[#4c739a] focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent"
        />
      </div>

      <div className="flex gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4c739a]" />
          <select
            value={filters.ward_id || ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                ward_id: e.target.value || undefined,
              })
            }
            className="pl-10 pr-8 py-2.5 rounded-lg border border-[#cfdbe7] bg-white text-sm text-[#0d141b] focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="">All Wards</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={filters.status || ''}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              status: (e.target.value as BedStatus) || undefined,
            })
          }
          className="px-4 py-2.5 rounded-lg border border-[#cfdbe7] bg-white text-sm text-[#0d141b] focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent appearance-none cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="cleaning">Cleaning</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>
    </div>
  );
}
