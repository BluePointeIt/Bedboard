import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useResidents, type CreateResidentInput } from '../hooks/useResidents';
import { useBeds, useBedActions } from '../hooks/useBeds';
import { Icon, Button, Modal, DiagnosisSelect, ResidentCard, SlideOverPanel, ResidentDetailSidebar } from '../components';
import type { Resident, IsolationType, PayorType, Gender } from '../types';
import type { LayoutContext } from '../components/AppLayout';
import { getCompatibilityLabel, type BedCompatibilityScore, type MoveRecommendation } from '../lib/compatibilityUtils';
import {
  validateDateOfBirth,
  validateAdmissionDate,
  validateDischargeDate,
  validateResidentForm,
} from '../lib/validation';

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
  const { currentFacility } = useOutletContext<LayoutContext>();
  const {
    activeResidents,
    dischargedResidents,
    loading,
    error,
    createResident,
    updateResident,
    dischargeResident,
    setIsolation,
  } = useResidents({ facilityId: currentFacility?.id });

  const { beds, refetch: refetchBeds } = useBeds({ facilityId: currentFacility?.id });
  const { assignResident, unassignResident, getBedRecommendationsForNewResident, checkGenderCompatibility, getMoveOptimizations } = useBedActions();

  const [showDischargedTab, setShowDischargedTab] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeDate, setDischargeDate] = useState(new Date().toISOString().split('T')[0]);
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
    medical_record_number: '',
    gender: 'male',
    date_of_birth: '',
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
    medical_record_number: '',
    gender: 'male' as Gender,
    date_of_birth: '',
    payor: 'private' as PayorType,
    diagnosis: '',
    admission_date: '',
    notes: '',
  });

  // Transfer Bed Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferBedId, setTransferBedId] = useState<string>('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Bed recommendations state for new resident
  const [bedRecommendations, setBedRecommendations] = useState<BedCompatibilityScore[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  // Optimize beds modal state
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [moveOptimizations, setMoveOptimizations] = useState<MoveRecommendation[]>([]);
  const [optimizeLoading, setOptimizeLoading] = useState(false);

  // Fetch bed recommendations when add modal is open and gender is set
  useEffect(() => {
    if (showAddModal && newResident.gender) {
      setRecommendationsLoading(true);
      getBedRecommendationsForNewResident({
        gender: newResident.gender,
        is_isolation: newResident.is_isolation ?? false,
        date_of_birth: newResident.date_of_birth || undefined,
        diagnosis: newResident.diagnosis || undefined,
        first_name: newResident.first_name || undefined,
        last_name: newResident.last_name || undefined,
      })
        .then(setBedRecommendations)
        .finally(() => setRecommendationsLoading(false));
    } else {
      setBedRecommendations([]);
    }
  }, [showAddModal, newResident.gender, newResident.is_isolation, newResident.date_of_birth, newResident.diagnosis]);

  const residents = showDischargedTab ? dischargedResidents : activeResidents;

  const filteredResidents = residents.filter((r) => {
    if (!searchQuery) return true;
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const handleDischarge = async () => {
    if (!selectedResident) return;

    // Validate discharge date is after admission date
    const dischargeValidation = validateDischargeDate(dischargeDate, selectedResident.admission_date);
    if (!dischargeValidation.valid) {
      // Show error to user - we'll need to add state for this
      alert(dischargeValidation.error || 'Invalid discharge date');
      return;
    }

    setActionLoading(true);
    await dischargeResident(selectedResident.id, undefined, dischargeDate);
    setActionLoading(false);
    setShowDischargeModal(false);
    setSelectedResident(null);
    setDischargeDate(new Date().toISOString().split('T')[0]);
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
    // Validate form data
    const formValidation = validateResidentForm({
      first_name: newResident.first_name,
      last_name: newResident.last_name,
      date_of_birth: newResident.date_of_birth,
      admission_date: newResident.admission_date,
    });

    if (!formValidation.valid) {
      setAddError(formValidation.error || 'Please fix validation errors');
      return;
    }

    // Additional date validation
    const dobValidation = validateDateOfBirth(newResident.date_of_birth);
    if (!dobValidation.valid) {
      setAddError(dobValidation.error || 'Invalid date of birth');
      return;
    }

    const admissionValidation = validateAdmissionDate(newResident.admission_date);
    if (!admissionValidation.valid) {
      setAddError(admissionValidation.error || 'Invalid admission date');
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
      date_of_birth: '',
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
      date_of_birth: '',
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
      medical_record_number: selectedResident.medical_record_number || '',
      gender: selectedResident.gender,
      date_of_birth: selectedResident.date_of_birth || '',
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

    // Validate form data
    const formValidation = validateResidentForm({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      date_of_birth: editForm.date_of_birth,
      admission_date: editForm.admission_date,
    });

    if (!formValidation.valid) {
      setEditError(formValidation.error || 'Please fix validation errors');
      return;
    }

    // Additional date validation
    const dobValidation = validateDateOfBirth(editForm.date_of_birth);
    if (!dobValidation.valid) {
      setEditError(dobValidation.error || 'Invalid date of birth');
      return;
    }

    const admissionValidation = validateAdmissionDate(editForm.admission_date);
    if (!admissionValidation.valid) {
      setEditError(admissionValidation.error || 'Invalid admission date');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const { error: updateError } = await updateResident({
      id: selectedResident.id,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      medical_record_number: editForm.medical_record_number || undefined,
      gender: editForm.gender,
      date_of_birth: editForm.date_of_birth || undefined,
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

  const getBedInfoForResident = (resident: Resident) => {
    if (!resident.bed_id) return undefined;
    const bed = beds.find(b => b.id === resident.bed_id);
    if (!bed) return undefined;
    return {
      roomNumber: bed.room?.room_number || '',
      bedLetter: bed.bed_letter,
      wingName: bed.room?.wing?.name || '',
    };
  };

  const handleOpenOptimize = async () => {
    setShowOptimizeModal(true);
    setOptimizeLoading(true);
    const unassigned = residents.filter(r => r.status === 'active' && !r.bed_id);
    const optimizations = await getMoveOptimizations(unassigned);
    setMoveOptimizations(optimizations);
    setOptimizeLoading(false);
  };

  const handleApplyOptimization = async (opt: MoveRecommendation) => {
    setActionLoading(true);
    // Only unassign if this is a move (not a direct placement)
    if (opt.currentBedId) {
      await unassignResident(opt.residentId, opt.currentBedId);
    }
    await assignResident(opt.suggestedBedId, opt.residentId);
    const unassigned = residents.filter(r => r.status === 'active' && !r.bed_id);
    const newOptimizations = await getMoveOptimizations(unassigned);
    setMoveOptimizations(newOptimizations);
    await refetchBeds();
    setActionLoading(false);
  };

  const handleTransferBed = async () => {
    if (!selectedResident || !transferBedId) return;
    setActionLoading(true);
    setTransferError(null);

    // Check gender compatibility before transfer
    const compatibility = await checkGenderCompatibility(
      transferBedId,
      selectedResident.gender,
      selectedResident.is_isolation
    );

    if (!compatibility.compatible) {
      setTransferError(compatibility.reason || 'This bed is not compatible with the resident.');
      setActionLoading(false);
      return;
    }

    // If resident currently has a bed, unassign first
    if (selectedResident.bed_id) {
      await unassignResident(selectedResident.id, selectedResident.bed_id);
    }

    // Assign to new bed
    await assignResident(transferBedId, selectedResident.id);
    await refetchBeds();

    setActionLoading(false);
    setShowTransferModal(false);
    setTransferBedId('');
    setTransferError(null);
    setSelectedResident(null);
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
    <div className="space-y-8">
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
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleOpenOptimize}
              disabled={!residents.some(r => r.status === 'active' && !r.bed_id)}
            >
              <Icon name="lightbulb" size={18} className="mr-2" />
              Optimize Beds
            </Button>
            <Button onClick={() => { resetAddForm(); setShowAddModal(true); }}>
              <Icon name="person_add" size={18} className="mr-2" />
              Add Resident
            </Button>
          </div>
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

      {/* Residents Card Grid */}
      {filteredResidents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center text-slate-500">
          No residents found
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredResidents.map((resident) => (
            <ResidentCard
              key={resident.id}
              resident={resident}
              bedInfo={getBedInfoForResident(resident)}
              isSelected={selectedResident?.id === resident.id}
              onClick={() => setSelectedResident(resident)}
              onAssignBed={() => {
                setSelectedResident(resident);
                setTransferBedId('');
                setTransferError(null);
                setShowTransferModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Resident Detail Sidebar */}
      <SlideOverPanel
        isOpen={!!selectedResident && !showIsolationModal && !showDischargeModal && !showEditModal && !showTransferModal}
        onClose={() => setSelectedResident(null)}
      >
        {selectedResident && (
          <ResidentDetailSidebar
            resident={selectedResident}
            bedInfo={getBedInfoForResident(selectedResident)}
            onClose={() => setSelectedResident(null)}
            onSetIsolation={() => {
              setIsolationType(selectedResident.isolation_type || 'respiratory');
              setShowIsolationModal(true);
            }}
            onDischarge={() => {
              setDischargeDate(new Date().toISOString().split('T')[0]);
              setShowDischargeModal(true);
            }}
            onEditProfile={handleEditClick}
            onTransfer={() => {
              setTransferBedId('');
              setTransferError(null);
              setShowTransferModal(true);
            }}
            onUnassign={selectedResident.bed_id ? async () => {
              await unassignResident(selectedResident.id, selectedResident.bed_id!);
              refetchBeds();
              setSelectedResident(null);
            } : undefined}
          />
        )}
      </SlideOverPanel>

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

      {/* Discharge Modal */}
      <Modal
        isOpen={showDischargeModal}
        onClose={() => setShowDischargeModal(false)}
        title="Discharge Resident"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            You are about to discharge{' '}
            <span className="font-semibold">
              {selectedResident?.first_name} {selectedResident?.last_name}
            </span>
            . This will remove them from their assigned bed.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Discharge Date *
            </label>
            <input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDischargeModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDischarge} loading={actionLoading}>
              Confirm Discharge
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

          {/* Medical Record Number */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="assignment_ind" size={16} className="text-slate-400" />
              Medical Record Number
            </label>
            <input
              type="text"
              value={newResident.medical_record_number}
              onChange={(e) => setNewResident({ ...newResident, medical_record_number: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400 font-mono"
              placeholder="Enter MRN (optional)"
            />
          </div>

          {/* Date of Birth and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="cake" size={16} className="text-slate-400" />
                Date of Birth
              </label>
              <input
                type="date"
                value={newResident.date_of_birth}
                onChange={(e) => setNewResident({ ...newResident, date_of_birth: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
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
          </div>

          {/* Payor */}
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
            <DiagnosisSelect
              value={newResident.diagnosis || ''}
              onChange={(value) => setNewResident({ ...newResident, diagnosis: value })}
            />
          </div>

          {/* Bed Assignment */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              Assign to Bed
            </label>

            {/* Smart Recommendations */}
            {recommendationsLoading ? (
              <div className="flex items-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                <span className="ml-2 text-sm text-slate-500">Analyzing best bed options...</span>
              </div>
            ) : bedRecommendations.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-slate-500 font-medium">Recommended Beds:</p>

                {/* Top Recommendation */}
                {bedRecommendations[0] && (
                  <button
                    type="button"
                    onClick={() => setSelectedBedId(bedRecommendations[0].bedId)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedBedId === bedRecommendations[0].bedId
                        ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300'
                        : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Icon name="star" size={18} className="text-amber-500" />
                        <span className="font-semibold text-slate-900">
                          Room {bedRecommendations[0].bedInfo.roomNumber}{bedRecommendations[0].bedInfo.bedLetter}
                        </span>
                        <span className="text-xs text-slate-500">- {bedRecommendations[0].bedInfo.wingName}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                        {bedRecommendations[0].totalScore}% match
                      </span>
                    </div>
                    {bedRecommendations[0].roommate ? (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Roommate:</span> {bedRecommendations[0].roommate.name}
                        {bedRecommendations[0].roommate.age !== null && ` (${bedRecommendations[0].roommate.age}yo)`}
                        {bedRecommendations[0].roommate.diagnosis && `, ${bedRecommendations[0].roommate.diagnosis}`}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Empty room</span> - No roommate constraints
                      </div>
                    )}
                    {bedRecommendations[0].warnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bedRecommendations[0].warnings.map((warning, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                            <Icon name="warning" size={12} />
                            {warning}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex gap-4 text-xs text-slate-500">
                      <span>Age: {bedRecommendations[0].ageScore}%</span>
                      <span>Diagnosis: {bedRecommendations[0].diagnosisScore}%</span>
                      <span>Flexibility: {bedRecommendations[0].flexibilityScore}%</span>
                    </div>
                  </button>
                )}

                {/* Other Recommendations */}
                {bedRecommendations.slice(1, 4).map((rec) => {
                  const { color, icon } = getCompatibilityLabel(rec.totalScore);
                  return (
                    <button
                      key={rec.bedId}
                      type="button"
                      onClick={() => setSelectedBedId(rec.bedId)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedBedId === rec.bedId
                          ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Icon
                            name={icon}
                            size={16}
                            className={color === 'green' ? 'text-green-500' : color === 'yellow' ? 'text-yellow-500' : 'text-orange-500'}
                          />
                          <span className="font-medium text-slate-900">
                            Room {rec.bedInfo.roomNumber}{rec.bedInfo.bedLetter}
                          </span>
                          <span className="text-xs text-slate-500">- {rec.bedInfo.wingName}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          color === 'green' ? 'bg-green-100 text-green-700' :
                          color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {rec.totalScore}%
                        </span>
                      </div>
                      {rec.roommate && (
                        <p className="mt-1 text-xs text-slate-500">
                          Roommate: {rec.roommate.name}
                          {rec.roommate.age !== null && ` (${rec.roommate.age}yo)`}
                        </p>
                      )}
                    </button>
                  );
                })}

                {bedRecommendations.length > 4 && (
                  <p className="text-xs text-slate-500 text-center pt-1">
                    +{bedRecommendations.length - 4} more beds available
                  </p>
                )}
              </div>
            ) : null}

            {/* Fallback select for manual selection or no assignment */}
            <select
              value={selectedBedId}
              onChange={(e) => setSelectedBedId(e.target.value)}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
            >
              <option value="">No bed assignment (will remain unassigned)</option>
              {vacantBeds.map((bed) => {
                const rec = bedRecommendations.find(r => r.bedId === bed.id);
                return (
                  <option key={bed.id} value={bed.id}>
                    {bed.room?.wing?.name} - Room {bed.room?.room_number} - Bed {bed.bed_letter}
                    {rec ? ` (${rec.totalScore}% match)` : ''}
                  </option>
                );
              })}
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

          {/* Medical Record Number */}
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="assignment_ind" size={16} className="text-slate-400" />
              Medical Record Number
            </label>
            <input
              type="text"
              value={editForm.medical_record_number}
              onChange={(e) => setEditForm({ ...editForm, medical_record_number: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400 font-mono"
              placeholder="Enter MRN (optional)"
            />
          </div>

          {/* Date of Birth and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="cake" size={16} className="text-slate-400" />
                Date of Birth
              </label>
              <input
                type="date"
                value={editForm.date_of_birth}
                onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
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
          </div>

          {/* Payor */}
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
            <DiagnosisSelect
              value={editForm.diagnosis}
              onChange={(value) => setEditForm({ ...editForm, diagnosis: value })}
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

      {/* Transfer/Assign Bed Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => { setShowTransferModal(false); setTransferError(null); }}
        title={selectedResident?.bed_id ? "Transfer Bed" : "Assign Bed"}
        size="md"
      >
        <div className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <Icon name="error" size={18} className="flex-shrink-0 mt-0.5" />
              <span>{transferError}</span>
            </div>
          )}

          <p className="text-sm text-slate-600">
            {selectedResident?.bed_id ? 'Select a new bed for' : 'Select a bed to assign'}{' '}
            <span className="font-semibold">
              {selectedResident?.first_name} {selectedResident?.last_name}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              ({selectedResident?.gender} resident{selectedResident?.is_isolation ? ', isolation' : ''})
            </span>
          </p>

          {selectedResident?.bed_id && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Current Bed</p>
              <p className="text-sm font-medium text-slate-900">
                {getBedInfoForResident(selectedResident)
                  ? `${getBedInfoForResident(selectedResident)?.wingName} - Room ${getBedInfoForResident(selectedResident)?.roomNumber} - Bed ${getBedInfoForResident(selectedResident)?.bedLetter}`
                  : 'Unassigned'}
              </p>
            </div>
          )}

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              New Bed *
            </label>
            <select
              value={transferBedId}
              onChange={(e) => setTransferBedId(e.target.value)}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
            >
              <option value="">Select a bed...</option>
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

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferBed}
              loading={actionLoading}
              disabled={!transferBedId}
            >
              {selectedResident?.bed_id ? 'Transfer' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Optimize Beds Modal */}
      <Modal
        isOpen={showOptimizeModal}
        onClose={() => setShowOptimizeModal(false)}
        title="Bed Optimization"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            These suggestions help accommodate unassigned residents by relocating current residents to free up compatible beds.
          </p>

          {optimizeLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
              <span className="ml-3 text-sm text-slate-500">Analyzing bed assignments...</span>
            </div>
          ) : moveOptimizations.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="check_circle" size={48} className="mx-auto text-green-500 mb-3" />
              <p className="text-slate-700 font-medium">Beds are optimally assigned</p>
              <p className="text-sm text-slate-500 mt-1">No moves needed to accommodate waiting residents.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {moveOptimizations.map((opt) => {
                const hasRoommate = opt.roommate && opt.compatibilityScore !== undefined;
                const scoreColor = (opt.compatibilityScore ?? 100) >= 70
                  ? 'bg-green-100 text-green-700'
                  : (opt.compatibilityScore ?? 100) >= 40
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-orange-100 text-orange-700';

                return (
                  <div
                    key={`${opt.residentId}-${opt.suggestedBedId}`}
                    className={`p-4 border rounded-xl ${
                      opt.isDirectPlacement
                        ? hasRoommate
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-emerald-50 border-emerald-200'
                        : 'bg-violet-50 border-violet-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{opt.residentName}</p>
                          {opt.isDirectPlacement && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              hasRoommate ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              Unassigned
                            </span>
                          )}
                          {hasRoommate && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${scoreColor}`}>
                              {opt.compatibilityScore}% match
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                          {opt.currentBed ? (
                            <>
                              <span>{opt.currentBed}</span>
                              <Icon name="arrow_forward" size={16} className="text-violet-500" />
                            </>
                          ) : (
                            <Icon name="add_circle" size={16} className={hasRoommate ? 'text-blue-500' : 'text-emerald-500'} />
                          )}
                          <span>{opt.suggestedBed}</span>
                        </div>

                        {/* Roommate info */}
                        {opt.roommate && (
                          <div className="mt-2 text-sm text-slate-600">
                            <span className="font-medium">Roommate:</span> {opt.roommate.name}
                            {opt.roommate.age !== null && ` (${opt.roommate.age}yo)`}
                            {opt.roommate.diagnosis && `, ${opt.roommate.diagnosis}`}
                          </div>
                        )}

                        {/* Compatibility details */}
                        {hasRoommate && (
                          <div className="mt-1 flex gap-3 text-xs text-slate-500">
                            <span>Age: {opt.ageScore}%</span>
                            <span>Diagnosis: {opt.diagnosisScore}%</span>
                          </div>
                        )}

                        {/* Warnings */}
                        {opt.warnings && opt.warnings.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {opt.warnings.map((warning, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                                <Icon name="warning" size={12} />
                                {warning}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className={`text-sm mt-2 flex items-center gap-1 ${
                          opt.isDirectPlacement
                            ? hasRoommate ? 'text-blue-600' : 'text-emerald-600'
                            : 'text-violet-600'
                        }`}>
                          <Icon name="lightbulb" size={14} />
                          {opt.reason}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApplyOptimization(opt)}
                        loading={actionLoading}
                      >
                        {opt.isDirectPlacement ? 'Assign' : 'Apply Move'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowOptimizeModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
