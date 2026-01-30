import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Resident, PayerType, ResidentStatus } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface CreateResidentInput {
  medical_record_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  payer_type: PayerType;
  diagnoses?: string[];
  contact_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  admission_date?: string;
  status?: ResidentStatus;
}

export interface UpdateResidentInput {
  id: string;
  medical_record_number?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  payer_type?: PayerType;
  diagnoses?: string[];
  contact_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  admission_date?: string;
  discharge_date?: string;
  status?: ResidentStatus;
  room_id?: string;
  bed_id?: string;
}

export function useResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    // Subscribe to realtime changes
    if (supabaseConfigured) {
      const subscription = supabase
        .channel('residents_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'residents' },
          () => {
            fetchResidents();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
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
        diagnoses: resident.diagnoses || [],
        status: resident.status || 'active',
      })
      .select()
      .single();

    if (data) {
      setResidents((prev) => [...prev, data].sort((a, b) =>
        a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
      ));
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
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (data) {
      setResidents((prev) =>
        prev.map((r) => (r.id === id ? data : r))
      );
    }

    return { data, error };
  }, []);

  const deleteResident = useCallback(async (id: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('residents')
      .delete()
      .eq('id', id);

    if (!error) {
      setResidents((prev) => prev.filter((r) => r.id !== id));
    }

    return { error };
  }, []);

  const dischargeResident = useCallback(async (id: string, notes?: string) => {
    return updateResident({
      id,
      status: 'discharged',
      discharge_date: new Date().toISOString(),
      notes: notes,
    });
  }, [updateResident]);

  const bulkCreateResidents = useCallback(async (residentsData: CreateResidentInput[]) => {
    const results = { success: 0, errors: [] as string[] };

    for (const resident of residentsData) {
      try {
        const { error } = await supabase
          .from('residents')
          .insert({
            ...resident,
            diagnoses: resident.diagnoses || [],
            status: resident.status || 'active',
          })
          .select()
          .single();

        if (error) {
          results.errors.push(`${resident.first_name} ${resident.last_name}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (err) {
        results.errors.push(`${resident.first_name} ${resident.last_name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Refetch residents after bulk import
    await fetchResidents();

    return results;
  }, [fetchResidents]);

  // Filter helpers
  const activeResidents = residents.filter((r) => r.status === 'active');
  const dischargedResidents = residents.filter((r) => r.status === 'discharged');

  return {
    residents,
    activeResidents,
    dischargedResidents,
    loading,
    error,
    createResident,
    updateResident,
    deleteResident,
    dischargeResident,
    bulkCreateResidents,
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

export function useUnassignedResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return { residents, loading };
}
