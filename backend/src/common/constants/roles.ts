// backend/src/common/constants/roles.ts
/**
 * 📄 Roles and Permissions Constants
 *
 * This file defines all user roles, permissions, and the permission matrix
 * used throughout the Real WhatsApp Clone application.
 *
 * @category Constants
 * @module Roles
 */

// -------- ENUMS --------

/**
 * User roles in the system.
 */
export enum UserRole {
  /** Super Admin – full system access */
  SUPER_ADMIN = "super_admin",
  /** Admin – administrative access */
  ADMIN = "admin",
  /** Moderator – content moderation access */
  MODERATOR = "moderator",
  /** User – standard authenticated user */
  USER = "user",
  /** Guest – unauthenticated user (limited access) */
  GUEST = "guest",
  /** Banned – banned/suspended user (no access) */
  BANNED = "banned",
  /** System – internal system user */
  SYSTEM = "system",
}

/**
 * Permission resources (what the permission applies to).
 */
export enum PermissionResource {
  USER = "user",
  MESSAGE = "message",
  GROUP = "group",
  CALL = "call",
  FILE = "file",
  ADMIN = "admin",
  SYSTEM = "system",
  NOTIFICATION = "notification",
  CONTACT = "contact",
  AUDIT = "audit",
}

/**
 * Permission actions (what can be done).
 */
export enum PermissionAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  MANAGE = "manage",
  SUSPEND = "suspend",
  UNSUSPEND = "unsuspend",
  PROMOTE = "promote",
  DEMOTE = "demote",
  BLOCK = "block",
  UNBLOCK = "unblock",
  REPORT = "report",
  ANALYZE = "analyze",
  EXPORT = "export",
  IMPORT = "import",
  CONFIGURE = "configure",
  APPROVE = "approve",
  REJECT = "reject",
  VIEW = "view",
  EDIT = "edit",
  REMOVE = "remove",
  SEND = "send",
  RECEIVE = "receive",
  READ_ALL = "read_all",
  WRITE_ALL = "write_all",
  DELETE_ALL = "delete_all",
}

// -------- PERMISSION DEFINITIONS --------

/**
 * Permission definition combining resource and action.
 */
export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
}

/**
 * Permission string format: 'resource:action'
 * Example: 'user:create', 'message:delete'
 */
export type PermissionString = `${PermissionResource}:${PermissionAction}`;

/**
 * Build a permission string from resource and action.
 */
export function buildPermission(
  resource: PermissionResource,
  action: PermissionAction,
): PermissionString {
  return `${resource}:${action}`;
}

/**
 * Parse a permission string into resource and action.
 */
export function parsePermission(
  permission: PermissionString,
): { resource: PermissionResource; action: PermissionAction } | null {
  const parts = permission.split(":");
  if (parts.length !== 2) return null;

  const resource = parts[0] as PermissionResource;
  const action = parts[1] as PermissionAction;

  if (!Object.values(PermissionResource).includes(resource)) return null;
  if (!Object.values(PermissionAction).includes(action)) return null;

  return { resource, action };
}

// -------- PERMISSION CONSTANTS --------

/**
 * All available permissions in the system.
 */
