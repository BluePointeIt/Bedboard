import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { BedStatus, FilterOptions, Gender, Resident } from '../types';
import type { BedWithDetails } from '../components/BedCard';
import {
  calculateBedCompatibility,
  analyzeOccupancyOptimization,
  type BedCompatibilityScore,
  type MoveRecommendation,
} from '../lib/compatibilityUtils';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface UseBedsOptions extends FilterOptions {
  facilityId?: string | null;
}

/**
 * Type definitions for Supabase nested relation responses.
 * Supabase returns nested relations as objects, but TypeScript can't infer the structure.
 */
interface SupabaseRoomData {
  id: string;
  room_number: string;
  has_shared_bathroom: boolean;
  shared_bathroom_group_id: string | null;
  wing?: SupabaseWingData;
}

interface SupabaseWingData {
  id: string;
  name: string;
}

/**
 * Type-safe accessor for wing data from Supabase queries.
 */
function extractWingData(wingData: unknown): SupabaseWingData | undefined {
  if (!wingData || typeof wingData !== 'object') {
    return undefined;
  }
  const wing = wingData as Record<string, unknown>;
  if (typeof wing.id !== 'string' || typeof wing.name !== 'string') {
    return undefined;
  }
  return {
    id: wing.id,
    name: wing.name,
  };
}

/**
 * Type-safe accessor for bed.room data from Supabase queries.
 * Validates and extracts room data from the nested relation.
 */
function extractRoomData(bedRoom: unknown): SupabaseRoomData | null {
  if (!bedRoom || typeof bedRoom !== 'object') {
    return null;
  }
  const room = bedRoom as Record<string, unknown>;
  if (typeof room.id !== 'string' || typeof room.room_number !== 'string') {
    return null;
  }
  return {
    id: room.id,
    room_number: room.room_number,
    has_shared_bathroom: Boolean(room.has_shared_bathroom),
    shared_bathroom_group_id: typeof room.shared_bathroom_group_id === 'string' ? room.shared_bathroom_group_id : null,
    wing: room.wing && typeof room.wing === 'object' ? extractWingData(room.wing) : undefined,
  };
}

/**
 * Type guard to validate Resident structure from Supabase response.
 * Validates required fields and returns properly typed Resident or null.
 */
function extractResident(data: unknown): Resident | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const obj = data as Record<string, unknown>;

  // Validate required fields
  if (typeof obj.id !== 'string') return null;
  if (typeof obj.first_name !== 'string') return null;
  if (typeof obj.last_name !== 'string') return null;
  if (typeof obj.gender !== 'string' || !['male', 'female', 'other'].includes(obj.gender)) return null;
  if (typeof obj.admission_date !== 'string') return null;
  if (typeof obj.payor !== 'string') return null;
  if (typeof obj.status !== 'string') return null;
  if (typeof obj.is_isolation !== 'boolean') return null;
  if (typeof obj.created_at !== 'string') return null;
  if (typeof obj.updated_at !== 'string') return null;

  return {
    id: obj.id,
    bed_id: typeof obj.bed_id === 'string' ? obj.bed_id : undefined,
    medical_record_number: typeof obj.medical_record_number === 'string' ? obj.medical_record_number : undefined,
    first_name: obj.first_name,
    last_name: obj.last_name,
    gender: obj.gender as Gender,
    date_of_birth: typeof obj.date_of_birth === 'string' ? obj.date_of_birth : undefined,
    admission_date: obj.admission_date,
    discharge_date: typeof obj.discharge_date === 'string' ? obj.discharge_date : undefined,
    payor: obj.payor as Resident['payor'],
    diagnosis: typeof obj.diagnosis === 'string' ? obj.diagnosis : undefined,
    is_isolation: obj.is_isolation,
    isolation_type: typeof obj.isolation_type === 'string' ? obj.isolation_type as Resident['isolation_type'] : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
    status: obj.status as Resident['status'],
    created_at: obj.created_at,
    updated_at: obj.updated_at,
  };
}

