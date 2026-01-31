import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Icon } from '../components';
import { useBeds } from '../hooks/useBeds';
import type { LayoutContext } from '../components/AppLayout';
import {
  exportToExcel,
  exportToPDF,
  exportCensusToExcel,
  exportCensusToPDF,
  type ColumnDef,
} from '../lib/exportUtils';
import { formatDate } from '../lib/utils';

type ReportType = 'census' | 'custom';

interface CustomReportField {
  key: string;
  label: string;
  header: string;
  enabled: boolean;
}

export function Reports() {
  const { selectedWingId, wings } = useOutletContext<LayoutContext>();
  const [reportType, setReportType] = useState<ReportType>('census');

  // Date range filter for custom reports
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Status filter for custom reports
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['occupied']));

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Custom report field selection
  const [customFields, setCustomFields] = useState<CustomReportField[]>([
    { key: 'name', label: 'Resident Name', header: 'Resident Name', enabled: true },
    { key: 'room', label: 'Room/Bed', header: 'Room/Bed', enabled: true },
    { key: 'wing', label: 'Wing', header: 'Wing', enabled: true },
    { key: 'status', label: 'Status', header: 'Status', enabled: true },
    { key: 'payor', label: 'Payor Type', header: 'Payor', enabled: false },
    { key: 'admissionDate', label: 'Admission Date', header: 'Admitted', enabled: false },
  ]);

  const { beds, loading } = useBeds({
    wing_id: selectedWingId || undefined,
  });

  // Calculate census statistics
  const censusStats = useMemo(() => {
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = beds.filter((b) => b.status === 'vacant').length;
    const outOfService = beds.filter((b) => b.status === 'out_of_service').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const maleOccupied = beds.filter(
      (b) => b.status === 'occupied' && b.resident?.gender === 'male'
    ).length;
    const femaleOccupied = beds.filter(
      (b) => b.status === 'occupied' && b.resident?.gender === 'female'
    ).length;

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      outOfService,
      occupancyRate,
      maleOccupied,
      femaleOccupied,
    };
  }, [beds]);

  // Calculate wing breakdown
  const wingBreakdown = useMemo(() => {
    return wings.map((wing) => {
      const wingBeds = beds.filter((b) => b.room?.wing?.id === wing.id);
      const occupied = wingBeds.filter((b) => b.status === 'occupied').length;
      const vacant = wingBeds.filter((b) => b.status === 'vacant').length;
      const oos = wingBeds.filter((b) => b.status === 'out_of_service').length;
      const total = wingBeds.length;
      const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;

      return {
        wing: wing.name,
        total,
        occupied,
        vacant,
        outOfService: oos,
        occupancyRate: rate,
      };
    });
  }, [beds, wings]);

  // Generate custom report data
  const customReportData = useMemo(() => {
    // Filter beds based on selected statuses
    return beds
      .filter((b) => {
        // Filter by status
        if (!selectedStatuses.has(b.status)) return false;

        // Apply date range filter only for occupied beds with residents
        if (b.status === 'occupied' && b.resident && (dateFrom || dateTo)) {
          const admissionDate = b.resident.admission_date;
          if (!admissionDate) return false;

          const admission = new Date(admissionDate);
          if (dateFrom) {
            const from = new Date(dateFrom);
            if (admission < from) return false;
          }
          if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999); // Include the entire end date
            if (admission > to) return false;
          }
        }

        return true;
      })
      .map((bed) => ({
        name: bed.resident
          ? `${bed.resident.first_name} ${bed.resident.last_name}`
          : '-',
        room: `${bed.room?.room_number}${bed.bed_letter}`,
        wing: bed.room?.wing?.name || '',
        status: bed.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        payor: bed.resident?.payor
          ? bed.resident.payor.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
          : '-',
        admissionDate: bed.resident?.admission_date
          ? formatDate(bed.resident.admission_date)
          : '-',
      }));
  }, [beds, dateFrom, dateTo, selectedStatuses]);

  // Get enabled columns for custom report
  const enabledColumns: ColumnDef[] = customFields
    .filter((f) => f.enabled)
    .map((f) => ({
      key: f.key,
      header: f.header,
      width: f.key === 'name' ? 25 : 15,
    }));

  const toggleField = (key: string) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    if (reportType === 'census') {
      exportCensusToExcel(censusStats, wingBreakdown, `daily-census-${dateStr}`);
    } else {
      exportToExcel(customReportData, enabledColumns, `resident-report-${dateStr}`);
    }
  };

  const handleExportPDF = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    if (reportType === 'census') {
      exportCensusToPDF(censusStats, wingBreakdown, `daily-census-${dateStr}`);
    } else {
      exportToPDF(
        customReportData,
        enabledColumns,
        'Resident Report',
        `resident-report-${dateStr}`
      );
    }
  };

  const selectedWing = wings.find((w) => w.id === selectedWingId);
  const scopeLabel = selectedWing ? selectedWing.name : 'All Wings';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="summarize" size={20} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500">
              Generate and export reports for {scopeLabel}
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={loading || (reportType === 'custom' && (enabledColumns.length === 0 || selectedStatuses.size === 0))}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="table_chart" size={18} />
            Export XLS
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading || (reportType === 'custom' && (enabledColumns.length === 0 || selectedStatuses.size === 0))}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="picture_as_pdf" size={18} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 inline-flex">
        <button
          onClick={() => setReportType('census')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            reportType === 'census'
              ? 'bg-primary-500 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Daily Census
        </button>
        <button
          onClick={() => setReportType('custom')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            reportType === 'custom'
              ? 'bg-primary-500 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Custom Report
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : reportType === 'census' ? (
        /* Daily Census Report */
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Icon name="bed" size={20} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Beds</p>
                  <p className="text-2xl font-bold text-slate-900">{censusStats.totalBeds}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Icon name="person" size={20} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Occupied</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {censusStats.occupiedBeds}
                    <span className="text-sm font-normal text-slate-400 ml-1">
                      ({censusStats.occupancyRate}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Icon name="check_circle" size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Vacant</p>
                  <p className="text-2xl font-bold text-green-600">
                    {censusStats.vacantBeds}
                    <span className="text-sm font-normal text-slate-400 ml-1">
                      ({censusStats.totalBeds > 0
                        ? Math.round((censusStats.vacantBeds / censusStats.totalBeds) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Icon name="construction" size={20} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Out of Service</p>
                  <p className="text-2xl font-bold text-slate-600">{censusStats.outOfService}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gender Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Gender Distribution</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg border border-primary-200">
                <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
                  <Icon name="male" size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-primary-700">Male Occupied</p>
                  <p className="text-2xl font-bold text-primary-600">{censusStats.maleOccupied}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-pink-50 rounded-lg border border-pink-200">
                <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center">
                  <Icon name="female" size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-pink-700">Female Occupied</p>
                  <p className="text-2xl font-bold text-pink-600">{censusStats.femaleOccupied}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Wing Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Wing Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Wing
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Occupied
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Vacant
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Out of Service
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Occupancy %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {wingBreakdown.map((row, index) => (
                    <tr key={row.wing} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.wing}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center">{row.total}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center">
                        {row.occupied}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center">{row.vacant}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center">
                        {row.outOfService}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                            row.occupancyRate >= 90
                              ? 'bg-green-100 text-green-700'
                              : row.occupancyRate >= 70
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {row.occupancyRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Custom Report */
        <div className="space-y-6">
          {/* Field Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Select Report Fields</h3>
            <div className="flex flex-wrap gap-3">
              {customFields.map((field) => (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    field.enabled
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    name={field.enabled ? 'check_box' : 'check_box_outline_blank'}
                    size={18}
                  />
                  {field.label}
                </button>
              ))}
            </div>
            {enabledColumns.length === 0 && (
              <p className="mt-3 text-sm text-amber-600">
                Please select at least one field to generate a report.
              </p>
            )}
          </div>

          {/* Status Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Filter by Bed Status</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => toggleStatus('occupied')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  selectedStatuses.has('occupied')
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon
                  name={selectedStatuses.has('occupied') ? 'check_box' : 'check_box_outline_blank'}
                  size={18}
                />
                Occupied
              </button>
              <button
                onClick={() => toggleStatus('vacant')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  selectedStatuses.has('vacant')
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon
                  name={selectedStatuses.has('vacant') ? 'check_box' : 'check_box_outline_blank'}
                  size={18}
                />
                Vacant
              </button>
              <button
                onClick={() => toggleStatus('out_of_service')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  selectedStatuses.has('out_of_service')
                    ? 'bg-slate-100 border-slate-400 text-slate-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon
                  name={selectedStatuses.has('out_of_service') ? 'check_box' : 'check_box_outline_blank'}
                  size={18}
                />
                Out of Service
              </button>
            </div>
            {selectedStatuses.size === 0 && (
              <p className="mt-3 text-sm text-amber-600">
                Please select at least one status to generate a report.
              </p>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Filter by Admission Date</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-600">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 px-3 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-600">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 px-3 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="h-10 px-4 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Clear Dates
                </button>
              )}
            </div>
            {(dateFrom || dateTo) && (
              <p className="mt-3 text-sm text-slate-500">
                Showing residents admitted{' '}
                {dateFrom && dateTo
                  ? `between ${formatDate(dateFrom)} and ${formatDate(dateTo)}`
                  : dateFrom
                  ? `on or after ${formatDate(dateFrom)}`
                  : `on or before ${formatDate(dateTo)}`}
              </p>
            )}
          </div>

          {/* Report Preview */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Report Preview</h3>
              <span className="text-sm text-slate-500">
                {customReportData.length} bed{customReportData.length !== 1 ? 's' : ''}
              </span>
            </div>

            {enabledColumns.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Icon name="table_chart" size={48} className="mx-auto mb-4 text-slate-300" />
                <p>Select fields above to preview the report</p>
              </div>
            ) : customReportData.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Icon name="bed" size={48} className="mx-auto mb-4 text-slate-300" />
                <p>
                  {selectedStatuses.size === 0
                    ? 'Please select at least one status above'
                    : dateFrom || dateTo
                    ? 'No beds found matching the selected filters'
                    : 'No beds found for the selected criteria'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {enabledColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {customReportData.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {enabledColumns.map((col) => (
                          <td key={col.key} className="px-6 py-4 text-sm text-slate-900">
                            {row[col.key as keyof typeof row]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
