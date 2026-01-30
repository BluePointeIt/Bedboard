// Wing types
export type WingType = 'rehab' | 'long_term' | 'hospice' | 'memory_care';

export interface Wing {
  id: string;
  name: string;
  wing_type: WingType;
  icon?: string;
  display_order: number;
  created_at: string;
}

// Room types
export interface Room {
  id: string;
  wing_id: string;
  room_number: string;
  has_shared_bathroom: boolean;
  shared_bathroom_group_id?: string | null;
  created_at: string;
  wing?: Wing;
}

// Extended room type with beds
export interface RoomWithBeds extends Room {
  beds: Bed[];
}

// Bed types
export type BedStatus = 'occupied' | 'vacant' | 'out_of_service';

export interface Bed {
  id: string;
  room_id: string;
  bed_letter: string;
  status: BedStatus;
  out_of_service_reason?: string;
  created_at: string;
  updated_at: string;
  room?: Room;
  resident?: Resident;
}

// Resident types
export type PayorType = 'private' | 'medicare' | 'medicaid' | 'managed_care' | 'bed_hold' | 'hospice';
export type IsolationType = 'respiratory' | 'contact' | 'droplet' | 'airborne';
export type ResidentStatus = 'active' | 'discharged' | 'deceased';
export type Gender = 'male' | 'female' | 'other';

export interface Resident {
  id: string;
  bed_id?: string;
  first_name: string;
  last_name: string;
  gender: Gender;
  admission_date: string;
  payor: PayorType;
  diagnosis?: string;
  is_isolation: boolean;
  isolation_type?: IsolationType;
  notes?: string;
  status: ResidentStatus;
  created_at: string;
  updated_at: string;
  bed?: Bed;
}

// User types
export type UserRole = 'admin' | 'nurse' | 'doctor' | 'clerk';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  male_occupied: number;
  female_occupied: number;
  isolation_count: number;
  out_of_service_count: number;
  occupancy_rate: number;
}

// Extended types for views
export interface BedWithDetails extends Bed {
  room: Room & { wing: Wing };
  resident?: Resident;
}

export interface WingWithStats extends Wing {
  total_beds: number;
  occupied_beds: number;
  occupancy_rate: number;
}

// Filter options
export interface FilterOptions {
  wing_id?: string | null;
  status?: BedStatus;
  search?: string;
}
