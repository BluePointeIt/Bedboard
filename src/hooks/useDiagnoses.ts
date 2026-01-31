import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface Diagnosis {
  id: string;
  name: string;
  created_at: string;
}

export function useDiagnoses() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnoses = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('diagnoses')
      .select('*')
      .order('name');

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setDiagnoses(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDiagnoses();
  }, [fetchDiagnoses]);

  const addDiagnosis = useCallback(async (name: string) => {
    if (!supabaseConfigured) {
      return { data: null, error: new Error('Supabase not configured') };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { data: null, error: new Error('Diagnosis name is required') };
    }

    const { data, error } = await supabase
      .from('diagnoses')
      .insert({ name: trimmedName })
      .select()
      .single();

    if (data) {
      setDiagnoses((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    return { data, error };
  }, []);

  return {
    diagnoses,
    loading,
    error,
    addDiagnosis,
    refetch: fetchDiagnoses,
  };
}
