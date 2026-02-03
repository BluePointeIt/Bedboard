import { Modal, Button } from './index';
import type { BedWithDetails } from './BedCard';

interface BedDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBed: BedWithDetails | null;
  onOpenAssignModal: () => void;
  onOpenMoveModal: () => void;
  onUnassignResident: () => Promise<void>;
  onSetOutOfService: () => Promise<void>;
  onReturnToService: () => Promise<void>;
  actionLoading: boolean;
}

export function BedDetailModal({
  isOpen,
  onClose,
  selectedBed,
  onOpenAssignModal,
  onOpenMoveModal,
  onUnassignResident,
  onSetOutOfService,
  onReturnToService,
  actionLoading,
}: BedDetailModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
              <Button onClick={onOpenAssignModal}>Assign Resident</Button>
            )}

            {selectedBed.status === 'occupied' && selectedBed.resident && (
              <>
                <Button onClick={onOpenMoveModal}>
                  Move Resident
                </Button>
                <Button variant="danger" onClick={onUnassignResident} loading={actionLoading}>
                  Unassign Resident
                </Button>
              </>
            )}

            {selectedBed.status !== 'out_of_service' && !selectedBed.resident && (
              <Button variant="secondary" onClick={onSetOutOfService} loading={actionLoading}>
                Set Out of Service
              </Button>
            )}

            {selectedBed.status === 'out_of_service' && (
              <Button onClick={onReturnToService} loading={actionLoading}>
                Return to Service
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
