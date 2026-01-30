import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { BedStatus, FilterOptions, Gender } from '../types';
import type { BedWithDetails } from '../components/BedCard';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface GenderCompatibilityResult {
  compatible: boolean;
  reason?: string;
  existingGender?: Gender | null;
  roomBedCount?: number;
  sharedBathroomRooms?: string[];
}

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

  const createBed = async (roomId: string, bedLetter: string) => {
    const { data, error } = await supabase
      .from('beds')
      .insert({
        room_id: roomId,
        bed_letter: bedLetter.toUpperCase(),
        status: 'vacant',
      })
      .select()
      .single();

    return { error, data };
  };

  const deleteBed = async (bedId: string) => {
    // First check if the bed is vacant
    const { data: bed, error: fetchError } = await supabase
      .from('beds')
      .select('status')
      .eq('id', bedId)
      .single();

    if (fetchError) {
      return { error: fetchError };
    }

    if (bed.status !== 'vacant') {
      return { error: new Error('Can only delete vacant beds') };
    }

    const { error } = await supabase
      .from('beds')
      .delete()
      .eq('id', bedId);

    return { error };
  };

  const getNextAvailableBedLetter = async (roomId: string): Promise<string> => {
    const { data: existingBeds } = await supabase
      .from('beds')
      .select('bed_letter')
      .eq('room_id', roomId);

    const usedLetters = (existingBeds || []).map((b) => b.bed_letter);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    for (const letter of letters) {
      if (!usedLetters.includes(letter)) {
        return letter;
      }
    }

    return 'A'; // Fallback
  };

  /**
   * Check if a resident's gender is compatible with a bed's room and shared bathroom group.
   * Rules:
   * - Semi-private/triple rooms (2+ beds) cannot have mixed sexes
   * - Rooms sharing a bathroom cannot have mixed sexes across the bathroom group
   */
  const checkGenderCompatibility = async (
    bedId: string,
    residentGender: Gender
  ): Promise<GenderCompatibilityResult> => {
    if (!supabaseConfigured) {
      return { compatible: true };
    }

    // Get the bed with room info
    const { data: bed, error: bedError } = await supabase
      .from('beds')
      .select(`
        id,
        room_id,
        room:rooms!inner(
          id,
          room_number,
          has_shared_bathroom,
          shared_bathroom_group_id
        )
      `)
      .eq('id', bedId)
      .single();

    if (bedError || !bed) {
      return { compatible: true };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomData = bed.room as any;
    const room = {
      id: roomData.id as string,
      room_number: roomData.room_number as string,
      has_shared_bathroom: roomData.has_shared_bathroom as boolean,
      shared_bathroom_group_id: roomData.shared_bathroom_group_id as string | null,
    };

    // Get all beds in the same room
    const { data: roomBeds } = await supabase
      .from('beds')
      .select('id, status')
      .eq('room_id', room.id);

    const roomBedCount = roomBeds?.length || 1;
    const isMultiBedRoom = roomBedCount > 1;

    // Collect all room IDs to check (current room + shared bathroom rooms)
    const roomIdsToCheck: string[] = [room.id];
    let sharedBathroomRooms: string[] = [];

    // If room has shared bathroom, get all rooms in the same bathroom group
    if (room.has_shared_bathroom && room.shared_bathroom_group_id) {
      const { data: bathroomGroupRooms } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('shared_bathroom_group_id', room.shared_bathroom_group_id);

      if (bathroomGroupRooms) {
        for (const bgRoom of bathroomGroupRooms) {
          if (bgRoom.id !== room.id) {
            roomIdsToCheck.push(bgRoom.id);
            sharedBathroomRooms.push(bgRoom.room_number);
          }
        }
      }
    }

    // Only check if it's a multi-bed room OR has shared bathroom
    if (!isMultiBedRoom && sharedBathroomRooms.length === 0) {
      return { compatible: true, roomBedCount };
    }

    // Get all occupied beds in all rooms to check
    const { data: occupiedBeds } = await supabase
      .from('beds')
      .select('id, room_id')
      .in('room_id', roomIdsToCheck)
      .eq('status', 'occupied');

    if (!occupiedBeds || occupiedBeds.length === 0) {
      return { compatible: true, roomBedCount, sharedBathroomRooms };
    }

    // Get residents for those occupied beds
    const occupiedBedIds = occupiedBeds.map((b) => b.id);
    const { data: residents } = await supabase
      .from('residents')
      .select('id, gender, bed_id')
      .in('bed_id', occupiedBedIds)
      .eq('status', 'active');

    if (!residents || residents.length === 0) {
      return { compatible: true, roomBedCount, sharedBathroomRooms };
    }

    // Check if any existing resident has a different gender
    const existingGenders = new Set(residents.map((r) => r.gender));

    // If there's already a mix (shouldn't happen but handle it)
    if (existingGenders.size > 1) {
      return {
        compatible: false,
        reason: 'Room or shared bathroom already has mixed genders',
        roomBedCount,
        sharedBathroomRooms,
      };
    }

    const existingGender = residents[0].gender as Gender;

    // Check if the new resident's gender matches
    if (existingGender !== residentGender) {
      // Determine where the conflict is
      const sameRoomOccupied = residents.some((r) =>
        occupiedBeds.find((b) => b.id === r.bed_id && b.room_id === room.id)
      );

      let reason: string;
      if (sameRoomOccupied && isMultiBedRoom) {
        reason = `Room ${room.room_number} already has a ${existingGender} resident. Semi-private and triple rooms cannot have mixed sexes.`;
      } else {
        reason = `Shared bathroom with Room ${sharedBathroomRooms.join(', ')} has ${existingGender} resident(s). Rooms sharing a bathroom cannot have mixed sexes.`;
      }

      return {
        compatible: false,
        reason,
        existingGender,
        roomBedCount,
        sharedBathroomRooms,
      };
    }

    return {
      compatible: true,
      existingGender,
      roomBedCount,
      sharedBathroomRooms,
    };
  };

  /**
   * Get the required gender for a bed based on room/bathroom occupancy.
   * Returns null if any gender is allowed, or the required gender.
   */
  const getRequiredGenderForBed = async (bedId: string): Promise<Gender | null> => {
    if (!supabaseConfigured) {
      return null;
    }

    // Get the bed with room info
    const { data: bed } = await supabase
      .from('beds')
      .select(`
        id,
        room_id,
        room:rooms!inner(
          id,
          has_shared_bathroom,
          shared_bathroom_group_id
        )
      `)
      .eq('id', bedId)
      .single();

    if (!bed) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomData = bed.room as any;
    const room = {
      id: roomData.id as string,
      has_shared_bathroom: roomData.has_shared_bathroom as boolean,
      shared_bathroom_group_id: roomData.shared_bathroom_group_id as string | null,
    };

    // Get all beds in the same room
    const { data: roomBeds } = await supabase
      .from('beds')
      .select('id')
      .eq('room_id', room.id);

    const isMultiBedRoom = (roomBeds?.length || 1) > 1;

    // Collect all room IDs to check
    const roomIdsToCheck: string[] = [room.id];

    if (room.has_shared_bathroom && room.shared_bathroom_group_id) {
      const { data: bathroomGroupRooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('shared_bathroom_group_id', room.shared_bathroom_group_id);

      if (bathroomGroupRooms) {
        for (const bgRoom of bathroomGroupRooms) {
          if (bgRoom.id !== room.id) {
            roomIdsToCheck.push(bgRoom.id);
          }
        }
      }
    }

    // Only check if constraints apply
    if (!isMultiBedRoom && roomIdsToCheck.length === 1) {
      return null;
    }

    // Get occupied beds
    const { data: occupiedBeds } = await supabase
      .from('beds')
      .select('id')
      .in('room_id', roomIdsToCheck)
      .eq('status', 'occupied');

    if (!occupiedBeds || occupiedBeds.length === 0) {
      return null;
    }

    // Get residents
    const { data: residents } = await supabase
      .from('residents')
      .select('gender')
      .in('bed_id', occupiedBeds.map((b) => b.id))
      .eq('status', 'active');

    if (!residents || residents.length === 0) {
      return null;
    }

    return residents[0].gender as Gender;
  };

  return {
    updateBedStatus,
    assignResident,
    unassignResident,
    createBed,
    deleteBed,
    getNextAvailableBedLetter,
    checkGenderCompatibility,
    getRequiredGenderForBed,
  };
}
