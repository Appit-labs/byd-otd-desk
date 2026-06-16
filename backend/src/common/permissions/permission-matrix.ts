import { UserRole } from '../../database/entities/user.entity.js';

/**
 * Central permission matrix for the BYD OTD Desk application.
 *
 * Maps each role to:
 *  - allowedDepartmentSlugs: which departments the role can perform stage actions on
 *  - allowedPages: which frontend pages the role can access (for reference/documentation)
 *  - canCreateRequest: whether the role can create new car requests
 *  - canCancelArchive: whether the role can cancel/archive requests
 *  - canAccessReports: whether the role can access the Reports dashboard
 *  - canAccessSettings: whether the role can access Settings
 *  - isReadOnly: whether the role is read-only (viewer)
 *
 * Stage actions (start/complete) are controlled via allowedDepartmentSlugs.
 * Route-level access is enforced by @Roles() decorators + RolesGuard.
 */

export interface RolePermissions {
  /** Human-readable label */
  label: string;
  /** Department slugs this role can perform stage transitions (start/complete) on */
  allowedDepartmentSlugs: string[];
  /** Whether this role can create new car requests */
  canCreateRequest: boolean;
  /** Whether this role can cancel or archive requests */
  canCancelArchive: boolean;
  /** Whether this role can access the Reports dashboard */
  canAccessReports: boolean;
  /** Whether this role can access Settings */
  canAccessSettings: boolean;
  /** Whether this role can access the Dashboard page */
  canAccessDashboard: boolean;
  /** Whether this role can access the Tracker page */
  canAccessTracker: boolean;
  /** Whether this role can access the Preview page */
  canAccessPreview: boolean;
  /** Whether this role can manage users (create/edit/deactivate) */
  canManageUsers: boolean;
}

export const PERMISSION_MATRIX: Record<UserRole, RolePermissions> = {
  [UserRole.SUPER_ADMIN]: {
    label: 'Super Admin',
    allowedDepartmentSlugs: [
      'storage',
      'accessories',
      'pdi',
      'finance',
      'delivery',
      'qc',
      'mechanical_check',
      'registration',
    ],
    canCreateRequest: true,
    canCancelArchive: true,
    canAccessReports: true,
    canAccessSettings: true,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: true,
  },

  [UserRole.ADMIN]: {
    label: 'Admin',
    // Admin cannot perform stage actions on any department
    allowedDepartmentSlugs: [],
    canCreateRequest: true,
    canCancelArchive: true,
    canAccessReports: true,
    canAccessSettings: true,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.NVS]: {
    label: 'NVS (Storage)',
    // Stage 1: Dispatch Vehicle
    allowedDepartmentSlugs: ['storage'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.QC_NVS]: {
    label: 'QC NVS',
    // Stage 3: Vehicle Received; Stage 6: Confirm Sent to Accessories; Stage 8: Final Inspection
    allowedDepartmentSlugs: ['qc', 'accessories', 'final_inspection'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.MECHANICAL_CHECK]: {
    label: 'Mechanical Check',
    // Stage 4: Start/Complete Mechanical Check; also GPS confirm after Final Inspection
    allowedDepartmentSlugs: ['mechanical_check', 'gps'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.PDI]: {
    label: 'PDI',
    // Stage 5: Start/Complete PDI
    allowedDepartmentSlugs: ['pdi'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.ACCESSORIES]: {
    label: 'Accessories',
    // Stage 6: Start/Complete Accessories
    allowedDepartmentSlugs: ['accessories'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.REGISTRATION]: {
    label: 'Registration',
    // Stage 7: Register
    allowedDepartmentSlugs: ['registration', 'finance'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.DELIVERY]: {
    label: 'Delivery',
    // Stage 8/9: Confirm Delivery
    allowedDepartmentSlugs: ['delivery'],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: true,
    canAccessTracker: true,
    canAccessPreview: true,
    canManageUsers: false,
  },

  [UserRole.VIEWER]: {
    label: 'Viewer',
    allowedDepartmentSlugs: [],
    canCreateRequest: false,
    canCancelArchive: false,
    canAccessReports: false,
    canAccessSettings: false,
    canAccessDashboard: false,
    canAccessTracker: false,
    canAccessPreview: true,
    canManageUsers: false,
  },
};

/**
 * Check whether a given role is authorized to perform transitions on a given department.
 * Returns true for super_admin, or if the role's allowedDepartmentSlugs includes the
 * department's slug.
 */
export function canRoleTransitionDepartment(
  role: UserRole,
  departmentSlug: string,
): boolean {
  const perms = PERMISSION_MATRIX[role];
  if (!perms) return false;
  return perms.allowedDepartmentSlugs.includes(departmentSlug);
}

/**
 * Get the default frontend page path for a given role.
 */
export function getDefaultPathForRole(role: UserRole): string {
  const perms = PERMISSION_MATRIX[role];
  if (!perms) return '/login';
  if (perms.canAccessDashboard) return '/dashboard';
  if (perms.canAccessTracker) return '/tracker';
  if (perms.canAccessPreview) return '/preview';
  return '/login';
}

/**
 * Returns all roles that are allowed to access a given department slug.
 */
export function getRolesForDepartment(departmentSlug: string): UserRole[] {
  return Object.entries(PERMISSION_MATRIX)
    .filter(([, perms]) => perms.allowedDepartmentSlugs.includes(departmentSlug))
    .map(([role]) => role as UserRole);
}
