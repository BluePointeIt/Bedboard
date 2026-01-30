export type BedStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance';

export type UserRole = 'admin' | 'nurse' | 'doctor' | 'clerk';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Ward {
  id: string;
  name: string;
  floor: number;
  capacity?: number;
  description?: string;
  created_at: string;
}

export interface Room {
  id: string;
  ward_id: string;
  room_number: string;
  room_type: 'private' | 'semi-private' | 'ward';
  created_at: string;
  ward?: Ward;
}

export type PayerType = 'private' | 'medicare' | 'medicaid' | 'managed_care';

export type ResidentStatus = 'active' | 'discharged' | 'deceased';

export interface Patient {
  id: string;
  medical_record_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  payer_type?: PayerType;
  contact_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  created_at: string;
}

export interface Resident {
  id: string;
  medical_record_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  payer_type: PayerType;
  diagnoses: string[];
  contact_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  admission_date: string;
  discharge_date?: string;
  status: ResidentStatus;
  room_id?: string;
  bed_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Bed {
  id: string;
  room_id: string;
  bed_number: string;
  status: BedStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  room?: Room;
  current_assignment?: BedAssignment;
}

export interface BedAssignment {
  id: string;
  bed_id: string;
  patient_id: string;
  assigned_by: string;
  assigned_at: string;
  discharged_at?: string;
  is_isolation: boolean;
  notes?: string;
  patient?: Patient;
  assigned_by_user?: User;
}

export interface BedWithDetails extends Bed {
  room: Room & { ward: Ward };
  current_assignment?: BedAssignment & { patient: Patient };
}

export interface CaseMixStats {
  private: number;
  medicare: number;
  medicaid: number;
  managed_care: number;
}

export interface DashboardStats {
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  isolation_beds: number;
  maintenance_beds: number;
  occupancy_rate: number;
  case_mix: CaseMixStats;
}

export interface FilterOptions {
  ward_id?: string;
  status?: BedStatus;
  search?: string;
}
