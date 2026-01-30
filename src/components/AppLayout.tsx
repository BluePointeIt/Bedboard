import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNavBar } from './TopNavBar';
import { SideNavBar } from './SideNavBar';
import { useWings } from '../hooks/useWings';

export function AppLayout() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWingId, setSelectedWingId] = useState<string | null>(null);
  const { wings, loading } = useWings();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <div className="flex flex-1 overflow-hidden">
        <SideNavBar
          wings={wings}
          selectedWingId={selectedWingId}
          onWingSelect={setSelectedWingId}
          loading={loading}
        />
        <main className="flex-1 overflow-y-auto bg-[#f6f7f8] p-8">
          <div className="max-w-[1400px] mx-auto">
            <Outlet context={{ searchQuery, selectedWingId, wings }} />
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
}
