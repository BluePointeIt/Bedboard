import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Resident, PayorType, IsolationType, ResidentStatus, Gender } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let residentsChannelCounter = 0;

export interface CreateResidentInput {
  first_name: string;
  last_name: string;
  gender: Gender;
  admission_date: string;
  payor: PayorType;
  diagnosis?: string;
  is_isolation?: boolean;
  isolation_type?: IsolationType;
  notes?: string;
  bed_id?: string;
}

export interface UpdateResidentInput {
  id: string;
  first_name?: string;
  last_name?: string;
  gender?: Gender;
  admission_date?: string;
  payor?: PayorType;
  diagnosis?: string;
  is_isolation?: boolean;
  isolation_type?: IsolationType | null;
  notes?: string;
  status?: ResidentStatus;
  bed_id?: string | null;
}

export function useResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`residents-changes-${++residentsChannelCounter}-${Date.now()}`);

  const fetchResidents = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('residents')
      .select('*')
      .order('last_name')
      .order('first_name');

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setResidents(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchResidents();

    if (supabaseConfigured) {
      const channel = supabase
        .channel(channelIdRef.current)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'residents' },
          () => {
            fetchResidents();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchResidents]);

  const createResident = useCallback(async (resident: CreateResidentInput) => {
    if (!supabaseConfigured) {
      return { data: null, error: new Error('Supabase not configured') };
    }

    const { data, error } = await supabase
      .from('residents')
      .insert({
        ...resident,
        is_isolation: resident.is_isolation || false,
        status: 'active',
      })
      .select()
      .single();

    if (data) {
      setResidents((prev) =>
        [...prev, data].sort(
          (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
        )
      );
    }

    return { data, error };
  }, []);

  const updateResident = useCallback(async (updates: UpdateResidentInput) => {
    if (!supabaseConfigured) {
      return { data: null, error: new Error('Supabase not configured') };
    }

    const { id, ...updateData } = updates;

    const { data, error } = await supabase
      .from('residents')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (data) {
      setResidents((prev) => prev.map((r) => (r.id === id ? data : r)));
    }

    return { data, error };
  }, []);

  const deleteResident = useCallback(async (id: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase.from('residents').delete().eq('id', id);

    if (!error) {
      setResidents((prev) => prev.filter((r) => r.id !== id));
    }

    return { error };
  }, []);

  const dischargeResident = useCallback(
    async (id: string, notes?: string) => {
      // First get the resident to check if they have a bed assigned
      const resident = residents.find((r) => r.id === id);

      // If resident has a bed, mark it as vacant
      if (resident?.bed_id) {
        await supabase
          .from('beds')
          .update({ status: 'vacant', updated_at: new Date().toISOString() })
          .eq('id', resident.bed_id);
      }

      return updateResident({
        id,
        status: 'discharged',
        bed_id: null,
        notes: notes,
      });
    },
    [updateResident, residents]
  );

  const setIsolation = useCallback(
    async (id: string, isIsolation: boolean, isolationType?: IsolationType) => {
      return updateResident({
        id,
        is_isolation: isIsolation,
        isolation_type: isIsolation ? isolationType : null,
      });
    },
    [updateResident]
  );

  // Filter helpers
  const activeResidents = residents.filter((r) => r.status === 'active');
  const dischargedResidents = residents.filter((r) => r.status === 'discharged');
  const unassignedResidents = residents.filter((r) => r.status === 'active' && !r.bed_id);
  const isolationResidents = residents.filter((r) => r.status === 'active' && r.is_isolation);

  return {
    residents,
    activeResidents,
    dischargedResidents,
    unassignedResidents,
    isolationResidents,
    loading,
    error,
    createResident,
    updateResident,
    deleteResident,
    dischargeResident,
    setIsolation,
    refetch: fetchResidents,
  };
}

export function useResident(id: string | null) {
  const [resident, setResident] = useState<Resident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !supabaseConfigured) {
      setLoading(false);
      return;
    }

    async function fetchResident() {
      const { data, error: fetchError } = await supabase
        .from('residents')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setResident(data);
      }

      setLoading(false);
    }

    fetchResident();
  }, [id]);

  return { resident, loading, error };
}

// Separate counter for unassigned residents hook
let unassignedChannelCounter = 0;

export function useUnassignedResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const channelIdRef = useRef(`unassigned-residents-${++unassignedChannelCounter}-${Date.now()}`);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    async function fetchUnassignedResidents() {
      const { data } = await supabase
        .from('residents')
        .select('*')
        .eq('status', 'active')
        .is('bed_id', null)
        .order('last_name')
        .order('first_name');

      setResidents(data || []);
      setLoading(false);
    }

    fetchUnassignedResidents();

    const channel = supabase
      .channel(channelIdRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => {
        fetchUnassignedResidents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { residents, loading };
}
