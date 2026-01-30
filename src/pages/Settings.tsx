import { useState, useEffect } from 'react';
import { Save, Building2, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { Button, Modal } from '../components';
import { useWards } from '../hooks/useWards';
import type { Ward } from '../types';

export function Settings() {
  const [facilityName, setFacilityName] = useState('');
  const [saved, setSaved] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    floor: 1,
    capacity: 10,
  });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { wards, createWard, updateWard, deleteWard, refetch } = useWards();

  // Load facility name from localStorage
  useEffect(() => {
    const savedFacilityName = localStorage.getItem('facilityName');
    if (savedFacilityName) {
      setFacilityName(savedFacilityName);
    }
  }, []);

  // Calculate total beds
  const totalBeds = wards.reduce((sum, ward) => sum + (ward.capacity || 0), 0);

  const handleSaveFacility = () => {
    localStorage.setItem('facilityName', facilityName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    const result = await createWard({
      name: formData.name,
      floor: formData.floor,
      capacity: formData.capacity,
    });

    setSaving(false);

    if (result.error) {
      setErrorMessage(result.error.message || 'Failed to add unit');
      return;
    }

    setShowAddUnitModal(false);
    setFormData({ name: '', floor: 1, capacity: 10 });
    refetch();
  };

  const resetForm = () => {
    setFormData({ name: '', floor: 1, capacity: 10 });
  };

  const handleEditClick = (ward: Ward) => {
    setSelectedWard(ward);
    setFormData({
      name: ward.name,
      floor: ward.floor,
      capacity: ward.capacity || 0,
    });
    setShowEditUnitModal(true);
  };

  const handleEditUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWard) return;

    setSaving(true);
    setErrorMessage(null);

    const result = await updateWard(selectedWard.id, {
      name: formData.name,
      floor: formData.floor,
      capacity: formData.capacity,
    });

    setSaving(false);

    if (result.error) {
      setErrorMessage(result.error.message || 'Failed to update unit');
      return;
    }

    setShowEditUnitModal(false);
    setSelectedWard(null);
    resetForm();
  };

  const handleDeleteClick = (ward: Ward) => {
    setSelectedWard(ward);
    setShowDeleteModal(true);
  };

  const handleDeleteUnit = async () => {
    if (!selectedWard) return;

    setSaving(true);
    setErrorMessage(null);

    const result = await deleteWard(selectedWard.id);

    setSaving(false);

    if (result.error) {
      setErrorMessage(result.error.message || 'Failed to delete unit');
      return;
    }

    setShowDeleteModal(false);
    setSelectedWard(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0d141b]">Settings</h1>
        <p className="text-[#4c739a]">Configure your facility settings</p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Facility Information */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#137fec]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#137fec]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#0d141b]">Facility Information</h2>
            <p className="text-sm text-[#4c739a]">Configure your facility details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Facility Name
            </label>
            <input
              type="text"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="Enter facility name"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Total Facility Beds
            </label>
            <div className="px-3 py-2 border border-[#e7edf3] rounded-lg bg-[#f6f7f8]">
              <span className="text-2xl font-bold text-[#137fec]">{totalBeds}</span>
              <span className="text-sm text-[#4c739a] ml-2">beds across {wards.length} units</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveFacility}>
            <Save className="w-4 h-4 mr-2" />
            {saved ? 'Saved!' : 'Save Facility Name'}
          </Button>
        </div>
      </div>

      {/* Unit Management */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#137fec]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#137fec]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0d141b]">Facility Units</h2>
              <p className="text-sm text-[#4c739a]">Manage your facility units and bed capacity</p>
            </div>
          </div>
          <Button onClick={() => setShowAddUnitModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Unit
          </Button>
        </div>

        {/* Units Table */}
        {wards.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-[#e7edf3]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f6f7f8] border-b border-[#e7edf3]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Unit Name
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Floor
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Total Beds
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {wards.map((ward) => (
                  <tr key={ward.id} className="border-b border-[#e7edf3] last:border-b-0 hover:bg-[#f6f7f8] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#137fec]" />
                        <span className="font-medium text-[#0d141b]">{ward.name}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3 text-[#4c739a]">
                      {ward.floor}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 bg-[#137fec]/10 text-[#137fec] font-bold rounded">
                        {ward.capacity || 0}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(ward)}
                          className="p-1.5 text-[#4c739a] hover:text-[#137fec] hover:bg-[#137fec]/10 rounded transition-colors"
                          title="Edit unit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(ward)}
                          className="p-1.5 text-[#4c739a] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete unit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f6f7f8]">
                  <td className="px-4 py-3 font-bold text-[#0d141b]">Total</td>
                  <td className="text-center px-4 py-3 text-[#4c739a]">{wards.length} units</td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 bg-[#137fec] text-white font-bold rounded">
                      {totalBeds}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-[#f6f7f8] rounded-lg border border-[#e7edf3]">
            <Building2 className="w-12 h-12 text-[#c4d4e5] mx-auto mb-3" />
            <p className="text-[#4c739a] mb-4">No units configured yet</p>
            <Button onClick={() => setShowAddUnitModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Unit
            </Button>
          </div>
        )}

        {/* Summary Cards */}
        {wards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">{wards.length}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Units</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#137fec]">{totalBeds}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Beds</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">
                {wards.length > 0 ? Math.round(totalBeds / wards.length) : 0}
              </p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Avg Beds/Unit</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">
                {wards.length > 0 ? Math.max(...wards.map(w => w.floor)) : 0}
              </p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Floors</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Unit Modal */}
      <Modal
        isOpen={showAddUnitModal}
        onClose={() => {
          setShowAddUnitModal(false);
          resetForm();
        }}
        title="Add New Unit"
        size="sm"
      >
        <form onSubmit={handleAddUnit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Unit Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., North Wing, Memory Care"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Floor *
              </label>
              <input
                type="number"
                required
                min="1"
                max="99"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Total Beds *
              </label>
              <input
                type="number"
                required
                min="1"
                max="999"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddUnitModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add Unit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Unit Modal */}
      <Modal
        isOpen={showEditUnitModal}
        onClose={() => {
          setShowEditUnitModal(false);
          setSelectedWard(null);
          resetForm();
        }}
        title="Edit Unit"
        size="sm"
      >
        <form onSubmit={handleEditUnit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Unit Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., North Wing, Memory Care"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Floor *
              </label>
              <input
                type="number"
                required
                min="1"
                max="99"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Total Beds *
              </label>
              <input
                type="number"
                required
                min="1"
                max="999"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditUnitModal(false);
                setSelectedWard(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedWard(null);
        }}
        title="Delete Unit"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[#4c739a]">
            Are you sure you want to delete <span className="font-semibold text-[#0d141b]">{selectedWard?.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedWard(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteUnit}
              loading={saving}
              className="!bg-red-500 hover:!bg-red-600"
            >
              Delete Unit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
