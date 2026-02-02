import { useOutletContext } from 'react-router-dom';
import { BedCard, BedGrid, FilterLegend, Modal, Button, Icon } from '../components';
import { useBeds, useBedActions } from '../hooks/useBeds';
import type { GenderCompatibilityResult } from '../hooks/useBeds';
import { useUnassignedResidents } from '../hooks/useResidents';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { BedWithDetails } from '../components/BedCard';
import type { LayoutContext } from '../components/AppLayout';
import type { Gender } from '../types';
import {
  calculateAge,
  getCompatibilityLabel,
  type BedCompatibilityScore,
  type MoveRecommendation,
} from '../lib/compatibilityUtils';

// Consolidated state interfaces
interface ModalState {
  type: 'detail' | 'assign' | 'move' | null;
  selectedBed: BedWithDetails | null;
  selectedResidentId: string;
  selectedTargetBedId: string;
}

interface AssignModalState {
  genderCompatibility: GenderCompatibilityResult | null;
  requiredGenderForBed: Gender | null;
  bedRecommendations: BedCompatibilityScore[];
  recommendationsLoading: boolean;
  moveOptimizations: MoveRecommendation[];
  showOptimizations: boolean;
}

interface MoveModalState {
  targetCompatibility: GenderCompatibilityResult | null;
  bedRecommendations: BedCompatibilityScore[];
  recommendationsLoading: boolean;
}

const INITIAL_MODAL_STATE: ModalState = {
  type: null,
  selectedBed: null,
  selectedResidentId: '',
  selectedTargetBedId: '',
};

const INITIAL_ASSIGN_STATE: AssignModalState = {
  genderCompatibility: null,
  requiredGenderForBed: null,
  bedRecommendations: [],
  recommendationsLoading: false,
  moveOptimizations: [],
  showOptimizations: false,
};

const INITIAL_MOVE_STATE: MoveModalState = {
  targetCompatibility: null,
  bedRecommendations: [],
  recommendationsLoading: false,
};

