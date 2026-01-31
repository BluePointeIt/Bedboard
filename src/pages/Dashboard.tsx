import { useOutletContext } from 'react-router-dom';
import { BedCard, BedGrid, FilterLegend, Modal, Button, Icon } from '../components';
import { useBeds, useBedActions } from '../hooks/useBeds';
import type { GenderCompatibilityResult } from '../hooks/useBeds';
import { useUnassignedResidents } from '../hooks/useResidents';
import { useState, useEffect, useMemo } from 'react';
import type { BedWithDetails } from '../components/BedCard';
import type { LayoutContext } from '../components/AppLayout';
import type { Gender } from '../types';

export function Dashboard() {
  const { searchQuery, selectedWingId, wings } = useOutletContext<LayoutContext>();

  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [selectedTargetBedId, setSelectedTargetBedId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Gender compatibility state
  const [genderCompatibility, setGenderCompatibility] = useState<GenderCompatibilityResult | null>(null);
  const [requiredGenderForBed, setRequiredGenderForBed] = useState<Gender | null>(null);
  const [moveTargetCompatibility, setMoveTargetCompatibility] = useState<GenderCompatibilityResult | null>(null);

  const { beds, loading } = useBeds({
    wing_id: selectedWingId,
    search: searchQuery || undefined,
  });
  const { residents: unassignedResidents } = useUnassignedResidents();
  const { updateBedStatus, assignResident, unassignResident, checkGenderCompatibility, getRequiredGenderForBed } = useBedActions();

  // Get the selected wing name for the header
  const selectedWing = wings.find((w) => w.id === selectedWingId);
  const headerTitle = selectedWing ? `Unit Overview: ${selectedWing.name}` : 'Unit Overview: All Wings';

  // Check required gender when opening assign modal
  useEffect(() => {
    if (showAssignModal && selectedBed) {
      getRequiredGenderForBed(selectedBed.id).then(setRequiredGenderForBed);
    } else {
      setRequiredGenderForBed(null);
      setGenderCompatibility(null);
    }
  }, [showAssignModal, selectedBed]);

  // Check gender compatibility when a resident is selected for assignment
  useEffect(() => {
    if (selectedResidentId && selectedBed) {
      const resident = unassignedResidents.find((r) => r.id === selectedResidentId);
      if (resident) {
        checkGenderCompatibility(selectedBed.id, resident.gender).then(setGenderCompatibility);
      }
    } else {
      setGenderCompatibility(null);
    }
  }, [selectedResidentId, selectedBed, unassignedResidents]);

  // Check gender compatibility when a target bed is selected for move
  useEffect(() => {
    if (selectedTargetBedId && selectedBed?.resident) {
      checkGenderCompatibility(selectedTargetBedId, selectedBed.resident.gender).then(setMoveTargetCompatibility);
    } else {
      setMoveTargetCompatibility(null);
    }
  }, [selectedTargetBedId, selectedBed]);

  const handleAssignResident = async () => {
    if (!selectedBed || !selectedResidentId) return;

    // Final compatibility check before assigning
    const resident = unassignedResidents.find((r) => r.id === selectedResidentId);
    if (resident) {
      const compatibility = await checkGenderCompatibility(selectedBed.id, resident.gender);
      if (!compatibility.compatible) {
        setGenderCompatibility(compatibility);
        return;
      }
    }

    setActionLoading(true);
    await assignResident(selectedBed.id, selectedResidentId);
    setActionLoading(false);
    setShowAssignModal(false);
    setSelectedBed(null);
    setSelectedResidentId('');
    setGenderCompatibility(null);
  };

  const handleUnassignResident = async () => {
    if (!selectedBed?.resident) return;
    setActionLoading(true);
    await unassignResident(selectedBed.resident.id, selectedBed.id);
    setActionLoading(false);
    setSelectedBed(null);
  };

  const handleSetOutOfService = async () => {
    if (!selectedBed) return;
    setActionLoading(true);
    await updateBedStatus(selectedBed.id, 'out_of_service', 'Manual out of service');
    setActionLoading(false);
    setSelectedBed(null);
  };

  const handleReturnToService = async () => {
    if (!selectedBed) return;
    setActionLoading(true);
    await updateBedStatus(selectedBed.id, 'vacant');
    setActionLoading(false);
    setSelectedBed(null);
  };

  const handleMoveResident = async () => {
    if (!selectedBed?.resident || !selectedTargetBedId) return;

    // Final compatibility check before moving
    const compatibility = await checkGenderCompatibility(selectedTargetBedId, selectedBed.resident.gender);
    if (!compatibility.compatible) {
      setMoveTargetCompatibility(compatibility);
      return;
    }

    setActionLoading(true);

    // Unassign from current bed (sets bed to vacant, removes resident's bed_id)
    await unassignResident(selectedBed.resident.id, selectedBed.id);

    // Assign to new bed (sets bed to occupied, updates resident's bed_id)
    await assignResident(selectedTargetBedId, selectedBed.resident.id);

    setActionLoading(false);
    setShowMoveModal(false);
    setSelectedBed(null);
    setSelectedTargetBedId('');
    setMoveTargetCompatibility(null);
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

  return (
    <div className="space-y-6">
      {/* Gender-Specific Bed Availability */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Male Available */}
          <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-xl p-5 border border-primary-200">
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
          <div className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 rounded-xl p-5 border border-pink-200">
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
          <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-xl p-5 border border-violet-200">
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
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Icon name="domain" size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Wing Summary</h2>
              <p className="text-sm text-slate-500">Occupancy breakdown by wing</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wings.map(wing => {
              const wingBeds = beds.filter(b => b.room?.wing?.id === wing.id);
              const wingOccupied = wingBeds.filter(b => b.status === 'occupied').length;
              const wingTotal = wingBeds.length;
              const wingRate = wingTotal > 0 ? Math.round((wingOccupied / wingTotal) * 100) : 0;

              return (
                <div key={wing.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Icon name="domain" size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{selectedWing.name} Summary</h2>
                <p className="text-sm text-slate-500">Current wing occupancy details</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Occupancy Rate */}
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 border border-amber-200">
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
              <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-xl p-4 border border-primary-200">
                <p className="text-xs font-medium text-primary-700 mb-1">Occupied</p>
                <p className="text-2xl font-bold text-primary-600">{wingOccupied}</p>
                <p className="text-xs text-primary-500 mt-1">of {wingTotal} beds</p>
              </div>

              {/* Vacant */}
              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-4 border border-green-200">
                <p className="text-xs font-medium text-green-700 mb-1">Available</p>
                <p className="text-2xl font-bold text-green-600">{wingVacant}</p>
                <p className="text-xs text-green-500 mt-1">ready for admission</p>
              </div>

              {/* Out of Service */}
              <div className="bg-gradient-to-br from-slate-500/10 to-slate-500/5 rounded-xl p-4 border border-slate-200">
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
            <BedCard key={bed.id} bed={bed} onClick={() => setSelectedBed(bed)} />
          ))}
        </BedGrid>
      )}

      {/* Bed Detail Modal */}
      <Modal
        isOpen={!!selectedBed && !showAssignModal && !showMoveModal}
        onClose={() => setSelectedBed(null)}
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
              <div className="p-4 bg-slate-50 rounded-lg">
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
                <Button onClick={() => setShowAssignModal(true)}>Assign Resident</Button>
              )}

              {selectedBed.status === 'occupied' && selectedBed.resident && (
                <>
                  <Button onClick={() => setShowMoveModal(true)}>
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
        onClose={() => {
          setShowAssignModal(false);
          setSelectedResidentId('');
          setGenderCompatibility(null);
        }}
        title="Assign Resident"
        size="md"
      >
        <div className="space-y-4">
          {/* Gender requirement info */}
          {requiredGenderForBed && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-start gap-2">
              <Icon name="info" size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Gender Restriction:</strong> This bed requires a{' '}
                <strong>{requiredGenderForBed}</strong> resident due to existing occupancy in the room
                or shared bathroom.
              </div>
            </div>
          )}

          {/* Gender incompatibility warning */}
          {genderCompatibility && !genderCompatibility.compatible && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <Icon name="warning" size={18} className="mt-0.5 flex-shrink-0" />
              <div>{genderCompatibility.reason}</div>
            </div>
          )}

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="person" size={16} className="text-slate-400" />
              Select Resident
            </label>
            <select
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            >
              <option value="">Choose a resident...</option>
              {unassignedResidents.map((resident) => {
                const isCompatible = !requiredGenderForBed || resident.gender === requiredGenderForBed;
                return (
                  <option
                    key={resident.id}
                    value={resident.id}
                    disabled={!isCompatible}
                    className={!isCompatible ? 'text-gray-400' : ''}
                  >
                    {resident.first_name} {resident.last_name} ({resident.gender === 'male' ? 'M' : resident.gender === 'female' ? 'F' : 'O'}) - {resident.payor.replace('_', ' ')}
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
            {requiredGenderForBed && unassignedResidents.filter(r => r.gender === requiredGenderForBed).length === 0 && unassignedResidents.length > 0 && (
              <p className="text-sm text-yellow-600 mt-2">
                No {requiredGenderForBed} residents available. Only {requiredGenderForBed} residents can be assigned to this bed.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedResidentId('');
                setGenderCompatibility(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignResident}
              disabled={!selectedResidentId || (genderCompatibility !== null && !genderCompatibility.compatible)}
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
        onClose={() => {
          setShowMoveModal(false);
          setSelectedTargetBedId('');
          setMoveTargetCompatibility(null);
        }}
        title="Move Resident"
        size="md"
      >
        <div className="space-y-4">
          {selectedBed?.resident && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Moving Resident</p>
              <p className="font-semibold text-slate-900">
                {selectedBed.resident.first_name} {selectedBed.resident.last_name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({selectedBed.resident.gender === 'male' ? 'Male' : selectedBed.resident.gender === 'female' ? 'Female' : 'Other'})
                </span>
              </p>
              <p className="text-sm text-slate-500">
                From: {selectedBed.room?.wing?.name} - Room {selectedBed.room?.room_number} - Bed {selectedBed.bed_letter}
              </p>
            </div>
          )}

          {/* Gender incompatibility warning */}
          {moveTargetCompatibility && !moveTargetCompatibility.compatible && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <Icon name="warning" size={18} className="mt-0.5 flex-shrink-0" />
              <div>{moveTargetCompatibility.reason}</div>
            </div>
          )}

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              Select New Bed
            </label>
            <select
              value={selectedTargetBedId}
              onChange={(e) => setSelectedTargetBedId(e.target.value)}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            >
              <option value="">Choose a vacant bed...</option>
              {vacantBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.room?.wing?.name} - Room {bed.room?.room_number} - Bed {bed.bed_letter}
                </option>
              ))}
            </select>
            {vacantBeds.length === 0 && (
              <p className="text-sm text-slate-500 mt-2">
                No vacant beds available to move to.
              </p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Note: Semi-private rooms and shared bathrooms require same-gender residents.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowMoveModal(false);
                setSelectedTargetBedId('');
                setMoveTargetCompatibility(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveResident}
              disabled={!selectedTargetBedId || (moveTargetCompatibility !== null && !moveTargetCompatibility.compatible)}
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
