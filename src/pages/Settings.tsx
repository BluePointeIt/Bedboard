import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button, Icon, Modal } from '../components';
import { useWings } from '../hooks/useWings';
import { useRooms, useRoomActions } from '../hooks/useRooms';
import { useBedActions } from '../hooks/useBeds';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { LayoutContext } from '../components/AppLayout';
import { isSuperuser } from '../lib/permissions';
import type { WingType, WingWithStats, RoomWithBeds, Room, Bed } from '../types';
import {
  validateNonNegativeNumber,
  validateRoomNumber,
  validateBedLetter,
  validateCSVFile,
  validateCSVRow,
} from '../lib/validation';

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

type MonthKey = 'january' | 'february' | 'march' | 'april' | 'may' | 'june' |
                'july' | 'august' | 'september' | 'october' | 'november' | 'december';

type MonthlyPayorRates = Record<MonthKey, PayorRates>;

const MONTHS: { key: MonthKey; label: string; short: string }[] = [
  { key: 'january', label: 'January', short: 'Jan' },
  { key: 'february', label: 'February', short: 'Feb' },
  { key: 'march', label: 'March', short: 'Mar' },
  { key: 'april', label: 'April', short: 'Apr' },
  { key: 'may', label: 'May', short: 'May' },
  { key: 'june', label: 'June', short: 'Jun' },
  { key: 'july', label: 'July', short: 'Jul' },
  { key: 'august', label: 'August', short: 'Aug' },
  { key: 'september', label: 'September', short: 'Sep' },
  { key: 'october', label: 'October', short: 'Oct' },
  { key: 'november', label: 'November', short: 'Nov' },
  { key: 'december', label: 'December', short: 'Dec' },
];

const DEFAULT_PAYOR_RATES: PayorRates = {
  private: 0,
  medicare: 0,
  medicaid: 0,
  managed_care: 0,
  hospice: 0,
  other: 0,
};

const DEFAULT_MONTHLY_RATES: MonthlyPayorRates = {
  january: { ...DEFAULT_PAYOR_RATES },
  february: { ...DEFAULT_PAYOR_RATES },
  march: { ...DEFAULT_PAYOR_RATES },
  april: { ...DEFAULT_PAYOR_RATES },
  may: { ...DEFAULT_PAYOR_RATES },
  june: { ...DEFAULT_PAYOR_RATES },
  july: { ...DEFAULT_PAYOR_RATES },
  august: { ...DEFAULT_PAYOR_RATES },
  september: { ...DEFAULT_PAYOR_RATES },
  october: { ...DEFAULT_PAYOR_RATES },
  november: { ...DEFAULT_PAYOR_RATES },
  december: { ...DEFAULT_PAYOR_RATES },
};