export const PERMISSIONS = {
  // User permissions
  USER_CREATE: buildPermission(
    PermissionResource.USER,
    PermissionAction.CREATE,
  ),
  USER_READ: buildPermission(PermissionResource.USER, PermissionAction.READ),
  USER_UPDATE: buildPermission(
    PermissionResource.USER,
    PermissionAction.UPDATE,
  ),
  USER_DELETE: buildPermission(
    PermissionResource.USER,
    PermissionAction.DELETE,
  ),
  USER_SUSPEND: buildPermission(
    PermissionResource.USER,
    PermissionAction.SUSPEND,
  ),
  USER_UNSUSPEND: buildPermission(
    PermissionResource.USER,
    PermissionAction.UNSUSPEND,
  ),
  USER_PROMOTE: buildPermission(
    PermissionResource.USER,
    PermissionAction.PROMOTE,
  ),
  USER_DEMOTE: buildPermission(
    PermissionResource.USER,
    PermissionAction.DEMOTE,
  ),
  USER_BLOCK: buildPermission(PermissionResource.USER, PermissionAction.BLOCK),
  USER_UNBLOCK: buildPermission(
    PermissionResource.USER,
    PermissionAction.UNBLOCK,
  ),
  USER_MANAGE: buildPermission(
    PermissionResource.USER,
    PermissionAction.MANAGE,
  ),
  USER_READ_ALL: buildPermission(
    PermissionResource.USER,
    PermissionAction.READ_ALL,
  ),

  // Message permissions
  MESSAGE_SEND: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.SEND,
  ),
  MESSAGE_RECEIVE: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.RECEIVE,
  ),
  MESSAGE_READ: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.READ,
  ),
  MESSAGE_EDIT: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.EDIT,
  ),
  MESSAGE_DELETE: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.DELETE,
  ),
  MESSAGE_MANAGE: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.MANAGE,
  ),
  MESSAGE_READ_ALL: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.READ_ALL,
  ),
  MESSAGE_DELETE_ALL: buildPermission(
    PermissionResource.MESSAGE,
    PermissionAction.DELETE_ALL,
  ),

  // Group permissions
  GROUP_CREATE: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.CREATE,
  ),
  GROUP_READ: buildPermission(PermissionResource.GROUP, PermissionAction.READ),
  GROUP_UPDATE: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.UPDATE,
  ),
  GROUP_DELETE: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.DELETE,
  ),
  GROUP_MANAGE: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.MANAGE,
  ),
  GROUP_PROMOTE: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.PROMOTE,
  ),
  GROUP_DEMOTE: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.DEMOTE,
  ),
  GROUP_READ_ALL: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.READ_ALL,
  ),
  GROUP_DELETE_ALL: buildPermission(
    PermissionResource.GROUP,
    PermissionAction.DELETE_ALL,
  ),

  // Call permissions
  CALL_INITIATE: buildPermission(
    PermissionResource.CALL,
    PermissionAction.CREATE,
  ),
  CALL_ANSWER: buildPermission(PermissionResource.CALL, PermissionAction.READ),
  CALL_END: buildPermission(PermissionResource.CALL, PermissionAction.DELETE),
  CALL_MANAGE: buildPermission(
    PermissionResource.CALL,
    PermissionAction.MANAGE,
  ),

  // File permissions
  FILE_UPLOAD: buildPermission(
    PermissionResource.FILE,
    PermissionAction.CREATE,
  ),
  FILE_READ: buildPermission(PermissionResource.FILE, PermissionAction.READ),
  FILE_DELETE: buildPermission(
    PermissionResource.FILE,
    PermissionAction.DELETE,
  ),
  FILE_MANAGE: buildPermission(
    PermissionResource.FILE,
    PermissionAction.MANAGE,
  ),

  // Admin permissions
  ADMIN_ACCESS: buildPermission(
    PermissionResource.ADMIN,
    PermissionAction.VIEW,
  ),
  ADMIN_CONFIG: buildPermission(
    PermissionResource.ADMIN,
    PermissionAction.CONFIGURE,
  ),
  ADMIN_APPROVE: buildPermission(
    PermissionResource.ADMIN,
    PermissionAction.APPROVE,
  ),
  ADMIN_REJECT: buildPermission(
    PermissionResource.ADMIN,
    PermissionAction.REJECT,
  ),
  ADMIN_EXPORT: buildPermission(
    PermissionResource.ADMIN,
    PermissionAction.EXPORT,
  ),
  ADMIN_IMPORT: buildPermission(
    PermissionResource.ADMIN,
    PermissionAction.IMPORT,
  ),

  // System permissions
  SYSTEM_VIEW: buildPermission(
    PermissionResource.SYSTEM,
    PermissionAction.VIEW,
  ),
  SYSTEM_CONFIG: buildPermission(
    PermissionResource.SYSTEM,
    PermissionAction.CONFIGURE,
  ),
  SYSTEM_ANALYZE: buildPermission(
    PermissionResource.SYSTEM,
    PermissionAction.ANALYZE,
  ),

  // Notification permissions
  NOTIFICATION_SEND: buildPermission(
    PermissionResource.NOTIFICATION,
    PermissionAction.CREATE,
  ),
  NOTIFICATION_READ: buildPermission(
    PermissionResource.NOTIFICATION,
    PermissionAction.READ,
  ),
  NOTIFICATION_DELETE: buildPermission(
    PermissionResource.NOTIFICATION,
    PermissionAction.DELETE,
  ),

  // Contact permissions
  CONTACT_ADD: buildPermission(
    PermissionResource.CONTACT,
    PermissionAction.CREATE,
  ),
  CONTACT_REMOVE: buildPermission(
    PermissionResource.CONTACT,
    PermissionAction.DELETE,
  ),
  CONTACT_READ: buildPermission(
    PermissionResource.CONTACT,
    PermissionAction.READ,
  ),
  CONTACT_BLOCK: buildPermission(
    PermissionResource.CONTACT,
    PermissionAction.BLOCK,
  ),
  CONTACT_UNBLOCK: buildPermission(
    PermissionResource.CONTACT,
    PermissionAction.UNBLOCK,
  ),

  // Audit permissions
  AUDIT_VIEW: buildPermission(PermissionResource.AUDIT, PermissionAction.VIEW),
  AUDIT_EXPORT: buildPermission(
    PermissionResource.AUDIT,
    PermissionAction.EXPORT,
  ),
} as const;

