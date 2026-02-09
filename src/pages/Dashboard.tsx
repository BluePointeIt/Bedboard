import { useOutletContext } from 'react-router-dom';
import { BedCard, BedGrid, FilterLegend, Icon, BedDetailModal, BedAssignmentModal, BedMoveModal } from '../components';
import { useBeds, useBedActions } from '../hooks/useBeds';
import type { GenderCompatibilityResult } from '../hooks/useBeds';
import { useUnassignedResidents } from '../hooks/useResidents';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { BedWithDetails } from '../components/BedCard';
import type { LayoutContext } from '../components/AppLayout';
import type { Gender } from '../types';
import {
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
  const { searchQuery, selectedWingId, wings, currentFacility } = useOutletContext<LayoutContext>();

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
    facilityId: currentFacility?.id,
  });
  const { residents: unassignedResidents } = useUnassignedResidents({ facilityId: currentFacility?.id });
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
      <BedDetailModal
        isOpen={modalState.type === 'detail'}
        onClose={closeModal}
        selectedBed={selectedBed}
        onOpenAssignModal={openAssignModal}
        onOpenMoveModal={openMoveModal}
        onUnassignResident={handleUnassignResident}
        onSetOutOfService={handleSetOutOfService}
        onReturnToService={handleReturnToService}
        actionLoading={actionLoading}
      />

      {/* Assign Resident Modal */}
      <BedAssignmentModal
        isOpen={showAssignModal}
        onClose={closeModal}
        selectedBed={selectedBed}
        selectedResidentId={selectedResidentId}
        onResidentSelect={(residentId) => setModalState(prev => ({ ...prev, selectedResidentId: residentId }))}
        unassignedResidents={unassignedResidents}
        assignState={assignState}
        onToggleOptimizations={() => setAssignState(prev => ({ ...prev, showOptimizations: !prev.showOptimizations }))}
        onApplyOptimization={async (opt) => {
          setActionLoading(true);
          if (opt.currentBedId) {
            await unassignResident(opt.residentId, opt.currentBedId);
          }
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
        onAssign={handleAssignResident}
        actionLoading={actionLoading}
      />

      {/* Move Resident Modal */}
      <BedMoveModal
        isOpen={showMoveModal}
        onClose={closeModal}
        selectedBed={selectedBed}
        selectedTargetBedId={selectedTargetBedId}
        onTargetBedSelect={setTargetBedId}
        vacantBeds={vacantBeds}
        moveState={moveState}
        onMove={handleMoveResident}
        actionLoading={actionLoading}
      />
    </div>
  );
}
