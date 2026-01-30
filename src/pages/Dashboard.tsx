import { useOutletContext } from 'react-router-dom';
import { BedCard, BedGrid, FilterLegend, StatsCard, Modal, Button } from '../components';
import { useBeds, useBedActions } from '../hooks/useBeds';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useUnassignedResidents } from '../hooks/useResidents';
import { useState } from 'react';
import type { BedWithDetails } from '../components/BedCard';
import type { LayoutContext } from '../components/AppLayout';

export function Dashboard() {
  const { searchQuery, selectedWingId, wings } = useOutletContext<LayoutContext>();

  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [selectedTargetBedId, setSelectedTargetBedId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { beds, loading } = useBeds({
    wing_id: selectedWingId,
    search: searchQuery || undefined,
  });
  const { stats } = useDashboardStats(selectedWingId);
  const { residents: unassignedResidents } = useUnassignedResidents();
  const { updateBedStatus, assignResident, unassignResident } = useBedActions();

  // Get the selected wing name for the header
  const selectedWing = wings.find((w) => w.id === selectedWingId);
  const headerTitle = selectedWing ? `Unit Overview: ${selectedWing.name}` : 'Unit Overview: All Wings';

  const handleAssignResident = async () => {
    if (!selectedBed || !selectedResidentId) return;
    setActionLoading(true);
    await assignResident(selectedBed.id, selectedResidentId);
    setActionLoading(false);
    setShowAssignModal(false);
    setSelectedBed(null);
    setSelectedResidentId('');
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
    setActionLoading(true);

    // Unassign from current bed (sets bed to vacant, removes resident's bed_id)
    await unassignResident(selectedBed.resident.id, selectedBed.id);

    // Assign to new bed (sets bed to occupied, updates resident's bed_id)
    await assignResident(selectedTargetBedId, selectedBed.resident.id);

    setActionLoading(false);
    setShowMoveModal(false);
    setSelectedBed(null);
    setSelectedTargetBedId('');
  };

  // Get vacant beds for move functionality
  const vacantBeds = beds.filter((bed) => bed.status === 'vacant');

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="flex flex-wrap gap-4">
        <StatsCard
          title="Occupancy Rate"
          value={`${stats.occupancy_rate}%`}
          change={stats.occupancy_rate >= 85 ? '+1.2%' : '-0.8%'}
          changeType={stats.occupancy_rate >= 85 ? 'positive' : 'negative'}
        />
        <StatsCard
          title="Available Beds"
          value={stats.available_beds}
          change={stats.available_beds > 5 ? `+${Math.min(stats.available_beds, 3)}` : `-${Math.abs(5 - stats.available_beds)}`}
          changeType={stats.available_beds > 5 ? 'positive' : 'negative'}
        />
        <StatsCard
          title="Isolation Units"
          value={stats.isolation_count}
          change="Stable"
          changeType="neutral"
        />
        <StatsCard
          title="Out of Service"
          value={stats.out_of_service_count}
          change="Maintenance"
          changeType="neutral"
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
        }}
        title="Assign Resident"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Select Resident</label>
            <select
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose a resident...</option>
              {unassignedResidents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.first_name} {resident.last_name} ({resident.payor.replace('_', ' ')})
                </option>
              ))}
            </select>
            {unassignedResidents.length === 0 && (
              <p className="text-sm text-[#4c739a] mt-2">
                No unassigned residents available. Create a new admission first.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedResidentId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignResident} disabled={!selectedResidentId} loading={actionLoading}>
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
              </p>
              <p className="text-sm text-[#4c739a]">
                From: {selectedBed.room?.wing?.name} - Room {selectedBed.room?.room_number} - Bed {selectedBed.bed_letter}
              </p>
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
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowMoveModal(false);
                setSelectedTargetBedId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleMoveResident} disabled={!selectedTargetBedId} loading={actionLoading}>
              Move Resident
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