export interface GenderCompatibilityResult {
  compatible: boolean;
  reason?: string;
  existingGender?: Gender | null;
  roomBedCount?: number;
  sharedBathroomRooms?: string[];
  isolationConflict?: boolean;
}

// Generate unique channel ID for each hook instance
let bedsChannelCounter = 0;

export function useBeds(filters?: FilterOptions | UseBedsOptions) {
  const facilityId = (filters as UseBedsOptions)?.facilityId;
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

    // Build query with facility filter via wing relationship
    let query = supabase
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

    // Filter by facility via wing relationship
    if (facilityId) {
      query = query.eq('room.wing.facility_id', facilityId);
    }

    const { data: bedsData, error: bedsError } = await query;

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
  }, [filters?.wing_id, filters?.status, filters?.search, facilityId]);

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
  const updateBedStatus = useCallback(async (bedId: string, status: BedStatus, reason?: string) => {
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
  }, []);

  const assignResident = useCallback(async (bedId: string, residentId: string) => {
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
  }, []);

  const unassignResident = useCallback(async (residentId: string, bedId: string) => {
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
  }, []);

  const createBed = useCallback(async (roomId: string, bedLetter: string) => {
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
  }, []);

  const deleteBed = useCallback(async (bedId: string) => {
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
  }, []);

  const getNextAvailableBedLetter = useCallback(async (roomId: string): Promise<string> => {
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
  }, []);

  /**
   * Check if a resident's gender and isolation status is compatible with a bed's room and shared bathroom group.
   * Rules:
   * - Semi-private/triple rooms (2+ beds) cannot have mixed sexes
   * - Rooms sharing a bathroom cannot have mixed sexes across the bathroom group
   * - In a room with an isolation resident, only another isolation resident of the same sex can be placed
   * - Non-isolation residents cannot be placed with isolation residents in the same room
   */
  const checkGenderCompatibility = useCallback(async (
    bedId: string,
    residentGender: Gender,
    residentIsIsolation: boolean = false
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

    const roomData = extractRoomData(bed.room);
    if (!roomData) {
      return { compatible: true };
    }
    const room = {
      id: roomData.id,
      room_number: roomData.room_number,
      has_shared_bathroom: roomData.has_shared_bathroom,
      shared_bathroom_group_id: roomData.shared_bathroom_group_id,
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
      .select('id, gender, bed_id, is_isolation')
      .in('bed_id', occupiedBedIds)
      .eq('status', 'active');

    if (!residents || residents.length === 0) {
      return { compatible: true, roomBedCount, sharedBathroomRooms };
    }

    // Check isolation compatibility for same-room residents only (not shared bathroom)
    const sameRoomResidents = residents.filter((r) =>
      occupiedBeds.find((b) => b.id === r.bed_id && b.room_id === room.id)
    );

    if (isMultiBedRoom && sameRoomResidents.length > 0) {
      const hasIsolationResident = sameRoomResidents.some((r) => r.is_isolation);
      const hasNonIsolationResident = sameRoomResidents.some((r) => !r.is_isolation);

      // If room has an isolation resident, new resident must also be isolation AND same gender
      if (hasIsolationResident && !residentIsIsolation) {
        return {
          compatible: false,
          reason: `Room ${room.room_number} has an isolation resident. Only another isolation resident of the same sex can be placed in this room.`,
          roomBedCount,
          sharedBathroomRooms,
          isolationConflict: true,
        };
      }

      // If room has a non-isolation resident, cannot add isolation resident
      if (hasNonIsolationResident && residentIsIsolation) {
        return {
          compatible: false,
          reason: `Room ${room.room_number} has a non-isolation resident. Isolation residents cannot be placed with non-isolation residents.`,
          roomBedCount,
          sharedBathroomRooms,
          isolationConflict: true,
        };
      }
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
      const sameRoomOccupied = sameRoomResidents.length > 0;

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
  }, []);

  /**
   * Get the required gender for a bed based on room/bathroom occupancy.
   * Returns null if any gender is allowed, or the required gender.
   */
  const getRequiredGenderForBed = useCallback(async (bedId: string): Promise<Gender | null> => {
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

    const roomData = extractRoomData(bed.room);
    if (!roomData) return null;
    const room = {
      id: roomData.id,
      has_shared_bathroom: roomData.has_shared_bathroom,
      shared_bathroom_group_id: roomData.shared_bathroom_group_id,
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
  }, []);

  /**
   * Get scored bed recommendations for a resident.
   * Returns all vacant, compatible beds sorted by compatibility score.
   */
  const getBedRecommendations = useCallback(async (
    residentId: string
  ): Promise<BedCompatibilityScore[]> => {
    if (!supabaseConfigured) {
      return [];
    }

    // Get the resident
    const { data: residentData, error: residentError } = await supabase
      .from('residents')
      .select('*')
      .eq('id', residentId)
      .single();

    if (residentError || !residentData) {
      return [];
    }

    // Validate resident data structure
    const resident = extractResident(residentData);
    if (!resident) {
      return [];
    }

    // Get all vacant beds with room and wing info
    const { data: vacantBeds } = await supabase
      .from('beds')
      .select(`
        *,
        room:rooms!inner(
          id,
          room_number,
          has_shared_bathroom,
          shared_bathroom_group_id,
          wing:wings!inner(id, name)
        )
      `)
      .eq('status', 'vacant');

    if (!vacantBeds || vacantBeds.length === 0) {
      return [];
    }

    // Get all beds with their residents to understand room occupancy
    const { data: allBeds } = await supabase
      .from('beds')
      .select(`
        id,
        room_id,
        bed_letter,
        status,
        room:rooms!inner(
          id,
          room_number,
          has_shared_bathroom,
          shared_bathroom_group_id,
          wing:wings!inner(id, name)
        )
      `);

    // Get all active residents with beds
    const { data: allResidents } = await supabase
      .from('residents')
      .select('*')
      .eq('status', 'active')
      .not('bed_id', 'is', null);

    // Create a map of bed_id to resident
    const residentsByBedId = new Map<string, Resident>();
    if (allResidents) {
      for (const r of allResidents) {
        const validatedResident = extractResident(r);
        if (validatedResident && validatedResident.bed_id) {
          residentsByBedId.set(validatedResident.bed_id, validatedResident);
        }
      }
    }

    // Group beds by room
    const roomToBeds = new Map<string, Array<{
      bedId: string;
      bedLetter: string;
      status: string;
      resident?: Resident;
    }>>();

    if (allBeds) {
      for (const bed of allBeds) {
        const roomId = bed.room_id;
        if (!roomToBeds.has(roomId)) {
          roomToBeds.set(roomId, []);
        }
        roomToBeds.get(roomId)!.push({
          bedId: bed.id,
          bedLetter: bed.bed_letter,
          status: bed.status,
          resident: residentsByBedId.get(bed.id),
        });
      }
    }

    // Pre-fetch all bathroom group data to avoid N+1 queries
    const { data: allRoomsWithBathroomGroups } = await supabase
      .from('rooms')
      .select('id, shared_bathroom_group_id')
      .not('shared_bathroom_group_id', 'is', null);

    // Build a map of bathroom_group_id -> room_ids
    const bathroomGroupToRoomIds = new Map<string, string[]>();
    if (allRoomsWithBathroomGroups) {
      for (const room of allRoomsWithBathroomGroups) {
        const groupId = room.shared_bathroom_group_id;
        if (groupId) {
          if (!bathroomGroupToRoomIds.has(groupId)) {
            bathroomGroupToRoomIds.set(groupId, []);
          }
          bathroomGroupToRoomIds.get(groupId)!.push(room.id);
        }
      }
    }

    // Calculate compatibility scores for each vacant bed
    const scores: BedCompatibilityScore[] = [];

    for (const bed of vacantBeds) {
      const roomData = extractRoomData(bed.room);
      if (!roomData) continue;
      const roomId = roomData.id;

      // Get room info
      const bedsInRoom = roomToBeds.get(roomId) || [];
      const occupiedBeds = bedsInRoom.filter(b => b.resident);
      const roomGender = occupiedBeds.length > 0 ? occupiedBeds[0].resident?.gender || null : null;

      // Check gender compatibility first
      if (roomGender && roomGender !== resident.gender) {
        continue; // Skip beds with gender mismatch
      }

      // Check shared bathroom compatibility using pre-fetched data
      if (roomData.has_shared_bathroom && roomData.shared_bathroom_group_id) {
        // Use pre-fetched bathroom group data
        const bathroomRoomIds = bathroomGroupToRoomIds.get(roomData.shared_bathroom_group_id) || [];
        let bathroomGender: Gender | null = null;

        for (const brId of bathroomRoomIds) {
          const brBeds = roomToBeds.get(brId) || [];
          for (const brBed of brBeds) {
            if (brBed.resident) {
              bathroomGender = brBed.resident.gender;
              break;
            }
          }
          if (bathroomGender) break;
        }

        if (bathroomGender && bathroomGender !== resident.gender) {
          continue; // Skip beds with bathroom gender mismatch
        }
      }

      // Check isolation compatibility
      const hasIsolationResident = occupiedBeds.some(b => b.resident?.is_isolation);
      const hasNonIsolationResident = occupiedBeds.some(b => b.resident && !b.resident.is_isolation);

      if (hasIsolationResident && !resident.is_isolation) {
        continue; // Non-isolation can't room with isolation
      }
      if (hasNonIsolationResident && resident.is_isolation) {
        continue; // Isolation can't room with non-isolation
      }

      const roomInfo = {
        id: roomId,
        roomNumber: roomData.room_number,
        bedsInRoom,
        gender: roomGender,
        hasSharedBathroom: roomData.has_shared_bathroom,
        sharedBathroomGroupId: roomData.shared_bathroom_group_id,
      };

      const bedForCalc = {
        ...bed,
        room: {
          room_number: roomData.room_number,
          wing: { name: roomData.wing?.name || '', id: roomData.wing?.id || '' },
        },
      };

      const score = calculateBedCompatibility(resident, bedForCalc, roomInfo);
      scores.push(score);
    }

    // Sort by total score (highest first)
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // Mark top recommendation
    if (scores.length > 0) {
      scores[0].recommended = true;
    }

    return scores;
  }, []);

  /**
   * Get move optimization suggestions to improve bed availability.
   */
  const getMoveOptimizations = useCallback(async (
    unassignedResidents: Resident[]
  ): Promise<MoveRecommendation[]> => {
    if (!supabaseConfigured) {
      return [];
    }

    // Get all beds with room info
    const { data: allBeds } = await supabase
      .from('beds')
      .select(`
        id,
        room_id,
        bed_letter,
        status,
        room:rooms!inner(
          id,
          room_number,
          has_shared_bathroom,
          shared_bathroom_group_id,
          wing:wings!inner(id, name)
        )
      `);

    if (!allBeds) {
      return [];
    }

    // Get all active residents with beds
    const { data: allResidents } = await supabase
      .from('residents')
      .select('*')
      .eq('status', 'active')
      .not('bed_id', 'is', null);

    // Create a map of bed_id to resident
    const residentsByBedId = new Map<string, Resident>();
    if (allResidents) {
      for (const r of allResidents) {
        const validatedResident = extractResident(r);
        if (validatedResident && validatedResident.bed_id) {
          residentsByBedId.set(validatedResident.bed_id, validatedResident);
        }
      }
    }

    // Group beds by room and build room info
    const roomsMap = new Map<string, {
      roomId: string;
      roomNumber: string;
      wingName: string;
      beds: Array<{
        bedId: string;
        bedLetter: string;
        status: string;
        resident?: Resident;
      }>;
      currentGender: Gender | null;
      hasSharedBathroom: boolean;
      sharedBathroomGroupId: string | null;
    }>();

    for (const bed of allBeds) {
      const roomData = extractRoomData(bed.room);
      if (!roomData) continue;
      const roomId = bed.room_id;

      if (!roomsMap.has(roomId)) {
        roomsMap.set(roomId, {
          roomId,
          roomNumber: roomData.room_number,
          wingName: roomData.wing?.name || '',
          beds: [],
          currentGender: null,
          hasSharedBathroom: roomData.has_shared_bathroom,
          sharedBathroomGroupId: roomData.shared_bathroom_group_id,
        });
      }

      const resident = residentsByBedId.get(bed.id);
      roomsMap.get(roomId)!.beds.push({
        bedId: bed.id,
        bedLetter: bed.bed_letter,
        status: bed.status,
        resident,
      });

      // Set room gender based on any occupied bed
      if (resident && !roomsMap.get(roomId)!.currentGender) {
        roomsMap.get(roomId)!.currentGender = resident.gender;
      }
    }

    const rooms = Array.from(roomsMap.values());

    return analyzeOccupancyOptimization(rooms, unassignedResidents);
  }, []);

  /**
   * Get scored bed recommendations for a NEW resident (not yet in database).
   * Takes resident data directly instead of requiring an ID.
   */
  const getBedRecommendationsForNewResident = useCallback(async (
    residentData: {
      gender: Gender;
      is_isolation: boolean;
      date_of_birth?: string;
      diagnosis?: string;
      first_name?: string;
      last_name?: string;
    }
  ): Promise<BedCompatibilityScore[]> => {
    if (!supabaseConfigured) {
      return [];
    }

    // Create a pseudo-resident object for compatibility calculation
    const pseudoResident: Resident = {
      id: 'new-resident',
      first_name: residentData.first_name || 'New',
      last_name: residentData.last_name || 'Resident',
      gender: residentData.gender,
      is_isolation: residentData.is_isolation,
      date_of_birth: residentData.date_of_birth,
      diagnosis: residentData.diagnosis,
      admission_date: new Date().toISOString(),
      status: 'active',
      payor: 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get all vacant beds with room and wing info
    const { data: vacantBeds } = await supabase
      .from('beds')
      .select(`
        *,
        room:rooms!inner(
          id,
          room_number,
          has_shared_bathroom,
          shared_bathroom_group_id,
          wing:wings!inner(id, name)
        )
      `)
      .eq('status', 'vacant');

    if (!vacantBeds || vacantBeds.length === 0) {
      return [];
    }

    // Get all beds with their residents to understand room occupancy
    const { data: allBeds } = await supabase
      .from('beds')
      .select(`
        id,
        room_id,
        bed_letter,
        status,
        room:rooms!inner(
          id,
          room_number,
          has_shared_bathroom,
          shared_bathroom_group_id,
          wing:wings!inner(id, name)
        )
      `);

    // Get all active residents with beds
    const { data: allResidents } = await supabase
      .from('residents')
      .select('*')
      .eq('status', 'active')
      .not('bed_id', 'is', null);

    // Create a map of bed_id to resident
    const residentsByBedId = new Map<string, Resident>();
    if (allResidents) {
      for (const r of allResidents) {
        const validatedResident = extractResident(r);
        if (validatedResident && validatedResident.bed_id) {
          residentsByBedId.set(validatedResident.bed_id, validatedResident);
        }
      }
    }

    // Group beds by room
    const roomToBeds = new Map<string, Array<{
      bedId: string;
      bedLetter: string;
      status: string;
      resident?: Resident;
    }>>();

    if (allBeds) {
      for (const bed of allBeds) {
        const roomId = bed.room_id;
        if (!roomToBeds.has(roomId)) {
          roomToBeds.set(roomId, []);
        }
        roomToBeds.get(roomId)!.push({
          bedId: bed.id,
          bedLetter: bed.bed_letter,
          status: bed.status,
          resident: residentsByBedId.get(bed.id),
        });
      }
    }

    // Pre-fetch all bathroom group data to avoid N+1 queries
    const { data: newResidentBathroomRooms } = await supabase
      .from('rooms')
      .select('id, shared_bathroom_group_id')
      .not('shared_bathroom_group_id', 'is', null);

    // Build a map of bathroom_group_id -> room_ids
    const newResidentBathroomGroupToRoomIds = new Map<string, string[]>();
    if (newResidentBathroomRooms) {
      for (const room of newResidentBathroomRooms) {
        const groupId = room.shared_bathroom_group_id;
        if (groupId) {
          if (!newResidentBathroomGroupToRoomIds.has(groupId)) {
            newResidentBathroomGroupToRoomIds.set(groupId, []);
          }
          newResidentBathroomGroupToRoomIds.get(groupId)!.push(room.id);
        }
      }
    }

    // Calculate compatibility scores for each vacant bed
    const scores: BedCompatibilityScore[] = [];

    for (const bed of vacantBeds) {
      const roomData = extractRoomData(bed.room);
      if (!roomData) continue;
      const roomId = roomData.id;

      // Get room info
      const bedsInRoom = roomToBeds.get(roomId) || [];
      const occupiedBeds = bedsInRoom.filter(b => b.resident);
      const roomGender = occupiedBeds.length > 0 ? occupiedBeds[0].resident?.gender || null : null;

      // Check gender compatibility first
      if (roomGender && roomGender !== pseudoResident.gender) {
        continue; // Skip beds with gender mismatch
      }

      // Check shared bathroom compatibility using pre-fetched data
      if (roomData.has_shared_bathroom && roomData.shared_bathroom_group_id) {
        // Use pre-fetched bathroom group data
        const bathroomRoomIds = newResidentBathroomGroupToRoomIds.get(roomData.shared_bathroom_group_id) || [];
        let bathroomGender: Gender | null = null;

        for (const brId of bathroomRoomIds) {
          const brBeds = roomToBeds.get(brId) || [];
          for (const brBed of brBeds) {
            if (brBed.resident) {
              bathroomGender = brBed.resident.gender;
              break;
            }
          }
          if (bathroomGender) break;
        }

        if (bathroomGender && bathroomGender !== pseudoResident.gender) {
          continue; // Skip beds with bathroom gender mismatch
        }
      }

      // Check isolation compatibility
      const hasIsolationResident = occupiedBeds.some(b => b.resident?.is_isolation);
      const hasNonIsolationResident = occupiedBeds.some(b => b.resident && !b.resident.is_isolation);

      if (hasIsolationResident && !pseudoResident.is_isolation) {
        continue; // Non-isolation can't room with isolation
      }
      if (hasNonIsolationResident && pseudoResident.is_isolation) {
        continue; // Isolation can't room with non-isolation
      }

      const roomInfo = {
        id: roomId,
        roomNumber: roomData.room_number,
        bedsInRoom,
        gender: roomGender,
        hasSharedBathroom: roomData.has_shared_bathroom,
        sharedBathroomGroupId: roomData.shared_bathroom_group_id,
      };

      const bedForCalc = {
        ...bed,
        room: {
          room_number: roomData.room_number,
          wing: { name: roomData.wing?.name || '', id: roomData.wing?.id || '' },
        },
      };

      const score = calculateBedCompatibility(pseudoResident, bedForCalc, roomInfo);
      scores.push(score);
    }

    // Sort by total score (highest first)
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // Mark top recommendation
    if (scores.length > 0) {
      scores[0].recommended = true;
    }

    return scores;
  }, []);

  return {
    updateBedStatus,
    assignResident,
    unassignResident,
    createBed,
    deleteBed,
    getNextAvailableBedLetter,
    checkGenderCompatibility,
    getRequiredGenderForBed,
    getBedRecommendations,
    getBedRecommendationsForNewResident,
    getMoveOptimizations,
  };
}
