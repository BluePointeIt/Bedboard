import { Modal, Button, Icon } from './index';
import type { BedWithDetails } from './BedCard';
import type { Resident, Gender } from '../types';
import type { GenderCompatibilityResult } from '../hooks/useBeds';
import {
  calculateAge,
  getCompatibilityLabel,
  type BedCompatibilityScore,
  type MoveRecommendation,
} from '../lib/compatibilityUtils';

interface AssignModalState {
  genderCompatibility: GenderCompatibilityResult | null;
  requiredGenderForBed: Gender | null;
  bedRecommendations: BedCompatibilityScore[];
  recommendationsLoading: boolean;
  moveOptimizations: MoveRecommendation[];
  showOptimizations: boolean;
}

interface BedAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBed: BedWithDetails | null;
  selectedResidentId: string;
  onResidentSelect: (residentId: string) => void;
  unassignedResidents: Resident[];
  assignState: AssignModalState;
  onToggleOptimizations: () => void;
  onApplyOptimization: (optimization: MoveRecommendation) => Promise<void>;
  onAssign: () => Promise<void>;
  actionLoading: boolean;
}

export function BedAssignmentModal({
  isOpen,
  onClose,
  selectedBed: _selectedBed,
  selectedResidentId,
  onResidentSelect,
  unassignedResidents,
  assignState,
  onToggleOptimizations,
  onApplyOptimization,
  onAssign,
  actionLoading,
}: BedAssignmentModalProps) {
  // Note: selectedBed is kept in the interface for potential future use but currently unused
  void _selectedBed;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
            onChange={(e) => onResidentSelect(e.target.value)}
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
              onClick={onToggleOptimizations}
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
                        onClick={() => onApplyOptimization(opt)}
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
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={onAssign}
            disabled={!selectedResidentId || (assignState.genderCompatibility !== null && !assignState.genderCompatibility.compatible)}
            loading={actionLoading}
          >
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}
