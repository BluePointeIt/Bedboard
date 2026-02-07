import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Company } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let channelCounter = 0;

export interface CreateFacilityInput {
  name: string;
  facility_code: string;
  organization_code?: string;
  address?: string;
  phone?: string;
  total_beds?: number;
}

export interface UpdateFacilityInput {
  name?: string;
  facility_code?: string;
  organization_code?: string;
  address?: string;
  phone?: string;
  total_beds?: number;
}

export function useFacilities() {
  const [facilities, setFacilities] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`facilities-changes-${++channelCounter}-${Date.now()}`);

  const fetchFacilities = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .order('name');

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setFacilities(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFacilities();

    // Subscribe to changes
    if (supabaseConfigured) {
      const channel = supabase
        .channel(channelIdRef.current)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'companies' },
          () => fetchFacilities()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchFacilities]);

  const createFacility = useCallback(async (input: CreateFacilityInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured'), data: null };
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: input.name,
        facility_code: input.facility_code.toUpperCase(),
        organization_code: input.organization_code?.toUpperCase() || input.facility_code.toUpperCase(),
        address: input.address || null,
        phone: input.phone || null,
        total_beds: input.total_beds || 0,
        is_active: true,
      })
      .select()
      .single();

    if (!error) {
      await fetchFacilities();
    }

    return { error, data };
  }, [fetchFacilities]);

  const updateFacility = useCallback(async (facilityId: string, updates: UpdateFacilityInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const updateData: Record<string, unknown> = { ...updates };
    if (updates.facility_code) {
      updateData.facility_code = updates.facility_code.toUpperCase();
    }
    if (updates.organization_code) {
      updateData.organization_code = updates.organization_code.toUpperCase();
    }

    const { error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', facilityId);

    if (!error) {
      await fetchFacilities();
    }

    return { error };
  }, [fetchFacilities]);

  const toggleFacilityStatus = useCallback(async (facilityId: string, isActive: boolean) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('companies')
      .update({ is_active: isActive })
      .eq('id', facilityId);

    if (!error) {
      await fetchFacilities();
    }

    return { error };
  }, [fetchFacilities]);

  return {
    facilities,
    loading,
    error,
    refetch: fetchFacilities,
    createFacility,
    updateFacility,
    toggleFacilityStatus,
  };
}
