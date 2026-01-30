import type { Ward, Room, Bed, Patient, BedWithDetails, BedAssignment, DashboardStats } from '../types';

export const demoWards: Ward[] = [
  { id: '1', name: 'Emergency', floor: 1, capacity: 20, description: 'Emergency department', created_at: new Date().toISOString() },
  { id: '2', name: 'ICU', floor: 2, capacity: 10, description: 'Intensive Care Unit', created_at: new Date().toISOString() },
  { id: '3', name: 'Medical', floor: 3, capacity: 30, description: 'General medical ward', created_at: new Date().toISOString() },
  { id: '4', name: 'Surgical', floor: 4, capacity: 25, description: 'Post-operative care', created_at: new Date().toISOString() },
];

export const demoRooms: Room[] = [
  { id: '1', ward_id: '1', room_number: 'E101', room_type: 'ward', created_at: new Date().toISOString() },
  { id: '2', ward_id: '1', room_number: 'E102', room_type: 'semi-private', created_at: new Date().toISOString() },
  { id: '3', ward_id: '2', room_number: 'ICU-1', room_type: 'private', created_at: new Date().toISOString() },
  { id: '4', ward_id: '2', room_number: 'ICU-2', room_type: 'private', created_at: new Date().toISOString() },
  { id: '5', ward_id: '3', room_number: 'M301', room_type: 'ward', created_at: new Date().toISOString() },
  { id: '6', ward_id: '3', room_number: 'M302', room_type: 'semi-private', created_at: new Date().toISOString() },
  { id: '7', ward_id: '4', room_number: 'S401', room_type: 'semi-private', created_at: new Date().toISOString() },
];

export const demoPatients: Patient[] = [
  { id: '1', medical_record_number: 'MRN001', first_name: 'John', last_name: 'Smith', date_of_birth: '1965-03-15', gender: 'male', payer_type: 'medicare', contact_phone: '555-0101', created_at: new Date().toISOString() },
  { id: '2', medical_record_number: 'MRN002', first_name: 'Mary', last_name: 'Johnson', date_of_birth: '1978-07-22', gender: 'female', payer_type: 'private', contact_phone: '555-0102', created_at: new Date().toISOString() },
  { id: '3', medical_record_number: 'MRN003', first_name: 'Robert', last_name: 'Williams', date_of_birth: '1952-11-08', gender: 'male', payer_type: 'medicaid', contact_phone: '555-0103', created_at: new Date().toISOString() },
  { id: '4', medical_record_number: 'MRN004', first_name: 'Patricia', last_name: 'Brown', date_of_birth: '1990-01-30', gender: 'female', payer_type: 'managed_care', contact_phone: '555-0104', created_at: new Date().toISOString() },
  { id: '5', medical_record_number: 'MRN005', first_name: 'Michael', last_name: 'Jones', date_of_birth: '1985-09-12', gender: 'male', payer_type: 'medicare', contact_phone: '555-0105', created_at: new Date().toISOString() },
];

const getWardForRoom = (roomId: string): Ward => {
  const room = demoRooms.find(r => r.id === roomId);
  return demoWards.find(w => w.id === room?.ward_id) || demoWards[0];
};

const getRoomWithWard = (roomId: string): Room & { ward: Ward } => {
  const room = demoRooms.find(r => r.id === roomId)!;
  return { ...room, ward: getWardForRoom(roomId) };
};

export const demoBeds: Bed[] = [
  { id: '1', room_id: '1', bed_number: 'A', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', room_id: '1', bed_number: 'B', status: 'occupied', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', room_id: '1', bed_number: 'C', status: 'cleaning', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', room_id: '1', bed_number: 'D', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', room_id: '2', bed_number: 'A', status: 'occupied', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', room_id: '2', bed_number: 'B', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '7', room_id: '3', bed_number: '1', status: 'occupied', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '8', room_id: '4', bed_number: '1', status: 'maintenance', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '9', room_id: '5', bed_number: 'A', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '10', room_id: '5', bed_number: 'B', status: 'occupied', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11', room_id: '5', bed_number: 'C', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '12', room_id: '5', bed_number: 'D', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '13', room_id: '6', bed_number: 'A', status: 'cleaning', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '14', room_id: '6', bed_number: 'B', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '15', room_id: '7', bed_number: 'A', status: 'available', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '16', room_id: '7', bed_number: 'B', status: 'occupied', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const demoAssignments: BedAssignment[] = [
  { id: '1', bed_id: '2', patient_id: '1', assigned_by: 'demo', assigned_at: new Date().toISOString(), is_isolation: false },
  { id: '2', bed_id: '5', patient_id: '2', assigned_by: 'demo', assigned_at: new Date().toISOString(), is_isolation: true },
  { id: '3', bed_id: '7', patient_id: '3', assigned_by: 'demo', assigned_at: new Date().toISOString(), is_isolation: true },
  { id: '4', bed_id: '10', patient_id: '4', assigned_by: 'demo', assigned_at: new Date().toISOString(), is_isolation: false },
  { id: '5', bed_id: '16', patient_id: '5', assigned_by: 'demo', assigned_at: new Date().toISOString(), is_isolation: false },
];

export function getBedsWithDetails(): BedWithDetails[] {
  return demoBeds.map(bed => {
    const assignment = demoAssignments.find(a => a.bed_id === bed.id);
    const patient = assignment ? demoPatients.find(p => p.id === assignment.patient_id) : undefined;

    return {
      ...bed,
      room: getRoomWithWard(bed.room_id),
      current_assignment: assignment && patient ? { ...assignment, patient } : undefined,
    };
  });
}

export function getDemoStats(): DashboardStats {
  const beds = demoBeds;
  const total = beds.length;
  const available = beds.filter(b => b.status === 'available').length;
  const occupied = beds.filter(b => b.status === 'occupied').length;
  const maintenance = beds.filter(b => b.status === 'maintenance').length;
  const isolation = demoAssignments.filter(a => a.is_isolation).length;

  // Calculate case mix from assigned patients
  const caseMix = { private: 0, medicare: 0, medicaid: 0, managed_care: 0 };
  for (const assignment of demoAssignments) {
    const patient = demoPatients.find(p => p.id === assignment.patient_id);
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
    occupancy_rate: Math.round((occupied / total) * 100),
    case_mix: caseMix,
  };
}

export function getUnassignedPatients(): Patient[] {
  const assignedPatientIds = demoAssignments.map(a => a.patient_id);
  return demoPatients.filter(p => !assignedPatientIds.includes(p.id));
}
