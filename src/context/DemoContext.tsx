import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  demoBeds,
  demoWards,
  demoPatients,
  demoAssignments,
  demoRooms,
} from '../lib/demo-data';
import type { BedWithDetails, Ward, Patient, BedStatus, DashboardStats, BedAssignment, Bed, Room } from '../types';

interface DemoContextType {
  isDemoMode: boolean;
  beds: BedWithDetails[];
  wards: Ward[];
  rooms: Room[];
  patients: Patient[];
  stats: DashboardStats;
  updateBedStatus: (bedId: string, status: BedStatus) => void;
  assignPatient: (bedId: string, patientId: string, isIsolation?: boolean) => void;
  dischargePatient: (assignmentId: string, bedId: string) => void;
  addPatient: (patient: Omit<Patient, 'id' | 'created_at'>) => Patient;
  addWard: (ward: Omit<Ward, 'id' | 'created_at'>) => Ward;
  updateWard: (id: string, updates: Partial<Omit<Ward, 'id' | 'created_at'>>) => Ward | null;
  deleteWard: (id: string) => void;
  addRoom: (room: Omit<Room, 'id' | 'created_at'>) => Room;
  addBed: (bed: Omit<Bed, 'id' | 'created_at' | 'updated_at'>) => Bed;
  getUnassignedPatients: () => Patient[];
}

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [beds, setBeds] = useState<Bed[]>(demoBeds);
  const [wards, setWards] = useState<Ward[]>(demoWards);
  const [rooms, setRooms] = useState<Room[]>(demoRooms);
  const [assignments, setAssignments] = useState<BedAssignment[]>(demoAssignments);
  const [patients, setPatients] = useState<Patient[]>(demoPatients);

  const getBedsWithDetailsLocal = useCallback((): BedWithDetails[] => {
    return beds.map(bed => {
      const room = rooms.find(r => r.id === bed.room_id);
      const ward = room ? wards.find(w => w.id === room.ward_id) : undefined;

      const roomWithWard = room ? {
        ...room,
        ward: ward!
      } : {
        id: bed.room_id,
        ward_id: '1',
        room_number: 'Unknown',
        room_type: 'ward' as const,
        created_at: new Date().toISOString(),
        ward: wards[0]
      };

      const assignment = assignments.find(a => a.bed_id === bed.id && !a.discharged_at);
      const patient = assignment ? patients.find(p => p.id === assignment.patient_id) : undefined;

      return {
        ...bed,
        room: roomWithWard,
        current_assignment: assignment && patient ? { ...assignment, patient } : undefined,
      };
    });
  }, [beds, rooms, wards, assignments, patients]);

  const getStatsLocal = useCallback((): DashboardStats => {
    const total = beds.length;
    const available = beds.filter(b => b.status === 'available').length;
    const occupied = beds.filter(b => b.status === 'occupied').length;
    const maintenance = beds.filter(b => b.status === 'maintenance').length;

    // Count isolation beds (occupied beds with isolation flag)
    const isolationBedIds = assignments
      .filter(a => !a.discharged_at && a.is_isolation)
      .map(a => a.bed_id);
    const isolation = beds.filter(b => isolationBedIds.includes(b.id)).length;

    // Calculate case mix from active assignments
    const caseMix = { private: 0, medicare: 0, medicaid: 0, managed_care: 0 };
    for (const assignment of assignments.filter(a => !a.discharged_at)) {
      const patient = patients.find(p => p.id === assignment.patient_id);
      if (patient?.payer_type === 'private') caseMix.private++;
      else if (patient?.payer_type === 'medicare') caseMix.medicare++;
      else if (patient?.payer_type === 'medicaid') caseMix.medicaid++;
      else if (patient?.payer_type === 'managed_care') caseMix.managed_care++;
    }

    return {
      total_beds: total,
      available_beds: available,
      occupied_beds: occupied,
      isolation_beds: isolation,
      maintenance_beds: maintenance,
      occupancy_rate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      case_mix: caseMix,
    };
  }, [beds, assignments, patients]);

  const updateBedStatus = useCallback((bedId: string, status: BedStatus) => {
    setBeds(prev => prev.map(bed =>
      bed.id === bedId ? { ...bed, status, updated_at: new Date().toISOString() } : bed
    ));
  }, []);

  const assignPatient = useCallback((bedId: string, patientId: string, isIsolation: boolean = false) => {
    const newAssignment: BedAssignment = {
      id: `assign-${Date.now()}`,
      bed_id: bedId,
      patient_id: patientId,
      assigned_by: 'demo-user',
      assigned_at: new Date().toISOString(),
      is_isolation: isIsolation,
    };
    setAssignments(prev => [...prev, newAssignment]);
    setBeds(prev => prev.map(bed =>
      bed.id === bedId ? { ...bed, status: 'occupied', updated_at: new Date().toISOString() } : bed
    ));
  }, []);

  const dischargePatient = useCallback((assignmentId: string, bedId: string) => {
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId ? { ...a, discharged_at: new Date().toISOString() } : a
    ).filter(a => !a.discharged_at));
    setBeds(prev => prev.map(bed =>
      bed.id === bedId ? { ...bed, status: 'cleaning', updated_at: new Date().toISOString() } : bed
    ));
  }, []);

  const addPatient = useCallback((patientData: Omit<Patient, 'id' | 'created_at'>): Patient => {
    const newPatient: Patient = {
      ...patientData,
      id: `patient-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setPatients(prev => [...prev, newPatient]);
    return newPatient;
  }, []);

  const addWard = useCallback((wardData: Omit<Ward, 'id' | 'created_at'>): Ward => {
    const newWard: Ward = {
      ...wardData,
      id: `ward-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setWards(prev => [...prev, newWard].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name)));
    return newWard;
  }, []);

  const updateWard = useCallback((id: string, updates: Partial<Omit<Ward, 'id' | 'created_at'>>): Ward | null => {
    let updatedWard: Ward | null = null;
    setWards(prev => {
      const newWards = prev.map(ward => {
        if (ward.id === id) {
          updatedWard = { ...ward, ...updates };
          return updatedWard;
        }
        return ward;
      });
      return newWards.sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
    });
    return updatedWard;
  }, []);

  const deleteWard = useCallback((id: string): void => {
    setWards(prev => prev.filter(ward => ward.id !== id));
    // Also remove rooms and beds associated with this ward
    setRooms(prev => prev.filter(room => room.ward_id !== id));
  }, []);

  const addRoom = useCallback((roomData: Omit<Room, 'id' | 'created_at'>): Room => {
    const newRoom: Room = {
      ...roomData,
      id: `room-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setRooms(prev => [...prev, newRoom]);
    return newRoom;
  }, []);

  const addBed = useCallback((bedData: Omit<Bed, 'id' | 'created_at' | 'updated_at'>): Bed => {
    const now = new Date().toISOString();
    const newBed: Bed = {
      ...bedData,
      id: `bed-${Date.now()}`,
      created_at: now,
      updated_at: now,
    };
    setBeds(prev => [...prev, newBed]);
    return newBed;
  }, []);

  const getUnassignedPatients = useCallback((): Patient[] => {
    const assignedPatientIds = assignments.filter(a => !a.discharged_at).map(a => a.patient_id);
    return patients.filter(p => !assignedPatientIds.includes(p.id));
  }, [assignments, patients]);

  const value: DemoContextType = {
    isDemoMode: true,
    beds: getBedsWithDetailsLocal(),
    wards,
    rooms,
    patients,
    stats: getStatsLocal(),
    updateBedStatus,
    assignPatient,
    dischargePatient,
    addPatient,
    addWard,
    updateWard,
    deleteWard,
    addRoom,
    addBed,
    getUnassignedPatients,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}

export function useDemoOptional() {
  return useContext(DemoContext);
}
