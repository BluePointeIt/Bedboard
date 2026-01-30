import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDemoOptional } from '../context/DemoContext';
import type { Room } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useRooms(wardId?: string) {
  const demo = useDemoOptional();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from('rooms')
      .select('*, ward:wards(*)')
      .order('room_number');

    if (wardId) {
      query = query.eq('ward_id', wardId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRooms(data || []);
    }

    setLoading(false);
  }, [wardId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const createRoom = useCallback(async (room: Omit<Room, 'id' | 'created_at'>) => {
    if (demo) {
      const newRoom = demo.addRoom(room);
      return { data: newRoom, error: null };
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert(room)
      .select()
      .single();

    if (data) {
      setRooms((prev) => [...prev, data]);
    }

    return { data, error };
  }, [demo]);

  const bulkCreateRooms = useCallback(async (roomsData: Omit<Room, 'id' | 'created_at'>[]) => {
    const results = { success: 0, errors: [] as string[] };

    for (const room of roomsData) {
      try {
        if (demo) {
          demo.addRoom(room);
          results.success++;
        } else {
          const { error } = await supabase
            .from('rooms')
            .insert(room)
            .select()
            .single();

          if (error) {
            results.errors.push(`Room ${room.room_number}: ${error.message}`);
          } else {
            results.success++;
          }
        }
      } catch (err) {
        results.errors.push(`Room ${room.room_number}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Refetch rooms after bulk import
    if (!demo && supabaseConfigured) {
      await fetchRooms();
    }

    return results;
  }, [demo, fetchRooms]);

  if (demo) {
    let filteredRooms = demo.rooms;
    if (wardId) {
      filteredRooms = filteredRooms.filter(r => r.ward_id === wardId);
    }
    return { rooms: filteredRooms, loading: false, error: null, createRoom, bulkCreateRooms, refetch: () => {} };
  }

  return { rooms, loading, error, createRoom, bulkCreateRooms, refetch: fetchRooms };
}