// -------- ROLE PERMISSION MATRIX --------

/**
 * Permission matrix defining which permissions each role has.
 * This is the single source of truth for authorization.
 */
export const PERMISSION_MATRIX: Record<UserRole, Set<PermissionString>> = {
  [UserRole.SUPER_ADMIN]: new Set<PermissionString>([
    // Super Admin has ALL permissions
    ...Object.values(PERMISSIONS),
  ]),

  [UserRole.ADMIN]: new Set<PermissionString>([
    // User management
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_UNSUSPEND,
    PERMISSIONS.USER_PROMOTE,
    PERMISSIONS.USER_DEMOTE,
    PERMISSIONS.USER_BLOCK,
    PERMISSIONS.USER_UNBLOCK,
    PERMISSIONS.USER_READ_ALL,

    // Message management
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_DELETE,
    PERMISSIONS.MESSAGE_MANAGE,
    PERMISSIONS.MESSAGE_READ_ALL,
    PERMISSIONS.MESSAGE_DELETE_ALL,

    // Group management
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_READ,
    PERMISSIONS.GROUP_UPDATE,
    PERMISSIONS.GROUP_DELETE,
    PERMISSIONS.GROUP_MANAGE,
    PERMISSIONS.GROUP_PROMOTE,
    PERMISSIONS.GROUP_DEMOTE,
    PERMISSIONS.GROUP_READ_ALL,
    PERMISSIONS.GROUP_DELETE_ALL,

    // Call management
    PERMISSIONS.CALL_INITIATE,
    PERMISSIONS.CALL_ANSWER,
    PERMISSIONS.CALL_END,
    PERMISSIONS.CALL_MANAGE,

    // File management
    PERMISSIONS.FILE_UPLOAD,
    PERMISSIONS.FILE_READ,
    PERMISSIONS.FILE_DELETE,
    PERMISSIONS.FILE_MANAGE,

    // Admin
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.ADMIN_CONFIG,
    PERMISSIONS.ADMIN_APPROVE,
    PERMISSIONS.ADMIN_REJECT,
    PERMISSIONS.ADMIN_EXPORT,
    PERMISSIONS.ADMIN_IMPORT,

    // System
    PERMISSIONS.SYSTEM_VIEW,
    PERMISSIONS.SYSTEM_ANALYZE,

    // Notifications
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_DELETE,

    // Contacts
    PERMISSIONS.CONTACT_ADD,
    PERMISSIONS.CONTACT_REMOVE,
    PERMISSIONS.CONTACT_READ,
    PERMISSIONS.CONTACT_BLOCK,
    PERMISSIONS.CONTACT_UNBLOCK,

    // Audit
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ]),

  [UserRole.MODERATOR]: new Set<PermissionString>([
    // User management (limited)
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_UNSUSPEND,
    PERMISSIONS.USER_BLOCK,
    PERMISSIONS.USER_UNBLOCK,

    // Message management
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_DELETE,
    PERMISSIONS.MESSAGE_MANAGE,
    PERMISSIONS.MESSAGE_READ_ALL,
    PERMISSIONS.MESSAGE_DELETE_ALL,

    // Group management
    PERMISSIONS.GROUP_READ,
    PERMISSIONS.GROUP_UPDATE,
    PERMISSIONS.GROUP_DELETE,
    PERMISSIONS.GROUP_MANAGE,
    PERMISSIONS.GROUP_READ_ALL,

    // File management
    PERMISSIONS.FILE_READ,
    PERMISSIONS.FILE_DELETE,

    // Notifications
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_READ,

    // Contacts
    PERMISSIONS.CONTACT_ADD,
    PERMISSIONS.CONTACT_REMOVE,
    PERMISSIONS.CONTACT_READ,

    // Audit
    PERMISSIONS.AUDIT_VIEW,
  ]),

  [UserRole.USER]: new Set<PermissionString>([
    // User (self)
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,

    // Messages (own)
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_RECEIVE,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_EDIT,
    PERMISSIONS.MESSAGE_DELETE,

    // Groups (own)
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_READ,
    PERMISSIONS.GROUP_UPDATE,

    // Calls
    PERMISSIONS.CALL_INITIATE,
    PERMISSIONS.CALL_ANSWER,
    PERMISSIONS.CALL_END,

    // Files (own)
    PERMISSIONS.FILE_UPLOAD,
    PERMISSIONS.FILE_READ,

    // Notifications
    PERMISSIONS.NOTIFICATION_READ,

    // Contacts
    PERMISSIONS.CONTACT_ADD,
    PERMISSIONS.CONTACT_REMOVE,
    PERMISSIONS.CONTACT_READ,
    PERMISSIONS.CONTACT_BLOCK,
    PERMISSIONS.CONTACT_UNBLOCK,
  ]),

  [UserRole.GUEST]: new Set<PermissionString>([
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.GROUP_READ,
  ]),

  [UserRole.BANNED]: new Set<PermissionString>([]),

  [UserRole.SYSTEM]: new Set<PermissionString>([
    PERMISSIONS.SYSTEM_VIEW,
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.SYSTEM_ANALYZE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.USER_READ_ALL,
    PERMISSIONS.MESSAGE_READ_ALL,
  ]),
};

