// backend/src/common/decorators/current-user.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  SetMetadata,
} from "@nestjs/common";
import { Request } from "express";
import { Reflector } from "@nestjs/core";

// -------- INTERFACES AND TYPES --------

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  isActive: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  profile?: {
    bio: string | null;
    status: string | null;
    avatarUrl: string | null;
  };
  roles?: string[];
  permissions?: string[];
  [key: string]: any; // for flexibility
}

export type UserField = keyof AuthUser | string;
export type UserFieldOrArray = UserField | UserField[];

export interface CurrentUserOptions {
  /**
   * If true, returns null when no user is present instead of throwing.
   * @default false
   */
  optional?: boolean;

  /**
   * If true, validates that the user is active.
   * @default true
   */
  validateActive?: boolean;

  /**
   * If true, validates that the user's email is verified.
   * @default false (because email verification might not be required for all routes)
   */
  validateVerified?: boolean;

  /**
   * Required roles the user must have.
   */
  roles?: string[];

  /**
   * Required permissions the user must have.
   */
  permissions?: string[];

  /**
   * Custom error message when validation fails.
   */
  errorMessage?: string;
}

// -------- DECORATOR FACTORY --------

/**
 * Decorator that injects the authenticated user from the request.
 * Can be used to select specific fields, make the user optional, or validate roles/permissions.
 *
 * @example
 * // Get full user object
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthUser) { ... }
 *
 * @example
 * // Get only the user ID
 * @Get('my-posts')
 * getMyPosts(@CurrentUser('id') userId: string) { ... }
 *
 * @example
 * // Get multiple fields as an object
 * @Get('info')
 * getInfo(@CurrentUser(['id', 'email', 'displayName']) user: Pick<AuthUser, 'id' | 'email' | 'displayName'>) { ... }
 *
 * @example
 * // Optional user (returns null if not authenticated)
 * @Get('public-data')
 * getPublicData(@CurrentUser({ optional: true }) user?: AuthUser | null) { ... }
 *
 * @example
 * // Require specific roles
 * @Get('admin')
 * @Roles('admin')
 * getAdminData(@CurrentUser({ roles: ['admin'] }) user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (
    data: UserFieldOrArray | CurrentUserOptions | undefined,
    ctx: ExecutionContext,
  ): any => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | null | undefined;

    // ---- 1. Parse options ----
    let field: UserFieldOrArray | undefined;
    let options: CurrentUserOptions = {};

    if (data === undefined || data === null) {
      // No data: return full user
      field = undefined;
    } else if (typeof data === "string" || Array.isArray(data)) {
      // Field selection
      field = data;
    } else if (typeof data === "object") {
      // Options object
      options = data as CurrentUserOptions;
      // If options has a `field` property, use it
      if ("field" in options && options.field) {
        field = options.field as UserFieldOrArray;
      }
    }

    // ---- 2. Validate user presence ----
    if (!user) {
      if (options.optional) {
        return null;
      }
      // If not optional and no user, throw Unauthorized
      const message =
        options.errorMessage || "Authentication required. Please log in.";
      throw new UnauthorizedException(message);
    }

    // ---- 3. Validate user is active ----
    if (options.validateActive !== false) {
      if (!user.isActive) {
        const message =
          options.errorMessage ||
          "Your account has been suspended. Please contact support.";
        throw new ForbiddenException(message);
      }
    }

    // ---- 4. Validate user is verified (if requested) ----
    if (options.validateVerified) {
      if (!user.isVerified) {
        const message =
          options.errorMessage ||
          "Please verify your email address to continue.";
        throw new ForbiddenException(message);
      }
    }

    // ---- 5. Validate roles ----
    if (options.roles && options.roles.length > 0) {
      const userRoles = user.roles || [];
      const hasRequiredRole = options.roles.some((role) =>
        userRoles.includes(role),
      );
      if (!hasRequiredRole) {
        const message =
          options.errorMessage ||
          `Insufficient roles. Required: ${options.roles.join(", ")}`;
        throw new ForbiddenException(message);
      }
    }

    // ---- 6. Validate permissions ----
    if (options.permissions && options.permissions.length > 0) {
      const userPermissions = user.permissions || [];
      const hasRequiredPermissions = options.permissions.every((perm) =>
        userPermissions.includes(perm),
      );
      if (!hasRequiredPermissions) {
        const message =
          options.errorMessage ||
          `Insufficient permissions. Required: ${options.permissions.join(", ")}`;
        throw new ForbiddenException(message);
      }
    }

    // ---- 7. Extract field(s) ----
    if (field === undefined) {
      // Return full user object
      return user;
    }

    if (typeof field === "string") {
      // Single field
      const value = (user as any)[field];
      if (value === undefined) {
        const message =
          options.errorMessage || `User field '${field}' not found.`;
        throw new BadRequestException(message);
      }
      return value;
    }

    if (Array.isArray(field)) {
      // Multiple fields: return an object with only those fields
      const result: Record<string, any> = {};
      for (const f of field) {
        const value = (user as any)[f];
        if (value === undefined) {
          const message =
            options.errorMessage || `User field '${f}' not found.`;
          throw new BadRequestException(message);
        }
        result[f] = value;
      }
      return result;
    }

    // Should never reach here
    return user;
  },
  [
    // Additional metadata to help with Swagger/OpenAPI
    (target: any, key: string) => {
      // We can add metadata to indicate the user parameter type
      // This is used by the Swagger plugin to generate better docs
      Reflect.defineMetadata("swagger:param:type", "AuthUser", target, key);
    },
  ],
);

// -------- ALIAS DECORATORS --------

/**
 * Alias for @CurrentUser() – returns the full authenticated user.
 * @example
 * @Get('profile')
 * getProfile(@User() user: AuthUser) { ... }
 */
