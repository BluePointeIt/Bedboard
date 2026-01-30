import { useState, useEffect } from 'react';
import { Button, Icon, Modal } from '../components';
import { useWings } from '../hooks/useWings';
import type { WingType, WingWithStats } from '../types';

const WING_TYPES: { value: WingType; label: string }[] = [
  { value: 'rehab', label: 'Rehabilitation' },
  { value: 'long_term', label: 'Long Term Care' },
  { value: 'hospice', label: 'Hospice' },
  { value: 'memory_care', label: 'Memory Care' },
];

export function Settings() {
  const [facilityName, setFacilityName] = useState('MediBed Pro Facility');
  const [saved, setSaved] = useState(false);

  const { wings, loading, updateWing, addBedsToWing, removeBedsFromWing, refetch } = useWings();

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWing, setSelectedWing] = useState<WingWithStats | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    wing_type: 'rehab' as WingType,
    bedChange: 0,
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load facility name from localStorage
  useEffect(() => {
    const savedFacilityName = localStorage.getItem('facilityName');
    if (savedFacilityName) {
      setFacilityName(savedFacilityName);
    }
  }, []);

  // Calculate total beds
  const totalBeds = wings.reduce((sum, wing) => sum + (wing.total_beds || 0), 0);

  const handleSaveFacility = () => {
    localStorage.setItem('facilityName', facilityName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEditClick = (wing: WingWithStats) => {
    setSelectedWing(wing);
    setEditForm({
      name: wing.name,
      wing_type: wing.wing_type,
      bedChange: 0,
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveWing = async () => {
    if (!selectedWing) return;

    setSaving(true);
    setEditError(null);

    // Update wing name and type
    const { error: updateError } = await updateWing(selectedWing.id, {
      name: editForm.name,
      wing_type: editForm.wing_type,
    });

    if (updateError) {
      setEditError(updateError.message);
      setSaving(false);
      return;
    }

    // Handle bed changes
    if (editForm.bedChange > 0) {
      const { error: addError } = await addBedsToWing(selectedWing.id, editForm.bedChange);
      if (addError) {
        setEditError(`Wing updated but failed to add beds: ${addError.message}`);
        setSaving(false);
        setShowEditModal(false);
        return;
      }
    } else if (editForm.bedChange < 0) {
      const { error: removeError } = await removeBedsFromWing(selectedWing.id, Math.abs(editForm.bedChange));
      if (removeError) {
        setEditError(`Wing updated but failed to remove beds: ${removeError.message}`);
        setSaving(false);
        setShowEditModal(false);
        return;
      }
    }

    setSaving(false);
    setShowEditModal(false);
    setSelectedWing(null);
    refetch();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0d141b]">Settings</h1>
        <p className="text-[#4c739a]">Configure your facility settings</p>
      </div>

      {/* Facility Information */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="domain" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-semibold text-[#0d141b]">Facility Information</h2>
            <p className="text-sm text-[#4c739a]">Configure your facility details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Facility Name</label>
            <input
              type="text"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="Enter facility name"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Total Facility Beds</label>
            <div className="px-3 py-2 border border-[#e7edf3] rounded-lg bg-[#f6f7f8]">
              <span className="text-2xl font-bold text-primary-500">{totalBeds}</span>
              <span className="text-sm text-[#4c739a] ml-2">beds across {wings.length} wings</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveFacility}>
            <Icon name="save" size={16} className="mr-2" />
            {saved ? 'Saved!' : 'Save Facility Name'}
          </Button>
        </div>
      </div>

      {/* Wings Overview */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="grid_view" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-semibold text-[#0d141b]">Facility Wings</h2>
            <p className="text-sm text-[#4c739a]">Manage your facility wings and bed capacity</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : wings.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-[#e7edf3]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f6f7f8] border-b border-[#e7edf3]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Wing Name
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Total Beds
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Occupied
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Occupancy
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {wings.map((wing) => (
                  <tr
                    key={wing.id}
                    className="border-b border-[#e7edf3] last:border-b-0 hover:bg-[#f6f7f8] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon name="domain" size={16} className="text-primary-500" />
                        <span className="font-medium text-[#0d141b]">{wing.name}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3 text-[#4c739a] capitalize">
                      {wing.wing_type.replace('_', ' ')}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 bg-primary-500/10 text-primary-500 font-bold rounded">
                        {wing.total_beds}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3 text-[#4c739a]">{wing.occupied_beds}</td>
                    <td className="text-center px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center min-w-[50px] px-2 py-1 font-bold rounded ${
                          wing.occupancy_rate >= 90
                            ? 'bg-red-100 text-red-700'
                            : wing.occupancy_rate >= 70
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {Math.round(wing.occupancy_rate)}%
                      </span>
                    </td>
                    <td className="text-right px-4 py-3">
                      <button
                        onClick={() => handleEditClick(wing)}
                        className="p-2 text-[#4c739a] hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors"
                        title="Edit wing"
                      >
                        <Icon name="edit" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f6f7f8]">
                  <td className="px-4 py-3 font-bold text-[#0d141b]">Total</td>
                  <td className="text-center px-4 py-3 text-[#4c739a]">{wings.length} wings</td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 bg-primary-500 text-white font-bold rounded">
                      {totalBeds}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 text-[#4c739a]">
                    {wings.reduce((sum, w) => sum + w.occupied_beds, 0)}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="font-bold text-[#0d141b]">
                      {totalBeds > 0
                        ? Math.round((wings.reduce((sum, w) => sum + w.occupied_beds, 0) / totalBeds) * 100)
                        : 0}
                      %
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-[#f6f7f8] rounded-lg border border-[#e7edf3]">
            <Icon name="domain" size={48} className="text-[#c4d4e5] mx-auto mb-3" />
            <p className="text-[#4c739a]">No wings configured</p>
          </div>
        )}

        {/* Summary Cards */}
        {wings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">{wings.length}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Wings</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-primary-500">{totalBeds}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Beds</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">
                {wings.length > 0 ? Math.round(totalBeds / wings.length) : 0}
              </p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Avg Beds/Wing</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">
                {wings.reduce((sum, w) => sum + w.occupied_beds, 0)}
              </p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Occupied Beds</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Wing Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedWing(null);
          setEditError(null);
        }}
        title="Edit Wing"
        size="md"
      >
        {selectedWing && (
          <div className="space-y-4">
            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {editError}
              </div>
            )}

            {/* Wing Name */}
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Wing Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter wing name"
              />
            </div>

            {/* Wing Type */}
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Wing Type</label>
              <select
                value={editForm.wing_type}
                onChange={(e) => setEditForm({ ...editForm, wing_type: e.target.value as WingType })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {WING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Total Beds */}
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Total Beds</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-3 py-2 border border-[#e7edf3] rounded-lg bg-[#f6f7f8]">
                  <span className="text-lg font-bold text-primary-500">{selectedWing.total_beds}</span>
                  <span className="text-sm text-[#4c739a] ml-2">current beds</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, bedChange: editForm.bedChange - 1 })}
                    disabled={selectedWing.total_beds + editForm.bedChange <= selectedWing.occupied_beds}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#e7edf3] hover:bg-[#f6f7f8] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="remove" size={20} />
                  </button>
                  <span className={`w-12 text-center font-bold ${editForm.bedChange > 0 ? 'text-green-600' : editForm.bedChange < 0 ? 'text-red-600' : 'text-[#4c739a]'}`}>
                    {editForm.bedChange > 0 ? `+${editForm.bedChange}` : editForm.bedChange}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, bedChange: editForm.bedChange + 1 })}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#e7edf3] hover:bg-[#f6f7f8]"
                  >
                    <Icon name="add" size={20} />
                  </button>
                </div>
              </div>
              {editForm.bedChange !== 0 && (
                <p className="text-xs text-[#4c739a] mt-2">
                  {editForm.bedChange > 0
                    ? `Will add ${editForm.bedChange} vacant bed(s) to existing rooms`
                    : `Will remove ${Math.abs(editForm.bedChange)} vacant bed(s)`}
                </p>
              )}
              {selectedWing.total_beds + editForm.bedChange <= selectedWing.occupied_beds && editForm.bedChange < 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Cannot remove beds below occupied count ({selectedWing.occupied_beds})
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedWing(null);
                  setEditError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWing}
                loading={saving}
                disabled={!editForm.name.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