// -------- ROLE HIERARCHY --------

/**
 * Role hierarchy defining inheritance.
 * Higher priority roles inherit permissions from lower priority roles.
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.SUPER_ADMIN]: [],
  [UserRole.ADMIN]: [UserRole.SUPER_ADMIN],
  [UserRole.MODERATOR]: [UserRole.ADMIN],
  [UserRole.USER]: [UserRole.MODERATOR, UserRole.GUEST],
  [UserRole.GUEST]: [],
  [UserRole.BANNED]: [],
  [UserRole.SYSTEM]: [UserRole.ADMIN],
};

/**
 * Role priority (higher number = higher priority).
 */
export const ROLE_PRIORITY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MODERATOR]: 60,
  [UserRole.USER]: 40,
  [UserRole.GUEST]: 20,
  [UserRole.BANNED]: 0,
  [UserRole.SYSTEM]: 90,
};

// -------- ROLE UTILITIES --------

/**
 * Get all permissions for a role (including inherited).
 */
export function getRolePermissions(role: UserRole): Set<PermissionString> {
  const permissions = new Set<PermissionString>();
  const visited = new Set<UserRole>();

  const collect = (r: UserRole) => {
    if (visited.has(r)) return;
    visited.add(r);

    // Add role's own permissions
    const rolePerms = PERMISSION_MATRIX[r];
    if (rolePerms) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }

    // Add inherited permissions
    const inherits = ROLE_HIERARCHY[r] || [];
    for (const inherit of inherits) {
      collect(inherit);
    }
  };

  collect(role);
  return permissions;
}

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(
  role: UserRole,
  permission: PermissionString,
): boolean {
  const permissions = getRolePermissions(role);
  return permissions.has(permission);
}

/**
 * Check if a role has all specified permissions.
 */