export const User = CurrentUser;

/**
 * Alias for @CurrentUser() – returns the full authenticated user.
 * @example
 * @Get('profile')
 * getProfile(@ReqUser() user: AuthUser) { ... }
 */
export const ReqUser = CurrentUser;

/**
 * Returns the authenticated user, or null if not authenticated (optional).
 * @example
 * @Get('public')
 * getPublic(@CurrentUserOrGuest() user: AuthUser | null) { ... }
 */
export const CurrentUserOrGuest = (data?: CurrentUserOptions) =>
  CurrentUser({
    ...(typeof data === "object" ? data : {}),
    optional: true,
  });

/**
 * Returns only the user ID.
 * @example
 * @Get('my-id')
 * getMyId(@UserId() userId: string) { ... }
 */
export const UserId = (options?: CurrentUserOptions) =>
  CurrentUser({
    ...(typeof options === "object" ? options : {}),
    field: "id",
  });

/**
 * Returns only the user email.
 * @example
 * @Get('my-email')
 * getMyEmail(@UserEmail() email: string) { ... }
 */
export const UserEmail = (options?: CurrentUserOptions) =>
  CurrentUser({
    ...(typeof options === "object" ? options : {}),
    field: "email",
  });

// -------- UTILITY FUNCTIONS --------

/**
 * Safely extract the current user from the request object (for use in middleware or services).
 * @param request - Express request object
 * @param options - optional configuration
 * @returns AuthUser or null
 */
export function getUserFromRequest(
  request: Request,
  options: { throwIfMissing?: boolean; validateActive?: boolean } = {},
): AuthUser | null {
  const user = request.user as AuthUser | null | undefined;

  if (!user) {
    if (options.throwIfMissing) {
      throw new UnauthorizedException("Authentication required.");
    }
    return null;
  }

  if (options.validateActive !== false && !user.isActive) {
    if (options.throwIfMissing) {
      throw new ForbiddenException("Account is suspended.");
    }
    return null;
  }

  return user;
}

/**
 * Type guard to check if a user object is present and valid.
 */
export function isAuthenticatedUser(user: any): user is AuthUser {
  return user && typeof user === "object" && "id" in user && "email" in user;
}

/**
 * Check if the current user has a specific role.
 * @param user - AuthUser or null
 * @param role - role to check
 * @returns boolean
 */
export function hasRole(user: AuthUser | null, role: string): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  return roles.includes(role) || user.isAdmin;
}

/**
 * Check if the current user has all required roles.
 * @param user - AuthUser or null
 * @param requiredRoles - array of roles
 * @returns boolean
 */
export function hasAllRoles(
  user: AuthUser | null,
  requiredRoles: string[],
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const userRoles = user.roles || [];
  return requiredRoles.every((role) => userRoles.includes(role));
}

/**
 * Check if the current user has any of the required roles.
 * @param user - AuthUser or null
 * @param requiredRoles - array of roles
 * @returns boolean
 */
export function hasAnyRole(
  user: AuthUser | null,
  requiredRoles: string[],
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const userRoles = user.roles || [];
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Check if the current user has a specific permission.
 * @param user - AuthUser or null
 * @param permission - permission to check
 * @returns boolean
 */
export function hasPermission(
  user: AuthUser | null,
  permission: string,
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const permissions = user.permissions || [];
  return permissions.includes(permission);
}

/**
 * Check if the current user has all required permissions.
 * @param user - AuthUser or null
 * @param requiredPermissions - array of permissions
 * @returns boolean
 */
export function hasAllPermissions(
  user: AuthUser | null,
  requiredPermissions: string[],
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const permissions = user.permissions || [];
  return requiredPermissions.every((p) => permissions.includes(p));
}

/**
 * Check if the current user has any of the required permissions.
 * @param user - AuthUser or null
 * @param requiredPermissions - array of permissions
 * @returns boolean
 */
export function hasAnyPermission(
  user: AuthUser | null,
  requiredPermissions: string[],
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const permissions = user.permissions || [];
  return requiredPermissions.some((p) => permissions.includes(p));
}

/**
 * Get a specific field from the user object safely.
 * @param user - AuthUser or null
 * @param field - field name
 * @param defaultValue - value to return if field is missing
 * @returns the field value or defaultValue
 */
export function getUserField<T = any>(
  user: AuthUser | null,
  field: string,
  defaultValue?: T,
): T | undefined {
  if (!user) return defaultValue;
  const value = (user as any)[field];
  return value !== undefined ? value : defaultValue;
}

/**
 * Return a sanitized user object with sensitive fields removed.
 * @param user - AuthUser
 * @returns sanitized object with only public fields
 */
export function sanitizeUser(user: AuthUser): Partial<AuthUser> {
  if (!user) return {};
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    isVerified: user.isVerified,
    profile: user.profile,
    // roles and permissions are not exposed by default
  };
}

