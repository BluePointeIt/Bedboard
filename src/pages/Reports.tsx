import { FileText, Download, Calendar, TrendingUp, Users, Bed } from 'lucide-react';

const reportTypes = [
  {
    id: 'occupancy',
    title: 'Occupancy Report',
    description: 'Daily, weekly, and monthly bed occupancy statistics',
    icon: Bed,
    lastGenerated: '2024-01-15',
  },
  {
    id: 'census',
    title: 'Census Report',
    description: 'Current resident census with demographics',
    icon: Users,
    lastGenerated: '2024-01-15',
  },
  {
    id: 'admissions',
    title: 'Admissions & Discharges',
    description: 'Track resident movement in and out of facility',
    icon: TrendingUp,
    lastGenerated: '2024-01-14',
  },
  {
    id: 'scheduled',
    title: 'Scheduled Reports',
    description: 'Configure automated report generation',
    icon: Calendar,
    lastGenerated: null,
  },
];

export function Reports() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0d141b]">Reports</h1>
          <p className="text-sm text-[#4c739a] mt-1">Generate and download facility reports</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e7edf3] text-[#0d141b] text-sm font-medium hover:bg-[#d9e2ec]">
            <Calendar className="w-4 h-4" />
            Schedule Report
          </button>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className="bg-white border border-[#e7edf3] rounded-xl p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#137fec]/10 flex items-center justify-center">
                  <report.icon className="w-6 h-6 text-[#137fec]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0d141b]">{report.title}</h3>
                  <p className="text-sm text-[#4c739a] mt-1">{report.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#e7edf3]">
              {report.lastGenerated ? (
                <span className="text-xs text-[#4c739a]">
                  Last generated: {report.lastGenerated}
                </span>
              ) : (
                <span className="text-xs text-[#4c739a]">Not configured</span>
              )}
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#137fec] text-white text-sm font-medium hover:bg-[#0d6edb]">
                <Download className="w-4 h-4" />
                Generate
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-white border border-[#e7edf3] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-[#137fec]" />
          <h2 className="font-semibold text-[#0d141b]">Report History</h2>
        </div>
        <div className="text-center py-8 text-[#4c739a]">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No reports generated yet</p>
          <p className="text-xs mt-1">Generate your first report to see history</p>
        </div>
      </div>
    </div>
  );
}
