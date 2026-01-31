import { useState } from 'react';
import { useResidents, type CreateResidentInput } from '../hooks/useResidents';
import { useBeds, useBedActions } from '../hooks/useBeds';
import { Icon, Button, Modal } from '../components';
import type { Resident, IsolationType, PayorType, Gender } from '../types';

const PAYOR_TYPES: { value: PayorType; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'managed_care', label: 'Managed Care' },
  { value: 'bed_hold', label: 'Bed Hold' },
  { value: 'hospice', label: 'Hospice' },
];

const ISOLATION_TYPES: { value: IsolationType; label: string }[] = [
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'contact', label: 'Contact' },
  { value: 'droplet', label: 'Droplet' },
  { value: 'airborne', label: 'Airborne' },
];

export function Residents() {
  const {
    activeResidents,
    dischargedResidents,
    loading,
    error,
    createResident,
    updateResident,
    dischargeResident,
    setIsolation,
  } = useResidents();

  const { beds, refetch: refetchBeds } = useBeds();
  const { assignResident } = useBedActions();

  const [showDischargedTab, setShowDischargedTab] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [isolationType, setIsolationType] = useState<IsolationType>('respiratory');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Resident Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newResident, setNewResident] = useState<CreateResidentInput>({
    first_name: '',
    last_name: '',
    gender: 'male',
    admission_date: new Date().toISOString().split('T')[0],
    payor: 'private',
    diagnosis: '',
    is_isolation: false,
    isolation_type: undefined,
    notes: '',
  });
  const [selectedBedId, setSelectedBedId] = useState<string>('');

  // Get vacant beds for assignment
  const vacantBeds = beds.filter((bed) => bed.status === 'vacant');

  // Edit Resident Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    gender: 'male' as Gender,
    payor: 'private' as PayorType,
    diagnosis: '',
    admission_date: '',
    notes: '',
  });

  const residents = showDischargedTab ? dischargedResidents : activeResidents;

  const filteredResidents = residents.filter((r) => {
    if (!searchQuery) return true;
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const handleDischarge = async () => {
    if (!selectedResident) return;
    setActionLoading(true);
    await dischargeResident(selectedResident.id);
    setActionLoading(false);
    setSelectedResident(null);
  };

  const handleToggleIsolation = async () => {
    if (!selectedResident) return;
    setActionLoading(true);
    if (selectedResident.is_isolation) {
      await setIsolation(selectedResident.id, false);
    } else {
      await setIsolation(selectedResident.id, true, isolationType);
    }
    setActionLoading(false);
    setShowIsolationModal(false);
    setSelectedResident(null);
  };

  const handleAddResident = async () => {
    if (!newResident.first_name.trim() || !newResident.last_name.trim()) {
      setAddError('First name and last name are required');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    // Create resident
    const { data: createdResident, error: createError } = await createResident({
      ...newResident,
      bed_id: selectedBedId || undefined,
    });

    if (createError) {
      setAddError(createError.message);
      setAddLoading(false);
      return;
    }

    // If a bed was selected, update its status to occupied
    if (selectedBedId && createdResident) {
      await assignResident(selectedBedId, createdResident.id);
      refetchBeds();
    }

    // Reset form and close modal
    setNewResident({
      first_name: '',
      last_name: '',
      gender: 'male',
      admission_date: new Date().toISOString().split('T')[0],
      payor: 'private',
      diagnosis: '',
      is_isolation: false,
      isolation_type: undefined,
      notes: '',
    });
    setSelectedBedId('');
    setAddLoading(false);
    setShowAddModal(false);
  };

  const resetAddForm = () => {
    setNewResident({
      first_name: '',
      last_name: '',
      gender: 'male',
      admission_date: new Date().toISOString().split('T')[0],
      payor: 'private',
      diagnosis: '',
      is_isolation: false,
      isolation_type: undefined,
      notes: '',
    });
    setSelectedBedId('');
    setAddError(null);
  };

  const handleEditClick = () => {
    if (!selectedResident) return;
    setEditForm({
      first_name: selectedResident.first_name,
      last_name: selectedResident.last_name,
      gender: selectedResident.gender,
      payor: selectedResident.payor,
      diagnosis: selectedResident.diagnosis || '',
      admission_date: selectedResident.admission_date,
      notes: selectedResident.notes || '',
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedResident) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      setEditError('First name and last name are required');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const { error: updateError } = await updateResident({
      id: selectedResident.id,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      gender: editForm.gender,
      payor: editForm.payor,
      diagnosis: editForm.diagnosis || undefined,
      admission_date: editForm.admission_date,
      notes: editForm.notes || undefined,
    });

    if (updateError) {
      setEditError(updateError.message);
      setEditLoading(false);
      return;
    }

    setEditLoading(false);
    setShowEditModal(false);
    setSelectedResident(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPayorBadge = (payor: string) => {
    const colors: Record<string, string> = {
      private: 'bg-green-100 text-green-700',
      medicare: 'bg-blue-100 text-blue-700',
      medicaid: 'bg-purple-100 text-purple-700',
      managed_care: 'bg-orange-100 text-orange-700',
      bed_hold: 'bg-gray-100 text-gray-700',
      hospice: 'bg-pink-100 text-pink-700',
    };
    return colors[payor] || 'bg-gray-100 text-gray-700';
  };

  const getPayorLabel = (payor: string) => {
    const labels: Record<string, string> = {
      private: 'Private',
      medicare: 'Medicare',
      medicaid: 'Medicaid',
      managed_care: 'Managed Care',
      bed_hold: 'Bed Hold',
      hospice: 'Hospice',
    };
    return labels[payor] || payor;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Error loading residents: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="group" size={20} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Residents</h1>
            <p className="text-sm text-slate-500">Manage resident records and assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setShowDischargedTab(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !showDischargedTab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Active ({activeResidents.length})
            </button>
            <button
              onClick={() => setShowDischargedTab(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showDischargedTab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Discharged ({dischargedResidents.length})
            </button>
          </div>
          <Button onClick={() => { resetAddForm(); setShowAddModal(true); }}>
            <Icon name="person_add" size={18} className="mr-2" />
            Add Resident
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" size={20} />
            </div>
            <input
              className="w-full h-12 pl-12 pr-4 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-slate-900 placeholder:text-slate-400"
              placeholder="Search residents by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Residents Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gender
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Payor
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Diagnosis
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Admission Date
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredResidents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No residents found
                </td>
              </tr>
            ) : (
              filteredResidents.map((resident) => (
                <tr key={resident.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          resident.gender === 'male' ? 'bg-primary-100' : 'bg-pink-100'
                        }`}
                      >
                        <Icon
                          name={resident.gender === 'male' ? 'male' : 'female'}
                          size={20}
                          className={resident.gender === 'male' ? 'text-primary-500' : 'text-pink-500'}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {resident.first_name} {resident.last_name}
                        </p>
                        {resident.is_isolation && (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                            <Icon name="warning" size={12} />
                            {resident.isolation_type || 'Isolation'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{resident.gender}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPayorBadge(
                        resident.payor
                      )}`}
                    >
                      {getPayorLabel(resident.payor)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-[200px] truncate" title={resident.diagnosis || ''}>
                    {resident.diagnosis || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDate(resident.admission_date)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        resident.bed_id
                          ? 'bg-green-100 text-green-700'
                          : resident.status === 'active'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {resident.bed_id ? 'Assigned' : resident.status === 'active' ? 'Unassigned' : 'Discharged'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedResident(resident)}
                      className="text-primary-500 hover:text-primary-700"
                    >
                      <Icon name="more_vert" size={20} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Resident Detail Modal */}
      <Modal
        isOpen={!!selectedResident && !showIsolationModal}
        onClose={() => setSelectedResident(null)}
        title={`${selectedResident?.first_name} ${selectedResident?.last_name}`}
        size="md"
      >
        {selectedResident && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Gender</p>
                <p className="font-medium text-slate-900 capitalize">{selectedResident.gender}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Payor</p>
                <p className="font-medium text-slate-900">
                  {getPayorLabel(selectedResident.payor)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Admission Date</p>
                <p className="font-medium text-slate-900">{formatDate(selectedResident.admission_date)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="font-medium text-slate-900 capitalize">{selectedResident.status}</p>
              </div>
            </div>

            {selectedResident.diagnosis && (
              <div>
                <p className="text-sm text-slate-500">Diagnosis</p>
                <p className="font-medium text-slate-900">{selectedResident.diagnosis}</p>
              </div>
            )}

            {selectedResident.notes && (
              <div>
                <p className="text-sm text-slate-500">Notes</p>
                <p className="font-medium text-slate-900">{selectedResident.notes}</p>
              </div>
            )}

            {selectedResident.is_isolation && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800">
                  Isolation: {selectedResident.isolation_type || 'Active'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
              {selectedResident.status === 'active' && (
                <>
                  <Button onClick={handleEditClick}>
                    <Icon name="edit" size={16} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsolationType(selectedResident.isolation_type || 'respiratory');
                      setShowIsolationModal(true);
                    }}
                  >
                    {selectedResident.is_isolation ? 'Remove Isolation' : 'Set Isolation'}
                  </Button>
                  <Button variant="danger" onClick={handleDischarge} loading={actionLoading}>
                    Discharge
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Isolation Modal */}
      <Modal
        isOpen={showIsolationModal}
        onClose={() => setShowIsolationModal(false)}
        title={selectedResident?.is_isolation ? 'Remove Isolation' : 'Set Isolation'}
        size="sm"
      >
        <div className="space-y-4">
          {!selectedResident?.is_isolation && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">Isolation Type</label>
              <select
                value={isolationType}
                onChange={(e) => setIsolationType(e.target.value as IsolationType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="respiratory">Respiratory</option>
                <option value="contact">Contact</option>
                <option value="droplet">Droplet</option>
                <option value="airborne">Airborne</option>
              </select>
            </div>
          )}

          <p className="text-sm text-slate-500">
            {selectedResident?.is_isolation
              ? 'Are you sure you want to remove isolation status?'
              : 'This will mark the resident as requiring isolation precautions.'}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowIsolationModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleToggleIsolation} loading={actionLoading}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Resident Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Resident"
        size="lg"
      >
        <div className="space-y-4">
          {addError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {addError}
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="badge" size={16} className="text-slate-400" />
                First Name *
              </label>
              <input
                type="text"
                value={newResident.first_name}
                onChange={(e) => setNewResident({ ...newResident, first_name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="badge" size={16} className="text-slate-400" />
                Last Name *
              </label>
              <input
                type="text"
                value={newResident.last_name}
                onChange={(e) => setNewResident({ ...newResident, last_name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                placeholder="Enter last name"
              />
            </div>
          </div>

          {/* Gender and Care Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="wc" size={16} className="text-slate-400" />
                Gender *
              </label>
              <select
                value={newResident.gender}
                onChange={(e) => setNewResident({ ...newResident, gender: e.target.value as Gender })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="payments" size={16} className="text-slate-400" />
                Payor *
              </label>
              <select
                value={newResident.payor}
                onChange={(e) => setNewResident({ ...newResident, payor: e.target.value as PayorType })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
              >
                {PAYOR_TYPES.map((payor) => (
                  <option key={payor.value} value={payor.value}>
                    {payor.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Admission Date */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="calendar_today" size={16} className="text-slate-400" />
              Admission Date *
            </label>
            <input
              type="date"
              value={newResident.admission_date}
              onChange={(e) => setNewResident({ ...newResident, admission_date: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Diagnosis */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="medical_information" size={16} className="text-slate-400" />
              Diagnosis
            </label>
            <input
              type="text"
              value={newResident.diagnosis}
              onChange={(e) => setNewResident({ ...newResident, diagnosis: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
              placeholder="Enter diagnosis (helps with room placement)"
            />
          </div>

          {/* Bed Assignment */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              Assign to Bed
            </label>
            <select
              value={selectedBedId}
              onChange={(e) => setSelectedBedId(e.target.value)}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
            >
              <option value="">No bed assignment (will remain unassigned)</option>
              {vacantBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.room?.wing?.name} - Room {bed.room?.room_number} - Bed {bed.bed_letter}
                </option>
              ))}
            </select>
            {vacantBeds.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">No vacant beds available</p>
            )}
          </div>

          {/* Isolation */}
          <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl border border-amber-200">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={newResident.is_isolation}
                onChange={(e) => setNewResident({ ...newResident, is_isolation: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <span className="font-semibold text-slate-900 group-hover:text-primary-500 transition-colors">Isolation Required</span>
                <p className="text-sm text-slate-500">Check if resident requires isolation precautions</p>
              </div>
            </label>

            {newResident.is_isolation && (
              <div className="mt-4">
                <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                  <Icon name="warning" size={16} className="text-amber-500" />
                  Isolation Type
                </label>
                <select
                  value={newResident.isolation_type || ''}
                  onChange={(e) => setNewResident({ ...newResident, isolation_type: e.target.value as IsolationType })}
                  className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
                >
                  <option value="">Select type...</option>
                  {ISOLATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="notes" size={16} className="text-slate-400" />
              Notes
            </label>
            <textarea
              value={newResident.notes}
              onChange={(e) => setNewResident({ ...newResident, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none placeholder:text-slate-400"
              placeholder="Add any additional notes about the resident..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddResident} loading={addLoading}>
              Add Resident
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Resident Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Resident"
        size="lg"
      >
        <div className="space-y-4">
          {editError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {editError}
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="badge" size={16} className="text-slate-400" />
                First Name *
              </label>
              <input
                type="text"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="badge" size={16} className="text-slate-400" />
                Last Name *
              </label>
              <input
                type="text"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                placeholder="Enter last name"
              />
            </div>
          </div>

          {/* Gender and Payor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="wc" size={16} className="text-slate-400" />
                Gender *
              </label>
              <select
                value={editForm.gender}
                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Gender })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="payments" size={16} className="text-slate-400" />
                Payor *
              </label>
              <select
                value={editForm.payor}
                onChange={(e) => setEditForm({ ...editForm, payor: e.target.value as PayorType })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
              >
                {PAYOR_TYPES.map((payor) => (
                  <option key={payor.value} value={payor.value}>
                    {payor.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Admission Date */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="calendar_today" size={16} className="text-slate-400" />
              Admission Date *
            </label>
            <input
              type="date"
              value={editForm.admission_date}
              onChange={(e) => setEditForm({ ...editForm, admission_date: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Diagnosis */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="medical_information" size={16} className="text-slate-400" />
              Diagnosis
            </label>
            <input
              type="text"
              value={editForm.diagnosis}
              onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
              placeholder="Enter diagnosis (helps with room placement)"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="notes" size={16} className="text-slate-400" />
              Notes
            </label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none placeholder:text-slate-400"
              placeholder="Add any additional notes about the resident..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={editLoading}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
