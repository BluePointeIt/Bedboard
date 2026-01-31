import { useState, useRef, useEffect } from 'react';
import { useDiagnoses } from '../hooks/useDiagnoses';
import { Icon } from './Icon';

interface DiagnosisSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DiagnosisSelect({ value, onChange, className = '' }: DiagnosisSelectProps) {
  const { diagnoses, addDiagnosis } = useDiagnoses();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when add new is shown
  useEffect(() => {
    if (showAddNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddNew]);

  const filteredDiagnoses = diagnoses.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (diagnosisName: string) => {
    onChange(diagnosisName);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleAddNew = async () => {
    if (!newDiagnosis.trim()) {
      setAddError('Please enter a diagnosis name');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    const { data, error } = await addDiagnosis(newDiagnosis);

    if (error) {
      setAddError(error.message);
      setAddLoading(false);
      return;
    }

    if (data) {
      onChange(data.name);
    }

    setNewDiagnosis('');
    setShowAddNew(false);
    setIsOpen(false);
    setAddLoading(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all flex items-center justify-between text-left"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>
          {value || 'Select diagnosis...'}
        </span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={20} className="text-slate-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search diagnoses..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2"
              >
                <Icon name="close" size={16} />
                Clear selection
              </button>
            )}

            {/* Add new option */}
            <button
              type="button"
              onClick={() => setShowAddNew(true)}
              className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-2 border-b border-slate-100"
            >
              <Icon name="add" size={16} />
              Add new diagnosis
            </button>

            {/* Diagnosis list */}
            {filteredDiagnoses.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                No diagnoses found
              </div>
            ) : (
              filteredDiagnoses.map((diagnosis) => (
                <button
                  key={diagnosis.id}
                  type="button"
                  onClick={() => handleSelect(diagnosis.name)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between ${
                    value === diagnosis.name ? 'bg-primary-50 text-primary-700' : 'text-slate-700'
                  }`}
                >
                  {diagnosis.name}
                  {value === diagnosis.name && <Icon name="check" size={16} className="text-primary-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add new diagnosis modal */}
      {showAddNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Diagnosis</h3>

            {addError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {addError}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={newDiagnosis}
              onChange={(e) => setNewDiagnosis(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNew();
                }
              }}
              placeholder="Enter diagnosis name..."
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddNew(false);
                  setNewDiagnosis('');
                  setAddError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNew}
                disabled={addLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {addLoading ? 'Adding...' : 'Add Diagnosis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