export function roleHasAllPermissions(
  role: UserRole,
  permissions: PermissionString[],
): boolean {
  const rolePerms = getRolePermissions(role);
  return permissions.every((p) => rolePerms.has(p));
}

/**
 * Check if a role has any of the specified permissions.
 */
export function roleHasAnyPermission(
  role: UserRole,
  permissions: PermissionString[],
): boolean {
  const rolePerms = getRolePermissions(role);
  return permissions.some((p) => rolePerms.has(p));
}

/**
 * Get all permissions for a list of roles (union).
 */
export function getRolesPermissions(roles: UserRole[]): Set<PermissionString> {
  const permissions = new Set<PermissionString>();
  for (const role of roles) {
    const rolePerms = getRolePermissions(role);
    for (const perm of rolePerms) {
      permissions.add(perm);
    }
  }
  return permissions;
}

/**
 * Check if a user has a specific permission based on their roles.
 */
export function userHasPermission(
  roles: UserRole[],
  permission: PermissionString,
): boolean {
  const permissions = getRolesPermissions(roles);
  return permissions.has(permission);
}

/**
 * Check if a user has all specified permissions.
 */
export function userHasAllPermissions(
  roles: UserRole[],
  permissions: PermissionString[],
): boolean {
  const userPerms = getRolesPermissions(roles);
  return permissions.every((p) => userPerms.has(p));
}

/**
 * Check if a user has any of the specified permissions.
 */
export function userHasAnyPermission(
  roles: UserRole[],
  permissions: PermissionString[],
): boolean {
  const userPerms = getRolesPermissions(roles);
  return permissions.some((p) => userPerms.has(p));
}

/**
 * Get the highest priority role from a list.
 */
export function getHighestPriorityRole(roles: UserRole[]): UserRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((a, b) => (ROLE_PRIORITY[a] > ROLE_PRIORITY[b] ? a : b));
}

/**
 * Check if a role has higher priority than another.
 */
export function hasHigherPriority(role1: UserRole, role2: UserRole): boolean {
  return ROLE_PRIORITY[role1] > ROLE_PRIORITY[role2];
}

/**
 * Check if a role has equal or higher priority than another.
 */
export function hasEqualOrHigherPriority(
  role1: UserRole,
  role2: UserRole,
): boolean {
  return ROLE_PRIORITY[role1] >= ROLE_PRIORITY[role2];
}

// -------- PERMISSION VALIDATION --------

/**
 * Validate that a permission string is valid.
 */
export function isValidPermission(
  permission: string,
): permission is PermissionString {
  const parsed = parsePermission(permission as PermissionString);
  return parsed !== null;
}

/**
 * Get all available permissions as an array.
 */
export function getAllPermissions(): PermissionString[] {
  return Object.values(PERMISSIONS);
}

/**
 * Get permissions by resource.
 */
export function getPermissionsByResource(
  resource: PermissionResource,
): PermissionString[] {
  return Object.values(PERMISSIONS).filter((p) => {
    const parsed = parsePermission(p);
    return parsed?.resource === resource;
  });
}

/**
 * Get all roles as an array.
 */
export function getAllRoles(): UserRole[] {
  return Object.values(UserRole);
}

/**
 * Get roles with at least one permission.
 */
export function getRolesWithPermissions(): UserRole[] {
  return Object.values(UserRole).filter((role) => {
    const perms = PERMISSION_MATRIX[role];
    return perms && perms.size > 0;
  });
}

// -------- ROLE MANAGEMENT UTILITIES --------

/**
 * Role manager class for runtime role operations.
 */
export class RoleManager {
  private static instance: RoleManager;
  private rolePermissionsCache = new Map<UserRole, Set<PermissionString>>();
  private cacheEnabled = true;

  private constructor() {
    this.refreshCache();
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): RoleManager {
    if (!RoleManager.instance) {
      RoleManager.instance = new RoleManager();
    }
    return RoleManager.instance;
  }

  /**
   * Refresh the permission cache.
   */
  refreshCache(): void {
    this.rolePermissionsCache.clear();
    for (const role of Object.values(UserRole)) {
      this.rolePermissionsCache.set(role, getRolePermissions(role));
    }
  }

