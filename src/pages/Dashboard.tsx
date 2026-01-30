import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BedCard, SearchFilter, Modal, Button, StatusBadge } from '../components';
import { useBeds, useBedStats, useBedActions } from '../hooks/useBeds';
import { useWards } from '../hooks/useWards';
import { useUnassignedResidents } from '../hooks/useResidents';
import type { BedWithDetails, BedStatus, FilterOptions } from '../types';

const BED_STATUS_COLORS = ['#22c55e', '#137fec', '#facc15', '#111827'];
const CASE_MIX_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f97316'];

interface CaseMixTargets {
  private: number;
  medicare: number;
  medicaid: number;
  managedCare: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

function StatCard({ title, value, change, changeType = 'neutral' }: StatCardProps) {
  const changeColor = changeType === 'positive'
    ? 'text-[#078838]'
    : changeType === 'negative'
    ? 'text-[#e73908]'
    : 'text-[#137fec]';

  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-1 rounded-xl p-6 bg-white border border-[#cfdbe7]">
      <p className="text-[#4c739a] text-sm font-medium">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {change && (
          <span className={`text-sm font-medium ${changeColor}`}>{change}</span>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [isIsolation, setIsIsolation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [occupancyTarget, setOccupancyTarget] = useState(85);
  const [caseMixTargets, setCaseMixTargets] = useState<CaseMixTargets>({
    private: 25,
    medicare: 35,
    medicaid: 25,
    managedCare: 15,
  });

  // Load configuration from localStorage
  useEffect(() => {
    const savedTarget = localStorage.getItem('occupancyTarget');
    if (savedTarget) setOccupancyTarget(parseInt(savedTarget, 10));

    const savedCaseMix = localStorage.getItem('caseMix');
    if (savedCaseMix) setCaseMixTargets(JSON.parse(savedCaseMix));

    // Listen for storage changes from Management page
    const handleStorage = () => {
      const updatedTarget = localStorage.getItem('occupancyTarget');
      if (updatedTarget) setOccupancyTarget(parseInt(updatedTarget, 10));

      const updatedCaseMix = localStorage.getItem('caseMix');
      if (updatedCaseMix) setCaseMixTargets(JSON.parse(updatedCaseMix));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const { beds, loading } = useBeds(filters);
  const { stats } = useBedStats();
  const { wards } = useWards();
  const { residents: unassignedResidents } = useUnassignedResidents();
  const { updateBedStatus, assignPatient, dischargePatient } = useBedActions();

  const handleStatusChange = async (bedId: string, status: BedStatus) => {
    setActionLoading(true);
    await updateBedStatus(bedId, status);
    setActionLoading(false);
    setSelectedBed(null);
  };

  const handleAssignPatient = async () => {
    if (!selectedBed || !selectedPatientId) return;
    setActionLoading(true);
    await assignPatient(selectedBed.id, selectedPatientId, 'current-user', isIsolation);
    setActionLoading(false);
    setShowAssignModal(false);
    setSelectedBed(null);
    setSelectedPatientId('');
    setIsIsolation(false);
  };

  const handleDischarge = async () => {
    if (!selectedBed?.current_assignment) return;
    setActionLoading(true);
    await dischargePatient(selectedBed.current_assignment.id, selectedBed.id);
    setActionLoading(false);
    setSelectedBed(null);
  };

  return (
    <div className="space-y-6">

      {/* Dashboard Stats */}
      <div className="flex flex-wrap gap-4 mb-2">
        <StatCard
          title="Occupancy Rate"
          value={`${stats.occupancy_rate}%`}
          change={stats.occupancy_rate >= occupancyTarget ? '+1.2%' : '-0.8%'}
          changeType={stats.occupancy_rate >= occupancyTarget ? 'positive' : 'negative'}
        />
        <StatCard
          title="Available Beds"
          value={stats.available_beds}
          change={stats.available_beds > 10 ? `+${Math.floor(stats.available_beds / 5)}` : `-${Math.abs(10 - stats.available_beds)}`}
          changeType={stats.available_beds > 10 ? 'positive' : 'negative'}
        />
        <StatCard
          title="Isolation Units"
          value={stats.isolation_beds}
          change="Stable"
          changeType="neutral"
        />
        <StatCard
          title="Out of Service"
          value={stats.maintenance_beds}
          change="Maintenance"
          changeType="neutral"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bed Status Pie Chart */}
        <div className="bg-white rounded-xl border border-[#e7edf3] p-5">
          <h3 className="font-semibold text-[#0d141b] mb-4">Bed Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Available', value: stats.available_beds },
                  { name: 'Occupied', value: stats.occupied_beds },
                  { name: 'Isolation', value: stats.isolation_beds },
                  { name: 'Out of Service', value: stats.maintenance_beds },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                label={({ value }) => value > 0 ? `${value}` : ''}
                labelLine={false}
              >
                {BED_STATUS_COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#22c55e]"></span>Available
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#137fec]"></span>Occupied
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#facc15]"></span>Isolation
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-gray-900"></span>Out of Service
            </span>
          </div>
        </div>

        {/* Case Mix Pie Chart */}
        <div className="bg-white rounded-xl border border-[#e7edf3] p-5">
          <h3 className="font-semibold text-[#0d141b] mb-4">Case Mix Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Private', value: stats.case_mix.private },
                  { name: 'Medicare', value: stats.case_mix.medicare },
                  { name: 'Medicaid', value: stats.case_mix.medicaid },
                  { name: 'Managed Care', value: stats.case_mix.managed_care },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                label={({ value }) => value > 0 ? `${value}` : ''}
                labelLine={false}
              >
                {CASE_MIX_COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span>Private
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#06b6d4]"></span>Medicare
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>Medicaid
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#4c739a]">
              <span className="w-3 h-3 rounded-full bg-[#f97316]"></span>Managed Care
            </span>
          </div>
        </div>

        {/* Occupancy Bar Chart */}
        <div className="bg-white rounded-xl border border-[#e7edf3] p-5">
          <h3 className="font-semibold text-[#0d141b] mb-4">Occupancy vs Target</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={[
                { name: 'Occupancy', actual: stats.occupancy_rate, target: occupancyTarget },
              ]}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar dataKey="actual" name="Actual" fill="#137fec" barSize={30} radius={[0, 4, 4, 0]} />
              <Bar dataKey="target" name="Target" fill="#c4d4e5" barSize={30} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-[#137fec]/10 rounded-lg">
              <p className="text-xs text-[#4c739a]">Current</p>
              <p className="text-xl font-bold text-[#137fec]">{stats.occupancy_rate}%</p>
            </div>
            <div className="p-3 bg-[#e7edf3] rounded-lg">
              <p className="text-xs text-[#4c739a]">Target</p>
              <p className="text-xl font-bold text-[#4c739a]">{occupancyTarget}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Case Mix Actual vs Target */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-5">
        <h3 className="font-semibold text-[#0d141b] mb-4">Case Mix: Actual vs Target</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={(() => {
              const totalResidents = stats.case_mix.private + stats.case_mix.medicare + stats.case_mix.medicaid + stats.case_mix.managed_care;
              return [
                {
                  name: 'Private',
                  actual: totalResidents > 0 ? Math.round((stats.case_mix.private / totalResidents) * 100) : 0,
                  target: caseMixTargets.private,
                  count: stats.case_mix.private
                },
                {
                  name: 'Medicare',
                  actual: totalResidents > 0 ? Math.round((stats.case_mix.medicare / totalResidents) * 100) : 0,
                  target: caseMixTargets.medicare,
                  count: stats.case_mix.medicare
                },
                {
                  name: 'Medicaid',
                  actual: totalResidents > 0 ? Math.round((stats.case_mix.medicaid / totalResidents) * 100) : 0,
                  target: caseMixTargets.medicaid,
                  count: stats.case_mix.medicaid
                },
                {
                  name: 'Managed Care',
                  actual: totalResidents > 0 ? Math.round((stats.case_mix.managed_care / totalResidents) * 100) : 0,
                  target: caseMixTargets.managedCare,
                  count: stats.case_mix.managed_care
                },
              ];
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value, name) => [`${value}%`, name === 'actual' ? 'Actual' : 'Target']} />
            <Legend />
            <Bar dataKey="actual" name="Actual %" fill="#137fec" radius={[4, 4, 0, 0]} />
            <Bar dataKey="target" name="Target %" fill="#c4d4e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="p-3 bg-[#8b5cf6]/10 rounded-lg border-l-4 border-[#8b5cf6]">
            <p className="text-sm text-[#4c739a]">Private</p>
            <p className="text-2xl font-bold text-[#0d141b]">{stats.case_mix.private}</p>
            <p className="text-xs text-[#4c739a]">Target: {caseMixTargets.private}%</p>
          </div>
          <div className="p-3 bg-[#06b6d4]/10 rounded-lg border-l-4 border-[#06b6d4]">
            <p className="text-sm text-[#4c739a]">Medicare</p>
            <p className="text-2xl font-bold text-[#0d141b]">{stats.case_mix.medicare}</p>
            <p className="text-xs text-[#4c739a]">Target: {caseMixTargets.medicare}%</p>
          </div>
          <div className="p-3 bg-[#10b981]/10 rounded-lg border-l-4 border-[#10b981]">
            <p className="text-sm text-[#4c739a]">Medicaid</p>
            <p className="text-2xl font-bold text-[#0d141b]">{stats.case_mix.medicaid}</p>
            <p className="text-xs text-[#4c739a]">Target: {caseMixTargets.medicaid}%</p>
          </div>
          <div className="p-3 bg-[#f97316]/10 rounded-lg border-l-4 border-[#f97316]">
            <p className="text-sm text-[#4c739a]">Managed Care</p>
            <p className="text-2xl font-bold text-[#0d141b]">{stats.case_mix.managed_care}</p>
            <p className="text-xs text-[#4c739a]">Target: {caseMixTargets.managedCare}%</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <SearchFilter
        filters={filters}
        onFiltersChange={setFilters}
        wards={wards}
      />

      {/* Bed Board Section */}
      <div>
        {/* Filter Legend & Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#0d141b]">Unit Overview: North Wing</h2>
          <div className="flex gap-3 flex-wrap">
            <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
              <div className="w-3 h-3 rounded-full bg-[#137fec]"></div>
              <p className="text-xs font-semibold">Male</p>
            </div>
            <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
              <div className="w-3 h-3 rounded-full bg-pink-400"></div>
              <p className="text-xs font-semibold">Female</p>
            </div>
            <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <p className="text-xs font-semibold">Isolation</p>
            </div>
            <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
              <div className="w-3 h-3 rounded-full bg-gray-900"></div>
              <p className="text-xs font-semibold">Out of Service</p>
            </div>
            <div className="flex h-8 items-center gap-x-2 rounded-lg bg-white border border-slate-200 px-3">
              <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></div>
              <p className="text-xs font-semibold">Vacant</p>
            </div>
          </div>
        </div>

        {/* Beds Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#137fec]" />
          </div>
        ) : beds.length === 0 ? (
          <div className="text-center py-12 text-[#4c739a]">
            No beds found matching your criteria
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {beds.map((bed) => (
              <BedCard
                key={bed.id}
                bed={bed}
                onClick={() => setSelectedBed(bed)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bed Detail Modal */}
      <Modal
        isOpen={!!selectedBed && !showAssignModal}
        onClose={() => setSelectedBed(null)}
        title={`Room ${selectedBed?.room?.room_number || ''} - Bed ${selectedBed?.bed_number || ''}`}
        size="md"
      >
        {selectedBed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#4c739a]">Ward</p>
                <p className="font-medium text-[#0d141b]">
                  {selectedBed.room?.ward?.name} - Floor {selectedBed.room?.ward?.floor}
                </p>
              </div>
              <StatusBadge status={selectedBed.status} />
            </div>

            {selectedBed.current_assignment?.patient && (
              <div className="p-4 bg-[#f6f7f8] rounded-lg">
                <p className="text-sm text-[#4c739a] mb-2">Current Resident</p>
                <p className="font-semibold text-[#0d141b]">
                  {selectedBed.current_assignment.patient.first_name}{' '}
                  {selectedBed.current_assignment.patient.last_name}
                </p>
                <p className="text-sm text-[#4c739a]">
                  MRN: {selectedBed.current_assignment.patient.medical_record_number}
                </p>
                {selectedBed.current_assignment.is_isolation && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-[#f5a623]/10 text-[#f5a623]">
                    Isolation
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#e7edf3]">
              {selectedBed.status === 'available' && (
                <Button onClick={() => setShowAssignModal(true)}>
                  Assign Resident
                </Button>
              )}

              {selectedBed.status === 'occupied' && selectedBed.current_assignment && (
                <Button
                  variant="danger"
                  onClick={handleDischarge}
                  loading={actionLoading}
                >
                  Discharge Resident
                </Button>
              )}

              {selectedBed.status === 'cleaning' && (
                <Button
                  onClick={() => handleStatusChange(selectedBed.id, 'available')}
                  loading={actionLoading}
                >
                  Mark Available
                </Button>
              )}

              {selectedBed.status !== 'maintenance' && (
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange(selectedBed.id, 'maintenance')}
                  loading={actionLoading}
                >
                  Set Out of Service
                </Button>
              )}

              {selectedBed.status === 'maintenance' && (
                <Button
                  onClick={() => handleStatusChange(selectedBed.id, 'available')}
                  loading={actionLoading}
                >
                  Return to Service
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Patient Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedPatientId('');
          setIsIsolation(false);
        }}
        title="Assign Resident"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Select Resident
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            >
              <option value="">Choose a resident...</option>
              {unassignedResidents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.first_name} {resident.last_name} (MRN: {resident.medical_record_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isIsolation}
                onChange={(e) => setIsIsolation(e.target.checked)}
                className="w-4 h-4 rounded border-[#c4d4e5] text-[#137fec] focus:ring-[#137fec]"
              />
              <span className="text-sm font-medium text-[#0d141b]">Isolation Required</span>
            </label>
            <p className="text-xs text-[#4c739a] mt-1 ml-6">
              Check if resident requires isolation precautions
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedPatientId('');
                setIsIsolation(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignPatient}
              disabled={!selectedPatientId}
              loading={actionLoading}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
