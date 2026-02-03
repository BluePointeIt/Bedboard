import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, Bed, RoomWithBeds } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let roomsChannelCounter = 0;

export interface CreateRoomInput {
  wing_id: string;
  room_number: string;
  has_shared_bathroom?: boolean;
  shared_bathroom_group_id?: string | null;
}

export interface UpdateRoomInput {
  room_number?: string;
  has_shared_bathroom?: boolean;
  shared_bathroom_group_id?: string | null;
}

export interface BathroomGroup {
  id: string;
  rooms: Room[];
}

export function useRooms(wingId?: string) {
  const [rooms, setRooms] = useState<RoomWithBeds[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`rooms-changes-${++roomsChannelCounter}-${Date.now()}`);

  const fetchRooms = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from('rooms')
      .select(`
        *,
        wing:wings!inner(*)
      `)
      .order('room_number');

    if (wingId) {
      query = query.eq('wing_id', wingId);
    }

    const { data: roomsData, error: roomsError } = await query;

    if (roomsError) {
      setError(roomsError.message);
      setRooms([]);
      setLoading(false);
      return;
    }

    // Fetch all beds for these rooms
    const roomIds = (roomsData || []).map((r: Room) => r.id);

    let bedsData: Bed[] = [];
    if (roomIds.length > 0) {
      const { data: beds, error: bedsError } = await supabase
        .from('beds')
        .select('*')
        .in('room_id', roomIds)
        .order('bed_letter');

      if (!bedsError && beds) {
        bedsData = beds;
      }
    }

    // Fetch residents for occupied beds
    const { data: residentsData } = await supabase
      .from('residents')
      .select('*')
      .eq('status', 'active')
      .not('bed_id', 'is', null);

    const residentsByBedId = new Map();
    if (residentsData) {
      for (const resident of residentsData) {
        if (resident.bed_id) {
          residentsByBedId.set(resident.bed_id, resident);
        }
      }
    }

    // Combine rooms with their beds
    const roomsWithBeds: RoomWithBeds[] = (roomsData || []).map((room: Room) => ({
      ...room,
      beds: bedsData
        .filter((bed) => bed.room_id === room.id)
        .map((bed) => ({
          ...bed,
          resident: residentsByBedId.get(bed.id) || undefined,
        })),
    }));

    setRooms(roomsWithBeds);
    setLoading(false);
  }, [wingId]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    fetchRooms();

    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => fetchRooms()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beds' },
        () => fetchRooms()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'residents' },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  return { rooms, loading, error, refetch: fetchRooms };
}

export function useRoomActions() {
  const createRoom = useCallback(async (input: CreateRoomInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured'), data: null };
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        wing_id: input.wing_id,
        room_number: input.room_number,
        has_shared_bathroom: input.has_shared_bathroom ?? false,
        shared_bathroom_group_id: input.shared_bathroom_group_id ?? null,
      })
      .select()
      .single();

    return { error, data };
  }, []);

  const updateRoom = useCallback(async (roomId: string, updates: UpdateRoomInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomId);

    return { error };
  }, []);

  const deleteRoom = useCallback(async (roomId: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    // First delete all beds in the room
    const { error: bedsError } = await supabase
      .from('beds')
      .delete()
      .eq('room_id', roomId);

    if (bedsError) {
      return { error: bedsError };
    }

    // Then delete the room
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    return { error };
  }, []);

  const getRoomsByBathroomGroup = useCallback(async (groupId: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured'), data: [] };
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('shared_bathroom_group_id', groupId)
      .order('room_number');

    return { error, data: data || [] };
  }, []);

  const getBathroomGroupsForWing = useCallback(async (wingId: string): Promise<{ error: Error | null; data: BathroomGroup[] }> => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured'), data: [] };
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('wing_id', wingId)
      .not('shared_bathroom_group_id', 'is', null)
      .order('room_number');

    if (error) {
      return { error, data: [] };
    }

    // Group rooms by shared_bathroom_group_id
    const groupsMap = new Map<string, Room[]>();
    for (const room of (data || [])) {
      const groupId = room.shared_bathroom_group_id;
      if (groupId) {
        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, []);
        }
        groupsMap.get(groupId)!.push(room);
      }
    }

    const groups: BathroomGroup[] = Array.from(groupsMap.entries()).map(([id, rooms]) => ({
      id,
      rooms,
    }));

    return { error: null, data: groups };
  }, []);

  return {
    createRoom,
    updateRoom,
    deleteRoom,
    getRoomsByBathroomGroup,
    getBathroomGroupsForWing
  };
}
