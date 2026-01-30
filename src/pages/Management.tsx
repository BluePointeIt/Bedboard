import { useState, useEffect } from 'react';
import { Plus, Building2, DoorOpen, Bed, Upload, Settings, Target } from 'lucide-react';
import { Button, Modal, CSVImport } from '../components';
import { useWards } from '../hooks/useWards';
import { useRooms } from '../hooks/useRooms';
import { useBedActions } from '../hooks/useBeds';
import type { Room } from '../types';

interface CaseMix {
  private: number;
  medicare: number;
  medicaid: number;
  managedCare: number;
}

export function Management() {
  const [showWardModal, setShowWardModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [showRoomImportModal, setShowRoomImportModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [wardForm, setWardForm] = useState({ name: '', floor: 1, description: '' });
  const [roomForm, setRoomForm] = useState({ ward_id: '', room_number: '', room_type: 'ward' as Room['room_type'] });
  const [bedForm, setBedForm] = useState({ room_id: '', bed_number: '', status: 'available' as const });

  // Configuration state
  const [occupancyTarget, setOccupancyTarget] = useState(85);
  const [caseMix, setCaseMix] = useState<CaseMix>({
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
    if (savedCaseMix) setCaseMix(JSON.parse(savedCaseMix));
  }, []);

  // Save configuration to localStorage
  const saveOccupancyTarget = (value: number) => {
    setOccupancyTarget(value);
    localStorage.setItem('occupancyTarget', value.toString());
    // Dispatch storage event for Dashboard to pick up
    window.dispatchEvent(new Event('storage'));
  };

  const saveCaseMix = (key: keyof CaseMix, value: number) => {
    const newCaseMix = { ...caseMix, [key]: value };
    setCaseMix(newCaseMix);
    localStorage.setItem('caseMix', JSON.stringify(newCaseMix));
  };

  const caseMixTotal = caseMix.private + caseMix.medicare + caseMix.medicaid + caseMix.managedCare;

  const { wards, createWard, refetch: refetchWards } = useWards();
  const { rooms, createRoom, bulkCreateRooms, refetch: refetchRooms } = useRooms();
  const { createBed } = useBedActions();

  const roomColumns = [
    { key: 'ward_name', label: 'Ward Name', required: true },
    { key: 'room_number', label: 'Room Number', required: true },
    { key: 'room_type', label: 'Room Type', required: true },
  ];

  const handleImportRooms = async (data: Record<string, string>[]) => {
    const roomsData: Omit<Room, 'id' | 'created_at'>[] = [];
    const errors: string[] = [];

    for (const row of data) {
      const wardName = row.ward_name || row.ward || '';
      const ward = wards.find(w => w.name.toLowerCase() === wardName.toLowerCase());

      if (!ward) {
        errors.push(`Room ${row.room_number}: Ward "${wardName}" not found`);
        continue;
      }

      const roomType = (row.room_type?.toLowerCase() || 'ward') as Room['room_type'];
      if (!['private', 'semi-private', 'ward'].includes(roomType)) {
        errors.push(`Room ${row.room_number}: Invalid room type "${row.room_type}"`);
        continue;
      }

      roomsData.push({
        ward_id: ward.id,
        room_number: row.room_number || '',
        room_type: roomType,
      });
    }

    if (roomsData.length > 0) {
      const result = await bulkCreateRooms(roomsData);
      return {
        success: result.success,
        errors: [...errors, ...result.errors],
      };
    }

    return { success: 0, errors };
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createWard(wardForm);
    setSaving(false);
    setShowWardModal(false);
    setWardForm({ name: '', floor: 1, description: '' });
    refetchWards();
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createRoom(roomForm);
    setSaving(false);
    setShowRoomModal(false);
    setRoomForm({ ward_id: '', room_number: '', room_type: 'ward' });
    refetchRooms();
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createBed(bedForm.room_id, bedForm.bed_number, bedForm.status);
    setSaving(false);
    setShowBedModal(false);
    setBedForm({ room_id: '', bed_number: '', status: 'available' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Management</h1>
        <p className="text-slate-500">Add and manage wards, rooms, and beds</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Add Ward Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Wards</h2>
              <p className="text-sm text-slate-500">{wards.length} total</p>
            </div>
          </div>
          <Button onClick={() => setShowWardModal(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Ward
          </Button>
        </div>

        {/* Add Room Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-success-50 flex items-center justify-center">
              <DoorOpen className="w-6 h-6 text-success-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Rooms</h2>
              <p className="text-sm text-slate-500">{rooms.length} total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowRoomModal(true)} className="flex-1" disabled={wards.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
            <Button variant="secondary" onClick={() => setShowRoomImportModal(true)} disabled={wards.length === 0}>
              <Upload className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Add Bed Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-warning-50 flex items-center justify-center">
              <Bed className="w-6 h-6 text-warning-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Beds</h2>
              <p className="text-sm text-slate-500">Add new beds</p>
            </div>
          </div>
          <Button onClick={() => setShowBedModal(true)} className="w-full" disabled={rooms.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Add Bed
          </Button>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" />
          <h3 className="font-semibold text-slate-900">Configuration</h3>
        </div>
        <div className="p-4 space-y-6">
          {/* Occupancy Target */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary-600" />
              <h4 className="font-medium text-slate-900">Occupancy Target</h4>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                max="100"
                value={occupancyTarget}
                onChange={(e) => saveOccupancyTarget(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-slate-500">%</span>
              <p className="text-sm text-slate-500">Target occupancy percentage for the dashboard</p>
            </div>
          </div>

          {/* Case Mix */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3">Case Mix Target</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Private</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={caseMix.private}
                    onChange={(e) => saveCaseMix('private', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Medicare</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={caseMix.medicare}
                    onChange={(e) => saveCaseMix('medicare', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Medicaid</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={caseMix.medicaid}
                    onChange={(e) => saveCaseMix('medicaid', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Managed Care</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={caseMix.managedCare}
                    onChange={(e) => saveCaseMix('managedCare', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
            </div>
            <p className={`text-sm mt-2 ${caseMixTotal === 100 ? 'text-green-600' : 'text-amber-600'}`}>
              Total: {caseMixTotal}% {caseMixTotal !== 100 && '(should equal 100%)'}
            </p>
          </div>
        </div>
      </div>

      {/* Wards List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">All Wards</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {wards.map((ward) => (
            <div key={ward.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{ward.name}</p>
                <p className="text-sm text-slate-500">Floor {ward.floor} {ward.description && `- ${ward.description}`}</p>
              </div>
              <span className="text-sm text-slate-400">
                {rooms.filter(r => r.ward_id === ward.id).length} rooms
              </span>
            </div>
          ))}
          {wards.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500">
              No wards yet. Add one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Rooms List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">All Rooms</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {rooms.map((room) => {
            const ward = wards.find(w => w.id === room.ward_id);
            return (
              <div key={room.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Room {room.room_number}</p>
                  <p className="text-sm text-slate-500">{ward?.name} - {room.room_type}</p>
                </div>
              </div>
            );
          })}
          {rooms.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500">
              No rooms yet. Add a ward first, then add rooms.
            </div>
          )}
        </div>
      </div>

      {/* Add Ward Modal */}
      <Modal isOpen={showWardModal} onClose={() => setShowWardModal(false)} title="Add New Ward">
        <form onSubmit={handleCreateWard} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ward Name *</label>
            <input
              type="text"
              required
              value={wardForm.name}
              onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
              placeholder="e.g., Emergency, ICU, Pediatrics"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Floor *</label>
            <input
              type="number"
              required
              min="1"
              value={wardForm.floor}
              onChange={(e) => setWardForm({ ...wardForm, floor: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={wardForm.description}
              onChange={(e) => setWardForm({ ...wardForm, description: e.target.value })}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowWardModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Ward</Button>
          </div>
        </form>
      </Modal>

      {/* Add Room Modal */}
      <Modal isOpen={showRoomModal} onClose={() => setShowRoomModal(false)} title="Add New Room">
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ward *</label>
            <select
              required
              value={roomForm.ward_id}
              onChange={(e) => setRoomForm({ ...roomForm, ward_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a ward...</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>{ward.name} (Floor {ward.floor})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Room Number *</label>
            <input
              type="text"
              required
              value={roomForm.room_number}
              onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
              placeholder="e.g., 101, ICU-1, E201"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Room Type *</label>
            <select
              required
              value={roomForm.room_type}
              onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value as Room['room_type'] })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="private">Private (1 bed)</option>
              <option value="semi-private">Semi-Private (2 beds)</option>
              <option value="ward">Ward (4+ beds)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowRoomModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Room</Button>
          </div>
        </form>
      </Modal>

      {/* Add Bed Modal */}
      <Modal isOpen={showBedModal} onClose={() => setShowBedModal(false)} title="Add New Bed">
        <form onSubmit={handleCreateBed} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Room *</label>
            <select
              required
              value={bedForm.room_id}
              onChange={(e) => setBedForm({ ...bedForm, room_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a room...</option>
              {rooms.map((room) => {
                const ward = wards.find(w => w.id === room.ward_id);
                return (
                  <option key={room.id} value={room.id}>
                    {ward?.name} - Room {room.room_number}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bed Number/Label *</label>
            <input
              type="text"
              required
              value={bedForm.bed_number}
              onChange={(e) => setBedForm({ ...bedForm, bed_number: e.target.value })}
              placeholder="e.g., A, B, 1, 2"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial Status</label>
            <select
              value={bedForm.status}
              onChange={(e) => setBedForm({ ...bedForm, status: e.target.value as 'available' })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowBedModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Bed</Button>
          </div>
        </form>
      </Modal>

      {/* Import Rooms Modal */}
      <Modal isOpen={showRoomImportModal} onClose={() => setShowRoomImportModal(false)} title="Import Rooms from CSV" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Ward names in the CSV must match existing wards exactly.
              Create wards first before importing rooms.
            </p>
          </div>
          <CSVImport
            onImport={handleImportRooms}
            columns={roomColumns}
            templateName="rooms"
          />
        </div>
      </Modal>
    </div>
  );
}
