import type { UserRole, User } from '../types';

/**
 * Permission definitions for role-based access control
 */
export type Permission =
  | 'view:dashboard'
  | 'view:residents'
  | 'view:analytics'
  | 'view:reports'
  | 'view:settings'
  | 'create:resident'
  | 'edit:resident'
  | 'discharge:resident'
  | 'delete:resident'
  | 'assign:bed'
  | 'move:resident'
  | 'set:isolation'
  | 'manage:beds'
  | 'manage:rooms'
  | 'manage:wings'
  | 'manage:facility'
  | 'import:csv'
  | 'export:data';

/**
 * Role-based permission matrix
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    'view:settings',
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
    'import:csv',
    'export:data',
  ],
  nurse: [
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
  ],
  doctor: [
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    'edit:resident',
    'set:isolation',
    'export:data',
  ],
  clerk: [
    'view:dashboard',
    'view:residents',
    'view:analytics',
    'view:reports',
    'create:resident',
    'edit:resident',
    'assign:bed',
    'export:data',
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
 * Check if a user is an admin
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
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
 * Get display-friendly role name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    admin: 'Administrator',
    nurse: 'Nurse',
    doctor: 'Doctor',
    clerk: 'Clerk',
  };
  return displayNames[role] ?? role;
}
