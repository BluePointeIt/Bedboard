import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Upload,
  X,
  Calendar,
  Edit,
  Bed,
  AlertTriangle,
  CreditCard,
  ChevronDown,
  Check,
  Stethoscope,
} from 'lucide-react';
import { Button, Modal, CSVImport } from '../components';
import { useResidents } from '../hooks/useResidents';
import type { CreateResidentInput } from '../hooks/useResidents';
import { cn, formatDate } from '../lib/utils';
import type { Resident, PayerType } from '../types';

// Common diagnoses for nursing home residents
const DEFAULT_DIAGNOSES = [
  'Alzheimer\'s Disease',
  'Dementia',
  'Parkinson\'s Disease',
  'Stroke (CVA)',
  'Congestive Heart Failure (CHF)',
  'Chronic Obstructive Pulmonary Disease (COPD)',
  'Diabetes Type 2',
  'Hypertension',
  'Coronary Artery Disease',
  'Atrial Fibrillation',
  'Osteoarthritis',
  'Osteoporosis',
  'Chronic Kidney Disease',
  'Depression',
  'Anxiety Disorder',
  'Urinary Tract Infection (UTI)',
  'Pneumonia',
  'Hip Fracture',
  'Anemia',
  'Hypothyroidism',
];

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getPayerTypeColor(payerType: PayerType | undefined): string {
  switch (payerType) {
    case 'medicare': return 'bg-[#06b6d4]';
    case 'medicaid': return 'bg-[#10b981]';
    case 'managed_care': return 'bg-[#f97316]';
    default: return 'bg-[#8b5cf6]';
  }
}

function getPayerTypeLabel(payerType: PayerType | undefined): string {
  switch (payerType) {
    case 'medicare': return 'Medicare';
    case 'medicaid': return 'Medicaid';
    case 'managed_care': return 'Managed Care';
    default: return 'Private';
  }
}

// Multi-select Diagnosis Dropdown Component
interface DiagnosisDropdownProps {
  selectedDiagnoses: string[];
  onSelectionChange: (diagnoses: string[]) => void;
  availableDiagnoses: string[];
  onAddCustom: (diagnosis: string) => void;
}

