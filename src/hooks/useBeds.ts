import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { BedStatus, FilterOptions } from '../types';
import type { BedWithDetails } from '../components/BedCard';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let bedsChannelCounter = 0;

export function useBeds(filters?: FilterOptions) {
  const [beds, setBeds] = useState<BedWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`beds-changes-${++bedsChannelCounter}-${Date.now()}`);

  const fetchBeds = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch beds with room, wing, and resident data
    const { data: bedsData, error: bedsError } = await supabase
      .from('beds')
      .select(`
        *,
        room:rooms!inner(
          *,
          wing:wings!inner(*)
        )
      `)
      .order('room_id')
      .order('bed_letter');

    if (bedsError) {
      setError(bedsError.message);
      setBeds([]);
      setLoading(false);
      return;
    }

    // Fetch residents separately and join
    const { data: residentsData } = await supabase
      .from('residents')
      .select('*')
      .eq('status', 'active')
      .not('bed_id', 'is', null);

    // Create a map of bed_id to resident
    const residentsByBedId = new Map();
    if (residentsData) {
      for (const resident of residentsData) {
        if (resident.bed_id) {
          residentsByBedId.set(resident.bed_id, resident);
        }
      }
    }

    // Combine beds with residents
    let combinedData: BedWithDetails[] = (bedsData || []).map((bed: BedWithDetails) => ({
      ...bed,
      resident: residentsByBedId.get(bed.id) || undefined,
    }));

    // Apply filters
    if (filters?.wing_id) {
      combinedData = combinedData.filter((bed) => bed.room?.wing?.id === filters.wing_id);
    }

    if (filters?.status) {
      combinedData = combinedData.filter((bed) => bed.status === filters.status);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      combinedData = combinedData.filter((bed) => {
        const residentName = bed.resident
          ? `${bed.resident.first_name} ${bed.resident.last_name}`
          : '';
        return (
          bed.bed_letter.toLowerCase().includes(searchLower) ||
          bed.room?.room_number.toLowerCase().includes(searchLower) ||
          bed.room?.wing?.name.toLowerCase().includes(searchLower) ||
          residentName.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by wing display order, then room number, then bed letter
    combinedData.sort((a, b) => {
      const wingOrderA = a.room?.wing?.display_order || 0;
      const wingOrderB = b.room?.wing?.display_order || 0;
      if (wingOrderA !== wingOrderB) return wingOrderA - wingOrderB;

      const roomA = a.room?.room_number || '';
      const roomB = b.room?.room_number || '';
      if (roomA !== roomB) return roomA.localeCompare(roomB);

      return a.bed_letter.localeCompare(b.bed_letter);
    });

    setBeds(combinedData);
    setLoading(false);
  }, [filters?.wing_id, filters?.status, filters?.search]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    fetchBeds();

    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beds' },
        () => fetchBeds()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'residents' },
        () => fetchBeds()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBeds]);

  return { beds, loading, error, refetch: fetchBeds };
}

export function useBedActions() {
  async function updateBedStatus(bedId: string, status: BedStatus, reason?: string) {
    const updateData: { status: BedStatus; updated_at: string; out_of_service_reason?: string | null } = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'out_of_service') {
      updateData.out_of_service_reason = reason || null;
    } else {
      updateData.out_of_service_reason = null;
    }

    const { error } = await supabase
      .from('beds')
      .update(updateData)
      .eq('id', bedId);

    return { error };
  }

  async function assignResident(bedId: string, residentId: string) {
    // Update resident's bed_id
    const { error: residentError } = await supabase
      .from('residents')
      .update({ bed_id: bedId, updated_at: new Date().toISOString() })
      .eq('id', residentId);

    if (residentError) return { error: residentError };

    // Update bed status to occupied
    const { error: bedError } = await supabase
      .from('beds')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', bedId);

    return { error: bedError };
  }

  async function unassignResident(residentId: string, bedId: string) {
    // Remove resident's bed_id
    const { error: residentError } = await supabase
      .from('residents')
      .update({ bed_id: null, updated_at: new Date().toISOString() })
      .eq('id', residentId);

    if (residentError) return { error: residentError };

    // Update bed status to vacant
    const { error: bedError } = await supabase
      .from('beds')
      .update({ status: 'vacant', updated_at: new Date().toISOString() })
      .eq('id', bedId);

    return { error: bedError };
  }

  return { updateBedStatus, assignResident, unassignResident };
}
