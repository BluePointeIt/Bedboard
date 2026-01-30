import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardStats } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let statsChannelCounter = 0;

interface BedWithRoom {
  id: string;
  status: string;
  room: { wing_id: string };
}

interface ResidentWithBed {
  id: string;
  gender: string;
  is_isolation: boolean;
  bed: { id: string; room: { wing_id: string } };
}

export function useDashboardStats(wingId?: string | null) {
  const [stats, setStats] = useState<DashboardStats>({
    total_beds: 0,
    occupied_beds: 0,
    available_beds: 0,
    male_occupied: 0,
    female_occupied: 0,
    isolation_count: 0,
    out_of_service_count: 0,
    occupancy_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`dashboard-stats-${++statsChannelCounter}-${Date.now()}`);

  const fetchStats = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setError(null);

    // Fetch beds with room info
    const { data: bedsData, error: bedsError } = await supabase
      .from('beds')
      .select(`
        id,
        status,
        room:rooms!inner(
          wing_id
        )
      `);

    if (bedsError) {
      setError(bedsError.message);
      setLoading(false);
      return;
    }

    // Filter by wing if specified
    let filteredBeds = (bedsData || []) as unknown as BedWithRoom[];
    if (wingId) {
      filteredBeds = filteredBeds.filter((bed) => bed.room?.wing_id === wingId);
    }

    // Get all active residents with beds for gender and isolation counts
    const { data: residentsData } = await supabase
      .from('residents')
      .select(`
        id,
        gender,
        is_isolation,
        bed:beds!inner(
          id,
          room:rooms!inner(
            wing_id
          )
        )
      `)
      .eq('status', 'active');

    // Filter residents by wing if specified and calculate counts
    let maleOccupied = 0;
    let femaleOccupied = 0;
    let isolationCount = 0;

    if (residentsData) {
      let filteredResidents = residentsData as unknown as ResidentWithBed[];
      if (wingId) {
        filteredResidents = filteredResidents.filter((r) => r.bed?.room?.wing_id === wingId);
      }

      maleOccupied = filteredResidents.filter((r) => r.gender === 'male').length;
      femaleOccupied = filteredResidents.filter((r) => r.gender === 'female').length;
      isolationCount = filteredResidents.filter((r) => r.is_isolation).length;
    }

    // Calculate stats
    const totalBeds = filteredBeds.length;
    const occupiedBeds = filteredBeds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = filteredBeds.filter((b) => b.status === 'vacant').length;
    const outOfServiceBeds = filteredBeds.filter((b) => b.status === 'out_of_service').length;
    const availableBeds = totalBeds - outOfServiceBeds;
    const occupancyRate = availableBeds > 0 ? (occupiedBeds / availableBeds) * 100 : 0;

    setStats({
      total_beds: totalBeds,
      occupied_beds: occupiedBeds,
      available_beds: vacantBeds,
      male_occupied: maleOccupied,
      female_occupied: femaleOccupied,
      isolation_count: isolationCount,
      out_of_service_count: outOfServiceBeds,
      occupancy_rate: Math.round(occupancyRate * 10) / 10,
    });

    setLoading(false);
  }, [wingId]);

  useEffect(() => {
    fetchStats();

    if (supabaseConfigured) {
      const channel = supabase
        .channel(channelIdRef.current)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'beds' },
          () => fetchStats()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'residents' },
          () => fetchStats()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
