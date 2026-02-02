import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components';
import { useWings } from '../hooks/useWings';
import { useBeds } from '../hooks/useBeds';
import { supabase } from '../lib/supabase';
import type { Gender } from '../types';

interface PayorRates {
  private: number;
  medicare: number;
  medicaid: number;
  managed_care: number;
  hospice: number;
  other: number;
}

interface GenderAvailability {
  male: number;
  female: number;
  either: number;
}

const DEFAULT_PAYOR_RATES: PayorRates = {
  private: 0,
  medicare: 0,
  medicaid: 0,
  managed_care: 0,
  hospice: 0,
  other: 0,
};

const PAYOR_LABELS: Record<string, string> = {
  private: 'Private',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  managed_care: 'Managed Care',
  hospice: 'Hospice',
  other: 'Other',
};

export function Analytics() {
  const { wings } = useWings();
  const { beds, loading: bedsLoading } = useBeds();
  const [caseMixBudget, setCaseMixBudget] = useState<PayorRates>(DEFAULT_PAYOR_RATES);
  const [budgetLoading, setBudgetLoading] = useState(true);

  // Load case-mix budget from Supabase
  useEffect(() => {
    async function loadCaseMix() {
      setBudgetLoading(true);
      const { data, error } = await supabase
        .from('facility_settings')
        .select('setting_value')
        .eq('setting_key', 'case_mix')
        .single();

      if (!error && data?.setting_value) {
        setCaseMixBudget(data.setting_value as PayorRates);
      }
      setBudgetLoading(false);
    }
    loadCaseMix();
  }, []);

  // Calculate all analytics
  const analytics = useMemo(() => {
    // Total beds calculation
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    const vacantBeds = beds.filter(b => b.status === 'vacant').length;
    const outOfServiceBeds = beds.filter(b => b.status === 'out_of_service').length;
    const actualOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Budget calculations
    const caseMixTotal = Object.values(caseMixBudget).reduce((sum, val) => sum + val, 0);
    const targetOccupancyRate = totalBeds > 0 ? Math.round((caseMixTotal / totalBeds) * 100) : 0;

    // Case-mix actual counts by payor type
    const actualByPayor: PayorRates = {
      private: 0,
      medicare: 0,
      medicaid: 0,
      managed_care: 0,
      hospice: 0,
      other: 0,
    };

    beds.forEach(bed => {
      if (bed.status === 'occupied' && bed.resident) {
        const payor = bed.resident.payor;
        if (payor === 'private') actualByPayor.private++;
        else if (payor === 'medicare') actualByPayor.medicare++;
        else if (payor === 'medicaid') actualByPayor.medicaid++;
        else if (payor === 'managed_care') actualByPayor.managed_care++;
        else if (payor === 'hospice') actualByPayor.hospice++;
        else actualByPayor.other++;
      }
    });

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      outOfServiceBeds,
      actualOccupancyRate,
      targetOccupancyRate,
      caseMixTotal,
      actualByPayor,
    };
  }, [beds, caseMixBudget]);

  // Calculate gender-specific bed availability
  const genderAvailability = useMemo((): GenderAvailability => {
    const vacantBeds = beds.filter(b => b.status === 'vacant');

    let maleAvailable = 0;
    let femaleAvailable = 0;
    let eitherAvailable = 0;

    // Group beds by room
    const roomToBeds = new Map<string, typeof beds>();
    beds.forEach(bed => {
      const roomId = bed.room_id || bed.room?.id;
      if (roomId) {
        if (!roomToBeds.has(roomId)) {
          roomToBeds.set(roomId, []);
        }
        roomToBeds.get(roomId)!.push(bed);
      }
    });

    // Group rooms by shared bathroom group
    const bathroomGroupToRooms = new Map<string, Set<string>>();
    beds.forEach(bed => {
      const room = bed.room;
      if (room?.has_shared_bathroom && room?.shared_bathroom_group_id) {
        if (!bathroomGroupToRooms.has(room.shared_bathroom_group_id)) {
          bathroomGroupToRooms.set(room.shared_bathroom_group_id, new Set());
        }
        bathroomGroupToRooms.get(room.shared_bathroom_group_id)!.add(room.id);
      }
    });

    // For each vacant bed, determine what gender can occupy it
    vacantBeds.forEach(vacantBed => {
      const roomId = vacantBed.room_id || vacantBed.room?.id;
      if (!roomId) {
        eitherAvailable++;
        return;
      }

      const room = vacantBed.room;
      const roomBeds = roomToBeds.get(roomId) || [];
      const isMultiBedRoom = roomBeds.length > 1;

      // Collect all rooms to check for gender constraints
      const roomsToCheck = new Set<string>([roomId]);

      // Add rooms sharing a bathroom
      if (room?.has_shared_bathroom && room?.shared_bathroom_group_id) {
        const sharedRooms = bathroomGroupToRooms.get(room.shared_bathroom_group_id);
        if (sharedRooms) {
          sharedRooms.forEach(r => roomsToCheck.add(r));
        }
      }

      // Only apply gender constraints if multi-bed room or shared bathroom
      if (!isMultiBedRoom && roomsToCheck.size === 1) {
        eitherAvailable++;
        return;
      }

      // Find existing genders in all rooms to check
      const existingGenders = new Set<Gender>();
      roomsToCheck.forEach(checkRoomId => {
        const checkRoomBeds = roomToBeds.get(checkRoomId) || [];
        checkRoomBeds.forEach(bed => {
          if (bed.status === 'occupied' && bed.resident?.gender) {
            existingGenders.add(bed.resident.gender);
          }
        });
      });

      // Determine availability based on existing occupants
      if (existingGenders.size === 0) {
        // No occupants - either gender can use this bed
        eitherAvailable++;
      } else if (existingGenders.size === 1) {
        // One gender present - only that gender can use this bed
        const existingGender = Array.from(existingGenders)[0];
        if (existingGender === 'male') {
          maleAvailable++;
        } else if (existingGender === 'female') {
          femaleAvailable++;
        } else {
          // 'other' gender - treat as either for now
          eitherAvailable++;
        }
      } else {
        // Mixed genders already present (shouldn't happen but handle it)
        // This bed can't really accept anyone safely
        eitherAvailable++;
      }
    });

    return {
      male: maleAvailable + eitherAvailable,
      female: femaleAvailable + eitherAvailable,
      either: eitherAvailable,
    };
  }, [beds]);

  const loading = bedsLoading || budgetLoading;

  // Helper to calculate variance
  const getVariance = (budget: number, actual: number) => actual - budget;
  const getVarianceColor = (variance: number) => {
    if (variance === 0) return 'text-slate-600';
    if (variance > 0) return 'text-green-600';
    return 'text-red-600';
  };
  const getVarianceIcon = (variance: number) => {
    if (variance === 0) return 'remove';
    if (variance > 0) return 'arrow_upward';
    return 'arrow_downward';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Icon name="analytics" size={24} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Facility Analytics</h1>
          <p className="text-slate-500">Occupancy tracking, budget analysis, and bed availability</p>
        </div>
      </div>

      {/* Occupancy Overview */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="analytics" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Occupancy Overview</h2>
            <p className="text-sm text-slate-500">Target vs actual occupancy comparison</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
            <p className="text-sm text-slate-500 mb-1">Total Beds</p>
            <p className="text-3xl font-bold text-slate-900">{analytics.totalBeds}</p>
          </div>
          <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
            <p className="text-sm text-slate-500 mb-1">Occupied</p>
            <p className="text-3xl font-bold text-primary-500">{analytics.occupiedBeds}</p>
          </div>
          <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
            <p className="text-sm text-slate-500 mb-1">Vacant</p>
            <p className="text-3xl font-bold text-green-600">{analytics.vacantBeds}</p>
          </div>
          <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
            <p className="text-sm text-slate-500 mb-1">Out of Service</p>
            <p className="text-3xl font-bold text-slate-500">{analytics.outOfServiceBeds}</p>
          </div>
        </div>

        {/* Target vs Actual Occupancy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-xl border border-primary-200" style={{ padding: '24px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-primary-700">Target Occupancy</p>
                <p className="text-xs text-primary-500">Based on Case-Mix Budget</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-primary-600">{analytics.targetOccupancyRate}%</p>
                <p className="text-xs text-primary-500">{analytics.caseMixTotal} / {analytics.totalBeds} beds</p>
              </div>
            </div>
            <div className="h-3 bg-primary-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-500"
                style={{ width: `${Math.min(analytics.targetOccupancyRate, 100)}%` }}
              />
            </div>
          </div>

          <div className={`rounded-xl border ${
            analytics.actualOccupancyRate >= analytics.targetOccupancyRate
              ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200'
              : 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-200'
          }`} style={{ padding: '24px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className={`text-sm font-medium ${
                  analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'text-green-700' : 'text-amber-700'
                }`}>Actual Occupancy</p>
                <p className={`text-xs ${
                  analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'text-green-500' : 'text-amber-500'
                }`}>Current Census</p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${
                  analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'text-green-600' : 'text-amber-600'
                }`}>{analytics.actualOccupancyRate}%</p>
                <p className={`text-xs ${
                  analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'text-green-500' : 'text-amber-500'
                }`}>{analytics.occupiedBeds} / {analytics.totalBeds} beds</p>
              </div>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${
              analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'bg-green-200' : 'bg-amber-200'
            }`}>
              <div
                className={`h-full transition-all duration-500 ${
                  analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(analytics.actualOccupancyRate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Variance Summary */}
        <div className="mt-8 bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name={analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'trending_up' : 'trending_down'}
                size={24}
                className={analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'text-green-500' : 'text-amber-500'}
              />
              <span className="font-medium text-slate-900">Occupancy Variance</span>
            </div>
            <div className={`text-xl font-bold ${
              analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? 'text-green-600' : 'text-amber-600'
            }`}>
              {analytics.actualOccupancyRate >= analytics.targetOccupancyRate ? '+' : ''}
              {analytics.actualOccupancyRate - analytics.targetOccupancyRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Case-Mix Budget vs Actual */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Icon name="payments" size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Case-Mix Analysis</h2>
            <p className="text-sm text-slate-500">Budget vs actual residents by payor type</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Payor Type</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Budget</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Actual</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Variance</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 min-w-[200px]">Progress</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(PAYOR_LABELS).map((payor) => {
                const budget = caseMixBudget[payor as keyof PayorRates] || 0;
                const actual = analytics.actualByPayor[payor as keyof PayorRates] || 0;
                const variance = getVariance(budget, actual);
                const progress = budget > 0 ? Math.min((actual / budget) * 100, 150) : (actual > 0 ? 100 : 0);

                return (
                  <tr key={payor} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{PAYOR_LABELS[payor]}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-slate-500 font-medium">{budget}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-slate-900">{actual}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className={`inline-flex items-center gap-1 ${getVarianceColor(variance)}`}>
                        <Icon name={getVarianceIcon(variance)} size={16} />
                        <span className="font-bold">{variance > 0 ? `+${variance}` : variance}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-amber-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 w-14 text-right">
                          {budget > 0 ? `${Math.round((actual / budget) * 100)}%` : '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900">Total</td>
                <td className="py-3 px-4 text-center font-bold text-slate-900">{analytics.caseMixTotal}</td>
                <td className="py-3 px-4 text-center font-bold text-primary-500">{analytics.occupiedBeds}</td>
                <td className="py-3 px-4 text-center">
                  <div className={`inline-flex items-center gap-1 font-bold ${getVarianceColor(analytics.occupiedBeds - analytics.caseMixTotal)}`}>
                    <Icon name={getVarianceIcon(analytics.occupiedBeds - analytics.caseMixTotal)} size={16} />
                    {analytics.occupiedBeds - analytics.caseMixTotal > 0 ? '+' : ''}
                    {analytics.occupiedBeds - analytics.caseMixTotal}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          analytics.occupiedBeds >= analytics.caseMixTotal ? 'bg-green-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${analytics.caseMixTotal > 0 ? Math.min((analytics.occupiedBeds / analytics.caseMixTotal) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-900 w-14 text-right">
                      {analytics.caseMixTotal > 0 ? `${Math.round((analytics.occupiedBeds / analytics.caseMixTotal) * 100)}%` : '-'}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Gender-Specific Bed Availability */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Icon name="wc" size={20} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Gender-Specific Availability</h2>
            <p className="text-sm text-slate-500">Available beds considering room and shared bathroom constraints</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Male Available */}
          <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-xl border border-primary-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center">
                <Icon name="male" size={28} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-700">Male Beds Available</p>
                <p className="text-3xl font-bold text-primary-600">{genderAvailability.male}</p>
              </div>
            </div>
            <p className="text-xs text-primary-600">
              Includes {genderAvailability.either} beds open to either gender
            </p>
          </div>

          {/* Female Available */}
          <div className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 rounded-xl border border-pink-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center">
                <Icon name="female" size={28} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-pink-700">Female Beds Available</p>
                <p className="text-3xl font-bold text-pink-600">{genderAvailability.female}</p>
              </div>
            </div>
            <p className="text-xs text-pink-600">
              Includes {genderAvailability.either} beds open to either gender
            </p>
          </div>

          {/* Either Gender */}
          <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-xl border border-violet-200" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center">
                <Icon name="group" size={28} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-violet-700">Open to Either</p>
                <p className="text-3xl font-bold text-violet-600">{genderAvailability.either}</p>
              </div>
            </div>
            <p className="text-xs text-violet-600">
              Private rooms or empty shared rooms/bathrooms
            </p>
          </div>
        </div>

        {/* Explanation */}
        <div className="mt-8 bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
          <div className="flex items-start gap-3">
            <Icon name="info" size={20} className="text-slate-500 mt-0.5" />
            <div className="text-sm text-slate-500">
              <p className="font-medium text-slate-900 mb-1">How gender availability is calculated:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Semi-private and triple rooms cannot have mixed genders</li>
                <li>Rooms sharing a bathroom cannot have opposite genders across the bathroom group</li>
                <li>Private rooms with private bathrooms are open to either gender</li>
                <li>Empty rooms/bathroom groups are counted as "open to either"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Wing-by-Wing Summary */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Icon name="domain" size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Wing Summary</h2>
            <p className="text-sm text-slate-500">Occupancy breakdown by wing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wings.map(wing => {
            const wingBeds = beds.filter(b => b.room?.wing?.id === wing.id);
            const wingOccupied = wingBeds.filter(b => b.status === 'occupied').length;
            const wingTotal = wingBeds.length;
            const wingRate = wingTotal > 0 ? Math.round((wingOccupied / wingTotal) * 100) : 0;

            return (
              <div key={wing.id} className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-900">{wing.name}</h3>
                  <span className={`text-sm font-bold ${
                    wingRate >= 90 ? 'text-green-600' : wingRate >= 70 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {wingRate}%
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      wingRate >= 90 ? 'bg-green-500' : wingRate >= 70 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${wingRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {wingOccupied} of {wingTotal} beds occupied
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