/**
 * Check if the current user is the owner of a given resource (by ID).
 * @param user - AuthUser or null
 * @param ownerId - ID of the resource owner
 * @returns boolean
 */
export function isOwner(user: AuthUser | null, ownerId: string): boolean {
  if (!user) return false;
  return user.id === ownerId;
}

/**
 * Check if the current user is an admin.
 * @param user - AuthUser or null
 * @returns boolean
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.isAdmin === true;
}

/**
 * Check if the current user is active.
 * @param user - AuthUser or null
 * @returns boolean
 */
export function isActive(user: AuthUser | null): boolean {
  return user?.isActive === true;
}

/**
 * Check if the current user is verified.
 * @param user - AuthUser or null
 * @returns boolean
 */
export function isVerified(user: AuthUser | null): boolean {
  return user?.isVerified === true;
}

/**
 * Get the user's display name, with fallback.
 * @param user - AuthUser or null
 * @param fallback - fallback string
 * @returns display name or fallback
 */
export function getUserDisplayName(
  user: AuthUser | null,
  fallback: string = "Guest",
): string {
  if (!user) return fallback;
  return user.displayName || user.email || fallback;
}

/**
 * Get the user's avatar URL, with fallback.
 * @param user - AuthUser or null
 * @param fallback - fallback URL
 * @returns avatar URL or fallback
 */
export function getUserAvatar(
  user: AuthUser | null,
  fallback: string = "",
): string {
  if (!user) return fallback;
  return user.profile?.avatarUrl || fallback;
}

/**
 * Check if the current user has access to a resource based on ownership or admin status.
 * @param user - AuthUser or null
 * @param ownerId - ID of the resource owner
 * @param allowAdmin - if true, admin bypasses ownership check
 * @returns boolean
 */
export function hasAccessToResource(
  user: AuthUser | null,
  ownerId: string,
  allowAdmin: boolean = true,
): boolean {
  if (!user) return false;
  if (allowAdmin && user.isAdmin) return true;
  return user.id === ownerId;
}

// -------- METADATA DECORATORS (for roles/permissions) --------
// These are useful to combine with @CurrentUser validation, but also used by guards.

export const ROLES_KEY = "roles";
export const PERMISSIONS_KEY = "permissions";

/**
 * Decorator to set required roles on a route.
 * @param roles - list of role names
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to set required permissions on a route.
 * @param permissions - list of permission names
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to mark a route as public (no authentication required).
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Decorator to mark a route as optional authentication (user may or may not be present).
 */
export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

// -------- CLASSES FOR TYPE SAFETY --------

/**
 * A simple class to represent the authenticated user.
 * Can be used to type the request.user object.
 */
export class UserEntity implements AuthUser {
  id!: string;
  email!: string;
  phone!: string | null;
  displayName!: string;
  isActive!: boolean;
  isAdmin!: boolean;
  isVerified!: boolean;
  profile?: {
    bio: string | null;
    status: string | null;
    avatarUrl: string | null;
  };
  roles?: string[];
  permissions?: string[];
  [key: string]: any;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }

  /**
   * Check if this user has a specific role.
   */
  hasRole(role: string): boolean {
    return hasRole(this, role);
  }

  /**
   * Check if this user has all required roles.
   */
  hasAllRoles(roles: string[]): boolean {
    return hasAllRoles(this, roles);
  }

  /**
   * Check if this user has any of the required roles.
   */
  hasAnyRole(roles: string[]): boolean {
    return hasAnyRole(this, roles);
  }

  /**
   * Check if this user has a specific permission.
   */
  hasPermission(permission: string): boolean {
    return hasPermission(this, permission);
  }

  /**
   * Check if this user has all required permissions.
   */
  hasAllPermissions(permissions: string[]): boolean {
    return hasAllPermissions(this, permissions);
  }

  /**
   * Check if this user has any of the required permissions.
   */
  hasAnyPermission(permissions: string[]): boolean {
    return hasAnyPermission(this, permissions);
  }

  /**
   * Check if this user is the owner of a resource.
   */
  isOwner(resourceOwnerId: string): boolean {
    return isOwner(this, resourceOwnerId);
  }

  /**
   * Get a sanitized version of the user.
   */
  sanitize(): Partial<UserEntity> {
    return sanitizeUser(this);
  }

  /**
   * Get the user's display name.
   */
  getDisplayName(fallback: string = "User"): string {
    return getUserDisplayName(this, fallback);
  }

  /**
   * Get the user's avatar URL.
   */
  getAvatar(fallback: string = ""): string {
    return getUserAvatar(this, fallback);
  }
}

// -------- END --------
