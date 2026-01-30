import { useState } from 'react';
import {
  X,
  Bed,
  AlertTriangle,
  Wrench,
  ArrowLeftRight,
  Plus,
  UserPlus,
  Calendar,
  Heart,
  Phone,
} from 'lucide-react';
import { BedCard, SearchFilter, Modal, Button } from '../components';
import { useBeds, useBedActions } from '../hooks/useBeds';
import { useWards } from '../hooks/useWards';
import { useRooms } from '../hooks/useRooms';
import { useUnassignedResidents } from '../hooks/useResidents';
import { cn, formatDate } from '../lib/utils';
import type { BedWithDetails, BedStatus, FilterOptions } from '../types';

function getStatusStripColor(bed: BedWithDetails): string {
  const isIsolation = bed.current_assignment?.is_isolation;
  const patient = bed.current_assignment?.patient;

  if (bed.status === 'maintenance') return 'bg-gray-900';
  if (bed.status === 'available' || bed.status === 'cleaning') return 'bg-slate-200';
  if (isIsolation) return 'bg-yellow-400';
  if (patient?.gender === 'female') return 'bg-pink-400';
  return 'bg-[#137fec]';
}

function getStatusLabel(bed: BedWithDetails): string {
  if (bed.status === 'maintenance') return 'Out of Service';
  if (bed.status === 'cleaning') return 'Cleaning';
  if (bed.status === 'available') return 'Vacant';
  if (bed.current_assignment?.is_isolation) return 'Occupied (Isolation)';
  return 'Occupied (Standard)';
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function Beds() {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [isIsolation, setIsIsolation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [bedFormData, setBedFormData] = useState({
    room_id: '',
    bed_number: '',
    status: 'available' as BedStatus,
  });
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [roomFormData, setRoomFormData] = useState({
    ward_id: '',
    room_number: '',
    room_type: 'ward' as 'private' | 'semi-private' | 'ward',
  });

  const { beds, loading, refetch } = useBeds(filters);
  const { wards } = useWards();
  const { rooms, createRoom, refetch: refetchRooms } = useRooms();
  const { residents: unassignedResidents } = useUnassignedResidents();
  const { updateBedStatus, createBed, assignPatient, dischargePatient } = useBedActions();

  const handleStatusChange = async (bedId: string, status: BedStatus) => {
    setActionLoading(true);
    await updateBedStatus(bedId, status);
    setActionLoading(false);
  };

  const handleToggleIsolation = async () => {
    if (!selectedBed?.current_assignment) return;
    // For now, just toggle the visual - in a real app this would update the database
    setActionLoading(true);
    // This would need a new API endpoint to toggle isolation status
    setActionLoading(false);
  };

  const handleAssignPatient = async () => {
    if (!selectedBed || !selectedPatientId) return;
    setActionLoading(true);
    await assignPatient(selectedBed.id, selectedPatientId, 'current-user', isIsolation);
    setActionLoading(false);
    setShowAssignModal(false);
    setSelectedBed(null);
    setSelectedPatientId('');
    setIsIsolation(false);
  };

  const handleDischarge = async () => {
    if (!selectedBed?.current_assignment) return;
    setActionLoading(true);
    await dischargePatient(selectedBed.current_assignment.id, selectedBed.id);
    setActionLoading(false);
    setSelectedBed(null);
  };

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedFormData.room_id || !bedFormData.bed_number) return;

    setActionLoading(true);
    await createBed(bedFormData.room_id, bedFormData.bed_number, bedFormData.status);
    setActionLoading(false);
    setShowAddBedModal(false);
    setBedFormData({ room_id: '', bed_number: '', status: 'available' });
    refetch();
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFormData.ward_id || !roomFormData.room_number) return;

    setActionLoading(true);
    await createRoom({
      ward_id: roomFormData.ward_id,
      room_number: roomFormData.room_number,
      room_type: roomFormData.room_type,
    });
    setActionLoading(false);
    setShowAddRoomModal(false);
    setRoomFormData({ ward_id: '', room_number: '', room_type: 'ward' });
    refetchRooms();
  };

  // Group beds by ward
  const bedsByWard = beds.reduce((acc, bed) => {
    const wardName = bed.room?.ward?.name || 'Unknown';
    if (!acc[wardName]) {
      acc[wardName] = [];
    }
    acc[wardName].push(bed);
    return acc;
  }, {} as Record<string, BedWithDetails[]>);

  const patient = selectedBed?.current_assignment?.patient;
  const isOccupied = selectedBed?.status === 'occupied' && patient;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Main Content */}
      <div className={cn(
        'space-y-6 transition-all duration-300',
        selectedBed && 'opacity-40 pointer-events-none'
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0d141b]">Bed Management</h1>
            <p className="text-[#4c739a]">View and manage all facility beds</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddRoomModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e7edf3] bg-white text-[#0d141b] font-medium text-sm hover:bg-[#f6f7f8] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
            <button
              onClick={() => setShowAddBedModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#137fec] text-white font-medium text-sm hover:bg-[#1171d4] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Bed
            </button>
          </div>
        </div>

        <SearchFilter
          filters={filters}
          onFiltersChange={setFilters}
          wards={wards}
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
            <div className="w-3 h-3 rounded-full bg-[#137fec]"></div>
            <p className="text-xs font-semibold">Male</p>
          </div>
          <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
            <div className="w-3 h-3 rounded-full bg-pink-400"></div>
            <p className="text-xs font-semibold">Female</p>
          </div>
          <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <p className="text-xs font-semibold">Isolation</p>
          </div>
          <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
            <div className="w-3 h-3 rounded-full bg-gray-900"></div>
            <p className="text-xs font-semibold">Out of Service</p>
          </div>
          <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
            <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></div>
            <p className="text-xs font-semibold">Vacant</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#137fec]" />
          </div>
        ) : beds.length === 0 ? (
          <div className="text-center py-12 text-[#4c739a]">
            No beds found matching your criteria
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(bedsByWard).map(([wardName, wardBeds]) => (
              <div key={wardName}>
                <h2 className="text-lg font-semibold text-[#0d141b] mb-4">
                  {wardName}
                  <span className="ml-2 text-sm font-normal text-[#4c739a]">
                    ({wardBeds.length} beds)
                  </span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {wardBeds.map((bed) => (
                    <BedCard
                      key={bed.id}
                      bed={bed}
                      onClick={() => setSelectedBed(bed)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overlay when side panel is open */}
      {selectedBed && (
        <div
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] z-40"
          onClick={() => setSelectedBed(null)}
        />
      )}

      {/* Right Side Panel */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#e7edf3] transform transition-transform duration-300',
          selectedBed ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {selectedBed && (
          <>
            {/* Status Header (Color Coded Accent) */}
            <div className={cn('h-2 w-full', getStatusStripColor(selectedBed))} />

            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Header Section */}
              <div className="px-6 py-6 border-b border-[#e7edf3]">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded w-fit mb-1',
                      selectedBed.status === 'maintenance'
                        ? 'bg-gray-900/10 text-gray-900'
                        : selectedBed.status === 'available' || selectedBed.status === 'cleaning'
                        ? 'bg-slate-200/50 text-[#4c739a]'
                        : selectedBed.current_assignment?.is_isolation
                        ? 'bg-yellow-400/10 text-yellow-600'
                        : 'bg-[#137fec]/10 text-[#137fec]'
                    )}>
                      {getStatusLabel(selectedBed)}
                    </span>
                    <h2 className="text-2xl font-bold text-[#0d141b]">
                      Bed {selectedBed.room?.room_number} - Unit {selectedBed.bed_number}
                    </h2>
                    <p className="text-[#4c739a] text-sm">
                      {selectedBed.room?.ward?.name} | Floor {selectedBed.room?.ward?.floor}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedBed(null)}
                    className="text-[#4c739a] hover:text-[#0d141b] transition-colors"
                  >
                    <X className="w-7 h-7" />
                  </button>
                </div>

                {/* Profile Header - Only show if occupied */}
                {isOccupied && patient && (
                  <div className="flex items-center gap-5 bg-[#f6f7f8] p-4 rounded-xl">
                    <div className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-white shadow-sm',
                      patient.gender === 'male' ? 'bg-[#137fec]' : 'bg-[#ec4899]'
                    )}>
                      {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[#0d141b] text-xl font-bold leading-tight">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-[#4c739a] text-sm font-medium">
                        MRN: {patient.medical_record_number}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-[#e7edf3] px-2 py-0.5 rounded-full">
                          Age: {calculateAge(patient.date_of_birth)}
                        </span>
                        <span className="text-xs bg-[#e7edf3] px-2 py-0.5 rounded-full capitalize">
                          {patient.gender}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vacant State */}
                {!isOccupied && selectedBed.status !== 'maintenance' && (
                  <div className="flex flex-col items-center justify-center py-8 bg-[#f6f7f8] rounded-xl">
                    <Bed className="w-12 h-12 text-[#c4d4e5] mb-3" />
                    <p className="text-[#4c739a] font-medium">
                      {selectedBed.status === 'cleaning' ? 'Bed is being cleaned' : 'Bed is vacant'}
                    </p>
                    {selectedBed.status === 'available' && (
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#137fec] text-white rounded-lg font-medium hover:bg-[#1171d4] transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Assign Resident
                      </button>
                    )}
                    {selectedBed.status === 'cleaning' && (
                      <button
                        onClick={() => handleStatusChange(selectedBed.id, 'available')}
                        disabled={actionLoading}
                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#137fec] text-white rounded-lg font-medium hover:bg-[#1171d4] transition-colors disabled:opacity-50"
                      >
                        Mark as Available
                      </button>
                    )}
                  </div>
                )}

                {/* Maintenance State */}
                {selectedBed.status === 'maintenance' && (
                  <div className="flex flex-col items-center justify-center py-8 bg-[#f6f7f8] rounded-xl">
                    <Wrench className="w-12 h-12 text-[#4c739a] mb-3" />
                    <p className="text-[#4c739a] font-medium">Out of Service</p>
                    {selectedBed.notes && (
                      <p className="text-sm text-[#4c739a] mt-2 text-center px-4">{selectedBed.notes}</p>
                    )}
                    <button
                      onClick={() => handleStatusChange(selectedBed.id, 'available')}
                      disabled={actionLoading}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#137fec] text-white rounded-lg font-medium hover:bg-[#1171d4] transition-colors disabled:opacity-50"
                    >
                      Return to Service
                    </button>
                  </div>
                )}
              </div>

              {/* Stats / Details Grid - Only show if occupied */}
              {isOccupied && (
                <div className="px-6 py-6 flex flex-wrap gap-3 border-b border-[#e7edf3]">
                  <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-[#f6f7f8] border border-[#e7edf3]">
                    <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Admitted
                    </p>
                    <p className="text-[#0d141b] font-bold text-base">
                      {formatDate(selectedBed.current_assignment?.assigned_at || '')}
                    </p>
                  </div>
                  <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-[#f6f7f8] border border-[#e7edf3]">
                    <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      Payer Type
                    </p>
                    <p className="text-[#0d141b] font-bold text-base capitalize">
                      {patient?.payer_type?.replace('_', ' ') || 'Private'}
                    </p>
                  </div>
                  <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-[#f6f7f8] border border-[#e7edf3]">
                    <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Emergency Contact
                    </p>
                    <p className="text-[#0d141b] font-bold text-base">
                      {patient?.emergency_contact_name || 'Not set'}
                    </p>
                  </div>
                </div>
              )}

              {/* Bed Management Status Toggles - Only show if occupied */}
              {isOccupied && (
                <div className="px-6 py-6">
                  <h3 className="text-sm font-bold text-[#0d141b] mb-4 flex items-center gap-2">
                    <Bed className="w-4 h-4" />
                    Bed Management
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleToggleIsolation}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all',
                        selectedBed.current_assignment?.is_isolation
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-yellow-400/20 bg-yellow-400/5 hover:bg-yellow-400/10'
                      )}
                    >
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm font-bold text-yellow-600">
                        {selectedBed.current_assignment?.is_isolation ? 'Remove Isolation' : 'Set Isolation'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedBed.id, 'maintenance')}
                      disabled={actionLoading}
                      className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-gray-900/20 bg-gray-900/5 hover:bg-gray-900/10 transition-all disabled:opacity-50"
                    >
                      <Wrench className="w-5 h-5 text-gray-900" />
                      <span className="text-sm font-bold text-gray-900">Out of Service</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Medical Alert Section - Only show if occupied and has notes */}
              {isOccupied && patient?.notes && (
                <div className="px-6 py-4 bg-red-50 mx-6 rounded-xl border border-red-100 mb-6">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">Medical Alert</span>
                  </div>
                  <p className="text-sm text-red-800 font-medium">{patient.notes}</p>
                </div>
              )}

              {/* Nursing Notes Placeholder */}
              {isOccupied && (
                <div className="px-6 flex-1 pb-10">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[#0d141b]">Nursing Notes</h3>
                    <button className="text-[#137fec] text-xs font-bold hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Add Note
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border border-[#e7edf3] shadow-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] font-bold text-[#4c739a]">TODAY, 09:15 AM</span>
                        <span className="text-[10px] text-[#4c739a]">By System</span>
                      </div>
                      <p className="text-xs text-[#4c739a] leading-relaxed">
                        Resident assigned to this bed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action Buttons - Only show if occupied */}
            {isOccupied && (
              <div className="p-6 border-t border-[#e7edf3] bg-[#f6f7f8] flex gap-3">
                <button
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg bg-[#137fec] text-white font-bold text-sm shadow-lg shadow-[#137fec]/20 hover:bg-[#1171d4] transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Transfer Bed
                </button>
                <button
                  onClick={handleDischarge}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg border border-red-200 bg-white text-red-600 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Discharge
                </button>
              </div>
            )}
          </>
        )}
      </aside>

      {/* Assign Patient Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedPatientId('');
          setIsIsolation(false);
        }}
        title="Assign Resident"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Select Resident
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            >
              <option value="">Choose a resident...</option>
              {unassignedResidents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.first_name} {resident.last_name} (MRN: {resident.medical_record_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isIsolation}
                onChange={(e) => setIsIsolation(e.target.checked)}
                className="w-4 h-4 rounded border-[#c4d4e5] text-[#137fec] focus:ring-[#137fec]"
              />
              <span className="text-sm font-medium text-[#0d141b]">Isolation Required</span>
            </label>
            <p className="text-xs text-[#4c739a] mt-1 ml-6">
              Check if resident requires isolation precautions
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedPatientId('');
                setIsIsolation(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignPatient}
              disabled={!selectedPatientId}
              loading={actionLoading}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Bed Modal */}
      <Modal
        isOpen={showAddBedModal}
        onClose={() => {
          setShowAddBedModal(false);
          setBedFormData({ room_id: '', bed_number: '', status: 'available' });
        }}
        title="Add New Bed"
        size="md"
      >
        <form onSubmit={handleAddBed} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Select Room *
            </label>
            <select
              required
              value={bedFormData.room_id}
              onChange={(e) => setBedFormData({ ...bedFormData, room_id: e.target.value })}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            >
              <option value="">Choose a room...</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} - {(room as any).ward?.name || 'Unknown Ward'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Bed Number *
            </label>
            <input
              type="text"
              required
              value={bedFormData.bed_number}
              onChange={(e) => setBedFormData({ ...bedFormData, bed_number: e.target.value })}
              placeholder="e.g., A, B, 1, 2"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Status
            </label>
            <select
              value={bedFormData.status}
              onChange={(e) => setBedFormData({ ...bedFormData, status: e.target.value as BedStatus })}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            >
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
              <option value="cleaning">Cleaning</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddBedModal(false);
                setBedFormData({ room_id: '', bed_number: '', status: 'available' });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!bedFormData.room_id || !bedFormData.bed_number}
              loading={actionLoading}
            >
              Add Bed
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Room Modal */}
      <Modal
        isOpen={showAddRoomModal}
        onClose={() => {
          setShowAddRoomModal(false);
          setRoomFormData({ ward_id: '', room_number: '', room_type: 'ward' });
        }}
        title="Add New Room"
        size="md"
      >
        <form onSubmit={handleAddRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Select Unit *
            </label>
            <select
              required
              value={roomFormData.ward_id}
              onChange={(e) => setRoomFormData({ ...roomFormData, ward_id: e.target.value })}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            >
              <option value="">Choose a unit...</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name} - Floor {ward.floor}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Room Number *
            </label>
            <input
              type="text"
              required
              value={roomFormData.room_number}
              onChange={(e) => setRoomFormData({ ...roomFormData, room_number: e.target.value })}
              placeholder="e.g., 101, 102, A1"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Room Type
            </label>
            <select
              value={roomFormData.room_type}
              onChange={(e) => setRoomFormData({ ...roomFormData, room_type: e.target.value as 'private' | 'semi-private' | 'ward' })}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            >
              <option value="ward">Ward (4+ beds)</option>
              <option value="semi-private">Semi-Private (2 beds)</option>
              <option value="private">Private (1 bed)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddRoomModal(false);
                setRoomFormData({ ward_id: '', room_number: '', room_type: 'ward' });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!roomFormData.ward_id || !roomFormData.room_number}
              loading={actionLoading}
            >
              Add Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
