import { useOutletContext } from 'react-router-dom';
import { BedCard, BedGrid, FilterLegend, StatsCard, Modal, Button, Icon } from '../components';
import { useBeds, useBedActions } from '../hooks/useBeds';
import type { GenderCompatibilityResult } from '../hooks/useBeds';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useUnassignedResidents } from '../hooks/useResidents';
import { useState, useEffect } from 'react';
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
  const { stats } = useDashboardStats(selectedWingId);
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

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="flex flex-wrap gap-4">
        <StatsCard
          title="% Occupied"
          value={`${stats.occupancy_rate}%`}
          change={stats.occupancy_rate >= 90 ? 'High' : stats.occupancy_rate >= 70 ? 'Normal' : 'Low'}
          changeType={stats.occupancy_rate >= 90 ? 'negative' : stats.occupancy_rate >= 70 ? 'neutral' : 'positive'}
        />
        <StatsCard
          title="Male Beds Occupied"
          value={stats.male_occupied}
          change={`${stats.occupied_beds > 0 ? Math.round((stats.male_occupied / stats.occupied_beds) * 100) : 0}%`}
          variant="male"
        />
        <StatsCard
          title="Female Beds Occupied"
          value={stats.female_occupied}
          change={`${stats.occupied_beds > 0 ? Math.round((stats.female_occupied / stats.occupied_beds) * 100) : 0}%`}
          variant="female"
        />
        <StatsCard
          title="Isolation Beds Occupied"
          value={stats.isolation_count}
          change="Active"
          variant="isolation"
        />
        <StatsCard
          title="Available Beds"
          value={stats.available_beds}
          change={stats.available_beds > 5 ? 'Good' : 'Low'}
          changeType={stats.available_beds > 5 ? 'positive' : 'negative'}
        />
        <StatsCard
          title="Out of Service"
          value={stats.out_of_service_count}
          change="Maintenance"
          variant="outOfService"
        />
      </div>

      {/* Filter Legend & Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#0d141b]">{headerTitle}</h2>
        <FilterLegend />
      </div>

      {/* Beds Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : beds.length === 0 ? (
        <div className="text-center py-12 text-[#4c739a]">
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
                <p className="text-sm text-[#4c739a]">Wing</p>
                <p className="font-medium text-[#0d141b]">{selectedBed.room?.wing?.name}</p>
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
              <div className="p-4 bg-[#f6f7f8] rounded-lg">
                <p className="text-sm text-[#4c739a] mb-2">Current Resident</p>
                <p className="font-semibold text-[#0d141b]">
                  {selectedBed.resident.first_name} {selectedBed.resident.last_name}
                </p>
                <p className="text-sm text-[#4c739a]">
                  Payor: {selectedBed.resident.payor.replace('_', ' ')}
                </p>
                {selectedBed.resident.is_isolation && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                    {selectedBed.resident.isolation_type || 'Isolation'}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#e7edf3]">
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
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Select Resident</label>
            <select
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              <p className="text-sm text-[#4c739a] mt-2">
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
            <div className="p-4 bg-[#f6f7f8] rounded-lg">
              <p className="text-sm text-[#4c739a] mb-1">Moving Resident</p>
              <p className="font-semibold text-[#0d141b]">
                {selectedBed.resident.first_name} {selectedBed.resident.last_name}
                <span className="ml-2 text-xs font-normal text-[#4c739a]">
                  ({selectedBed.resident.gender === 'male' ? 'Male' : selectedBed.resident.gender === 'female' ? 'Female' : 'Other'})
                </span>
              </p>
              <p className="text-sm text-[#4c739a]">
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
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Select New Bed</label>
            <select
              value={selectedTargetBedId}
              onChange={(e) => setSelectedTargetBedId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose a vacant bed...</option>
              {vacantBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.room?.wing?.name} - Room {bed.room?.room_number} - Bed {bed.bed_letter}
                </option>
              ))}
            </select>
            {vacantBeds.length === 0 && (
              <p className="text-sm text-[#4c739a] mt-2">
                No vacant beds available to move to.
              </p>
            )}
            <p className="text-xs text-[#4c739a] mt-2">
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
