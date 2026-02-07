import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import type { Company } from '../types';

interface FacilitySwitcherProps {
  currentFacility: Company | null;
  accessibleFacilities: Company[];
  onFacilityChange: (facility: Company) => void;
}

export function FacilitySwitcher({
  currentFacility,
  accessibleFacilities,
  onFacilityChange,
}: FacilitySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Don't render if user only has access to one facility
  if (accessibleFacilities.length <= 1) {
    return null;
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (facility: Company) => {
    onFacilityChange(facility);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#e7edf3] hover:bg-[#dde5ed] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon name="business" size={18} className="text-[#4c739a]" />
        <div className="flex flex-col items-start">
          <span className="text-xs text-[#4c739a] font-medium">Facility</span>
          <span className="text-sm font-semibold text-[#0d141b]">
            {currentFacility?.facility_code || 'Select'}
          </span>
        </div>
        <Icon
          name={isOpen ? 'expand_less' : 'expand_more'}
          size={20}
          className="text-[#4c739a] ml-1"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-[#e7edf3] py-2 z-50"
          role="listbox"
          aria-label="Select facility"
        >
          <div className="px-4 py-2 border-b border-[#e7edf3]">
            <h3 className="font-semibold text-[#0d141b] text-sm">Switch Facility</h3>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {accessibleFacilities.map((facility) => {
              const isSelected = facility.id === currentFacility?.id;
              return (
                <button
                  key={facility.id}
                  onClick={() => handleSelect(facility)}
                  className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                    isSelected
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-[#f6f7f8] text-[#0d141b]'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-[#e7edf3] text-[#4c739a]'
                    }`}
                  >
                    {facility.facility_code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isSelected ? 'text-primary-700' : 'text-[#0d141b]'
                      }`}
                    >
                      {facility.name}
                    </p>
                    {facility.address && (
                      <p className="text-xs text-[#4c739a] truncate">{facility.address}</p>
                    )}
                  </div>
                  {isSelected && (
                    <Icon name="check" size={18} className="text-primary-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
