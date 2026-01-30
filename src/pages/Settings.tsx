import { useState, useEffect } from 'react';
import { Button, Icon, Modal } from '../components';
import { useWings } from '../hooks/useWings';
import { useRooms, useRoomActions } from '../hooks/useRooms';
import { useBedActions } from '../hooks/useBeds';
import type { WingType, WingWithStats, RoomWithBeds, Room, Bed } from '../types';

const WING_TYPES: { value: WingType; label: string }[] = [
  { value: 'rehab', label: 'Rehabilitation' },
  { value: 'long_term', label: 'Long Term Care' },
  { value: 'hospice', label: 'Hospice' },
  { value: 'memory_care', label: 'Memory Care' },
];

interface BathroomGroup {
  id: string;
  rooms: Room[];
}

interface PayorRates {
  private: number;
  medicare: number;
  medicaid: number;
  managed_care: number;
  hospice: number;
  other: number;
}

const DEFAULT_PAYOR_RATES: PayorRates = {
  private: 0,
  medicare: 0,
  medicaid: 0,
  managed_care: 0,
  hospice: 0,
  other: 0,
};

export function Settings() {
  const [facilityName, setFacilityName] = useState('MediBed Pro Facility');
  const [saved, setSaved] = useState(false);

  // Budget settings state
  const [payorRates, setPayorRates] = useState<PayorRates>(DEFAULT_PAYOR_RATES);
  const [budgetSaved, setBudgetSaved] = useState(false);

  const { wings, loading: wingsLoading, updateWing, refetch: refetchWings } = useWings();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const { createRoom, updateRoom, deleteRoom, getBathroomGroupsForWing } = useRoomActions();
  const { createBed, deleteBed, getNextAvailableBedLetter } = useBedActions();

  // Expanded wings state
  const [expandedWings, setExpandedWings] = useState<Set<string>>(new Set());

  // Edit wing modal state
  const [showEditWingModal, setShowEditWingModal] = useState(false);
  const [selectedWing, setSelectedWing] = useState<WingWithStats | null>(null);
  const [editWingForm, setEditWingForm] = useState({
    name: '',
    wing_type: 'rehab' as WingType,
  });

  // Add room modal state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [addRoomWingId, setAddRoomWingId] = useState<string | null>(null);
  const [addRoomForm, setAddRoomForm] = useState({
    room_number: '',
    has_shared_bathroom: false,
    bathroom_group_option: 'none' as 'none' | 'new' | 'existing',
    selected_bathroom_group_id: '',
  });
  const [bathroomGroups, setBathroomGroups] = useState<BathroomGroup[]>([]);

  // Edit room modal state
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithBeds | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({
    room_number: '',
    has_shared_bathroom: false,
    bathroom_group_option: 'none' as 'none' | 'new' | 'existing',
    selected_bathroom_group_id: '',
  });

  // Add bed modal state
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [addBedRoomId, setAddBedRoomId] = useState<string | null>(null);
  const [addBedForm, setAddBedForm] = useState({
    bed_letter: '',
  });
  const [suggestedBedLetter, setSuggestedBedLetter] = useState('A');

  // Delete confirmation modal state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'room' | 'bed'; id: string; name: string; hasOccupiedBeds?: boolean } | null>(null);

  // General states
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load facility name and budget settings from localStorage
  useEffect(() => {
    const savedFacilityName = localStorage.getItem('facilityName');
    if (savedFacilityName) {
      setFacilityName(savedFacilityName);
    }

    const savedPayorRates = localStorage.getItem('payorRates');
    if (savedPayorRates) {
      try {
        setPayorRates(JSON.parse(savedPayorRates));
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  // Group rooms by wing
  const roomsByWing = rooms.reduce((acc, room) => {
    const wingId = room.wing_id;
    if (!acc[wingId]) {
      acc[wingId] = [];
    }
    acc[wingId].push(room);
    return acc;
  }, {} as Record<string, RoomWithBeds[]>);

  // Calculate total beds
  const totalBeds = wings.reduce((sum, wing) => sum + (wing.total_beds || 0), 0);

  // Calculate case-mix total and derived occupancy target
  const caseMixTotal = Object.values(payorRates).reduce((sum, val) => sum + val, 0);
  const calculatedOccupancyTarget = totalBeds > 0 ? Math.round((caseMixTotal / totalBeds) * 100) : 0;

  const handleSaveFacility = () => {
    localStorage.setItem('facilityName', facilityName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveBudget = () => {
    localStorage.setItem('occupancyTarget', String(calculatedOccupancyTarget));
    localStorage.setItem('payorRates', JSON.stringify(payorRates));
    setBudgetSaved(true);
    setTimeout(() => setBudgetSaved(false), 2000);
  };

  const updatePayorRate = (payor: keyof PayorRates, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    setPayorRates((prev) => ({ ...prev, [payor]: numValue }));
  };

  const toggleWingExpanded = (wingId: string) => {
    setExpandedWings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(wingId)) {
        newSet.delete(wingId);
      } else {
        newSet.add(wingId);
      }
      return newSet;
    });
  };

  // Wing edit handlers
  const handleEditWingClick = (wing: WingWithStats) => {
    setSelectedWing(wing);
    setEditWingForm({
      name: wing.name,
      wing_type: wing.wing_type,
    });
    setActionError(null);
    setShowEditWingModal(true);
  };

  const handleSaveWing = async () => {
    if (!selectedWing) return;

    setSaving(true);
    setActionError(null);

    const { error } = await updateWing(selectedWing.id, {
      name: editWingForm.name,
      wing_type: editWingForm.wing_type,
    });

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowEditWingModal(false);
    setSelectedWing(null);
    refetchWings();
  };

  // Room add handlers
  const handleAddRoomClick = async (wingId: string) => {
    setAddRoomWingId(wingId);
    setAddRoomForm({
      room_number: '',
      has_shared_bathroom: false,
      bathroom_group_option: 'none',
      selected_bathroom_group_id: '',
    });
    setActionError(null);

    // Fetch existing bathroom groups for this wing
    const { data } = await getBathroomGroupsForWing(wingId);
    setBathroomGroups(data);

    setShowAddRoomModal(true);
  };

  const handleSaveNewRoom = async () => {
    if (!addRoomWingId || !addRoomForm.room_number.trim()) return;

    setSaving(true);
    setActionError(null);

    let sharedBathroomGroupId: string | null = null;
    const hasSharedBathroom = addRoomForm.bathroom_group_option !== 'none';

    if (addRoomForm.bathroom_group_option === 'new') {
      sharedBathroomGroupId = crypto.randomUUID();
    } else if (addRoomForm.bathroom_group_option === 'existing') {
      sharedBathroomGroupId = addRoomForm.selected_bathroom_group_id || null;
    }

    const { error } = await createRoom({
      wing_id: addRoomWingId,
      room_number: addRoomForm.room_number.trim(),
      has_shared_bathroom: hasSharedBathroom,
      shared_bathroom_group_id: sharedBathroomGroupId,
    });

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowAddRoomModal(false);
    setAddRoomWingId(null);
    refetchRooms();
    refetchWings();
  };

  // Room edit handlers
  const handleEditRoomClick = async (room: RoomWithBeds) => {
    setSelectedRoom(room);

    // Determine bathroom group option
    let bathroomOption: 'none' | 'new' | 'existing' = 'none';
    if (room.has_shared_bathroom && room.shared_bathroom_group_id) {
      bathroomOption = 'existing';
    }

    setEditRoomForm({
      room_number: room.room_number,
      has_shared_bathroom: room.has_shared_bathroom,
      bathroom_group_option: bathroomOption,
      selected_bathroom_group_id: room.shared_bathroom_group_id || '',
    });
    setActionError(null);

    // Fetch existing bathroom groups for this wing
    const { data } = await getBathroomGroupsForWing(room.wing_id);
    setBathroomGroups(data);

    setShowEditRoomModal(true);
  };

  const handleSaveEditRoom = async () => {
    if (!selectedRoom || !editRoomForm.room_number.trim()) return;

    setSaving(true);
    setActionError(null);

    let sharedBathroomGroupId: string | null = null;
    const hasSharedBathroom = editRoomForm.bathroom_group_option !== 'none';

    if (editRoomForm.bathroom_group_option === 'new') {
      sharedBathroomGroupId = crypto.randomUUID();
    } else if (editRoomForm.bathroom_group_option === 'existing') {
      sharedBathroomGroupId = editRoomForm.selected_bathroom_group_id || null;
    }

    const { error } = await updateRoom(selectedRoom.id, {
      room_number: editRoomForm.room_number.trim(),
      has_shared_bathroom: hasSharedBathroom,
      shared_bathroom_group_id: sharedBathroomGroupId,
    });

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowEditRoomModal(false);
    setSelectedRoom(null);
    refetchRooms();
  };

  // Room delete handlers
  const handleDeleteRoomClick = (room: RoomWithBeds) => {
    const hasOccupiedBeds = room.beds.some((bed) => bed.status === 'occupied');
    setDeleteTarget({
      type: 'room',
      id: room.id,
      name: `Room ${room.room_number}`,
      hasOccupiedBeds,
    });
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setActionError(null);

    if (deleteTarget.type === 'room') {
      const { error } = await deleteRoom(deleteTarget.id);
      if (error) {
        setActionError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await deleteBed(deleteTarget.id);
      if (error) {
        setActionError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowDeleteConfirmModal(false);
    setDeleteTarget(null);
    refetchRooms();
    refetchWings();
  };

  // Bed add handlers
  const handleAddBedClick = async (roomId: string) => {
    setAddBedRoomId(roomId);
    const nextLetter = await getNextAvailableBedLetter(roomId);
    setSuggestedBedLetter(nextLetter);
    setAddBedForm({ bed_letter: nextLetter });
    setActionError(null);
    setShowAddBedModal(true);
  };

  const handleSaveNewBed = async () => {
    if (!addBedRoomId || !addBedForm.bed_letter.trim()) return;

    setSaving(true);
    setActionError(null);

    const { error } = await createBed(addBedRoomId, addBedForm.bed_letter.trim());

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowAddBedModal(false);
    setAddBedRoomId(null);
    refetchRooms();
    refetchWings();
  };

  // Bed delete handlers
  const handleDeleteBedClick = (bed: Bed, roomNumber: string) => {
    if (bed.status !== 'vacant') {
      setActionError('Can only delete vacant beds');
      return;
    }
    setDeleteTarget({
      type: 'bed',
      id: bed.id,
      name: `Bed ${bed.bed_letter} in Room ${roomNumber}`,
    });
    setShowDeleteConfirmModal(true);
  };

  // Helper to get bathroom group display
  const getBathroomGroupDisplay = (room: RoomWithBeds) => {
    if (!room.has_shared_bathroom || !room.shared_bathroom_group_id) {
      return 'Private';
    }

    const groupRooms = rooms.filter(
      (r) => r.shared_bathroom_group_id === room.shared_bathroom_group_id && r.id !== room.id
    );

    if (groupRooms.length === 0) {
      return 'Shared (no other rooms)';
    }

    const roomNumbers = groupRooms.map((r) => r.room_number).join(', ');
    return `Shared with ${roomNumbers}`;
  };

  const loading = wingsLoading || roomsLoading;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0d141b]">Settings</h1>
        <p className="text-[#4c739a]">Configure your facility settings</p>
      </div>

      {/* Facility Information */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="domain" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-semibold text-[#0d141b]">Facility Information</h2>
            <p className="text-sm text-[#4c739a]">Configure your facility details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Facility Name</label>
            <input
              type="text"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="Enter facility name"
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Total Facility Beds</label>
            <div className="px-3 py-2 border border-[#e7edf3] rounded-lg bg-[#f6f7f8]">
              <span className="text-2xl font-bold text-primary-500">{totalBeds}</span>
              <span className="text-sm text-[#4c739a] ml-2">beds across {wings.length} wings</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveFacility}>
            <Icon name="save" size={16} className="mr-2" />
            {saved ? 'Saved!' : 'Save Facility Name'}
          </Button>
        </div>
      </div>

      {/* Budget Settings */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Icon name="payments" size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-[#0d141b]">Budget Settings</h2>
            <p className="text-sm text-[#4c739a]">Configure occupancy targets and payor rates</p>
          </div>
        </div>

        {/* Case-Mix (Budgeted Residents by Payor) */}
        <div>
          <label className="block text-sm font-medium text-[#0d141b] mb-3">
            Case-Mix <span className="font-normal text-[#4c739a]">(Budgeted Residents)</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs text-[#4c739a] mb-1">Private</label>
              <input
                type="number"
                min="0"
                value={payorRates.private || ''}
                onChange={(e) => updatePayorRate('private', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-[#4c739a] mb-1">Medicare</label>
              <input
                type="number"
                min="0"
                value={payorRates.medicare || ''}
                onChange={(e) => updatePayorRate('medicare', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-[#4c739a] mb-1">Medicaid</label>
              <input
                type="number"
                min="0"
                value={payorRates.medicaid || ''}
                onChange={(e) => updatePayorRate('medicaid', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-[#4c739a] mb-1">Managed Care</label>
              <input
                type="number"
                min="0"
                value={payorRates.managed_care || ''}
                onChange={(e) => updatePayorRate('managed_care', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-[#4c739a] mb-1">Hospice</label>
              <input
                type="number"
                min="0"
                value={payorRates.hospice || ''}
                onChange={(e) => updatePayorRate('hospice', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-[#4c739a] mb-1">Other</label>
              <input
                type="number"
                min="0"
                value={payorRates.other || ''}
                onChange={(e) => updatePayorRate('other', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
              />
            </div>
          </div>
        </div>

        {/* Calculated Occupancy Target */}
        <div className="mt-6 p-4 bg-[#f6f7f8] rounded-lg border border-[#e7edf3]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-[#0d141b]">Calculated Occupancy Target</p>
              <p className="text-xs text-[#4c739a]">
                {caseMixTotal} budgeted residents / {totalBeds} total beds
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-green-600">{calculatedOccupancyTarget}%</span>
            </div>
          </div>
          <div className="h-3 bg-[#e7edf3] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                calculatedOccupancyTarget > 100 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(calculatedOccupancyTarget, 100)}%` }}
            />
          </div>
          {calculatedOccupancyTarget > 100 && (
            <p className="text-xs text-red-600 mt-2">
              Warning: Budgeted residents exceed total bed capacity
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSaveBudget}>
            <Icon name="save" size={16} className="mr-2" />
            {budgetSaved ? 'Saved!' : 'Save Budget Settings'}
          </Button>
        </div>
      </div>

      {/* Facility Wings with Rooms and Beds */}
      <div className="bg-white rounded-xl border border-[#e7edf3] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="grid_view" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-semibold text-[#0d141b]">Facility Wings</h2>
            <p className="text-sm text-[#4c739a]">Manage wings, rooms, and beds</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : wings.length > 0 ? (
          <div className="space-y-4">
            {wings.map((wing) => {
              const isExpanded = expandedWings.has(wing.id);
              const wingRooms = roomsByWing[wing.id] || [];

              return (
                <div key={wing.id} className="border border-[#e7edf3] rounded-lg overflow-hidden">
                  {/* Wing Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-[#f6f7f8] cursor-pointer hover:bg-[#eef1f5] transition-colors"
                    onClick={() => toggleWingExpanded(wing.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name={isExpanded ? 'expand_more' : 'chevron_right'}
                        size={20}
                        className="text-[#4c739a]"
                      />
                      <Icon name="domain" size={18} className="text-primary-500" />
                      <div>
                        <span className="font-medium text-[#0d141b]">{wing.name}</span>
                        <span className="text-sm text-[#4c739a] ml-2">
                          ({wing.wing_type.replace('_', ' ')})
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-bold bg-primary-500/10 text-primary-500 rounded">
                        {wing.total_beds} beds
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          wing.occupancy_rate >= 90
                            ? 'bg-red-100 text-red-700'
                            : wing.occupancy_rate >= 70
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {Math.round(wing.occupancy_rate)}% occupied
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditWingClick(wing);
                        }}
                        className="p-1.5 text-[#4c739a] hover:text-primary-500 hover:bg-primary-500/10 rounded transition-colors"
                        title="Edit wing"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Wing Content (Rooms and Beds) */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {wingRooms.length > 0 ? (
                        <>
                          {wingRooms.map((room) => (
                            <div
                              key={room.id}
                              className="border border-[#e7edf3] rounded-lg p-3 bg-white"
                            >
                              {/* Room Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <Icon name="meeting_room" size={18} className="text-[#4c739a]" />
                                  <span className="font-medium text-[#0d141b]">
                                    Room {room.room_number}
                                  </span>
                                  <span className="text-xs text-[#4c739a] bg-[#f6f7f8] px-2 py-0.5 rounded">
                                    {getBathroomGroupDisplay(room)}
                                  </span>
                                  <span className="text-xs text-[#4c739a]">
                                    {room.beds.length} bed{room.beds.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditRoomClick(room)}
                                    className="p-1.5 text-[#4c739a] hover:text-primary-500 hover:bg-primary-500/10 rounded transition-colors"
                                    title="Edit room"
                                  >
                                    <Icon name="edit" size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRoomClick(room)}
                                    className="p-1.5 text-[#4c739a] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Delete room"
                                  >
                                    <Icon name="delete" size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Beds */}
                              <div className="pl-6 space-y-1">
                                {room.beds.map((bed) => (
                                  <div
                                    key={bed.id}
                                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#f6f7f8]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Icon
                                        name="bed"
                                        size={14}
                                        className={
                                          bed.status === 'occupied'
                                            ? 'text-blue-500'
                                            : bed.status === 'out_of_service'
                                            ? 'text-red-500'
                                            : 'text-green-500'
                                        }
                                      />
                                      <span className="text-sm text-[#0d141b]">
                                        Bed {bed.bed_letter}
                                      </span>
                                      <span
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                          bed.status === 'occupied'
                                            ? 'bg-blue-100 text-blue-700'
                                            : bed.status === 'out_of_service'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}
                                      >
                                        {bed.status === 'out_of_service'
                                          ? 'Out of Service'
                                          : bed.status.charAt(0).toUpperCase() + bed.status.slice(1)}
                                      </span>
                                      {bed.resident && (
                                        <span className="text-xs text-[#4c739a]">
                                          ({bed.resident.first_name} {bed.resident.last_name})
                                        </span>
                                      )}
                                    </div>
                                    {bed.status === 'vacant' && (
                                      <button
                                        onClick={() => handleDeleteBedClick(bed, room.room_number)}
                                        className="p-1 text-[#4c739a] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Delete bed"
                                      >
                                        <Icon name="delete" size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {room.beds.length === 0 && (
                                  <div className="text-xs text-[#4c739a] italic py-1">
                                    No beds in this room
                                  </div>
                                )}

                                {/* Add Bed Button */}
                                <button
                                  onClick={() => handleAddBedClick(room.id)}
                                  className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 py-1"
                                >
                                  <Icon name="add" size={14} />
                                  Add Bed
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-sm text-[#4c739a] italic text-center py-4">
                          No rooms in this wing
                        </div>
                      )}

                      {/* Add Room Button */}
                      <button
                        onClick={() => handleAddRoomClick(wing.id)}
                        className="flex items-center gap-2 w-full justify-center py-2 border border-dashed border-[#c4d4e5] rounded-lg text-primary-500 hover:bg-primary-500/5 hover:border-primary-500 transition-colors"
                      >
                        <Icon name="add" size={18} />
                        <span className="text-sm font-medium">Add Room</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#f6f7f8] rounded-lg border border-[#e7edf3]">
            <Icon name="domain" size={48} className="text-[#c4d4e5] mx-auto mb-3" />
            <p className="text-[#4c739a]">No wings configured</p>
          </div>
        )}

        {/* Summary Cards */}
        {wings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">{wings.length}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Wings</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-primary-500">{rooms.length}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Rooms</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-primary-500">{totalBeds}</p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Total Beds</p>
            </div>
            <div className="bg-[#f6f7f8] rounded-lg p-4 border border-[#e7edf3]">
              <p className="text-2xl font-bold text-[#0d141b]">
                {wings.reduce((sum, w) => sum + w.occupied_beds, 0)}
              </p>
              <p className="text-xs text-[#4c739a] uppercase font-medium">Occupied Beds</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Wing Modal */}
      <Modal
        isOpen={showEditWingModal}
        onClose={() => {
          setShowEditWingModal(false);
          setSelectedWing(null);
          setActionError(null);
        }}
        title="Edit Wing"
        size="md"
      >
        {selectedWing && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Wing Name</label>
              <input
                type="text"
                value={editWingForm.name}
                onChange={(e) => setEditWingForm({ ...editWingForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter wing name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Wing Type</label>
              <select
                value={editWingForm.wing_type}
                onChange={(e) => setEditWingForm({ ...editWingForm, wing_type: e.target.value as WingType })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {WING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditWingModal(false);
                  setSelectedWing(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveWing} loading={saving} disabled={!editWingForm.name.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Room Modal */}
      <Modal
        isOpen={showAddRoomModal}
        onClose={() => {
          setShowAddRoomModal(false);
          setAddRoomWingId(null);
          setActionError(null);
        }}
        title="Add Room"
        size="md"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Room Number</label>
            <input
              type="text"
              value={addRoomForm.room_number}
              onChange={(e) => setAddRoomForm({ ...addRoomForm, room_number: e.target.value })}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., 101, 102A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-2">Bathroom Type</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="bathroom_option"
                  checked={addRoomForm.bathroom_group_option === 'none'}
                  onChange={() => setAddRoomForm({ ...addRoomForm, bathroom_group_option: 'none' })}
                  className="text-primary-500"
                />
                <span className="text-sm text-[#0d141b]">Private bathroom</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="bathroom_option"
                  checked={addRoomForm.bathroom_group_option === 'new'}
                  onChange={() => setAddRoomForm({ ...addRoomForm, bathroom_group_option: 'new' })}
                  className="text-primary-500"
                />
                <span className="text-sm text-[#0d141b]">Create new shared bathroom group</span>
              </label>
              {bathroomGroups.length > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bathroom_option"
                    checked={addRoomForm.bathroom_group_option === 'existing'}
                    onChange={() => setAddRoomForm({ ...addRoomForm, bathroom_group_option: 'existing' })}
                    className="text-primary-500"
                  />
                  <span className="text-sm text-[#0d141b]">Join existing bathroom group</span>
                </label>
              )}
            </div>

            {addRoomForm.bathroom_group_option === 'existing' && bathroomGroups.length > 0 && (
              <div className="mt-3 pl-6">
                <select
                  value={addRoomForm.selected_bathroom_group_id}
                  onChange={(e) =>
                    setAddRoomForm({ ...addRoomForm, selected_bathroom_group_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                >
                  <option value="">Select a group...</option>
                  {bathroomGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      Shared by: {group.rooms.map((r) => r.room_number).join(', ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddRoomModal(false);
                setAddRoomWingId(null);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewRoom}
              loading={saving}
              disabled={!addRoomForm.room_number.trim()}
            >
              Add Room
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Room Modal */}
      <Modal
        isOpen={showEditRoomModal}
        onClose={() => {
          setShowEditRoomModal(false);
          setSelectedRoom(null);
          setActionError(null);
        }}
        title="Edit Room"
        size="md"
      >
        {selectedRoom && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-1">Room Number</label>
              <input
                type="text"
                value={editRoomForm.room_number}
                onChange={(e) => setEditRoomForm({ ...editRoomForm, room_number: e.target.value })}
                className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., 101, 102A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0d141b] mb-2">Bathroom Type</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit_bathroom_option"
                    checked={editRoomForm.bathroom_group_option === 'none'}
                    onChange={() => setEditRoomForm({ ...editRoomForm, bathroom_group_option: 'none' })}
                    className="text-primary-500"
                  />
                  <span className="text-sm text-[#0d141b]">Private bathroom</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit_bathroom_option"
                    checked={editRoomForm.bathroom_group_option === 'new'}
                    onChange={() => setEditRoomForm({ ...editRoomForm, bathroom_group_option: 'new' })}
                    className="text-primary-500"
                  />
                  <span className="text-sm text-[#0d141b]">Create new shared bathroom group</span>
                </label>
                {bathroomGroups.length > 0 && (
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="edit_bathroom_option"
                      checked={editRoomForm.bathroom_group_option === 'existing'}
                      onChange={() =>
                        setEditRoomForm({ ...editRoomForm, bathroom_group_option: 'existing' })
                      }
                      className="text-primary-500"
                    />
                    <span className="text-sm text-[#0d141b]">Join existing bathroom group</span>
                  </label>
                )}
              </div>

              {editRoomForm.bathroom_group_option === 'existing' && bathroomGroups.length > 0 && (
                <div className="mt-3 pl-6">
                  <select
                    value={editRoomForm.selected_bathroom_group_id}
                    onChange={(e) =>
                      setEditRoomForm({ ...editRoomForm, selected_bathroom_group_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                  >
                    <option value="">Select a group...</option>
                    {bathroomGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        Shared by: {group.rooms.map((r) => r.room_number).join(', ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditRoomModal(false);
                  setSelectedRoom(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditRoom}
                loading={saving}
                disabled={!editRoomForm.room_number.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Bed Modal */}
      <Modal
        isOpen={showAddBedModal}
        onClose={() => {
          setShowAddBedModal(false);
          setAddBedRoomId(null);
          setActionError(null);
        }}
        title="Add Bed"
        size="sm"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#0d141b] mb-1">Bed Letter</label>
            <input
              type="text"
              value={addBedForm.bed_letter}
              onChange={(e) => setAddBedForm({ bed_letter: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-[#e7edf3] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., A, B, C"
              maxLength={2}
            />
            <p className="text-xs text-[#4c739a] mt-1">Suggested: {suggestedBedLetter}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddBedModal(false);
                setAddBedRoomId(null);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewBed}
              loading={saving}
              disabled={!addBedForm.bed_letter.trim()}
            >
              Add Bed
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setDeleteTarget(null);
          setActionError(null);
        }}
        title={`Delete ${deleteTarget?.type === 'room' ? 'Room' : 'Bed'}`}
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <p className="text-[#0d141b]">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>

            {deleteTarget.type === 'room' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <Icon name="warning" size={16} className="inline mr-1" />
                {deleteTarget.hasOccupiedBeds
                  ? 'Warning: This room has occupied beds. All beds will be deleted and residents will be unassigned.'
                  : 'All beds in this room will also be deleted.'}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e7edf3]">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteTarget(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} loading={saving}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
