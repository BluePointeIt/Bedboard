import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDemoOptional } from '../context/DemoContext';
import type { Patient } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export function usePatients() {
  const demo = useDemoOptional();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    async function fetchPatients() {
      const { data, error: fetchError } = await supabase
        .from('patients')
        .select('*')
        .order('last_name')
        .order('first_name');

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPatients(data || []);
      }

      setLoading(false);
    }

    fetchPatients();
  }, []);

  const createPatient = useCallback(async (patient: Omit<Patient, 'id' | 'created_at'>) => {
    if (demo) {
      const newPatient = demo.addPatient(patient);
      return { data: newPatient, error: null };
    }

    const { data, error } = await supabase
      .from('patients')
      .insert(patient)
      .select()
      .single();

    if (data) {
      setPatients((prev) => [...prev, data]);
    }

    return { data, error };
  }, [demo]);

  const bulkCreatePatients = useCallback(async (patientsData: Omit<Patient, 'id' | 'created_at'>[]) => {
    const results = { success: 0, errors: [] as string[] };

    for (const patient of patientsData) {
      try {
        if (demo) {
          demo.addPatient(patient);
          results.success++;
        } else {
          const { error } = await supabase
            .from('patients')
            .insert(patient)
            .select()
            .single();

          if (error) {
            results.errors.push(`${patient.first_name} ${patient.last_name}: ${error.message}`);
          } else {
            results.success++;
          }
        }
      } catch (err) {
        results.errors.push(`${patient.first_name} ${patient.last_name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Refetch patients after bulk import
    if (!demo && supabaseConfigured) {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .order('last_name')
        .order('first_name');
      setPatients(data || []);
    }

    return results;
  }, [demo]);

  if (demo) {
    return { patients: demo.patients, loading: false, error: null, createPatient, bulkCreatePatients };
  }

  return { patients, loading, error, createPatient, bulkCreatePatients };
}

export function useUnassignedPatients() {
  const demo = useDemoOptional();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    async function fetchUnassignedPatients() {
      const { data: assignedPatientIds } = await supabase
        .from('bed_assignments')
        .select('patient_id')
        .is('discharged_at', null);

      const assignedIds = (assignedPatientIds || []).map((a) => a.patient_id);

      let query = supabase.from('patients').select('*');

      if (assignedIds.length > 0) {
        query = query.not('id', 'in', `(${assignedIds.join(',')})`);
      }

      const { data } = await query.order('last_name').order('first_name');

      setPatients(data || []);
      setLoading(false);
    }

    fetchUnassignedPatients();
  }, []);

  if (demo) {
    return { patients: demo.getUnassignedPatients(), loading: false };
  }

  return { patients, loading };
}
