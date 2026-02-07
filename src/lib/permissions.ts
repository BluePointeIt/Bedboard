import type { UserRole, User } from '../types';

/**
 * Permission definitions for role-based access control
 * Organized by category for clarity
 */
export type Permission =
  // View permissions
  | 'view:dashboard'
  | 'view:residents'
  | 'view:analytics'
  | 'view:reports'
  | 'view:settings'
  | 'view:users'
  | 'view:facilities'
  // Resident operations
  | 'create:resident'
  | 'edit:resident'
  | 'discharge:resident'
  | 'delete:resident'
  // Bed operations
  | 'assign:bed'
  | 'move:resident'
  | 'set:isolation'
  // Facility management
  | 'manage:beds'
  | 'manage:rooms'
  | 'manage:wings'
  | 'manage:facility'
  | 'manage:users'
  | 'manage:user_roles'
  | 'manage:facilities'
  // Data operations
  | 'import:csv'
  | 'export:data'
  // Multi-facility
  | 'switch:facility';

/**
 * Role hierarchy (higher index = higher privileges)
 */
export const ROLE_HIERARCHY: UserRole[] = ['user', 'supervisor', 'regional', 'superuser'];

/**
 * Role-based permission matrix
 * Each role includes all permissions explicitly listed
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    // View permissions
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    // Resident operations
    'create:resident',
    'edit:resident',
    'discharge:resident',
    // Bed operations
    'assign:bed',
    'move:resident',
    'set:isolation',
    // Data operations
    'export:data',
  ],
  supervisor: [
    // All user permissions
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    'create:resident',
    'edit:resident',
    'discharge:resident',
    'assign:bed',
    'move:resident',
    'set:isolation',
    'export:data',
    // Additional supervisor permissions
    'view:settings',
    'view:users',
    'delete:resident',
    'manage:beds',
    'manage:rooms',
    'manage:wings',
    'manage:facility',
    'manage:users',
    'import:csv',
  ],
  regional: [
    // All supervisor permissions
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    'view:settings',
    'view:users',
    'create:resident',
    'edit:resident',
    'discharge:resident',
    'delete:resident',
    'assign:bed',
    'move:resident',
    'set:isolation',
    'manage:beds',
    'manage:rooms',
    'manage:wings',
    'manage:facility',
    'manage:users',
    'import:csv',
    'export:data',
    // Additional regional permissions
    'view:facilities',
    'switch:facility',
  ],
  superuser: [
    // All permissions
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    'view:settings',
    'view:users',
    'view:facilities',
    'create:resident',
    'edit:resident',
    'discharge:resident',
    'delete:resident',
    'assign:bed',
    'move:resident',
    'set:isolation',
    'manage:beds',
    'manage:rooms',
    'manage:wings',
    'manage:facility',
    'manage:users',
    'manage:user_roles',
    'manage:facilities',
    'import:csv',
    'export:data',
    'switch:facility',
  ],
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role];
  return rolePermissions?.includes(permission) ?? false;
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false;

  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false;

  return permissions.every(permission => hasPermission(user, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Get the hierarchy level of a role (higher = more privileges)
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if roleA is higher than or equal to roleB in the hierarchy
 */
export function isRoleHigherOrEqual(roleA: UserRole, roleB: UserRole): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

/**
 * Check if roleA is strictly higher than roleB in the hierarchy
 */
export function isRoleHigher(roleA: UserRole, roleB: UserRole): boolean {
  return getRoleLevel(roleA) > getRoleLevel(roleB);
}

/**
 * Get roles that a user can assign to others
 * Users can only assign roles lower than their own
 */
export function getAssignableRoles(userRole: UserRole): UserRole[] {
  const userLevel = getRoleLevel(userRole);
  return ROLE_HIERARCHY.filter((_, index) => index < userLevel);
}

/**
 * Check if a user can manage another user based on role hierarchy
 */
export function canManageUser(manager: User | null, targetUser: User | null): boolean {
  if (!manager || !targetUser) return false;

  // Can always manage yourself (limited)
  if (manager.id === targetUser.id) return true;

  // Superusers can manage everyone
  if (manager.role === 'superuser') return true;

  // Must have higher role to manage
  return isRoleHigher(manager.role, targetUser.role);
}

/**
 * Check if a user can access a specific route
 */
export function canAccessRoute(user: User | null, route: string): boolean {
  if (!user) return false;

  const routePermissions: Record<string, Permission> = {
    '/dashboard': 'view:dashboard',
    '/residents': 'view:residents',
    '/analytics': 'view:analytics',
    '/reports': 'view:reports',
    '/settings': 'view:settings',
    '/admissions': 'create:resident',
    '/admin': 'manage:users',
    '/users': 'view:users',
    '/facilities': 'view:facilities',
  };

  const requiredPermission = routePermissions[route];
  if (!requiredPermission) return true; // Default allow for unprotected routes

  return hasPermission(user, requiredPermission);
}

/**
 * Check if a user can perform resident operations
 */
export function canManageResidents(user: User | null): boolean {
  return hasAnyPermission(user, ['create:resident', 'edit:resident', 'discharge:resident']);
}

/**
 * Check if a user can perform bed/room operations
 */
export function canManageFacility(user: User | null): boolean {
  return hasAnyPermission(user, ['manage:beds', 'manage:rooms', 'manage:wings', 'manage:facility']);
}

/**
 * Check if a user is a superuser
 */
export function isSuperuser(user: User | null): boolean {
  return user?.role === 'superuser';
}

/**
 * Check if a user is supervisor or higher
 */
export function isSupervisorOrHigher(user: User | null): boolean {
  if (!user) return false;
  return isRoleHigherOrEqual(user.role, 'supervisor');
}

/**
 * Check if a user is regional or higher
 */
export function isRegionalOrHigher(user: User | null): boolean {
  if (!user) return false;
  return isRoleHigherOrEqual(user.role, 'regional');
}

/**
 * Check if a user can switch facilities
 */
export function canSwitchFacility(user: User | null): boolean {
  return hasPermission(user, 'switch:facility');
}

/**
 * Check if a user can discharge residents
 */
export function canDischargeResident(user: User | null): boolean {
  return hasPermission(user, 'discharge:resident');
}

/**
 * Check if a user can delete residents
 */
export function canDeleteResident(user: User | null): boolean {
  return hasPermission(user, 'delete:resident');
}

/**
 * Check if a user can manage other users
 */
export function canManageUsers(user: User | null): boolean {
  return hasPermission(user, 'manage:users');
}

/**
 * Get display-friendly role name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    user: 'User',
    supervisor: 'Supervisor',
    regional: 'Regional Manager',
    superuser: 'Super User',
  };
  return displayNames[role] ?? role;
}

/**
 * Get role badge color classes
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    user: 'bg-gray-100 text-gray-800',
    supervisor: 'bg-blue-100 text-blue-800',
    regional: 'bg-purple-100 text-purple-800',
    superuser: 'bg-red-100 text-red-800',
  };
  return colors[role] ?? 'bg-gray-100 text-gray-800';
}