  /**
   * Get permissions for a role (cached).
   */
  getRolePermissions(role: UserRole): Set<PermissionString> {
    if (!this.cacheEnabled) {
      return getRolePermissions(role);
    }
    const cached = this.rolePermissionsCache.get(role);
    if (cached) {
      return new Set(cached);
    }
    const perms = getRolePermissions(role);
    this.rolePermissionsCache.set(role, perms);
    return new Set(perms);
  }

  /**
   * Check if a role has a permission.
   */
  hasPermission(role: UserRole, permission: PermissionString): boolean {
    return this.getRolePermissions(role).has(permission);
  }

  /**
   * Check if a user has a permission.
   */
  userHasPermission(roles: UserRole[], permission: PermissionString): boolean {
    const allPerms = new Set<PermissionString>();
    for (const role of roles) {
      const perms = this.getRolePermissions(role);
      for (const p of perms) {
        allPerms.add(p);
      }
    }
    return allPerms.has(permission);
  }

  /**
   * Enable or disable caching.
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.rolePermissionsCache.clear();
    }
  }

  /**
   * Clear the cache.
   */
  clearCache(): void {
    this.rolePermissionsCache.clear();
  }

  /**
   * Get all permissions for multiple roles.
   */
  getMultipleRolesPermissions(roles: UserRole[]): Set<PermissionString> {
    const allPerms = new Set<PermissionString>();
    for (const role of roles) {
      const perms = this.getRolePermissions(role);
      for (const p of perms) {
        allPerms.add(p);
      }
    }
    return allPerms;
  }
}

// -------- DECORATORS (for controllers) --------

import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const PERMISSIONS_KEY = "permissions";

/**
 * Decorator to set required roles on a route.
 * @example @Roles(UserRole.ADMIN, UserRole.MODERATOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to set required permissions on a route.
 * @example @Permissions(PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE)
 */
