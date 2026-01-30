import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDemoOptional } from '../context/DemoContext';
import type { Ward } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useWards() {
  const demo = useDemoOptional();
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWards = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('wards')
      .select('*')
      .order('floor')
      .order('name');

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setWards(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!demo) {
      fetchWards();
    }
  }, [fetchWards, demo]);

  const createWard = useCallback(async (ward: Omit<Ward, 'id' | 'created_at'>) => {
    // Demo mode - use demo context
    if (demo) {
      const newWard = demo.addWard(ward);
      return { data: newWard, error: null };
    }

    // Supabase mode
    if (!supabaseConfigured) {
      return { data: null, error: new Error('Database not configured') };
    }

    const { data, error } = await supabase
      .from('wards')
      .insert(ward)
      .select()
      .single();

    if (data) {
      setWards((prev) => [...prev, data].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name)));
    }

    return { data, error };
  }, [demo]);

  const updateWard = useCallback(async (id: string, updates: Partial<Omit<Ward, 'id' | 'created_at'>>) => {
    // Demo mode - use demo context
    if (demo) {
      const updatedWard = demo.updateWard(id, updates);
      return { data: updatedWard, error: null };
    }

    // Supabase mode
    if (!supabaseConfigured) {
      return { data: null, error: new Error('Database not configured') };
    }

    const { data, error } = await supabase
      .from('wards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (data) {
      setWards((prev) =>
        prev.map((w) => (w.id === id ? data : w))
          .sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name))
      );
    }

    return { data, error };
  }, [demo]);

  const deleteWard = useCallback(async (id: string) => {
    // Demo mode - use demo context
    if (demo) {
      demo.deleteWard(id);
      return { error: null };
    }

    // Supabase mode
    if (!supabaseConfigured) {
      return { error: new Error('Database not configured') };
    }

    const { error } = await supabase
      .from('wards')
      .delete()
      .eq('id', id);

    if (!error) {
      setWards((prev) => prev.filter((w) => w.id !== id));
    }

    return { error };
  }, [demo]);

  // In demo mode, return demo data
  if (demo) {
    return {
      wards: demo.wards,
      loading: false,
      error: null,
      createWard,
      updateWard,
      deleteWard,
      refetch: () => {}
    };
  }

  return { wards, loading, error, createWard, updateWard, deleteWard, refetch: fetchWards };
}