export function Dashboard() {
  const { searchQuery, selectedWingId, wings } = useOutletContext<LayoutContext>();

  // Consolidated modal state
  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);
  const [assignState, setAssignState] = useState<AssignModalState>(INITIAL_ASSIGN_STATE);
  const [moveState, setMoveState] = useState<MoveModalState>(INITIAL_MOVE_STATE);
  const [actionLoading, setActionLoading] = useState(false);

  // Derived state helpers
  const selectedBed = modalState.selectedBed;
  const showAssignModal = modalState.type === 'assign';
  const showMoveModal = modalState.type === 'move';
  const selectedResidentId = modalState.selectedResidentId;
  const selectedTargetBedId = modalState.selectedTargetBedId;

  const { beds, loading, refetch: refetchBeds } = useBeds({
    wing_id: selectedWingId,
    search: searchQuery || undefined,
  });
  const { residents: unassignedResidents } = useUnassignedResidents();
  const { updateBedStatus, assignResident, unassignResident, checkGenderCompatibility, getRequiredGenderForBed, getBedRecommendations, getMoveOptimizations } = useBedActions();

  // Get the selected wing name for the header
  const selectedWing = wings.find((w) => w.id === selectedWingId);
  const headerTitle = selectedWing ? `Unit Overview: ${selectedWing.name}` : 'Unit Overview: All Wings';

  // Check required gender when opening assign modal
  useEffect(() => {
    if (showAssignModal && selectedBed) {
      getRequiredGenderForBed(selectedBed.id).then(gender =>
        setAssignState(prev => ({ ...prev, requiredGenderForBed: gender }))
      );
    } else {
      setAssignState(prev => ({ ...prev, requiredGenderForBed: null, genderCompatibility: null }));
    }
  }, [showAssignModal, selectedBed, getRequiredGenderForBed]);

  // Check gender compatibility when a resident is selected for assignment
  useEffect(() => {
    if (selectedResidentId && selectedBed) {
      const resident = unassignedResidents.find((r) => r.id === selectedResidentId);
      if (resident) {
        checkGenderCompatibility(selectedBed.id, resident.gender, resident.is_isolation).then(result =>
          setAssignState(prev => ({ ...prev, genderCompatibility: result }))
        );
      }
    } else {
      setAssignState(prev => ({ ...prev, genderCompatibility: null }));
    }
  }, [selectedResidentId, selectedBed, unassignedResidents, checkGenderCompatibility]);

  // Fetch bed recommendations when a resident is selected
  useEffect(() => {
    if (selectedResidentId && showAssignModal) {
      setAssignState(prev => ({ ...prev, recommendationsLoading: true }));
      getBedRecommendations(selectedResidentId)
        .then(recs => setAssignState(prev => ({ ...prev, bedRecommendations: recs })))
        .finally(() => setAssignState(prev => ({ ...prev, recommendationsLoading: false })));
    } else {
      setAssignState(prev => ({ ...prev, bedRecommendations: [] }));
    }
  }, [selectedResidentId, showAssignModal, getBedRecommendations]);

  // Fetch move optimizations when assign modal opens
  useEffect(() => {
    if (showAssignModal && unassignedResidents.length > 0) {
      getMoveOptimizations(unassignedResidents).then(opts =>
        setAssignState(prev => ({ ...prev, moveOptimizations: opts }))
      );
    } else {
      setAssignState(prev => ({ ...prev, moveOptimizations: [], showOptimizations: false }));
    }
  }, [showAssignModal, unassignedResidents, getMoveOptimizations]);

  // Check gender compatibility when a target bed is selected for move
  useEffect(() => {
    if (selectedTargetBedId && selectedBed?.resident) {
      checkGenderCompatibility(selectedTargetBedId, selectedBed.resident.gender, selectedBed.resident.is_isolation).then(result =>
        setMoveState(prev => ({ ...prev, targetCompatibility: result }))
      );
    } else {
      setMoveState(prev => ({ ...prev, targetCompatibility: null }));
    }
  }, [selectedTargetBedId, selectedBed, checkGenderCompatibility]);

  // Fetch bed recommendations when move modal opens
  useEffect(() => {
    if (showMoveModal && selectedBed?.resident) {
      setMoveState(prev => ({ ...prev, recommendationsLoading: true }));
      getBedRecommendations(selectedBed.resident.id)
        .then(recs => setMoveState(prev => ({ ...prev, bedRecommendations: recs })))
        .finally(() => setMoveState(prev => ({ ...prev, recommendationsLoading: false })));
    } else {
      setMoveState(prev => ({ ...prev, bedRecommendations: [] }));
    }
  }, [showMoveModal, selectedBed?.resident?.id, getBedRecommendations]);

  // Modal state helpers
  const openAssignModal = useCallback(() => {
    setModalState(prev => ({ ...prev, type: 'assign' }));
  }, []);

  const openMoveModal = useCallback(() => {
    setModalState(prev => ({ ...prev, type: 'move' }));
  }, []);

  const closeModal = useCallback(() => {
    setModalState(INITIAL_MODAL_STATE);
    setAssignState(INITIAL_ASSIGN_STATE);
    setMoveState(INITIAL_MOVE_STATE);
  }, []);

  const selectBed = useCallback((bed: BedWithDetails) => {
    setModalState(prev => ({ ...prev, selectedBed: bed, type: 'detail' }));
  }, []);

  const setTargetBedId = useCallback((bedId: string) => {
    setModalState(prev => ({ ...prev, selectedTargetBedId: bedId }));
  }, []);

  const handleAssignResident = async () => {
    if (!selectedBed || !selectedResidentId) return;

    // Final compatibility check before assigning
    const resident = unassignedResidents.find((r) => r.id === selectedResidentId);
    if (resident) {
      const compatibility = await checkGenderCompatibility(selectedBed.id, resident.gender, resident.is_isolation);
      if (!compatibility.compatible) {
        setAssignState(prev => ({ ...prev, genderCompatibility: compatibility }));
        return;
      }
    }

    setActionLoading(true);
    await assignResident(selectedBed.id, selectedResidentId);
    await refetchBeds();
    setActionLoading(false);
    closeModal();
  };

  const handleUnassignResident = async () => {
    if (!selectedBed?.resident) return;
    setActionLoading(true);
    await unassignResident(selectedBed.resident.id, selectedBed.id);
    await refetchBeds();
    setActionLoading(false);
    closeModal();
  };

  const handleSetOutOfService = async () => {
    if (!selectedBed) return;
    setActionLoading(true);
    await updateBedStatus(selectedBed.id, 'out_of_service', 'Manual out of service');
    await refetchBeds();
    setActionLoading(false);
    closeModal();
  };

  const handleReturnToService = async () => {
    if (!selectedBed) return;
    setActionLoading(true);
    await updateBedStatus(selectedBed.id, 'vacant');
    await refetchBeds();
    setActionLoading(false);
    closeModal();
  };

  const handleMoveResident = async () => {
    if (!selectedBed?.resident || !selectedTargetBedId) return;

    // Final compatibility check before moving
    const compatibility = await checkGenderCompatibility(selectedTargetBedId, selectedBed.resident.gender, selectedBed.resident.is_isolation);
    if (!compatibility.compatible) {
      setMoveState(prev => ({ ...prev, targetCompatibility: compatibility }));
      return;
    }

    setActionLoading(true);

    // Unassign from current bed (sets bed to vacant, removes resident's bed_id)
    await unassignResident(selectedBed.resident.id, selectedBed.id);

    // Assign to new bed (sets bed to occupied, updates resident's bed_id)
    await assignResident(selectedTargetBedId, selectedBed.resident.id);

    await refetchBeds();
    setActionLoading(false);
    closeModal();
  };

  // Get vacant beds for move functionality
  const vacantBeds = beds.filter((bed) => bed.status === 'vacant');

  // Calculate gender-specific bed availability for the current view
  const genderAvailability = useMemo(() => {
    const vacantBedsForCalc = beds.filter(b => b.status === 'vacant');

    let maleAvailable = 0;
    let femaleAvailable = 0;
    let eitherAvailable = 0;

    // Group beds by room
    const roomToBeds = new Map<string, typeof beds>();
    beds.forEach(bed => {
      const roomId = bed.room_id || bed.room?.id;
      if (roomId) {
        if (!roomToBeds.has(roomId)) {
          roomToBeds.set(roomId, []);
        }
        roomToBeds.get(roomId)!.push(bed);
      }
    });

    // Group rooms by shared bathroom group
    const bathroomGroupToRooms = new Map<string, Set<string>>();
    beds.forEach(bed => {
      const room = bed.room;
      if (room?.has_shared_bathroom && room?.shared_bathroom_group_id) {
        if (!bathroomGroupToRooms.has(room.shared_bathroom_group_id)) {
          bathroomGroupToRooms.set(room.shared_bathroom_group_id, new Set());
        }
        bathroomGroupToRooms.get(room.shared_bathroom_group_id)!.add(room.id);
      }
    });

    // For each vacant bed, determine what gender can occupy it
    vacantBedsForCalc.forEach(vacantBed => {
      const roomId = vacantBed.room_id || vacantBed.room?.id;
      if (!roomId) {
        eitherAvailable++;
        return;
      }

      const room = vacantBed.room;
      const roomBeds = roomToBeds.get(roomId) || [];
      const isMultiBedRoom = roomBeds.length > 1;

      // Collect all rooms to check for gender constraints
      const roomsToCheck = new Set<string>([roomId]);

      // Add rooms sharing a bathroom
      if (room?.has_shared_bathroom && room?.shared_bathroom_group_id) {
        const sharedRooms = bathroomGroupToRooms.get(room.shared_bathroom_group_id);
        if (sharedRooms) {
          sharedRooms.forEach(r => roomsToCheck.add(r));
        }
      }

      // Only apply gender constraints if multi-bed room or shared bathroom
      if (!isMultiBedRoom && roomsToCheck.size === 1) {
        eitherAvailable++;
        return;
      }

      // Find existing genders in all rooms to check
      const existingGenders = new Set<Gender>();
      roomsToCheck.forEach(checkRoomId => {
        const checkRoomBeds = roomToBeds.get(checkRoomId) || [];
        checkRoomBeds.forEach(bed => {
          if (bed.status === 'occupied' && bed.resident?.gender) {
            existingGenders.add(bed.resident.gender);
          }
        });
      });

      // Determine availability based on existing occupants
      if (existingGenders.size === 0) {
        eitherAvailable++;
      } else if (existingGenders.size === 1) {
        const existingGender = Array.from(existingGenders)[0];
        if (existingGender === 'male') {
          maleAvailable++;
        } else if (existingGender === 'female') {
          femaleAvailable++;
        } else {
          eitherAvailable++;
        }
      } else {
        eitherAvailable++;
      }
    });

    return {
      male: maleAvailable + eitherAvailable,
      female: femaleAvailable + eitherAvailable,
      either: eitherAvailable,
    };
  }, [beds]);

  // Calculate total occupancy
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Total Occupancy Rate */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Icon name="monitoring" size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Total Occupancy</h2>
              <p className="text-sm text-slate-500">
                {selectedWing ? selectedWing.name : 'All Wings'} • {occupiedBeds} of {totalBeds} beds occupied
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${
              occupancyRate >= 90 ? 'text-emerald-600' : occupancyRate >= 70 ? 'text-amber-600' : 'text-red-500'
            }`}>
              {occupancyRate}%
            </p>
          </div>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              occupancyRate >= 90 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
              occupancyRate >= 70 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
              'bg-gradient-to-r from-red-400 to-red-500'
            }`}
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Gender-Specific Bed Availability */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Icon name="wc" size={20} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Gender-Specific Availability</h2>
            <p className="text-sm text-slate-500">
              {selectedWing ? `Available beds in ${selectedWing.name}` : 'Available beds across all wings'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Male Available */}
          <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-xl border border-primary-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
                <Icon name="male" size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary-700">Male Beds</p>
                <p className="text-2xl font-bold text-primary-600">{genderAvailability.male}</p>
              </div>
            </div>
          </div>

          {/* Female Available */}
          <div className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 rounded-xl border border-pink-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center">
                <Icon name="female" size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-pink-700">Female Beds</p>
                <p className="text-2xl font-bold text-pink-600">{genderAvailability.female}</p>
              </div>
            </div>
          </div>

          {/* Either Gender */}
          <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-xl border border-violet-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
                <Icon name="group" size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-violet-700">Open to Either</p>
                <p className="text-2xl font-bold text-violet-600">{genderAvailability.either}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wing Summary - Show all wings when viewing all */}
      {!selectedWingId && wings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Icon name="domain" size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Wing Summary</h2>
              <p className="text-sm text-slate-500">Occupancy breakdown by wing</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wings.map(wing => {
              const wingBeds = beds.filter(b => b.room?.wing?.id === wing.id);
              const wingOccupied = wingBeds.filter(b => b.status === 'occupied').length;
              const wingTotal = wingBeds.length;
              const wingRate = wingTotal > 0 ? Math.round((wingOccupied / wingTotal) * 100) : 0;

              return (
                <div key={wing.id} className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-slate-900">{wing.name}</h3>
                    <span className={`text-sm font-bold ${
                      wingRate >= 90 ? 'text-green-600' : wingRate >= 70 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {wingRate}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        wingRate >= 90 ? 'bg-green-500' : wingRate >= 70 ? 'bg-amber-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${wingRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {wingOccupied} of {wingTotal} beds occupied
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual Wing Summary - Show when viewing a specific wing */}
      {selectedWingId && selectedWing && (() => {
        const wingOccupied = beds.filter(b => b.status === 'occupied').length;
        const wingVacant = beds.filter(b => b.status === 'vacant').length;
        const wingOutOfService = beds.filter(b => b.status === 'out_of_service').length;
        const wingTotal = beds.length;
        const wingRate = wingTotal > 0 ? Math.round((wingOccupied / wingTotal) * 100) : 0;

        return (
          <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Icon name="domain" size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{selectedWing.name} Summary</h2>
                <p className="text-sm text-slate-500">Current wing occupancy details</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Occupancy Rate */}
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl border border-amber-200" style={{ padding: '24px' }}>
                <p className="text-xs font-medium text-amber-700 mb-1">Occupancy Rate</p>
                <p className="text-2xl font-bold text-amber-600">{wingRate}%</p>
                <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${wingRate}%` }}
                  />
                </div>
              </div>

              {/* Occupied */}
              <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-xl border border-primary-200" style={{ padding: '24px' }}>
                <p className="text-xs font-medium text-primary-700 mb-1">Occupied</p>
                <p className="text-2xl font-bold text-primary-600">{wingOccupied}</p>
                <p className="text-xs text-primary-500 mt-1">of {wingTotal} beds</p>
              </div>

              {/* Vacant */}
              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-200" style={{ padding: '24px' }}>
                <p className="text-xs font-medium text-green-700 mb-1">Available</p>
                <p className="text-2xl font-bold text-green-600">{wingVacant}</p>
                <p className="text-xs text-green-500 mt-1">ready for admission</p>
              </div>

              {/* Out of Service */}
              <div className="bg-gradient-to-br from-slate-500/10 to-slate-500/5 rounded-xl border border-slate-200" style={{ padding: '24px' }}>
                <p className="text-xs font-medium text-slate-700 mb-1">Out of Service</p>
                <p className="text-2xl font-bold text-slate-600">{wingOutOfService}</p>
                <p className="text-xs text-slate-500 mt-1">maintenance</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Spacer before Unit Overview */}
      <div className="pt-4" />

      {/* Filter Legend & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="grid_view" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">{headerTitle}</h2>
            <p className="text-sm text-slate-500">Manage bed assignments and status</p>
          </div>
        </div>
        <FilterLegend />
      </div>

      {/* Beds Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : beds.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No beds found matching your criteria
        </div>
      ) : (
        <BedGrid>
          {beds.map((bed) => (
            <BedCard key={bed.id} bed={bed} onClick={() => selectBed(bed)} />
          ))}
        </BedGrid>
      )}

      {/* Bed Detail Modal */}
      <Modal
        isOpen={modalState.type === 'detail'}
        onClose={closeModal}
        title={`Room ${selectedBed?.room?.room_number || ''} - Bed ${selectedBed?.bed_letter || ''}`}
        size="md"
      >
        {selectedBed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Wing</p>
                <p className="font-medium text-slate-900">{selectedBed.room?.wing?.name}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedBed.status === 'occupied'
                    ? 'bg-primary-100 text-primary-700'
                    : selectedBed.status === 'vacant'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {selectedBed.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {selectedBed.resident && (
              <div className="bg-slate-50 rounded-lg" style={{ padding: '24px' }}>
                <p className="text-sm text-slate-500 mb-2">Current Resident</p>
                <p className="font-semibold text-slate-900">
                  {selectedBed.resident.first_name} {selectedBed.resident.last_name}
                </p>
                <p className="text-sm text-slate-500">
                  Payor: {selectedBed.resident.payor.replace('_', ' ')}
                </p>
                {selectedBed.resident.is_isolation && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                    {selectedBed.resident.isolation_type || 'Isolation'}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
              {selectedBed.status === 'vacant' && (
                <Button onClick={openAssignModal}>Assign Resident</Button>
              )}

              {selectedBed.status === 'occupied' && selectedBed.resident && (
                <>
                  <Button onClick={openMoveModal}>
                    Move Resident
                  </Button>
                  <Button variant="danger" onClick={handleUnassignResident} loading={actionLoading}>
                    Unassign Resident
                  </Button>
                </>
              )}

              {selectedBed.status !== 'out_of_service' && !selectedBed.resident && (
                <Button variant="secondary" onClick={handleSetOutOfService} loading={actionLoading}>
                  Set Out of Service
                </Button>
              )}

              {selectedBed.status === 'out_of_service' && (
                <Button onClick={handleReturnToService} loading={actionLoading}>
                  Return to Service
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Resident Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={closeModal}
        title="Assign Resident"
        size="lg"
      >
        <div className="space-y-4">
          {/* Gender requirement info */}
          {assignState.requiredGenderForBed && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-start gap-2" style={{ padding: '16px' }}>
              <Icon name="info" size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Gender Restriction:</strong> This bed requires a{' '}
                <strong>{assignState.requiredGenderForBed}</strong> resident due to existing occupancy in the room
                or shared bathroom.
              </div>
            </div>
          )}

          {/* Gender incompatibility warning */}
          {assignState.genderCompatibility && !assignState.genderCompatibility.compatible && (
            <div className="bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2" style={{ padding: '16px' }}>
              <Icon name="warning" size={18} className="mt-0.5 flex-shrink-0" />
              <div>{assignState.genderCompatibility.reason}</div>
            </div>
          )}

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="person" size={16} className="text-slate-400" />
              Select Resident
            </label>
            <select
              value={selectedResidentId}
              onChange={(e) => setModalState(prev => ({ ...prev, selectedResidentId: e.target.value }))}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            >
              <option value="">Choose a resident...</option>
              {unassignedResidents.map((resident) => {
                const isCompatible = !assignState.requiredGenderForBed || resident.gender === assignState.requiredGenderForBed;
                const age = calculateAge(resident.date_of_birth);
                const ageStr = age !== null ? `, ${age}yo` : '';
                const isolationStr = resident.is_isolation ? ' - ISOLATION' : '';
                const diagnosisStr = resident.diagnosis ? `, ${resident.diagnosis}` : '';
                return (
                  <option
                    key={resident.id}
                    value={resident.id}
                    disabled={!isCompatible}
                    className={!isCompatible ? 'text-gray-400' : ''}
                  >
                    {resident.first_name} {resident.last_name} ({resident.gender === 'male' ? 'M' : resident.gender === 'female' ? 'F' : 'O'}{ageStr}{diagnosisStr}){isolationStr}
                    {!isCompatible ? ' (incompatible gender)' : ''}
                  </option>
                );
              })}
            </select>
            {unassignedResidents.length === 0 && (
              <p className="text-sm text-slate-500 mt-2">
                No unassigned residents available. Create a new admission first.
              </p>
            )}
            {assignState.requiredGenderForBed && unassignedResidents.filter(r => r.gender === assignState.requiredGenderForBed).length === 0 && unassignedResidents.length > 0 && (
              <p className="text-sm text-yellow-600 mt-2">
                No {assignState.requiredGenderForBed} residents available. Only {assignState.requiredGenderForBed} residents can be assigned to this bed.
              </p>
            )}
          </div>

          {/* Bed Recommendations Section */}
          {selectedResidentId && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-3">
                <Icon name="recommend" size={16} className="text-amber-500" />
                Recommended Beds
              </h4>

              {assignState.recommendationsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                  <span className="ml-2 text-sm text-slate-500">Analyzing compatibility...</span>
                </div>
              ) : assignState.bedRecommendations.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No compatible beds available for this resident.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {/* Top Recommendation */}
                  {assignState.bedRecommendations[0] && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="star" size={18} className="text-amber-500" />
                          <span className="font-semibold text-slate-900">
                            Room {assignState.bedRecommendations[0].bedInfo.roomNumber}{assignState.bedRecommendations[0].bedInfo.bedLetter}
                          </span>
                          <span className="text-xs text-slate-500">- {assignState.bedRecommendations[0].bedInfo.wingName}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                          {assignState.bedRecommendations[0].totalScore}% match
                        </span>
                      </div>
                      {assignState.bedRecommendations[0].roommate && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-medium">Roommate:</span> {assignState.bedRecommendations[0].roommate.name}
                          {assignState.bedRecommendations[0].roommate.age !== null && ` (${assignState.bedRecommendations[0].roommate.age}yo)`}
                          {assignState.bedRecommendations[0].roommate.diagnosis && `, ${assignState.bedRecommendations[0].roommate.diagnosis}`}
                        </div>
                      )}
                      {!assignState.bedRecommendations[0].roommate && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-medium">Empty room</span> - No roommate constraints
                        </div>
                      )}
                      {assignState.bedRecommendations[0].warnings.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {assignState.bedRecommendations[0].warnings.map((warning, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                              <Icon name="warning" size={12} />
                              {warning}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex gap-4 text-xs text-slate-500">
                        <span>Age: {assignState.bedRecommendations[0].ageScore}%</span>
                        <span>Diagnosis: {assignState.bedRecommendations[0].diagnosisScore}%</span>
                        <span>Flexibility: {assignState.bedRecommendations[0].flexibilityScore}%</span>
                      </div>
                    </div>
                  )}

                  {/* Other Recommendations */}
                  {assignState.bedRecommendations.slice(1, 5).map((rec) => {
                    const { color, icon } = getCompatibilityLabel(rec.totalScore);
                    return (
                      <div
                        key={rec.bedId}
                        className={`p-3 rounded-lg border ${
                          color === 'green' ? 'bg-green-50/50 border-green-200' :
                          color === 'yellow' ? 'bg-yellow-50/50 border-yellow-200' :
                          'bg-orange-50/50 border-orange-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon
                              name={icon === 'star' ? 'star' : icon === 'check' ? 'check_circle' : 'warning'}
                              size={16}
                              className={
                                color === 'green' ? 'text-green-500' :
                                color === 'yellow' ? 'text-yellow-500' :
                                'text-orange-500'
                              }
                            />
                            <span className="font-medium text-slate-800">
                              Room {rec.bedInfo.roomNumber}{rec.bedInfo.bedLetter}
                            </span>
                            <span className="text-xs text-slate-500">- {rec.bedInfo.wingName}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            color === 'green' ? 'bg-green-100 text-green-700' :
                            color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {rec.totalScore}% match
                          </span>
                        </div>
                        {rec.roommate && (
                          <div className="mt-1 text-sm text-slate-600">
                            {rec.roommate.name}
                            {rec.roommate.age !== null && ` (${rec.roommate.age}yo)`}
                          </div>
                        )}
                        {rec.warnings.length > 0 && (
                          <div className="mt-1 text-xs text-orange-600">
                            {rec.warnings.join(' | ')}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {assignState.bedRecommendations.length > 5 && (
                    <p className="text-xs text-slate-500 text-center pt-2">
                      +{assignState.bedRecommendations.length - 5} more beds available
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Move Optimization Suggestions */}
          {assignState.moveOptimizations.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <button
                onClick={() => setAssignState(prev => ({ ...prev, showOptimizations: !prev.showOptimizations }))}
                className="w-full flex items-center justify-between text-slate-700 text-sm font-semibold hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="lightbulb" size={16} className="text-violet-500" />
                  Optimization Suggestions
                  <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">
                    {assignState.moveOptimizations.length}
                  </span>
                </div>
                <Icon
                  name={assignState.showOptimizations ? 'expand_less' : 'expand_more'}
                  size={20}
                  className="text-slate-400"
                />
              </button>

              {assignState.showOptimizations && (
                <div className="mt-3 space-y-2">
                  {assignState.moveOptimizations.slice(0, 3).map((opt) => (
                    <div
                      key={opt.residentId}
                      className="p-3 bg-violet-50 border border-violet-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Move {opt.residentName}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {opt.currentBed} → {opt.suggestedBed}
                          </p>
                          <p className="text-xs text-violet-600 mt-1">
                            {opt.reason}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            setActionLoading(true);
                            await unassignResident(opt.residentId, opt.currentBedId);
                            await assignResident(opt.suggestedBedId, opt.residentId);
                            setActionLoading(false);
                            // Refresh recommendations
                            if (selectedResidentId) {
                              getBedRecommendations(selectedResidentId).then(recs =>
                                setAssignState(prev => ({ ...prev, bedRecommendations: recs }))
                              );
                            }
                            getMoveOptimizations(unassignedResidents).then(opts =>
                              setAssignState(prev => ({ ...prev, moveOptimizations: opts }))
                            );
                          }}
                          loading={actionLoading}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignResident}
              disabled={!selectedResidentId || (assignState.genderCompatibility !== null && !assignState.genderCompatibility.compatible)}
              loading={actionLoading}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>

      {/* Move Resident Modal */}
      <Modal
        isOpen={showMoveModal}
        onClose={closeModal}
        title="Move Resident"
        size="lg"
      >
        <div className="space-y-4">
          {selectedBed?.resident && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Moving Resident</p>
              <p className="font-semibold text-slate-900">
                {selectedBed.resident.first_name} {selectedBed.resident.last_name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({selectedBed.resident.gender === 'male' ? 'Male' : selectedBed.resident.gender === 'female' ? 'Female' : 'Other'}
                  {selectedBed.resident.date_of_birth && `, ${calculateAge(selectedBed.resident.date_of_birth)}yo`}
                  {selectedBed.resident.diagnosis && `, ${selectedBed.resident.diagnosis}`})
                </span>
              </p>
              <p className="text-sm text-slate-500">
                From: {selectedBed.room?.wing?.name} - Room {selectedBed.room?.room_number} - Bed {selectedBed.bed_letter}
              </p>
            </div>
          )}

          {/* Gender incompatibility warning */}
          {moveState.targetCompatibility && !moveState.targetCompatibility.compatible && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <Icon name="warning" size={18} className="mt-0.5 flex-shrink-0" />
              <div>{moveState.targetCompatibility.reason}</div>
            </div>
          )}

          {/* Bed Recommendations Section */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-3">
              <Icon name="recommend" size={16} className="text-amber-500" />
              Recommended Beds
            </h4>

            {moveState.recommendationsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                <span className="ml-2 text-sm text-slate-500">Analyzing compatibility...</span>
              </div>
            ) : moveState.bedRecommendations.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No compatible beds available.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Top Recommendation */}
                {moveState.bedRecommendations[0] && (
                  <button
                    type="button"
                    onClick={() => setTargetBedId(moveState.bedRecommendations[0].bedId)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedTargetBedId === moveState.bedRecommendations[0].bedId
                        ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300'
                        : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="star" size={18} className="text-amber-500" />
                        <span className="font-semibold text-slate-900">
                          Room {moveState.bedRecommendations[0].bedInfo.roomNumber}{moveState.bedRecommendations[0].bedInfo.bedLetter}
                        </span>
                        <span className="text-xs text-slate-500">- {moveState.bedRecommendations[0].bedInfo.wingName}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                        {moveState.bedRecommendations[0].totalScore}% match
                      </span>
                    </div>
                    {moveState.bedRecommendations[0].roommate && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Roommate:</span> {moveState.bedRecommendations[0].roommate.name}
                        {moveState.bedRecommendations[0].roommate.age !== null && ` (${moveState.bedRecommendations[0].roommate.age}yo)`}
                        {moveState.bedRecommendations[0].roommate.diagnosis && `, ${moveState.bedRecommendations[0].roommate.diagnosis}`}
                      </div>
                    )}
                    {!moveState.bedRecommendations[0].roommate && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Empty room</span> - No roommate constraints
                      </div>
                    )}
                    {moveState.bedRecommendations[0].warnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {moveState.bedRecommendations[0].warnings.map((warning, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                            <Icon name="warning" size={12} />
                            {warning}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex gap-4 text-xs text-slate-500">
                      <span>Age: {moveState.bedRecommendations[0].ageScore}%</span>
                      <span>Diagnosis: {moveState.bedRecommendations[0].diagnosisScore}%</span>
                      <span>Flexibility: {moveState.bedRecommendations[0].flexibilityScore}%</span>
                    </div>
                  </button>
                )}

                {/* Other Recommendations */}
                {moveState.bedRecommendations.slice(1, 5).map((rec) => {
                  const { color, icon } = getCompatibilityLabel(rec.totalScore);
                  return (
                    <button
                      key={rec.bedId}
                      type="button"
                      onClick={() => setTargetBedId(rec.bedId)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedTargetBedId === rec.bedId
                          ? 'ring-2 ring-primary-300 border-primary-400 bg-primary-50'
                          : color === 'green' ? 'bg-green-50/50 border-green-200 hover:border-green-300' :
                            color === 'yellow' ? 'bg-yellow-50/50 border-yellow-200 hover:border-yellow-300' :
                            'bg-orange-50/50 border-orange-200 hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon
                            name={icon === 'star' ? 'star' : icon === 'check' ? 'check_circle' : 'warning'}
                            size={16}
                            className={
                              color === 'green' ? 'text-green-500' :
                              color === 'yellow' ? 'text-yellow-500' :
                              'text-orange-500'
                            }
                          />
                          <span className="font-medium text-slate-800">
                            Room {rec.bedInfo.roomNumber}{rec.bedInfo.bedLetter}
                          </span>
                          <span className="text-xs text-slate-500">- {rec.bedInfo.wingName}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          color === 'green' ? 'bg-green-100 text-green-700' :
                          color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {rec.totalScore}% match
                        </span>
                      </div>
                      {rec.roommate && (
                        <div className="mt-1 text-sm text-slate-600">
                          {rec.roommate.name}
                          {rec.roommate.age !== null && ` (${rec.roommate.age}yo)`}
                        </div>
                      )}
                      {rec.warnings.length > 0 && (
                        <div className="mt-1 text-xs text-orange-600">
                          {rec.warnings.join(' | ')}
                        </div>
                      )}
                    </button>
                  );
                })}

                {moveState.bedRecommendations.length > 5 && (
                  <p className="text-xs text-slate-500 text-center pt-2">
                    +{moveState.bedRecommendations.length - 5} more beds available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Manual bed selection fallback */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              Or Select Manually
            </label>
            <select
              value={selectedTargetBedId}
              onChange={(e) => setTargetBedId(e.target.value)}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            >
              <option value="">Choose a vacant bed...</option>
              {vacantBeds.map((bed) => {
                const rec = moveState.bedRecommendations.find(r => r.bedId === bed.id);
                return (
                  <option key={bed.id} value={bed.id}>
                    {bed.room?.wing?.name} - Room {bed.room?.room_number} - Bed {bed.bed_letter}
                    {rec ? ` (${rec.totalScore}% match)` : ''}
                  </option>
                );
              })}
            </select>
            {vacantBeds.length === 0 && (
              <p className="text-sm text-slate-500 mt-2">
                No vacant beds available to move to.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveResident}
              disabled={!selectedTargetBedId || (moveState.targetCompatibility !== null && !moveState.targetCompatibility.compatible)}
              loading={actionLoading}
            >
              Move Resident
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