export const Permissions = (...permissions: PermissionString[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to require admin access.
 */
export const Admin = () => Roles(UserRole.ADMIN);

/**
 * Decorator to require super admin access.
 */
export const SuperAdmin = () => Roles(UserRole.SUPER_ADMIN);

/**
 * Decorator to require moderator access.
 */
export const Moderator = () => Roles(UserRole.MODERATOR);

// -------- PERMISSION CHECK HELPERS --------

/**
 * Static permission check class for quick validation in services.
 */
export class PermissionChecker {
  /**
   * Check if the user has a specific permission.
   */
  static hasPermission(
    userRoles: UserRole[],
    permission: PermissionString,
  ): boolean {
    return userHasPermission(userRoles, permission);
  }

  /**
   * Check if the user has all specified permissions.
   */
  static hasAllPermissions(
    userRoles: UserRole[],
    permissions: PermissionString[],
  ): boolean {
    return userHasAllPermissions(userRoles, permissions);
  }

  /**
   * Check if the user has any of the specified permissions.
   */
  static hasAnyPermission(
    userRoles: UserRole[],
    permissions: PermissionString[],
  ): boolean {
    return userHasAnyPermission(userRoles, permissions);
  }

  /**
   * Check if the user is an admin.
   */
  static isAdmin(userRoles: UserRole[]): boolean {
    return (
      userRoles.includes(UserRole.ADMIN) ||
      userRoles.includes(UserRole.SUPER_ADMIN)
    );
  }

  /**
   * Check if the user is a super admin.
   */
  static isSuperAdmin(userRoles: UserRole[]): boolean {
    return userRoles.includes(UserRole.SUPER_ADMIN);
  }

  /**
   * Check if the user is a moderator.
   */
  static isModerator(userRoles: UserRole[]): boolean {
    return userRoles.includes(UserRole.MODERATOR);
  }

  /**
   * Check if the user is banned.
   */
  static isBanned(userRoles: UserRole[]): boolean {
    return userRoles.includes(UserRole.BANNED);
  }

  /**
   * Check if the user is a regular user.
   */
  static isRegularUser(userRoles: UserRole[]): boolean {
    return (
      userRoles.includes(UserRole.USER) &&
      !this.isAdmin(userRoles) &&
      !this.isModerator(userRoles)
    );
  }

  /**
   * Get the highest priority role.
   */
  static getHighestRole(userRoles: UserRole[]): UserRole | null {
    return getHighestPriorityRole(userRoles);
  }

  /**
   * Check if one user can manage another based on roles.
   */
  static canManageUser(
    managerRoles: UserRole[],
    targetRoles: UserRole[],
  ): boolean {
    const managerPriority = getHighestPriorityRole(managerRoles);
    const targetPriority = getHighestPriorityRole(targetRoles);
    if (!managerPriority || !targetPriority) return false;
    return hasHigherPriority(managerPriority, targetPriority);
  }

  /**
   * Check if the user has access to a specific resource.
   * This is a convenience method that checks both roles and permissions.
   */
  static hasResourceAccess(
    userRoles: UserRole[],
    resource: PermissionResource,
    action: PermissionAction,
  ): boolean {
    const permission = buildPermission(resource, action);
    return this.hasPermission(userRoles, permission);
  }
}

// -------- ADMIN UTILITIES --------

/**
 * Admin-specific utilities.
 */
export class AdminUtils {
  /**
   * Get all admin roles.
   */
  static getAdminRoles(): UserRole[] {
    return [UserRole.SUPER_ADMIN, UserRole.ADMIN];
  }

  /**
   * Get all management roles (admin + moderator).
   */
  static getManagementRoles(): UserRole[] {
    return [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR];
  }

  /**
   * Check if a role is an admin role.
   */
  static isAdminRole(role: UserRole): boolean {
    return [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(role);
  }

  /**
   * Check if a role is a management role.
   */
  static isManagementRole(role: UserRole): boolean {
    return [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR].includes(
      role,
    );
  }

  /**
   * Get all permissions that admin roles have.
   */
  static getAdminPermissions(): Set<PermissionString> {
    const adminRoles = this.getAdminRoles();
    return getRolesPermissions(adminRoles);
  }

  /**
   * Get the permission diff between two roles.
   */
  static getPermissionDiff(
    role1: UserRole,
    role2: UserRole,
  ): {
    onlyRole1: PermissionString[];
    onlyRole2: PermissionString[];
    common: PermissionString[];
  } {
    const perms1 = getRolePermissions(role1);
    const perms2 = getRolePermissions(role2);

    const onlyRole1: PermissionString[] = [];
    const onlyRole2: PermissionString[] = [];
    const common: PermissionString[] = [];

    for (const p of perms1) {
      if (perms2.has(p)) {
        common.push(p);
      } else {
        onlyRole1.push(p);
      }
    }

    for (const p of perms2) {
      if (!perms1.has(p)) {
        onlyRole2.push(p);
      }
    }

    return { onlyRole1, onlyRole2, common };
  }

  /**
   * Get role hierarchy as a tree.
   */
  static getRoleHierarchyTree(): Record<string, string[]> {
    const tree: Record<string, string[]> = {};
    for (const [role, inherits] of Object.entries(ROLE_HIERARCHY)) {
      tree[role] = inherits.map((r) => r.toString());
    }
    return tree;
  }
}

// -------- PERMISSION MATRIX EXPORTER --------

/**
 * Export permission matrix for documentation or debugging.
 */
export function exportPermissionMatrix(): Record<string, string[]> {
  const matrix: Record<string, string[]> = {};
  for (const role of Object.values(UserRole)) {
    const perms = PERMISSION_MATRIX[role];
    matrix[role] = Array.from(perms).sort();
  }
  return matrix;
}

/**
 * Generate a human-readable permission matrix.
 */
export function generatePermissionMatrixReport(): string {
  const matrix = exportPermissionMatrix();
  let report = "📋 PERMISSION MATRIX\n";
  report += "=".repeat(60) + "\n\n";

  for (const [role, permissions] of Object.entries(matrix)) {
    report += `📌 ${role.toUpperCase()}\n`;
    report += "-".repeat(40) + "\n";
    if (permissions.length === 0) {
      report += "  (No permissions)\n";
    } else {
      for (const perm of permissions) {
        report += `  ✅ ${perm}\n`;
      }
    }
    report += "\n";
  }

  return report;
}

// -------- END --------
