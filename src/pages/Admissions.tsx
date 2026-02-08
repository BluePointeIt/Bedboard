import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResidents, type CreateResidentInput } from '../hooks/useResidents';
import { useAuth } from '../hooks/useAuth';
import { Button, Icon } from '../components';

export function Admissions() {
  const navigate = useNavigate();
  const { currentFacility } = useAuth();
  const { createResident } = useResidents({ facilityId: currentFacility?.id });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<CreateResidentInput>({
    first_name: '',
    last_name: '',
    gender: 'male',
    date_of_birth: '',
    admission_date: new Date().toISOString().split('T')[0],
    payor: 'private',
    is_isolation: false,
    isolation_type: undefined,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: createError } = await createResident(formData);

    if (createError) {
      setError(createError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Reset form after success
    setTimeout(() => {
      setFormData({
        first_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        admission_date: new Date().toISOString().split('T')[0],
        payor: 'private',
        is_isolation: false,
        isolation_type: undefined,
        notes: '',
      });
      setSuccess(false);
    }, 2000);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Icon name="person_add" size={24} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Admission</h1>
            <p className="text-slate-500">Register a new resident in the facility</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-200 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Icon name="check" size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-green-800">Resident admitted successfully!</p>
            <p className="text-sm text-green-600">
              You can now assign them to a bed from the Dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-200 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
            <Icon name="error" size={20} className="text-white" />
          </div>
          <p className="font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-8 shadow-sm">
        <div className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="badge" size={16} className="text-slate-400" />
                First Name *
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
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
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                placeholder="Enter last name"
              />
            </div>
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
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="wc" size={16} className="text-slate-400" />
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
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
              name="payor"
              value={formData.payor}
              onChange={handleChange}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            >
              <option value="private">Private</option>
              <option value="medicare">Medicare</option>
              <option value="medicaid">Medicaid</option>
              <option value="managed_care">Managed Care</option>
              <option value="bed_hold">Bed Hold</option>
              <option value="hospice">Hospice</option>
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
              name="admission_date"
              value={formData.admission_date}
              onChange={handleChange}
              required
              className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Isolation */}
          <div className="p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl border border-amber-200">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="is_isolation"
                checked={formData.is_isolation}
                onChange={handleChange}
                className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <span className="font-semibold text-slate-900 group-hover:text-primary-500 transition-colors">Isolation Required</span>
                <p className="text-sm text-slate-500">Check if resident requires isolation precautions</p>
              </div>
            </label>

            {formData.is_isolation && (
              <div className="mt-4">
                <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                  <Icon name="warning" size={16} className="text-amber-500" />
                  Isolation Type
                </label>
                <select
                  name="isolation_type"
                  value={formData.isolation_type || ''}
                  onChange={handleChange}
                  className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="respiratory">Respiratory</option>
                  <option value="contact">Contact</option>
                  <option value="droplet">Droplet</option>
                  <option value="airborne">Airborne</option>
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
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none placeholder:text-slate-400"
              placeholder="Add any additional notes about the resident..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button type="submit" size="xl" loading={loading}>
              <Icon name="person_add" size={20} className="mr-2" />
              Admit Resident
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
