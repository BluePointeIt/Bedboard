import { useState, useMemo } from 'react';
import { Button, Icon, Modal } from '../components';
import { useUsers, type UserWithFacility, type CreateUserInput, type UpdateUserInput } from '../hooks/useUsers';
import { useFacilities, type CreateFacilityInput, type UpdateFacilityInput } from '../hooks/useFacilities';
import { useAuth } from '../hooks/useAuth';
import {
  hasPermission,
  isSuperuser,
  getAssignableRoles,
  canManageUser,
  getRoleDisplayName,
  getRoleBadgeColor,
  ROLE_HIERARCHY,
} from '../lib/permissions';
import type { UserRole, Company } from '../types';

export function Admin() {
  const { profile, accessibleFacilities } = useAuth();

  // Get facility IDs the current user can access
  const accessibleFacilityIds = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'superuser') return undefined; // Superusers see all
    return accessibleFacilities.map((f) => f.id);
  }, [profile, accessibleFacilities]);

  const { users, loading: usersLoading, createUser, updateUser, toggleUserStatus, getUserFacilities, refetch: refetchUsers } = useUsers({
    facilityIds: accessibleFacilityIds,
  });
  const {
    facilities,
    loading: facilitiesLoading,
    createFacility,
    updateFacility,
    toggleFacilityStatus,
    refetch: refetchFacilities,
  } = useFacilities();

  // Section expand state
  const [userSectionExpanded, setUserSectionExpanded] = useState(true);
  const [facilitySectionExpanded, setFacilitySectionExpanded] = useState(true);

  // Filter states
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [facilityFilter, setFacilityFilter] = useState<string>('');
  const [facilitySearch, setFacilitySearch] = useState('');

  // Modal states
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserInput>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    primary_facility_id: '',
    assigned_facilities: [],
  });

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithFacility | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    full_name: '',
    role: 'user' as UserRole,
    primary_facility_id: '',
    assigned_facilities: [] as string[],
  });
  const [loadingUserFacilities, setLoadingUserFacilities] = useState(false);

  const [showCreateFacilityModal, setShowCreateFacilityModal] = useState(false);
  const [showEditFacilityModal, setShowEditFacilityModal] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Company | null>(null);
  const [facilityForm, setFacilityForm] = useState<CreateFacilityInput>({
    name: '',
    facility_code: '',
    organization_code: '',
    address: '',
    phone: '',
  });

  const [showDisableConfirmModal, setShowDisableConfirmModal] = useState(false);
  const [disableTarget, setDisableTarget] = useState<{
    type: 'user' | 'facility';
    id: string;
    name: string;
    isCurrentlyActive: boolean;
  } | null>(null);

  // General states
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Permission checks
  const canManageUsers = hasPermission(profile, 'manage:users');
  const canManageFacilities = hasPermission(profile, 'manage:facilities');
  const userIsSuperuser = isSuperuser(profile);

  // Get assignable roles for current user
  const assignableRoles = profile ? getAssignableRoles(profile.role) : [];

  // Get facilities for dropdowns based on user access
  const selectableFacilities = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'superuser') return facilities;
    return facilities.filter((f) => accessibleFacilities.some((af) => af.id === f.id));
  }, [profile, facilities, accessibleFacilities]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search filter
      if (userSearch) {
        const search = userSearch.toLowerCase();
        const matchesSearch =
          user.full_name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (roleFilter && user.role !== roleFilter) return false;

      // Facility filter
      if (facilityFilter && user.primary_facility_id !== facilityFilter) return false;

      return true;
    });
  }, [users, userSearch, roleFilter, facilityFilter]);

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    if (!facilitySearch) return facilities;
    const search = facilitySearch.toLowerCase();
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(search) ||
        f.facility_code.toLowerCase().includes(search)
    );
  }, [facilities, facilitySearch]);

  // User handlers
  const handleCreateUserClick = () => {
    // Set default facility based on user's access
    const defaultFacilityId = profile?.role === 'supervisor'
      ? profile.primary_facility_id || ''
      : '';

    setCreateUserForm({
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      primary_facility_id: defaultFacilityId,
      assigned_facilities: [],
    });
    setActionError(null);
    setShowCreateUserModal(true);
  };

  const handleSaveNewUser = async () => {
    if (!createUserForm.email.trim() || !createUserForm.password || !createUserForm.full_name.trim()) {
      setActionError('Email, password, and full name are required');
      return;
    }

    if (createUserForm.password.length < 6) {
      setActionError('Password must be at least 6 characters');
      return;
    }

    // Validate role assignment
    if (!assignableRoles.includes(createUserForm.role) && profile?.role !== 'superuser') {
      setActionError('You cannot assign this role');
      return;
    }

    setSaving(true);
    setActionError(null);

    const { error } = await createUser(createUserForm);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowCreateUserModal(false);
    refetchUsers();
  };

  const handleEditUserClick = async (user: UserWithFacility) => {
    if (!profile || !canManageUser(profile, user)) {
      setActionError('You do not have permission to edit this user');
      return;
    }
    setSelectedUser(user);
    setEditUserForm({
      full_name: user.full_name,
      role: user.role,
      primary_facility_id: user.primary_facility_id || '',
      assigned_facilities: [],
    });
    setActionError(null);
    setShowEditUserModal(true);

    // Fetch user's assigned facilities if they are a regional user
    if (user.role === 'regional') {
      setLoadingUserFacilities(true);
      const { data } = await getUserFacilities(user.id);
      setEditUserForm((prev) => ({
        ...prev,
        assigned_facilities: data,
      }));
      setLoadingUserFacilities(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setActionError(null);

    const updates: UpdateUserInput = {};
    if (editUserForm.full_name !== selectedUser.full_name) {
      updates.full_name = editUserForm.full_name;
    }
    if (editUserForm.role !== selectedUser.role) {
      // Validate role assignment
      if (!assignableRoles.includes(editUserForm.role) && profile?.role !== 'superuser') {
        setActionError('You cannot assign this role');
        setSaving(false);
        return;
      }
      updates.role = editUserForm.role;
    }
    if (editUserForm.primary_facility_id !== selectedUser.primary_facility_id) {
      updates.primary_facility_id = editUserForm.primary_facility_id || undefined;
    }

    // Include assigned facilities for regional users
    if (editUserForm.role === 'regional') {
      updates.assigned_facilities = editUserForm.assigned_facilities;
    } else {
      // Clear assigned facilities if role is not regional
      updates.assigned_facilities = [];
    }

    const { error } = await updateUser(selectedUser.id, updates);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowEditUserModal(false);
    setSelectedUser(null);
    refetchUsers();
  };

  const handleToggleUserStatus = (user: UserWithFacility) => {
    if (!profile || !canManageUser(profile, user)) {
      setActionError('You do not have permission to modify this user');
      return;
    }
    setDisableTarget({
      type: 'user',
      id: user.id,
      name: user.full_name,
      isCurrentlyActive: user.is_active,
    });
    setActionError(null);
    setShowDisableConfirmModal(true);
  };

  // Facility handlers
  const handleCreateFacilityClick = () => {
    setFacilityForm({
      name: '',
      facility_code: '',
      organization_code: '',
      address: '',
      phone: '',
    });
    setActionError(null);
    setShowCreateFacilityModal(true);
  };

  const handleEditFacilityClick = (facility: Company) => {
    setSelectedFacility(facility);
    setFacilityForm({
      name: facility.name,
      facility_code: facility.facility_code,
      organization_code: facility.organization_code || '',
      address: facility.address || '',
      phone: facility.phone || '',
    });
    setActionError(null);
    setShowEditFacilityModal(true);
  };

  const handleSaveNewFacility = async () => {
    if (!facilityForm.name.trim() || !facilityForm.facility_code.trim()) {
      setActionError('Name and facility code are required');
      return;
    }

    if (facilityForm.facility_code.length < 2 || facilityForm.facility_code.length > 5) {
      setActionError('Facility code must be 2-5 characters');
      return;
    }

    setSaving(true);
    setActionError(null);

    const { error } = await createFacility(facilityForm);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowCreateFacilityModal(false);
    refetchFacilities();
  };

  const handleSaveEditFacility = async () => {
    if (!selectedFacility) return;

    if (!facilityForm.name.trim() || !facilityForm.facility_code.trim()) {
      setActionError('Name and facility code are required');
      return;
    }

    setSaving(true);
    setActionError(null);

    const updates: UpdateFacilityInput = {};
    if (facilityForm.name !== selectedFacility.name) {
      updates.name = facilityForm.name;
    }
    if (facilityForm.facility_code !== selectedFacility.facility_code) {
      updates.facility_code = facilityForm.facility_code;
    }
    if (facilityForm.organization_code !== (selectedFacility.organization_code || '')) {
      updates.organization_code = facilityForm.organization_code || undefined;
    }
    if (facilityForm.address !== (selectedFacility.address || '')) {
      updates.address = facilityForm.address || undefined;
    }
    if (facilityForm.phone !== (selectedFacility.phone || '')) {
      updates.phone = facilityForm.phone || undefined;
    }

    if (Object.keys(updates).length === 0) {
      setShowEditFacilityModal(false);
      setSelectedFacility(null);
      setSaving(false);
      return;
    }

    const { error } = await updateFacility(selectedFacility.id, updates);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowEditFacilityModal(false);
    setSelectedFacility(null);
    refetchFacilities();
  };

  const handleToggleFacilityStatus = (facility: Company) => {
    setDisableTarget({
      type: 'facility',
      id: facility.id,
      name: facility.name,
      isCurrentlyActive: facility.is_active,
    });
    setActionError(null);
    setShowDisableConfirmModal(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!disableTarget) return;

    setSaving(true);
    setActionError(null);

    const newStatus = !disableTarget.isCurrentlyActive;

    if (disableTarget.type === 'user') {
      const { error } = await toggleUserStatus(disableTarget.id, newStatus);
      if (error) {
        setActionError(error.message);
        setSaving(false);
        return;
      }
      refetchUsers();
    } else {
      const { error } = await toggleFacilityStatus(disableTarget.id, newStatus);
      if (error) {
        setActionError(error.message);
        setSaving(false);
        return;
      }
      refetchFacilities();
    }

    setSaving(false);
    setShowDisableConfirmModal(false);
    setDisableTarget(null);
  };

  // Get available roles for the role dropdown in edit user modal
  const getAvailableRolesForUser = (targetUser: UserWithFacility | null) => {
    if (!profile || !targetUser) return [];

    // Superusers can assign any role
    if (profile.role === 'superuser') {
      return ROLE_HIERARCHY;
    }

    // Others can only assign roles lower than their own
    const roles = getAssignableRoles(profile.role);

    // Include the current role of the target user if they already have it
    if (!roles.includes(targetUser.role)) {
      return [...roles, targetUser.role].sort(
        (a, b) => ROLE_HIERARCHY.indexOf(a) - ROLE_HIERARCHY.indexOf(b)
      );
    }

    return roles;
  };

  const loading = usersLoading || facilitiesLoading;

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Icon name="lock" size={48} className="text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">You do not have permission to access admin features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Icon name="admin_panel_settings" size={24} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin</h1>
          <p className="text-slate-500">Manage users and facilities</p>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white rounded-xl border border-slate-200">
        <button
          onClick={() => setUserSectionExpanded(!userSectionExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Icon name="group" size={20} className="text-blue-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-slate-900">User Management</h2>
              <p className="text-sm text-slate-500">{users.length} users</p>
            </div>
          </div>
          <Icon
            name={userSectionExpanded ? 'expand_less' : 'expand_more'}
            size={24}
            className="text-slate-400"
          />
        </button>

        {userSectionExpanded && (
          <div className="px-6 pb-6 border-t border-slate-100">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 py-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Icon
                    name="search"
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                className="h-10 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white"
              >
                <option value="">All Roles</option>
                {ROLE_HIERARCHY.map((role) => (
                  <option key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </option>
                ))}
              </select>
              <select
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value)}
                className="h-10 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white"
              >
                <option value="">All Facilities</option>
                {selectableFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {assignableRoles.length > 0 && (
                <Button onClick={handleCreateUserClick}>
                  <Icon name="person_add" size={18} className="mr-2" />
                  Add User
                </Button>
              )}
            </div>

            {/* Users Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Facility
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => {
                      const canEdit = profile ? canManageUser(profile, user) : false;
                      return (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary-600">
                                  {user.full_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-slate-900">{user.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{user.email}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                                user.role
                              )}`}
                            >
                              {getRoleDisplayName(user.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {user.primary_facility?.name || (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {user.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditUserClick(user)}
                                disabled={!canEdit}
                                className={`p-2 rounded-lg transition-colors ${
                                  canEdit
                                    ? 'text-slate-500 hover:text-primary-500 hover:bg-primary-500/10'
                                    : 'text-slate-300 cursor-not-allowed'
                                }`}
                                title="Edit user"
                              >
                                <Icon name="edit" size={16} />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(user)}
                                disabled={!canEdit}
                                className={`p-2 rounded-lg transition-colors ${
                                  canEdit
                                    ? user.is_active
                                      ? 'text-slate-500 hover:text-red-500 hover:bg-red-50'
                                      : 'text-slate-500 hover:text-green-500 hover:bg-green-50'
                                    : 'text-slate-300 cursor-not-allowed'
                                }`}
                                title={user.is_active ? 'Disable user' : 'Enable user'}
                              >
                                <Icon name={user.is_active ? 'block' : 'check_circle'} size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <Icon name="group_off" size={48} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Facility Management Section - Superuser only */}
      {userIsSuperuser && (
        <div className="bg-white rounded-xl border border-slate-200">
          <button
            onClick={() => setFacilitySectionExpanded(!facilitySectionExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Icon name="business" size={20} className="text-purple-600" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-slate-900">Facility Management</h2>
                <p className="text-sm text-slate-500">{facilities.length} facilities</p>
              </div>
            </div>
            <Icon
              name={facilitySectionExpanded ? 'expand_less' : 'expand_more'}
              size={24}
              className="text-slate-400"
            />
          </button>

          {facilitySectionExpanded && (
            <div className="px-6 pb-6 border-t border-slate-100">
              {/* Filters and Add button */}
              <div className="flex flex-wrap items-center gap-4 py-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Icon
                      name="search"
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Search facilities..."
                      value={facilitySearch}
                      onChange={(e) => setFacilitySearch(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>
                {canManageFacilities && (
                  <Button onClick={handleCreateFacilityClick}>
                    <Icon name="add" size={18} className="mr-2" />
                    Add Facility
                  </Button>
                )}
              </div>

              {/* Facility Cards */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
              ) : filteredFacilities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFacilities.map((facility) => (
                    <div
                      key={facility.id}
                      className={`border rounded-xl p-4 transition-all ${
                        facility.is_active
                          ? 'border-slate-200 bg-white'
                          : 'border-red-200 bg-red-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{facility.name}</h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-600">
                            {facility.facility_code}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            facility.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {facility.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      {facility.address && (
                        <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                          <Icon name="location_on" size={14} />
                          {facility.address}
                        </p>
                      )}
                      {facility.phone && (
                        <p className="text-sm text-slate-500 mb-3 flex items-center gap-1">
                          <Icon name="phone" size={14} />
                          {facility.phone}
                        </p>
                      )}
                      {canManageFacilities && (
                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => handleEditFacilityClick(facility)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors"
                          >
                            <Icon name="edit" size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleFacilityStatus(facility)}
                            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                              facility.is_active
                                ? 'text-slate-600 hover:text-red-500 hover:bg-red-50'
                                : 'text-slate-600 hover:text-green-500 hover:bg-green-50'
                            }`}
                          >
                            <Icon name={facility.is_active ? 'block' : 'check_circle'} size={16} />
                            {facility.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <Icon name="business" size={48} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No facilities found</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateUserModal}
        onClose={() => {
          setShowCreateUserModal(false);
          setActionError(null);
        }}
        title="Add User"
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
              <Icon name="person" size={16} className="text-slate-400" />
              Full Name *
            </label>
            <input
              type="text"
              value={createUserForm.full_name}
              onChange={(e) => setCreateUserForm({ ...createUserForm, full_name: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="mail" size={16} className="text-slate-400" />
              Email *
            </label>
            <input
              type="email"
              value={createUserForm.email}
              onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="lock" size={16} className="text-slate-400" />
              Password *
            </label>
            <input
              type="password"
              value={createUserForm.password}
              onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="Minimum 6 characters"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="badge" size={16} className="text-slate-400" />
              Role
            </label>
            <select
              value={createUserForm.role}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setCreateUserForm({
                  ...createUserForm,
                  role: newRole,
                  // Clear assigned facilities if changing away from regional
                  assigned_facilities: newRole === 'regional' ? createUserForm.assigned_facilities : [],
                });
              }}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white"
            >
              {(profile?.role === 'superuser' ? ROLE_HIERARCHY : assignableRoles).map((role) => (
                <option key={role} value={role}>
                  {getRoleDisplayName(role)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="business" size={16} className="text-slate-400" />
              Primary Facility
            </label>
            <select
              value={createUserForm.primary_facility_id || ''}
              onChange={(e) =>
                setCreateUserForm({ ...createUserForm, primary_facility_id: e.target.value })
              }
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white"
              disabled={profile?.role === 'supervisor'}
            >
              <option value="">No facility</option>
              {selectableFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.facility_code})
                </option>
              ))}
            </select>
            {profile?.role === 'supervisor' && (
              <p className="text-xs text-slate-500 mt-1">Users will be assigned to your facility</p>
            )}
          </div>

          {/* Additional Facilities for Regional Users */}
          {createUserForm.role === 'regional' && (
            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="domain_add" size={16} className="text-slate-400" />
                Additional Facilities
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Select additional facilities within the same organization
              </p>
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {(() => {
                  const primaryFacility = selectableFacilities.find(
                    (f) => f.id === createUserForm.primary_facility_id
                  );
                  const primaryOrgCode = primaryFacility?.organization_code;

                  if (!primaryOrgCode) {
                    return (
                      <p className="px-4 py-3 text-sm text-slate-500 text-center">
                        Select a primary facility first
                      </p>
                    );
                  }

                  const sameOrgFacilities = selectableFacilities.filter(
                    (f) =>
                      f.id !== createUserForm.primary_facility_id &&
                      f.organization_code === primaryOrgCode
                  );

                  if (sameOrgFacilities.length === 0) {
                    return (
                      <p className="px-4 py-3 text-sm text-slate-500 text-center">
                        No other facilities in this organization
                      </p>
                    );
                  }

                  return sameOrgFacilities.map((facility) => {
                    const isSelected = createUserForm.assigned_facilities?.includes(facility.id);
                    return (
                      <label
                        key={facility.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 ${
                          isSelected ? 'bg-primary-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const current = createUserForm.assigned_facilities || [];
                            if (e.target.checked) {
                              setCreateUserForm({
                                ...createUserForm,
                                assigned_facilities: [...current, facility.id],
                              });
                            } else {
                              setCreateUserForm({
                                ...createUserForm,
                                assigned_facilities: current.filter((id) => id !== facility.id),
                              });
                            }
                          }}
                          className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {facility.name}
                          </p>
                          <p className="text-xs text-slate-500">{facility.facility_code}</p>
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateUserModal(false);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewUser}
              loading={saving}
              disabled={!createUserForm.email.trim() || !createUserForm.password || !createUserForm.full_name.trim()}
            >
              Add User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditUserModal}
        onClose={() => {
          setShowEditUserModal(false);
          setSelectedUser(null);
          setActionError(null);
        }}
        title="Edit User"
        size="md"
      >
        {selectedUser && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="person" size={16} className="text-slate-400" />
                Full Name
              </label>
              <input
                type="text"
                value={editUserForm.full_name}
                onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="mail" size={16} className="text-slate-400" />
                Email
              </label>
              <input
                type="email"
                value={selectedUser.email}
                disabled
                className="w-full h-12 px-4 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="badge" size={16} className="text-slate-400" />
                Role
              </label>
              <select
                value={editUserForm.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setEditUserForm({
                    ...editUserForm,
                    role: newRole,
                    // Clear assigned facilities if changing away from regional
                    assigned_facilities: newRole === 'regional' ? editUserForm.assigned_facilities : [],
                  });
                }}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white"
              >
                {getAvailableRolesForUser(selectedUser).map((role) => (
                  <option key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="business" size={16} className="text-slate-400" />
                Primary Facility
              </label>
              <select
                value={editUserForm.primary_facility_id}
                onChange={(e) =>
                  setEditUserForm({ ...editUserForm, primary_facility_id: e.target.value })
                }
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white"
              >
                <option value="">No facility</option>
                {selectableFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.facility_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Facilities for Regional Users */}
            {editUserForm.role === 'regional' && (
              <div>
                <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                  <Icon name="domain_add" size={16} className="text-slate-400" />
                  Additional Facilities
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Select additional facilities within the same organization
                </p>
                {loadingUserFacilities ? (
                  <div className="flex items-center justify-center py-4 border border-slate-200 rounded-lg">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                    <span className="ml-2 text-sm text-slate-500">Loading facilities...</span>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                    {(() => {
                      // Get primary facility's organization code
                      const primaryFacility = selectableFacilities.find(
                        (f) => f.id === editUserForm.primary_facility_id
                      );
                      const primaryOrgCode = primaryFacility?.organization_code;

                      if (!primaryOrgCode) {
                        return (
                          <p className="px-4 py-3 text-sm text-slate-500 text-center">
                            Select a primary facility first
                          </p>
                        );
                      }

                      // Filter to only facilities with the same organization code
                      const sameOrgFacilities = selectableFacilities.filter(
                        (f) =>
                          f.id !== editUserForm.primary_facility_id &&
                          f.organization_code === primaryOrgCode
                      );

                      if (sameOrgFacilities.length === 0) {
                        return (
                          <p className="px-4 py-3 text-sm text-slate-500 text-center">
                            No other facilities in this organization
                          </p>
                        );
                      }

                      return sameOrgFacilities.map((facility) => {
                        const isSelected = editUserForm.assigned_facilities?.includes(facility.id);
                        return (
                          <label
                            key={facility.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 ${
                              isSelected ? 'bg-primary-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const current = editUserForm.assigned_facilities || [];
                                if (e.target.checked) {
                                  setEditUserForm({
                                    ...editUserForm,
                                    assigned_facilities: [...current, facility.id],
                                  });
                                } else {
                                  setEditUserForm({
                                    ...editUserForm,
                                    assigned_facilities: current.filter((id) => id !== facility.id),
                                  });
                                }
                              }}
                              className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {facility.name}
                              </p>
                              <p className="text-xs text-slate-500">{facility.facility_code}</p>
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditUserModal(false);
                  setSelectedUser(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveUser} loading={saving} disabled={!editUserForm.full_name.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Facility Modal */}
      <Modal
        isOpen={showCreateFacilityModal}
        onClose={() => {
          setShowCreateFacilityModal(false);
          setActionError(null);
        }}
        title="Add Facility"
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
              <Icon name="business" size={16} className="text-slate-400" />
              Facility Name *
            </label>
            <input
              type="text"
              value={facilityForm.name}
              onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="e.g., Sunrise Care Center"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="tag" size={16} className="text-slate-400" />
              Facility Code * (2-5 letters)
            </label>
            <input
              type="text"
              value={facilityForm.facility_code}
              onChange={(e) =>
                setFacilityForm({ ...facilityForm, facility_code: e.target.value.toUpperCase() })
              }
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
              placeholder="e.g., SCC"
              maxLength={5}
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="corporate_fare" size={16} className="text-slate-400" />
              Organization Code
            </label>
            <input
              type="text"
              value={facilityForm.organization_code || ''}
              onChange={(e) =>
                setFacilityForm({ ...facilityForm, organization_code: e.target.value.toUpperCase() })
              }
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
              placeholder="e.g., ACME (groups related facilities)"
              maxLength={10}
            />
            <p className="text-xs text-slate-500 mt-1">
              Group facilities by organization. Defaults to facility code if empty.
            </p>
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="location_on" size={16} className="text-slate-400" />
              Address
            </label>
            <input
              type="text"
              value={facilityForm.address || ''}
              onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="e.g., 123 Main St, City, ST 12345"
            />
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
              <Icon name="phone" size={16} className="text-slate-400" />
              Phone
            </label>
            <input
              type="text"
              value={facilityForm.phone || ''}
              onChange={(e) => setFacilityForm({ ...facilityForm, phone: e.target.value })}
              className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              placeholder="e.g., (555) 123-4567"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateFacilityModal(false);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewFacility}
              loading={saving}
              disabled={!facilityForm.name.trim() || !facilityForm.facility_code.trim()}
            >
              Add Facility
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Facility Modal */}
      <Modal
        isOpen={showEditFacilityModal}
        onClose={() => {
          setShowEditFacilityModal(false);
          setSelectedFacility(null);
          setActionError(null);
        }}
        title="Edit Facility"
        size="md"
      >
        {selectedFacility && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="business" size={16} className="text-slate-400" />
                Facility Name *
              </label>
              <input
                type="text"
                value={facilityForm.name}
                onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="e.g., Sunrise Care Center"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="tag" size={16} className="text-slate-400" />
                Facility Code * (2-5 letters)
              </label>
              <input
                type="text"
                value={facilityForm.facility_code}
                onChange={(e) =>
                  setFacilityForm({ ...facilityForm, facility_code: e.target.value.toUpperCase() })
                }
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
                placeholder="e.g., SCC"
                maxLength={5}
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="corporate_fare" size={16} className="text-slate-400" />
                Organization Code
              </label>
              <input
                type="text"
                value={facilityForm.organization_code || ''}
                onChange={(e) =>
                  setFacilityForm({ ...facilityForm, organization_code: e.target.value.toUpperCase() })
                }
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
                placeholder="e.g., ACME (groups related facilities)"
                maxLength={10}
              />
              <p className="text-xs text-slate-500 mt-1">
                Group facilities by organization. Defaults to facility code if empty.
              </p>
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="location_on" size={16} className="text-slate-400" />
                Address
              </label>
              <input
                type="text"
                value={facilityForm.address || ''}
                onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="e.g., 123 Main St, City, ST 12345"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2 mb-2">
                <Icon name="phone" size={16} className="text-slate-400" />
                Phone
              </label>
              <input
                type="text"
                value={facilityForm.phone || ''}
                onChange={(e) => setFacilityForm({ ...facilityForm, phone: e.target.value })}
                className="w-full h-12 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                placeholder="e.g., (555) 123-4567"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditFacilityModal(false);
                  setSelectedFacility(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditFacility}
                loading={saving}
                disabled={!facilityForm.name.trim() || !facilityForm.facility_code.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Disable/Enable Confirmation Modal */}
      <Modal
        isOpen={showDisableConfirmModal}
        onClose={() => {
          setShowDisableConfirmModal(false);
          setDisableTarget(null);
          setActionError(null);
        }}
        title={disableTarget?.isCurrentlyActive ? 'Disable Confirmation' : 'Enable Confirmation'}
        size="sm"
      >
        {disableTarget && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <p className="text-slate-900">
              Are you sure you want to{' '}
              <strong>{disableTarget.isCurrentlyActive ? 'disable' : 'enable'}</strong>{' '}
              {disableTarget.type === 'user' ? 'user' : 'facility'}{' '}
              <strong>{disableTarget.name}</strong>?
            </p>

            {disableTarget.isCurrentlyActive && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <Icon name="warning" size={16} className="inline mr-1" />
                {disableTarget.type === 'user'
                  ? 'This user will no longer be able to log in.'
                  : 'This facility will be hidden from dropdowns and users will not be able to access it.'}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDisableConfirmModal(false);
                  setDisableTarget(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant={disableTarget.isCurrentlyActive ? 'danger' : 'primary'}
                onClick={handleConfirmToggleStatus}
                loading={saving}
              >
                {disableTarget.isCurrentlyActive ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