function DiagnosisDropdown({
  selectedDiagnoses,
  onSelectionChange,
  availableDiagnoses,
  onAddCustom,
}: DiagnosisDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customDiagnosis, setCustomDiagnosis] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddCustom(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDiagnoses = availableDiagnoses.filter(d =>
    d.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleDiagnosis = (diagnosis: string) => {
    if (selectedDiagnoses.includes(diagnosis)) {
      onSelectionChange(selectedDiagnoses.filter(d => d !== diagnosis));
    } else {
      onSelectionChange([...selectedDiagnoses, diagnosis]);
    }
  };

  const handleAddCustom = () => {
    if (customDiagnosis.trim() && !availableDiagnoses.includes(customDiagnosis.trim())) {
      onAddCustom(customDiagnosis.trim());
      onSelectionChange([...selectedDiagnoses, customDiagnosis.trim()]);
      setCustomDiagnosis('');
      setShowAddCustom(false);
    }
  };

  const removeDiagnosis = (diagnosis: string) => {
    onSelectionChange(selectedDiagnoses.filter(d => d !== diagnosis));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-[#0d141b] mb-1">
        Diagnoses
      </label>

      {/* Selected diagnoses tags */}
      {selectedDiagnoses.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedDiagnoses.map((diagnosis) => (
            <span
              key={diagnosis}
              className="inline-flex items-center gap-1 px-2 py-1 bg-[#137fec]/10 text-[#137fec] text-xs font-medium rounded-full"
            >
              {diagnosis}
              <button
                type="button"
                onClick={() => removeDiagnosis(diagnosis)}
                className="hover:bg-[#137fec]/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec] flex items-center justify-between text-left"
      >
        <span className="text-sm text-[#4c739a]">
          {selectedDiagnoses.length === 0
            ? 'Select diagnoses...'
            : `${selectedDiagnoses.length} selected`}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-[#4c739a] transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#e7edf3] rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-[#e7edf3]">
            <input
              type="text"
              placeholder="Search diagnoses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>

          {/* Options list */}
          <div className="max-h-40 overflow-y-auto">
            {filteredDiagnoses.map((diagnosis) => (
              <button
                key={diagnosis}
                type="button"
                onClick={() => toggleDiagnosis(diagnosis)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-[#f6f7f8] flex items-center justify-between"
              >
                <span className="text-[#0d141b]">{diagnosis}</span>
                {selectedDiagnoses.includes(diagnosis) && (
                  <Check className="w-4 h-4 text-[#137fec]" />
                )}
              </button>
            ))}
            {filteredDiagnoses.length === 0 && (
              <div className="px-3 py-2 text-sm text-[#4c739a]">No matching diagnoses</div>
            )}
          </div>

          {/* Add custom diagnosis */}
          <div className="border-t border-[#e7edf3] p-2">
            {!showAddCustom ? (
              <button
                type="button"
                onClick={() => setShowAddCustom(true)}
                className="w-full px-3 py-2 text-sm text-[#137fec] font-medium hover:bg-[#137fec]/5 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Diagnosis
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter diagnosis..."
                  value={customDiagnosis}
                  onChange={(e) => setCustomDiagnosis(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())}
                  className="flex-1 px-3 py-2 text-sm border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customDiagnosis.trim()}
                  className="px-3 py-2 bg-[#137fec] text-white text-sm font-medium rounded-lg hover:bg-[#1171d4] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Patients() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [_isEditing, setIsEditing] = useState(false);
  const [availableDiagnoses, setAvailableDiagnoses] = useState<string[]>(DEFAULT_DIAGNOSES);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    admission_date: new Date().toISOString().split('T')[0],
    gender: 'male' as 'male' | 'female' | 'other',
    payer_type: 'private' as PayerType,
    notes: '',
    diagnoses: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const { activeResidents, loading, createResident, bulkCreateResidents } = useResidents();

  const residentColumns = [
    { key: 'medical_record_number', label: 'Medical Record Number', required: true },
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: true },
    { key: 'gender', label: 'Gender', required: true },
    { key: 'payer_type', label: 'Payer Type', required: true },
    { key: 'contact_phone', label: 'Contact Phone' },
    { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
    { key: 'emergency_contact_phone', label: 'Emergency Contact Phone' },
  ];

  const handleImportResidents = async (data: Record<string, string>[]) => {
    const residents: CreateResidentInput[] = data.map((row) => ({
      medical_record_number: row.medical_record_number || row.mrn || '',
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      date_of_birth: row.date_of_birth || row.dob || '',
      gender: (row.gender?.toLowerCase() || 'other') as 'male' | 'female' | 'other',
      payer_type: (row.payer_type?.toLowerCase().replace(' ', '_') || 'private') as PayerType,
      contact_phone: row.contact_phone || row.phone || '',
      emergency_contact_name: row.emergency_contact_name || '',
      emergency_contact_phone: row.emergency_contact_phone || '',
      diagnoses: [],
    }));

    return await bulkCreateResidents(residents);
  };

  const filteredResidents = activeResidents.filter((resident) => {
    const searchLower = search.toLowerCase();
    const fullName = `${resident.first_name} ${resident.last_name}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      resident.medical_record_number.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Auto-generate medical record number
    const generatedMRN = `MRN-${Date.now().toString(36).toUpperCase()}`;

    const residentData: CreateResidentInput = {
      medical_record_number: generatedMRN,
      first_name: formData.first_name,
      last_name: formData.last_name,
      date_of_birth: formData.date_of_birth,
      admission_date: formData.admission_date,
      gender: formData.gender,
      payer_type: formData.payer_type,
      diagnoses: formData.diagnoses,
      notes: formData.notes || undefined,
    };

    const { error } = await createResident(residentData);

    if (error) {
      console.error('Error creating resident:', error);
    }

    setSaving(false);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      admission_date: new Date().toISOString().split('T')[0],
      gender: 'male',
      payer_type: 'private',
      notes: '',
      diagnoses: [],
    });
  };

  const handleAddCustomDiagnosis = (diagnosis: string) => {
    if (!availableDiagnoses.includes(diagnosis)) {
      setAvailableDiagnoses([...availableDiagnoses, diagnosis].sort());
    }
  };

  const handleEditClick = () => {
    if (selectedResident) {
      setFormData({
        first_name: selectedResident.first_name,
        last_name: selectedResident.last_name,
        date_of_birth: selectedResident.date_of_birth,
        admission_date: selectedResident.admission_date || new Date().toISOString().split('T')[0],
        gender: selectedResident.gender,
        payer_type: selectedResident.payer_type || 'private',
        notes: selectedResident.notes || '',
        diagnoses: selectedResident.diagnoses || [],
      });
      setIsEditing(true);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Main Content */}
      <div className={cn(
        'space-y-6 transition-all duration-300',
        selectedResident && 'opacity-40 pointer-events-none'
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0d141b]">Residents</h1>
            <p className="text-[#4c739a]">Manage resident records</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e7edf3] bg-white text-[#0d141b] font-medium text-sm hover:bg-[#f6f7f8] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#137fec] text-white font-medium text-sm hover:bg-[#1171d4] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Resident
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4c739a]" />
          <input
            type="text"
            placeholder="Search by name or MRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#e7edf3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]"
          />
        </div>

        {/* Payer Type Legend */}
        <div className="flex flex-wrap gap-4 p-3 bg-white rounded-lg border border-[#e7edf3]">
          <span className="flex items-center gap-2 text-sm text-[#4c739a]">
            <span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span>Private
          </span>
          <span className="flex items-center gap-2 text-sm text-[#4c739a]">
            <span className="w-3 h-3 rounded-full bg-[#06b6d4]"></span>Medicare
          </span>
          <span className="flex items-center gap-2 text-sm text-[#4c739a]">
            <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>Medicaid
          </span>
          <span className="flex items-center gap-2 text-sm text-[#4c739a]">
            <span className="w-3 h-3 rounded-full bg-[#f97316]"></span>Managed Care
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#137fec]" />
          </div>
        ) : filteredResidents.length === 0 ? (
          <div className="text-center py-12 text-[#4c739a]">
            No residents found
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#e7edf3] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f6f7f8] border-b border-[#e7edf3]">
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                      Resident
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                      MRN
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                      Age / Gender
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                      Admission Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#4c739a] uppercase tracking-wide">
                      Payer Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResidents.map((resident) => (
                    <tr
                      key={resident.id}
                      onClick={() => setSelectedResident(resident)}
                      className="border-b border-[#e7edf3] hover:bg-[#f6f7f8] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold',
                            resident.gender === 'male' ? 'bg-[#137fec]' : 'bg-[#ec4899]'
                          )}>
                            {resident.first_name.charAt(0)}{resident.last_name.charAt(0)}
                          </div>
                          <span className="font-medium text-[#0d141b]">
                            {resident.first_name} {resident.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4c739a] font-mono">
                        {resident.medical_record_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4c739a]">
                        {calculateAge(resident.date_of_birth)} / {resident.gender === 'male' ? 'M' : resident.gender === 'female' ? 'F' : 'O'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4c739a]">
                        {resident.admission_date ? formatDate(resident.admission_date) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white',
                          getPayerTypeColor(resident.payer_type)
                        )}>
                          {getPayerTypeLabel(resident.payer_type)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Overlay when side panel is open */}
      {selectedResident && (
        <div
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] z-40"
          onClick={() => {
            setSelectedResident(null);
            setIsEditing(false);
          }}
        />
      )}

      {/* Right Side Panel */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#e7edf3] transform transition-transform duration-300',
          selectedResident ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {selectedResident && (
          <>
            {/* Status Header (Color Coded by Payer Type) */}
            <div className={cn('h-2 w-full', getPayerTypeColor(selectedResident.payer_type))} />

            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Header Section */}
              <div className="px-6 py-6 border-b border-[#e7edf3]">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded w-fit mb-1 text-white',
                      getPayerTypeColor(selectedResident.payer_type)
                    )}>
                      {getPayerTypeLabel(selectedResident.payer_type)}
                    </span>
                    <h2 className="text-2xl font-bold text-[#0d141b]">Resident Details</h2>
                    <p className="text-[#4c739a] text-sm">
                      MRN: {selectedResident.medical_record_number}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedResident(null);
                      setIsEditing(false);
                    }}
                    className="text-[#4c739a] hover:text-[#0d141b] transition-colors"
                  >
                    <X className="w-7 h-7" />
                  </button>
                </div>

                {/* Profile Header */}
                <div className="flex items-center gap-5 bg-[#f6f7f8] p-4 rounded-xl">
                  <div className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-white shadow-sm',
                    selectedResident.gender === 'male' ? 'bg-[#137fec]' : 'bg-[#ec4899]'
                  )}>
                    {selectedResident.first_name.charAt(0)}{selectedResident.last_name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[#0d141b] text-xl font-bold leading-tight">
                      {selectedResident.first_name} {selectedResident.last_name}
                    </p>
                    <p className="text-[#4c739a] text-sm font-medium">
                      ID: #{selectedResident.id.slice(0, 8).toUpperCase()}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs bg-[#e7edf3] px-2 py-0.5 rounded-full">
                        Age: {calculateAge(selectedResident.date_of_birth)}
                      </span>
                      <span className="text-xs bg-[#e7edf3] px-2 py-0.5 rounded-full capitalize">
                        {selectedResident.gender}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats / Details Grid */}
              <div className="px-6 py-6 flex flex-wrap gap-3 border-b border-[#e7edf3]">
                <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-[#f6f7f8] border border-[#e7edf3]">
                  <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Admission Date
                  </p>
                  <p className="text-[#0d141b] font-bold text-base">
                    {formatDate(selectedResident.admission_date)}
                  </p>
                </div>
                <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-[#f6f7f8] border border-[#e7edf3]">
                  <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Payer Type
                  </p>
                  <p className="text-[#0d141b] font-bold text-base">
                    {getPayerTypeLabel(selectedResident.payer_type)}
                  </p>
                </div>
                <div className="flex flex-col flex-1 min-w-[120px] gap-1 rounded-lg p-4 bg-[#f6f7f8] border border-[#e7edf3]">
                  <p className="text-[#4c739a] text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                    <Bed className="w-3 h-3" />
                    Bed Assignment
                  </p>
                  <p className="text-[#0d141b] font-bold text-base">
                    {selectedResident.bed_id ? 'Assigned' : 'Not Assigned'}
                  </p>
                </div>
              </div>

              {/* Diagnoses Section */}
              {selectedResident.diagnoses && selectedResident.diagnoses.length > 0 && (
                <div className="px-6 py-6 border-b border-[#e7edf3]">
                  <h3 className="text-sm font-bold text-[#0d141b] mb-4 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Diagnoses
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedResident.diagnoses.map((diagnosis) => (
                      <span
                        key={diagnosis}
                        className="inline-flex items-center px-3 py-1 bg-[#137fec]/10 text-[#137fec] text-sm font-medium rounded-full"
                      >
                        {diagnosis}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical Notes / Alerts */}
              {selectedResident.notes && (
                <div className="px-6 py-4 bg-red-50 mx-6 rounded-xl border border-red-100 my-6">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">Medical Notes</span>
                  </div>
                  <p className="text-sm text-red-800 font-medium">
                    {selectedResident.notes}
                  </p>
                </div>
              )}

              {/* Activity / History Placeholder */}
              <div className="px-6 flex-1 pb-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[#0d141b]">Recent Activity</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-3 bg-white rounded-lg border border-[#e7edf3] shadow-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#4c739a]">
                        {formatDate(selectedResident.created_at).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[#4c739a]">System</span>
                    </div>
                    <p className="text-xs text-[#4c739a] leading-relaxed">
                      Resident record created in the system.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="p-6 border-t border-[#e7edf3] bg-[#f6f7f8] flex gap-3">
              <button
                onClick={handleEditClick}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg bg-[#137fec] text-white font-bold text-sm shadow-lg shadow-[#137fec]/20 hover:bg-[#1171d4] transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg border border-[#e7edf3] bg-white text-[#0d141b] font-bold text-sm hover:bg-[#f6f7f8] transition-colors"
              >
                <Bed className="w-4 h-4" />
                Assign Bed
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Add Patient Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add New Resident"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) =>
                  setFormData({ ...formData, date_of_birth: e.target.value })
                }
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Date of Admission *
              </label>
              <input
                type="date"
                required
                value={formData.admission_date}
                onChange={(e) =>
                  setFormData({ ...formData, admission_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Gender *
              </label>
              <select
                required
                value={formData.gender}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gender: e.target.value as 'male' | 'female' | 'other',
                  })
                }
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Payer Type *
              </label>
              <select
                required
                value={formData.payer_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payer_type: e.target.value as PayerType,
                  })
                }
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              >
                <option value="private">Private</option>
                <option value="medicare">Medicare</option>
                <option value="medicaid">Medicaid</option>
                <option value="managed_care">Managed Care</option>
              </select>
            </div>
          </div>

          {/* Diagnosis Dropdown */}
          <DiagnosisDropdown
            selectedDiagnoses={formData.diagnoses}
            onSelectionChange={(diagnoses) => setFormData({ ...formData, diagnoses })}
            availableDiagnoses={availableDiagnoses}
            onAddCustom={handleAddCustomDiagnosis}
          />

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Additional Medical Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              placeholder="Any allergies, special care instructions, or other notes..."
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add Resident
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import Residents Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Residents from CSV"
        size="lg"
      >
        <CSVImport
          onImport={handleImportResidents}
          columns={residentColumns}
          templateName="residents"
        />
      </Modal>
    </div>
  );
}
