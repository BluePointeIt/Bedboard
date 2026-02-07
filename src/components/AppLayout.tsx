import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { TopNavBar } from './TopNavBar';
import { SideNavBar } from './SideNavBar';
import { useWings } from '../hooks/useWings';
import type { User, Company } from '../types';

interface AppLayoutProps {
  user?: SupabaseUser | null;
  profile?: User | null;
  currentFacility?: Company | null;
  accessibleFacilities?: Company[];
  onFacilityChange?: (facility: Company) => void;
  onSignOut?: () => Promise<{ error: Error | null }>;
}

export function AppLayout({
  user,
  profile,
  currentFacility,
  accessibleFacilities = [],
  onFacilityChange,
  onSignOut,
}: AppLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWingId, setSelectedWingId] = useState<string | null>(null);

  // Fetch wings filtered by current facility
  const { wings, loading } = useWings({ facilityId: currentFacility?.id });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        user={user}
        profile={profile}
        currentFacility={currentFacility}
        accessibleFacilities={accessibleFacilities}
        onFacilityChange={onFacilityChange}
        onSignOut={onSignOut}
      />
      <div className="flex flex-1 overflow-hidden">
        <SideNavBar
          wings={wings}
          selectedWingId={selectedWingId}
          onWingSelect={setSelectedWingId}
          loading={loading}
        />
        <main className="flex-1 overflow-y-auto bg-[#f6f7f8]" style={{ padding: '32px' }}>
          <div className="max-w-[1400px] mx-auto">
            <Outlet context={{ searchQuery, selectedWingId, wings, currentFacility }} />
          </div>
        </main>
      </div>
    </div>
  );
}

// Hook for child routes to access layout context
export interface LayoutContext {
  searchQuery: string;
  selectedWingId: string | null;
  wings: ReturnType<typeof useWings>['wings'];
  currentFacility: Company | null;
}
