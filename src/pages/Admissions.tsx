import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResidents, type CreateResidentInput } from '../hooks/useResidents';
import { Button, Icon } from '../components';

export function Admissions() {
  const navigate = useNavigate();
  const { createResident } = useResidents();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<CreateResidentInput>({
    first_name: '',
    last_name: '',
    gender: 'male',
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
        <h1 className="text-2xl font-bold text-[#0d141b]">New Admission</h1>
        <p className="text-[#4c739a] mt-1">Register a new resident in the facility</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <Icon name="check_circle" size={24} className="text-green-600" />
          <div>
            <p className="font-medium text-green-800">Resident admitted successfully!</p>
            <p className="text-sm text-green-600">
              You can now assign them to a bed from the Dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <Icon name="error" size={24} className="text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">First Name *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Last Name *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter last name"
              />
            </div>
          </div>

          {/* Gender and Care Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Gender *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Payor *</label>
              <select
                name="payor"
                value={formData.payor}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="private">Private</option>
                <option value="medicare">Medicare</option>
                <option value="medicaid">Medicaid</option>
                <option value="managed_care">Managed Care</option>
                <option value="bed_hold">Bed Hold</option>
                <option value="hospice">Hospice</option>
              </select>
            </div>
          </div>

          {/* Admission Date */}
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Admission Date *</label>
            <input
              type="date"
              name="admission_date"
              value={formData.admission_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Isolation */}
          <div className="p-4 bg-[#f6f7f8] rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_isolation"
                checked={formData.is_isolation}
                onChange={handleChange}
                className="w-5 h-5 rounded border-[#c4d4e5] text-primary-500 focus:ring-primary-500"
              />
              <div>
                <span className="font-medium text-[#0d141b]">Isolation Required</span>
                <p className="text-sm text-[#4c739a]">Check if resident requires isolation precautions</p>
              </div>
            </label>

            {formData.is_isolation && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-[#0d141b] mb-1">Isolation Type</label>
                <select
                  name="isolation_type"
                  value={formData.isolation_type || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Add any additional notes about the resident..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
            <Button type="button" variant="secondary" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Admit Resident
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