export function Settings() {
  const { currentFacility } = useOutletContext<LayoutContext>();
  const { profile } = useAuth();
  const canEditBudgetedBeds = isSuperuser(profile);

  // Budget settings state
  const [monthlyRates, setMonthlyRates] = useState<MonthlyPayorRates>(DEFAULT_MONTHLY_RATES);
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [budgetLoading, setBudgetLoading] = useState(true);

  const { wings, loading: wingsLoading, createWing, updateWing, deleteWing, refetch: refetchWings } = useWings({ facilityId: currentFacility?.id });
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms({ facilityId: currentFacility?.id });
  const { createRoom, updateRoom, deleteRoom, getBathroomGroupsForWing } = useRoomActions();
  const { createBed, deleteBed, getNextAvailableBedLetter } = useBedActions();

  // Expanded wings state
  const [expandedWings, setExpandedWings] = useState<Set<string>>(new Set());

  // Add wing modal state
  const [showAddWingModal, setShowAddWingModal] = useState(false);
  const [addWingForm, setAddWingForm] = useState({
    name: '',
    wing_type: 'rehab' as WingType,
  });

  // Edit wing modal state
  const [showEditWingModal, setShowEditWingModal] = useState(false);
  const [selectedWing, setSelectedWing] = useState<WingWithStats | null>(null);
  const [editWingForm, setEditWingForm] = useState({
    name: '',
    wing_type: 'rehab' as WingType,
  });

  // Delete wing confirmation state
  const [showDeleteWingConfirmModal, setShowDeleteWingConfirmModal] = useState(false);
  const [wingToDelete, setWingToDelete] = useState<WingWithStats | null>(null);

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

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<{
    room_number: string;
    wing_name: string;
    beds: string;
    shared_bathroom: string;
    bathroom_group: string;
  }>>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Load case-mix settings from Supabase
  useEffect(() => {
    async function loadCaseMix() {
      if (!currentFacility?.id) {
        setBudgetLoading(false);
        return;
      }

      setBudgetLoading(true);
      const { data, error } = await supabase
        .from('facility_settings')
        .select('setting_value')
        .eq('facility_id', currentFacility.id)
        .eq('setting_key', 'case_mix_monthly')
        .single();

      if (!error && data?.setting_value) {
        // Merge with defaults in case new months are added
        const loaded = data.setting_value as Partial<MonthlyPayorRates>;
        const merged = { ...DEFAULT_MONTHLY_RATES };
        for (const month of MONTHS) {
          if (loaded[month.key]) {
            merged[month.key] = { ...DEFAULT_PAYOR_RATES, ...loaded[month.key] };
          }
        }
        setMonthlyRates(merged);
      } else {
        // Check for legacy single-value case_mix and migrate
        const { data: legacyData } = await supabase
          .from('facility_settings')
          .select('setting_value')
          .eq('facility_id', currentFacility.id)
          .eq('setting_key', 'case_mix')
          .single();

        if (legacyData?.setting_value) {
          // Apply legacy values to all months
          const legacyRates = legacyData.setting_value as PayorRates;
          const migrated = { ...DEFAULT_MONTHLY_RATES };
          for (const month of MONTHS) {
            migrated[month.key] = { ...legacyRates };
          }
          setMonthlyRates(migrated);
        } else {
          setMonthlyRates(DEFAULT_MONTHLY_RATES);
        }
      }
      setBudgetLoading(false);
    }
    loadCaseMix();
  }, [currentFacility?.id]);

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

  // Calculate case-mix totals (monthly and annual)
  const getMonthTotal = (month: MonthKey): number => {
    const rates = monthlyRates[month];
    return Object.values(rates).reduce((sum, val) => sum + val, 0);
  };

  const getPayorAnnualTotal = (payor: keyof PayorRates): number => {
    return MONTHS.reduce((sum, m) => sum + monthlyRates[m.key][payor], 0);
  };

  const annualTotal = MONTHS.reduce((sum, m) => sum + getMonthTotal(m.key), 0);
  const averageMonthlyBudget = Math.round(annualTotal / 12);
  const calculatedOccupancyTarget = totalBeds > 0 ? Math.round((averageMonthlyBudget / totalBeds) * 100) : 0;

  const handleSaveBudget = async () => {
    if (!currentFacility?.id) return;

    const { error } = await supabase
      .from('facility_settings')
      .upsert({
        facility_id: currentFacility.id,
        setting_key: 'case_mix_monthly',
        setting_value: monthlyRates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'facility_id,setting_key' });

    if (!error) {
      setBudgetSaved(true);
      setTimeout(() => setBudgetSaved(false), 2000);
    }
  };

  const updateMonthlyRate = (month: MonthKey, payor: keyof PayorRates, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    const validation = validateNonNegativeNumber(numValue, payor);
    if (validation.valid) {
      setMonthlyRates((prev) => ({
        ...prev,
        [month]: { ...prev[month], [payor]: numValue },
      }));
    }
  };

  // Import handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate CSV file
    const fileValidation = validateCSVFile(file);
    if (!fileValidation.valid) {
      setImportError(fileValidation.error || 'Invalid file');
      return;
    }

    setImportFile(file);
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          setImportError('File must contain a header row and at least one data row');
          return;
        }

        // Parse CSV (expecting: room_number, wing_name, beds, shared_bathroom, bathroom_group)
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          return {
            room_number: values[0] || '',
            wing_name: values[1] || '',
            beds: values[2] || 'A',
            shared_bathroom: values[3] || 'no',
            bathroom_group: values[4] || '',
          };
        }).filter(row => row.room_number && row.wing_name);

        if (rows.length === 0) {
          setImportError('No valid rows found in file');
          return;
        }

        setImportPreview(rows);
      } catch {
        setImportError('Failed to parse file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (importPreview.length === 0) return;

    // Calculate total beds being imported (superadmins can bypass limit)
    const budgetedBeds = currentFacility?.total_beds || 0;
    if (!canEditBudgetedBeds && budgetedBeds > 0) {
      const bedsToImport = importPreview.reduce((sum, row) => {
        const bedLetters = row.beds.split(/[,\s]+/).filter(b => b.trim());
        return sum + bedLetters.length;
      }, 0);

      if (totalBeds + bedsToImport > budgetedBeds) {
        setImportError(`Cannot import: Would exceed facility capacity. Current: ${totalBeds}, importing: ${bedsToImport}, budget: ${budgetedBeds}. Contact a superadmin to increase the budgeted beds.`);
        return;
      }
    }

    setImporting(true);
    setImportError(null);

    try {
      // Group rows by bathroom_group for shared bathroom logic
      const bathroomGroups = new Map<string, string>();
      let created = 0;
      let skipped = 0;

      for (const row of importPreview) {
        // Validate row data
        const rowValidation = validateCSVRow(row);
        if (!rowValidation.valid) {
          skipped++;
          continue;
        }

        // Find the wing by name
        const wing = wings.find(w =>
          w.name.toLowerCase() === row.wing_name.toLowerCase()
        );

        if (!wing) {
          skipped++;
          continue;
        }

        // Check if room already exists
        const existingRoom = rooms.find(r =>
          r.wing_id === wing.id && r.room_number === row.room_number
        );

        if (existingRoom) {
          skipped++;
          continue;
        }

        // Handle shared bathroom group
        let sharedBathroomGroupId: string | null = null;
        const hasSharedBathroom = row.shared_bathroom.toLowerCase() === 'yes' ||
                                   row.shared_bathroom.toLowerCase() === 'true' ||
                                   row.shared_bathroom === '1';

        if (hasSharedBathroom && row.bathroom_group) {
          if (!bathroomGroups.has(row.bathroom_group)) {
            bathroomGroups.set(row.bathroom_group, crypto.randomUUID());
          }
          sharedBathroomGroupId = bathroomGroups.get(row.bathroom_group) || null;
        }

        // Create room
        const { data: newRoom, error: roomError } = await createRoom({
          wing_id: wing.id,
          room_number: row.room_number,
          has_shared_bathroom: hasSharedBathroom,
          shared_bathroom_group_id: sharedBathroomGroupId,
        });

        if (roomError || !newRoom) {
          skipped++;
          continue;
        }

        // Create beds
        const bedLetters = row.beds.split(/[,\s]+/).map(b => b.trim().toUpperCase()).filter(b => b);
        for (const letter of bedLetters) {
          await createBed(newRoom.id, letter);
        }

        created++;
      }

      setImportSuccess(`Successfully imported ${created} rooms. ${skipped > 0 ? `${skipped} skipped (already exist or invalid wing).` : ''}`);
      refetchRooms();
      refetchWings();
    } catch {
      setImportError('An error occurred during import');
    }

    setImporting(false);
  };

  const downloadTemplate = () => {
    const template = `room_number,wing_name,beds,shared_bathroom,bathroom_group
101,North Wing,A B,no,
102,North Wing,A B,yes,group1
103,North Wing,A,yes,group1
201,East Wing,A B C,no,`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'room_bed_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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

  // Wing add handlers
  const handleAddWingClick = () => {
    setAddWingForm({
      name: '',
      wing_type: 'rehab',
    });
    setActionError(null);
    setShowAddWingModal(true);
  };

  const handleSaveNewWing = async () => {
    if (!currentFacility?.id || !addWingForm.name.trim()) return;

    setSaving(true);
    setActionError(null);

    const { error } = await createWing({
      name: addWingForm.name.trim(),
      wing_type: addWingForm.wing_type,
      facility_id: currentFacility.id,
    });

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowAddWingModal(false);
    refetchWings();
  };

  // Wing delete handlers
  const handleDeleteWingClick = (wing: WingWithStats) => {
    setWingToDelete(wing);
    setActionError(null);
    setShowDeleteWingConfirmModal(true);
  };

  const handleConfirmDeleteWing = async () => {
    if (!wingToDelete) return;

    setSaving(true);
    setActionError(null);

    const { error } = await deleteWing(wingToDelete.id);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowDeleteWingConfirmModal(false);
    setWingToDelete(null);
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

    // Validate room number
    const roomValidation = validateRoomNumber(addRoomForm.room_number);
    if (!roomValidation.valid) {
      setActionError(roomValidation.error || 'Invalid room number');
      return;
    }

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

    // Validate room number
    const roomValidation = validateRoomNumber(editRoomForm.room_number);
    if (!roomValidation.valid) {
      setActionError(roomValidation.error || 'Invalid room number');
      return;
    }

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

    // Validate bed letter
    const bedValidation = validateBedLetter(addBedForm.bed_letter);
    if (!bedValidation.valid) {
      setActionError(bedValidation.error || 'Invalid bed letter');
      return;
    }

    // Check if adding this bed would exceed the facility's budgeted total (superadmins can bypass)
    const budgetedBeds = currentFacility?.total_beds || 0;
    if (!canEditBudgetedBeds && budgetedBeds > 0 && totalBeds >= budgetedBeds) {
      setActionError(`Cannot add bed: Facility is at capacity (${totalBeds}/${budgetedBeds} budgeted beds). Contact a superadmin to increase the budgeted beds.`);
      return;
    }

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
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Icon name="settings" size={24} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-slate-500">Configure your facility settings</p>
        </div>
      </div>

      {/* Facility Information */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <Icon name="domain" size={20} className="text-primary-500" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Facility Information</h2>
            <p className="text-sm text-slate-500">Configure your facility details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="business" size={16} className="text-slate-400" />
              Facility Name
            </label>
            <div className="h-12 px-4 flex items-center border border-slate-200 rounded-lg bg-slate-50">
              <span className="text-lg font-semibold text-slate-900">{currentFacility?.name || 'No facility selected'}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Facility name is managed in Admin → Facility Management</p>
          </div>
          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              Total Facility Beds
            </label>
            <div className="h-12 px-4 flex items-center border border-slate-200 rounded-lg bg-slate-50">
              <span className="text-2xl font-bold text-primary-500">{currentFacility?.total_beds || 0}</span>
              <span className="text-sm text-slate-500 ml-2">
                budgeted beds
                <span className="ml-2 text-slate-400">
                  ({totalBeds} configured across {wings.length} wings)
                </span>
              </span>
            </div>
            {!canEditBudgetedBeds && (
              <p className="text-xs text-slate-400 mt-1">Budgeted beds can only be changed by superadmin in Admin → Facility Management</p>
            )}
          </div>
        </div>

      </div>

      {/* Budget Settings */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Icon name="payments" size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Budget Settings</h2>
            <p className="text-sm text-slate-500">Configure occupancy targets and payor rates</p>
          </div>
        </div>

        {/* Case-Mix (Budgeted Residents by Payor - Monthly) */}
        {budgetLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : (
          <>
        <div>
          <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-3">
            <Icon name="pie_chart" size={16} className="text-slate-400" />
            Case-Mix Budget by Month <span className="font-normal text-slate-500">(Budgeted Residents)</span>
          </label>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50">Month</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 min-w-[70px]">Private</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 min-w-[70px]">Medicare</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 min-w-[70px]">Medicaid</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 min-w-[80px]">Managed Care</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 min-w-[70px]">Hospice</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 min-w-[70px]">Other</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-green-600 min-w-[70px] bg-green-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((month, idx) => {
                  const monthTotal = getMonthTotal(month.key);
                  return (
                    <tr key={month.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-1.5 text-slate-700 font-medium sticky left-0 bg-inherit border-r border-slate-100">
                        {month.label}
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          value={monthlyRates[month.key].private || ''}
                          onChange={(e) => updateMonthlyRate(month.key, 'private', e.target.value)}
                          placeholder="0"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          value={monthlyRates[month.key].medicare || ''}
                          onChange={(e) => updateMonthlyRate(month.key, 'medicare', e.target.value)}
                          placeholder="0"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          value={monthlyRates[month.key].medicaid || ''}
                          onChange={(e) => updateMonthlyRate(month.key, 'medicaid', e.target.value)}
                          placeholder="0"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          value={monthlyRates[month.key].managed_care || ''}
                          onChange={(e) => updateMonthlyRate(month.key, 'managed_care', e.target.value)}
                          placeholder="0"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          value={monthlyRates[month.key].hospice || ''}
                          onChange={(e) => updateMonthlyRate(month.key, 'hospice', e.target.value)}
                          placeholder="0"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          value={monthlyRates[month.key].other || ''}
                          onChange={(e) => updateMonthlyRate(month.key, 'other', e.target.value)}
                          placeholder="0"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold text-green-600 bg-green-50/50">
                        {monthTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-700 sticky left-0 bg-slate-100">Annual Total</td>
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">{getPayorAnnualTotal('private')}</td>
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">{getPayorAnnualTotal('medicare')}</td>
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">{getPayorAnnualTotal('medicaid')}</td>
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">{getPayorAnnualTotal('managed_care')}</td>
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">{getPayorAnnualTotal('hospice')}</td>
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">{getPayorAnnualTotal('other')}</td>
                  <td className="px-2 py-2 text-center font-bold text-green-700 bg-green-100">{annualTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Calculated Occupancy Target */}
        <div className="mt-6 bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Calculated Average Occupancy Target</p>
              <p className="text-xs text-slate-500">
                {averageMonthlyBudget} avg monthly budgeted residents / {totalBeds} total beds
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-green-600">{calculatedOccupancyTarget}%</span>
            </div>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                calculatedOccupancyTarget > 100 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(calculatedOccupancyTarget, 100)}%` }}
            />
          </div>
          {calculatedOccupancyTarget > 100 && (
            <p className="text-xs text-red-600 mt-2">
              Warning: Average budgeted residents exceed total bed capacity
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSaveBudget}>
            <Icon name="save" size={16} className="mr-2" />
            {budgetSaved ? 'Saved!' : 'Save Budget Settings'}
          </Button>
        </div>
          </>
        )}
      </div>

      {/* Facility Wings with Rooms and Beds */}
      <div className="bg-white rounded-xl border border-slate-200" style={{ padding: '24px' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <Icon name="grid_view" size={20} className="text-primary-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Facility Wings</h2>
              <p className="text-sm text-slate-500">Manage wings, rooms, and beds</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowImportModal(true)}>
              <Icon name="upload_file" size={16} className="mr-2" />
              Import Rooms
            </Button>
            <Button onClick={handleAddWingClick}>
              <Icon name="add" size={16} className="mr-2" />
              Add Wing
            </Button>
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
                <div key={wing.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Wing Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-[#eef1f5] transition-colors"
                    onClick={() => toggleWingExpanded(wing.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name={isExpanded ? 'expand_more' : 'chevron_right'}
                        size={20}
                        className="text-slate-500"
                      />
                      <Icon name="domain" size={18} className="text-primary-500" />
                      <div>
                        <span className="font-medium text-slate-900">{wing.name}</span>
                        <span className="text-sm text-slate-500 ml-2">
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
                        className="p-1.5 text-slate-500 hover:text-primary-500 hover:bg-primary-500/10 rounded transition-colors"
                        title="Edit wing"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWingClick(wing);
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete wing"
                      >
                        <Icon name="delete" size={16} />
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
                              className="border border-slate-200 rounded-lg p-3 bg-white"
                            >
                              {/* Room Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <Icon name="meeting_room" size={18} className="text-slate-500" />
                                  <span className="font-medium text-slate-900">
                                    Room {room.room_number}
                                  </span>
                                  <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                                    {getBathroomGroupDisplay(room)}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {room.beds.length} bed{room.beds.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditRoomClick(room)}
                                    className="p-1.5 text-slate-500 hover:text-primary-500 hover:bg-primary-500/10 rounded transition-colors"
                                    title="Edit room"
                                  >
                                    <Icon name="edit" size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRoomClick(room)}
                                    className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
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
                                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50"
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
                                      <span className="text-sm text-slate-900">
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
                                        <span className="text-xs text-slate-500">
                                          ({bed.resident.first_name} {bed.resident.last_name})
                                        </span>
                                      )}
                                    </div>
                                    {bed.status === 'vacant' && (
                                      <button
                                        onClick={() => handleDeleteBedClick(bed, room.room_number)}
                                        className="p-1 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Delete bed"
                                      >
                                        <Icon name="delete" size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {room.beds.length === 0 && (
                                  <div className="text-xs text-slate-500 italic py-1">
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
                        <div className="text-sm text-slate-500 italic text-center py-4">
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
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <Icon name="domain" size={48} className="text-[#c4d4e5] mx-auto mb-3" />
            <p className="text-slate-500">No wings configured</p>
          </div>
        )}

        {/* Summary Cards */}
        {wings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
              <p className="text-2xl font-bold text-slate-900">{wings.length}</p>
              <p className="text-xs text-slate-500 uppercase font-medium">Total Wings</p>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
              <p className="text-2xl font-bold text-primary-500">{rooms.length}</p>
              <p className="text-xs text-slate-500 uppercase font-medium">Total Rooms</p>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
              <p className="text-2xl font-bold text-primary-500">{totalBeds}</p>
              <p className="text-xs text-slate-500 uppercase font-medium">Total Beds</p>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200" style={{ padding: '24px' }}>
              <p className="text-2xl font-bold text-slate-900">
                {wings.reduce((sum, w) => sum + w.occupied_beds, 0)}
              </p>
              <p className="text-xs text-slate-500 uppercase font-medium">Occupied Beds</p>
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
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="domain" size={16} className="text-slate-400" />
                Wing Name
              </label>
              <input
                type="text"
                value={editWingForm.name}
                onChange={(e) => setEditWingForm({ ...editWingForm, name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="Enter wing name"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="category" size={16} className="text-slate-400" />
                Wing Type
              </label>
              <select
                value={editWingForm.wing_type}
                onChange={(e) => setEditWingForm({ ...editWingForm, wing_type: e.target.value as WingType })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
              >
                {WING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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

      {/* Add Wing Modal */}
      <Modal
        isOpen={showAddWingModal}
        onClose={() => {
          setShowAddWingModal(false);
          setActionError(null);
        }}
        title="Add Wing"
        size="md"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {actionError}
            </div>
          )}

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="domain" size={16} className="text-slate-400" />
              Wing Name
            </label>
            <input
              type="text"
              value={addWingForm.name}
              onChange={(e) => setAddWingForm({ ...addWingForm, name: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="e.g., North Wing, East Wing"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="category" size={16} className="text-slate-400" />
              Wing Type
            </label>
            <select
              value={addWingForm.wing_type}
              onChange={(e) => setAddWingForm({ ...addWingForm, wing_type: e.target.value as WingType })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
            >
              {WING_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddWingModal(false);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNewWing} loading={saving} disabled={!addWingForm.name.trim()}>
              Add Wing
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Wing Confirmation Modal */}
      <Modal
        isOpen={showDeleteWingConfirmModal}
        onClose={() => {
          setShowDeleteWingConfirmModal(false);
          setWingToDelete(null);
          setActionError(null);
        }}
        title="Delete Wing"
        size="sm"
      >
        {wingToDelete && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <p className="text-slate-900">
              Are you sure you want to delete <strong>{wingToDelete.name}</strong>?
            </p>

            {wingToDelete.total_beds > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <Icon name="warning" size={16} className="inline mr-1" />
                This wing has {wingToDelete.total_beds} beds. All rooms and beds will be deleted.
                {wingToDelete.occupied_beds > 0 && (
                  <span className="font-semibold"> {wingToDelete.occupied_beds} beds are currently occupied - residents will be unassigned.</span>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteWingConfirmModal(false);
                  setWingToDelete(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDeleteWing} loading={saving}>
                Delete Wing
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
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="meeting_room" size={16} className="text-slate-400" />
              Room Number
            </label>
            <input
              type="text"
              value={addRoomForm.room_number}
              onChange={(e) => setAddRoomForm({ ...addRoomForm, room_number: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="e.g., 101, 102A"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-3">
              <Icon name="bathroom" size={16} className="text-slate-400" />
              Bathroom Type
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="bathroom_option"
                  checked={addRoomForm.bathroom_group_option === 'none'}
                  onChange={() => setAddRoomForm({ ...addRoomForm, bathroom_group_option: 'none' })}
                  className="w-4 h-4 text-primary-500 border-slate-300"
                />
                <span className="text-sm text-slate-700 group-hover:text-primary-500 transition-colors">Private bathroom</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="bathroom_option"
                  checked={addRoomForm.bathroom_group_option === 'new'}
                  onChange={() => setAddRoomForm({ ...addRoomForm, bathroom_group_option: 'new' })}
                  className="w-4 h-4 text-primary-500 border-slate-300"
                />
                <span className="text-sm text-slate-700 group-hover:text-primary-500 transition-colors">Create new shared bathroom group</span>
              </label>
              {bathroomGroups.length > 0 && (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="bathroom_option"
                    checked={addRoomForm.bathroom_group_option === 'existing'}
                    onChange={() => setAddRoomForm({ ...addRoomForm, bathroom_group_option: 'existing' })}
                    className="w-4 h-4 text-primary-500 border-slate-300"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-primary-500 transition-colors">Join existing bathroom group</span>
                </label>
              )}
            </div>

            {addRoomForm.bathroom_group_option === 'existing' && bathroomGroups.length > 0 && (
              <div className="mt-4 pl-7">
                <select
                  value={addRoomForm.selected_bathroom_group_id}
                  onChange={(e) =>
                    setAddRoomForm({ ...addRoomForm, selected_bathroom_group_id: e.target.value })
                  }
                  className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="meeting_room" size={16} className="text-slate-400" />
                Room Number
              </label>
              <input
                type="text"
                value={editRoomForm.room_number}
                onChange={(e) => setEditRoomForm({ ...editRoomForm, room_number: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="e.g., 101, 102A"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-3">
                <Icon name="bathroom" size={16} className="text-slate-400" />
                Bathroom Type
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="edit_bathroom_option"
                    checked={editRoomForm.bathroom_group_option === 'none'}
                    onChange={() => setEditRoomForm({ ...editRoomForm, bathroom_group_option: 'none' })}
                    className="w-4 h-4 text-primary-500 border-slate-300"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-primary-500 transition-colors">Private bathroom</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="edit_bathroom_option"
                    checked={editRoomForm.bathroom_group_option === 'new'}
                    onChange={() => setEditRoomForm({ ...editRoomForm, bathroom_group_option: 'new' })}
                    className="w-4 h-4 text-primary-500 border-slate-300"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-primary-500 transition-colors">Create new shared bathroom group</span>
                </label>
                {bathroomGroups.length > 0 && (
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="edit_bathroom_option"
                      checked={editRoomForm.bathroom_group_option === 'existing'}
                      onChange={() =>
                        setEditRoomForm({ ...editRoomForm, bathroom_group_option: 'existing' })
                      }
                      className="w-4 h-4 text-primary-500 border-slate-300"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-primary-500 transition-colors">Join existing bathroom group</span>
                  </label>
                )}
              </div>

              {editRoomForm.bathroom_group_option === 'existing' && bathroomGroups.length > 0 && (
                <div className="mt-4 pl-7">
                  <select
                    value={editRoomForm.selected_bathroom_group_id}
                    onChange={(e) =>
                      setEditRoomForm({ ...editRoomForm, selected_bathroom_group_id: e.target.value })
                    }
                    className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all bg-white"
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

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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

          {/* Capacity warning */}
          {currentFacility?.total_beds && currentFacility.total_beds > 0 && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              totalBeds >= currentFacility.total_beds && !canEditBudgetedBeds
                ? 'bg-red-50 border border-red-200 text-red-700'
                : totalBeds >= currentFacility.total_beds - 5
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-slate-50 border border-slate-200 text-slate-600'
            }`}>
              <Icon name={totalBeds >= currentFacility.total_beds && !canEditBudgetedBeds ? 'error' : 'info'} size={16} />
              <span>
                Facility capacity: <strong>{totalBeds}/{currentFacility.total_beds}</strong> beds
                {totalBeds >= currentFacility.total_beds && (canEditBudgetedBeds ? ' (superadmin can exceed)' : ' (at capacity)')}
              </span>
            </div>
          )}

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="bed" size={16} className="text-slate-400" />
              Bed Letter
            </label>
            <input
              type="text"
              value={addBedForm.bed_letter}
              onChange={(e) => setAddBedForm({ bed_letter: e.target.value.toUpperCase() })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-center font-bold text-lg"
              placeholder="e.g., A, B, C"
              maxLength={2}
            />
            <p className="text-xs text-slate-500 mt-2">Suggested: <span className="font-semibold text-primary-500">{suggestedBedLetter}</span></p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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

            <p className="text-slate-900">
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

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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

      {/* Import Rooms Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportPreview([]);
          setImportError(null);
          setImportSuccess(null);
        }}
        title="Import Rooms & Beds"
        size="lg"
      >
        <div className="space-y-4">
          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {importError}
            </div>
          )}

          {importSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {importSuccess}
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm font-medium text-slate-900 mb-2">CSV File Format</p>
            <p className="text-xs text-slate-500 mb-3">
              Upload a CSV file with columns: room_number, wing_name, beds, shared_bathroom, bathroom_group
            </p>
            <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 overflow-x-auto">
              <div className="text-slate-500">room_number,wing_name,beds,shared_bathroom,bathroom_group</div>
              <div>101,North Wing,A B,no,</div>
              <div>102,North Wing,A B,yes,group1</div>
              <div>103,North Wing,A,yes,group1</div>
            </div>
            <button
              onClick={downloadTemplate}
              className="mt-3 text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1"
            >
              <Icon name="download" size={14} />
              Download Template
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Select File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            {importFile && (
              <p className="text-xs text-slate-500 mt-1">
                Selected: {importFile.name}
              </p>
            )}
          </div>

          {importPreview.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">
                Preview ({importPreview.length} rows)
              </p>
              <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left text-slate-500">Room</th>
                      <th className="px-2 py-1 text-left text-slate-500">Wing</th>
                      <th className="px-2 py-1 text-left text-slate-500">Beds</th>
                      <th className="px-2 py-1 text-left text-slate-500">Shared Bath</th>
                      <th className="px-2 py-1 text-left text-slate-500">Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="px-2 py-1">{row.room_number}</td>
                        <td className="px-2 py-1">{row.wing_name}</td>
                        <td className="px-2 py-1">{row.beds}</td>
                        <td className="px-2 py-1">{row.shared_bathroom}</td>
                        <td className="px-2 py-1">{row.bathroom_group || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.length > 20 && (
                  <p className="text-xs text-slate-500 p-2 text-center bg-slate-50">
                    ... and {importPreview.length - 20} more rows
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview([]);
                setImportError(null);
                setImportSuccess(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importPreview.length === 0 || importing}
              loading={importing}
            >
              Import {importPreview.length > 0 ? `${importPreview.length} Rooms` : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
