import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Wing, WingType, WingWithStats } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let channelCounter = 0;

interface BedWithRoom {
  id: string;
  status: string;
  room: { wing_id: string };
}

/**
 * Type guard to validate BedWithRoom structure from Supabase response.
 */
function isBedWithRoom(data: unknown): data is BedWithRoom {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.status !== 'string') return false;
  if (!obj.room || typeof obj.room !== 'object') return false;
  const room = obj.room as Record<string, unknown>;
  return typeof room.wing_id === 'string';
}

export interface CreateWingInput {
  name: string;
  wing_type: WingType;
  facility_id: string;
}

export interface UpdateWingInput {
  name?: string;
  wing_type?: WingType;
}

export interface UseWingsOptions {
  facilityId?: string | null;
}

export function useWings(options?: UseWingsOptions) {
  const facilityId = options?.facilityId;
  const [wings, setWings] = useState<WingWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`wings-changes-${++channelCounter}-${Date.now()}`);

  const fetchWings = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query with optional facility filter
    let query = supabase
      .from('wings')
      .select('*')
      .order('display_order');

    // Filter by facility if provided
    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data: wingsData, error: wingsError } = await query;

    if (wingsError) {
      setError(wingsError.message);
      setLoading(false);
      return;
    }

    // Fetch bed counts per wing
    const { data: bedsData } = await supabase
      .from('beds')
      .select(`
        id,
        status,
        room:rooms!inner(
          wing_id
        )
      `);

    // Validate and cast data structure
    // The type guard validates each element at runtime, making this cast safe
    // We use 'unknown' intermediate cast because Supabase infers joins as arrays
    const beds = (bedsData || []).filter(isBedWithRoom) as unknown as BedWithRoom[];

    // Calculate stats for each wing
    const wingsWithStats: WingWithStats[] = (wingsData || []).map((wing: Wing) => {
      const wingBeds = beds.filter((bed) => bed.room.wing_id === wing.id);
      const totalBeds = wingBeds.length;
      const occupiedBeds = wingBeds.filter((bed) => bed.status === 'occupied').length;
      const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

      return {
        ...wing,
        total_beds: totalBeds,
        occupied_beds: occupiedBeds,
        occupancy_rate: occupancyRate,
      };
    });

    setWings(wingsWithStats);
    setLoading(false);
  }, [facilityId]);

  useEffect(() => {
    fetchWings();

    // Subscribe to changes with unique channel name per hook instance
    if (supabaseConfigured) {
      const channel = supabase
        .channel(channelIdRef.current)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wings' },
          () => fetchWings()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'beds' },
          () => fetchWings()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms' },
          () => fetchWings()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchWings]);

  const updateWing = useCallback(async (wingId: string, updates: UpdateWingInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('wings')
      .update(updates)
      .eq('id', wingId);

    if (!error) {
      await fetchWings();
    }

    return { error };
  }, [fetchWings]);

  const addBedsToWing = useCallback(async (wingId: string, count: number) => {
    if (!supabaseConfigured || count <= 0) {
      return { error: new Error('Invalid request') };
    }

    // Get existing rooms for this wing
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, room_number')
      .eq('wing_id', wingId)
      .order('room_number');

    if (!rooms || rooms.length === 0) {
      return { error: new Error('No rooms found in this wing') };
    }

    // Get existing beds to find next available letter
    const { data: existingBeds } = await supabase
      .from('beds')
      .select('room_id, bed_letter')
      .in('room_id', rooms.map(r => r.id));

    // Distribute new beds across rooms
    const bedsToCreate: { room_id: string; bed_letter: string; status: string }[] = [];
    let bedsAdded = 0;

    for (const room of rooms) {
      if (bedsAdded >= count) break;

      const roomBeds = existingBeds?.filter(b => b.room_id === room.id) || [];
      const usedLetters = roomBeds.map(b => b.bed_letter);

      // Find next available letter
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (const letter of letters) {
        if (bedsAdded >= count) break;
        if (!usedLetters.includes(letter)) {
          bedsToCreate.push({
            room_id: room.id,
            bed_letter: letter,
            status: 'vacant'
          });
          usedLetters.push(letter);
          bedsAdded++;
        }
      }
    }

    if (bedsToCreate.length === 0) {
      return { error: new Error('Could not add beds - rooms may be full') };
    }

    const { error } = await supabase
      .from('beds')
      .insert(bedsToCreate);

    if (!error) {
      await fetchWings();
    }

    return { error, added: bedsToCreate.length };
  }, [fetchWings]);

  const removeBedsFromWing = useCallback(async (wingId: string, count: number) => {
    if (!supabaseConfigured || count <= 0) {
      return { error: new Error('Invalid request') };
    }

    // Get vacant beds from this wing (only remove vacant beds)
    const { data: vacantBeds } = await supabase
      .from('beds')
      .select(`
        id,
        status,
        room:rooms!inner(wing_id)
      `)
      .eq('status', 'vacant');

    // Validate and cast data structure
    // The type guard validates each element at runtime, making this cast safe
    // We use 'unknown' intermediate cast because Supabase infers joins as arrays
    const validVacantBeds = (vacantBeds || []).filter(isBedWithRoom) as unknown as BedWithRoom[];
    const wingVacantBeds = validVacantBeds.filter((b) => b.room.wing_id === wingId);

    if (wingVacantBeds.length === 0) {
      return { error: new Error('No vacant beds to remove') };
    }

    const bedsToRemove = wingVacantBeds.slice(0, count).map((b) => b.id);

    const { error } = await supabase
      .from('beds')
      .delete()
      .in('id', bedsToRemove);

    if (!error) {
      await fetchWings();
    }

    return { error, removed: bedsToRemove.length };
  }, [fetchWings]);

  const createWing = useCallback(async (input: CreateWingInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured'), data: null };
    }

    // Get the max display_order for the facility
    const { data: existingWings } = await supabase
      .from('wings')
      .select('display_order')
      .eq('facility_id', input.facility_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextDisplayOrder = existingWings && existingWings.length > 0
      ? (existingWings[0].display_order || 0) + 1
      : 1;

    const { data, error } = await supabase
      .from('wings')
      .insert({
        name: input.name,
        wing_type: input.wing_type,
        facility_id: input.facility_id,
        display_order: nextDisplayOrder,
      })
      .select()
      .single();

    if (!error) {
      await fetchWings();
    }

    return { error, data };
  }, [fetchWings]);

  const deleteWing = useCallback(async (wingId: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('wings')
      .delete()
      .eq('id', wingId);

    if (!error) {
      await fetchWings();
    }

    return { error };
  }, [fetchWings]);

  return { wings, loading, error, refetch: fetchWings, createWing, updateWing, deleteWing, addBedsToWing, removeBedsFromWing };
}
