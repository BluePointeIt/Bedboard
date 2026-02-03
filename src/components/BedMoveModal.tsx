import { Modal, Button, Icon } from './index';
import type { BedWithDetails } from './BedCard';
import type { GenderCompatibilityResult } from '../hooks/useBeds';
import {
  calculateAge,
  getCompatibilityLabel,
  type BedCompatibilityScore,
} from '../lib/compatibilityUtils';

interface MoveModalState {
  targetCompatibility: GenderCompatibilityResult | null;
  bedRecommendations: BedCompatibilityScore[];
  recommendationsLoading: boolean;
}

interface BedMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBed: BedWithDetails | null;
  selectedTargetBedId: string;
  onTargetBedSelect: (bedId: string) => void;
  vacantBeds: BedWithDetails[];
  moveState: MoveModalState;
  onMove: () => Promise<void>;
  actionLoading: boolean;
}

export function BedMoveModal({
  isOpen,
  onClose,
  selectedBed,
  selectedTargetBedId,
  onTargetBedSelect,
  vacantBeds,
  moveState,
  onMove,
  actionLoading,
}: BedMoveModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
                  onClick={() => onTargetBedSelect(moveState.bedRecommendations[0].bedId)}
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
                    onClick={() => onTargetBedSelect(rec.bedId)}
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
            onChange={(e) => onTargetBedSelect(e.target.value)}
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
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={onMove}
            disabled={!selectedTargetBedId || (moveState.targetCompatibility !== null && !moveState.targetCompatibility.compatible)}
            loading={actionLoading}
          >
            Move Resident
          </Button>
        </div>
      </div>
    </Modal>
  );
}
