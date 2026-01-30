import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bed,
  Users,
  Menu,
  X,
  LogOut,
  Search,
  Bell,
  HelpCircle,
  Plus,
  Building2,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useWards } from '../hooks/useWards';
import { Modal, Button } from './index';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  onSignOut?: () => void;
  userName?: string;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patients', label: 'Residents', icon: Users },
  { path: '/beds', label: 'Rooms', icon: Bed },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children, onSignOut, userName }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    floor: 1,
    capacity: 10,
  });
  const [saving, setSaving] = useState(false);
  const location = useLocation();

  const { wards, createWard } = useWards();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    await createWard({
      name: formData.name,
      floor: formData.floor,
      capacity: formData.capacity,
    });

    setSaving(false);
    setShowAddUnitModal(false);
    setFormData({ name: '', floor: 1, capacity: 10 });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f6f7f8]">
      {/* Top Header */}
      <header className="flex h-16 items-center justify-between border-b border-[#e7edf3] bg-white px-4 lg:px-10 z-20 shrink-0">
        <div className="flex items-center gap-4 lg:gap-8">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-[#137fec]">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z" fill="currentColor"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z" fill="currentColor"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight hidden sm:block">MediBed Pro</h2>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'text-sm font-medium h-16 flex items-center border-b-2 transition-colors',
                    isActive
                      ? 'text-[#137fec] border-[#137fec] font-semibold'
                      : 'text-[#4c739a] border-transparent hover:text-[#137fec]'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          {/* Search */}
          <div className="hidden md:flex w-64 h-10 items-center rounded-lg bg-[#e7edf3] px-4 gap-2">
            <Search className="w-5 h-5 text-[#4c739a]" />
            <input
              type="text"
              placeholder="Search resident or room..."
              className="w-full bg-transparent border-none text-sm placeholder:text-[#4c739a] focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-[#e7edf3] text-[#0d141b] hover:bg-[#d9e2ec]">
              <Bell className="w-5 h-5" />
            </button>
            <button className="hidden sm:flex items-center justify-center rounded-lg h-10 w-10 bg-[#e7edf3] text-[#0d141b] hover:bg-[#d9e2ec]">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#137fec] flex items-center justify-center text-white font-semibold">
              {userName ? userName.charAt(0).toUpperCase() : 'A'}
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:relative top-0 lg:top-auto left-0 z-50 lg:z-auto h-full w-72 border-r border-[#e7edf3] bg-white flex flex-col p-4 overflow-y-auto transform transition-transform lg:translate-x-0 shrink-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Mobile nav links */}
          <div className="lg:hidden mb-6 pt-8">
            <h3 className="text-xs font-bold text-[#4c739a] uppercase tracking-wider mb-4 px-3">Navigation</h3>
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                      isActive
                        ? 'bg-[#137fec]/10 text-[#137fec]'
                        : 'text-[#4c739a] hover:bg-slate-50'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Facility Map - Units Table */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xs font-bold text-[#4c739a] uppercase tracking-wider">Facility Units</h3>
              <button
                onClick={() => setShowAddUnitModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#137fec] hover:bg-[#137fec]/10 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Unit
              </button>
            </div>

            {/* Units Table */}
            {wards.length > 0 ? (
              <div className="bg-[#f6f7f8] rounded-lg overflow-hidden border border-[#e7edf3]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e7edf3]">
                      <th className="text-left px-3 py-2 font-bold text-[#4c739a]">Unit</th>
                      <th className="text-center px-2 py-2 font-bold text-[#4c739a]">Floor</th>
                      <th className="text-center px-2 py-2 font-bold text-[#4c739a]">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wards.map((ward) => (
                      <tr key={ward.id} className="border-b border-[#e7edf3] last:border-b-0 hover:bg-white transition-colors">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3 h-3 text-[#137fec]" />
                            <span className="font-medium text-[#0d141b] truncate max-w-[100px]">{ward.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-2 py-2 text-[#4c739a]">{ward.floor}</td>
                        <td className="text-center px-2 py-2">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 bg-[#137fec]/10 text-[#137fec] font-medium rounded">
                            {ward.capacity || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-[#f6f7f8] rounded-lg p-4 text-center border border-[#e7edf3]">
                <Building2 className="w-8 h-8 text-[#c4d4e5] mx-auto mb-2" />
                <p className="text-xs text-[#4c739a]">No units configured</p>
                <button
                  onClick={() => setShowAddUnitModal(true)}
                  className="mt-2 text-xs font-medium text-[#137fec] hover:underline"
                >
                  Add your first unit
                </button>
              </div>
            )}

            {/* Summary Stats */}
            {wards.length > 0 && (
              <div className="mt-3 flex gap-2">
                <div className="flex-1 bg-[#f6f7f8] rounded-lg p-2 text-center border border-[#e7edf3]">
                  <p className="text-lg font-bold text-[#0d141b]">{wards.length}</p>
                  <p className="text-[10px] text-[#4c739a] uppercase">Units</p>
                </div>
                <div className="flex-1 bg-[#f6f7f8] rounded-lg p-2 text-center border border-[#e7edf3]">
                  <p className="text-lg font-bold text-[#0d141b]">
                    {wards.reduce((sum, w) => sum + (w.capacity || 0), 0)}
                  </p>
                  <p className="text-[10px] text-[#4c739a] uppercase">Total Beds</p>
                </div>
              </div>
            )}
          </div>

          {/* Occupancy Alert */}
          <div className="mt-auto pt-4 border-t border-[#e7edf3]">
            <div className="bg-[#137fec]/5 rounded-lg p-4">
              <p className="text-xs font-bold text-[#137fec] mb-1">OCCUPANCY ALERT</p>
              <p className="text-xs text-[#4c739a] leading-tight">
                North Wing reached 95% capacity. Review pending transfers.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Add Unit Modal */}
      <Modal
        isOpen={showAddUnitModal}
        onClose={() => {
          setShowAddUnitModal(false);
          setFormData({ name: '', floor: 1, capacity: 10 });
        }}
        title="Add New Unit"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">
              Unit Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., North Wing, Memory Care"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Floor *
              </label>
              <input
                type="number"
                required
                min="1"
                max="99"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">
                Unit Size (Beds) *
              </label>
              <input
                type="number"
                required
                min="1"
                max="999"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddUnitModal(false);
                setFormData({ name: '', floor: 1, capacity: 10 });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add Unit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
