import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useDemoOptional } from '../context/DemoContext';
import type { BedWithDetails, BedStatus, FilterOptions, DashboardStats } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useBeds(filters?: FilterOptions) {
  const demo = useDemoOptional();
  const [beds, setBeds] = useState<BedWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredDemoBeds = useMemo(() => {
    if (!demo) return [];
    let result = demo.beds;

    if (filters?.ward_id) {
      result = result.filter(bed => bed.room?.ward?.id === filters.ward_id);
    }

    if (filters?.status) {
      result = result.filter(bed => bed.status === filters.status);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(bed => {
        const patientName = bed.current_assignment?.patient
          ? `${bed.current_assignment.patient.first_name} ${bed.current_assignment.patient.last_name}`
          : '';
        return (
          bed.bed_number.toLowerCase().includes(searchLower) ||
          bed.room?.room_number.toLowerCase().includes(searchLower) ||
          bed.room?.ward?.name.toLowerCase().includes(searchLower) ||
          patientName.toLowerCase().includes(searchLower)
        );
      });
    }

    return result;
  }, [demo, filters?.ward_id, filters?.status, filters?.search]);

  const fetchBeds = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from('beds')
      .select(`
        *,
        room:rooms(
          *,
          ward:wards(*)
        ),
        current_assignment:bed_assignments(
          *,
          patient:patients(*)
        )
      `)
      .is('current_assignment.discharged_at', null)
      .order('room_id')
      .order('bed_number');

    if (filters?.ward_id) {
      query = query.eq('room.ward_id', filters.ward_id);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setBeds([]);
    } else {
      let filteredData = (data || []) as BedWithDetails[];

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter((bed) => {
          const patientName = bed.current_assignment?.patient
            ? `${bed.current_assignment.patient.first_name} ${bed.current_assignment.patient.last_name}`
            : '';
          return (
            bed.bed_number.toLowerCase().includes(searchLower) ||
            bed.room?.room_number.toLowerCase().includes(searchLower) ||
            bed.room?.ward?.name.toLowerCase().includes(searchLower) ||
            patientName.toLowerCase().includes(searchLower)
          );
        });
      }

      setBeds(filteredData);
    }

    setLoading(false);
  }, [filters?.ward_id, filters?.status, filters?.search]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    fetchBeds();

    const channel = supabase
      .channel('beds-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beds' },
        () => fetchBeds()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bed_assignments' },
        () => fetchBeds()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBeds]);

  if (demo) {
    return { beds: filteredDemoBeds, loading: false, error: null, refetch: () => {} };
  }

  return { beds, loading, error, refetch: fetchBeds };
}

export function useBedStats() {
  const demo = useDemoOptional();
  const [stats, setStats] = useState<DashboardStats>({
    total_beds: 0,
    available_beds: 0,
    occupied_beds: 0,
    isolation_beds: 0,
    maintenance_beds: 0,
    occupancy_rate: 0,
    case_mix: { private: 0, medicare: 0, medicaid: 0, managed_care: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    async function fetchStats() {
      const { data: bedsData, error: bedsError } = await supabase
        .from('beds')
        .select('id, status');

      const { data: isolationData } = await supabase
        .from('bed_assignments')
        .select('bed_id')
        .is('discharged_at', null)
        .eq('is_isolation', true);

      // Get case mix from active assignments with patient payer info
      const { data: assignmentsData } = await supabase
        .from('bed_assignments')
        .select('patient:patients(payer_type)')
        .is('discharged_at', null);

      const caseMix = { private: 0, medicare: 0, medicaid: 0, managed_care: 0 };
      if (assignmentsData) {
        for (const assignment of assignmentsData) {
          const payerType = (assignment.patient as { payer_type?: string })?.payer_type;
          if (payerType === 'private') caseMix.private++;
          else if (payerType === 'medicare') caseMix.medicare++;
          else if (payerType === 'medicaid') caseMix.medicaid++;
          else if (payerType === 'managed_care') caseMix.managed_care++;
        }
      }

      if (!bedsError && bedsData) {
        const total = bedsData.length;
        const available = bedsData.filter((b) => b.status === 'available').length;
        const occupied = bedsData.filter((b) => b.status === 'occupied').length;
        const maintenance = bedsData.filter((b) => b.status === 'maintenance').length;
        const isolation = isolationData?.length || 0;

        setStats({
          total_beds: total,
          available_beds: available,
          occupied_beds: occupied,
          isolation_beds: isolation,
          maintenance_beds: maintenance,
          occupancy_rate: total > 0 ? Math.round((occupied / total) * 100) : 0,
          case_mix: caseMix,
        });
      }

      setLoading(false);
    }

    fetchStats();

    const channel = supabase
      .channel('beds-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beds' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (demo) {
    return { stats: demo.stats, loading: false };
  }

  return { stats, loading };
}

export function useBedActions() {
  const demo = useDemoOptional();

  async function updateBedStatus(bedId: string, status: BedStatus) {
    if (demo) {
      demo.updateBedStatus(bedId, status);
      return { error: null };
    }

    const { error } = await supabase
      .from('beds')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bedId);

    return { error };
  }

  async function createBed(roomId: string, bedNumber: string, status: BedStatus = 'available') {
    if (demo) {
      demo.addBed({ room_id: roomId, bed_number: bedNumber, status });
      return { error: null };
    }

    const { error } = await supabase
      .from('beds')
      .insert({
        room_id: roomId,
        bed_number: bedNumber,
        status,
      });

    return { error };
  }

  async function assignPatient(
    bedId: string,
    patientId: string,
    assignedBy: string,
    isIsolation: boolean = false,
    notes?: string
  ) {
    if (demo) {
      demo.assignPatient(bedId, patientId, isIsolation);
      return { error: null };
    }

    const { error: assignError } = await supabase.from('bed_assignments').insert({
      bed_id: bedId,
      patient_id: patientId,
      assigned_by: assignedBy,
      is_isolation: isIsolation,
      notes,
    });

    if (assignError) return { error: assignError };

    const { error: statusError } = await supabase
      .from('beds')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', bedId);

    return { error: statusError };
  }

  async function dischargePatient(assignmentId: string, bedId: string) {
    if (demo) {
      demo.dischargePatient(assignmentId, bedId);
      return { error: null };
    }

    const { error: dischargeError } = await supabase
      .from('bed_assignments')
      .update({ discharged_at: new Date().toISOString() })
      .eq('id', assignmentId);

    if (dischargeError) return { error: dischargeError };

    const { error: statusError } = await supabase
      .from('beds')
      .update({ status: 'cleaning', updated_at: new Date().toISOString() })
      .eq('id', bedId);

    return { error: statusError };
  }

  return { updateBedStatus, createBed, assignPatient, dischargePatient };
}
