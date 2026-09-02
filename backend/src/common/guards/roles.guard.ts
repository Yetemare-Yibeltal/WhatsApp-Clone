// backend/src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  Inject,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Request } from "express";
import { AuthUser } from "../decorators/current-user.decorator";

// -------- METADATA KEYS (re-exported from decorators file) --------
export const ROLES_KEY = "roles";
export const PERMISSIONS_KEY = "permissions";
export const IS_PUBLIC_KEY = "isPublic";
export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";

export interface RoleDefinition {
  name: string;
  inherits?: string[]; // roles this role inherits from
  permissions: string[]; // explicit permissions granted
}

export interface PermissionsDefinition {
  required: string[]; // list of required permissions
  match: "all" | "any"; // all must be present, or at least one
  negations?: string[]; // permissions that explicitly deny access
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  private readonly enableCaching: boolean;
  private readonly cacheTtl: number;
  private readonly adminBypass: boolean;
  private readonly strictMode: boolean;
  private readonly roleHierarchy: Record<string, RoleDefinition>;

  // In-memory cache for role definitions (loaded from config or DB)
  private roleDefinitionsCache: Record<string, RoleDefinition> = {};

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.enableCaching =
      this.configService.get("ENABLE_PERMISSION_CACHING") !== false;
    this.cacheTtl = parseInt(
      this.configService.get("PERMISSION_CACHE_TTL") || "300",
      10,
    ); // 5 minutes default
    this.adminBypass = this.configService.get("ADMIN_BYPASS") !== false;
    this.strictMode = this.configService.get("AUTH_STRICT_MODE") !== "false";

    // Load role hierarchy from config (optional)
    const hierarchyConfig = this.configService.get("ROLE_HIERARCHY");
    if (hierarchyConfig) {
      try {
        this.roleHierarchy =
          typeof hierarchyConfig === "string"
            ? JSON.parse(hierarchyConfig)
            : hierarchyConfig;
        this.roleDefinitionsCache = { ...this.roleHierarchy };
      } catch (_) {
        this.logger.warn(
          "Failed to parse ROLE_HIERARCHY config; using empty hierarchy.",
        );
        this.roleHierarchy = {};
      }
    } else {
      this.roleHierarchy = {};
    }

    this.logger.log("RolesGuard initialized with config:", {
      enableCaching: this.enableCaching,
      cacheTtl: this.cacheTtl,
      adminBypass: this.adminBypass,
      strictMode: this.strictMode,
      roleCount: Object.keys(this.roleHierarchy).length,
    });
  }

  // ---------------------- MAIN GUARD LOGIC ----------------------
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // ---- 1. Check if route is public ----
    const isPublic =
      this.reflector.get<boolean>(IS_PUBLIC_KEY, handler) ||
      this.reflector.get<boolean>(IS_PUBLIC_KEY, controller);
    if (isPublic) {
      // Allow access (user may or may not be present)
      return true;
    }

    // ---- 2. Check if route is optional auth ----
    const isOptional =
      this.reflector.get<boolean>(IS_OPTIONAL_AUTH_KEY, handler) ||
      this.reflector.get<boolean>(IS_OPTIONAL_AUTH_KEY, controller);
    // Get user from request (attached by JWT guard)
    const user = request.user as AuthUser | null | undefined;

    if (isOptional && !user) {
      // Optional auth and no user present → allow access
      return true;
    }

    // ---- 3. Require user for non-optional routes ----
    if (!user) {
      this.logUnAuthorized(request, "No authenticated user found");
      throw new UnauthorizedException("Authentication required.");
    }

    // ---- 4. Get required roles and permissions from metadata ----
    const requiredRoles =
      this.reflector.get<string[]>(ROLES_KEY, handler) ||
      this.reflector.get<string[]>(ROLES_KEY, controller) ||
      [];
    const requiredPermissions =
      this.reflector.get<string[]>(PERMISSIONS_KEY, handler) ||
      this.reflector.get<string[]>(PERMISSIONS_KEY, controller) ||
      [];

    // ---- 5. If no roles or permissions are required, allow access (but still ensure user is valid) ----
    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      // Valid user is present, so allow
      return true;
    }

    // ---- 6. Check admin bypass (if enabled) ----
    if (this.adminBypass && user.isAdmin) {
      this.logger.debug(
        `Admin bypass granted for user ${user.id} to ${request.url}`,
      );
      return true;
    }

    // ---- 7. Resolve user's effective roles and permissions ----
    let userRoles: string[] = user.roles || [];
    let userPermissions: string[] = user.permissions || [];

    // If roles/permissions are not directly on the user object, fetch from cache/db
    if (userRoles.length === 0 && userPermissions.length === 0) {
      // Attempt to load from cache or DB (using a service call; we'll use a placeholder)
      // In a real implementation, you would inject a UserPermissionsService.
      // For now, we'll treat them as empty and log a warning.
      this.logger.warn(
        `User ${user.id} has no roles/permissions defined; defaulting to empty.`,
      );
    }

    // Expand roles to include inherited roles and their permissions
    const expandedRoles = this.expandRoles(userRoles);
    const expandedPermissions = this.expandPermissions(
      expandedRoles,
      userPermissions,
    );

    // ---- 8. Check roles (if any required) ----
    if (requiredRoles.length > 0) {
      const hasRole = this.checkRoles(expandedRoles, requiredRoles);
      if (!hasRole) {
        this.logFailedAuthorization(request, user, "roles", requiredRoles);
        throw new ForbiddenException(
          `Access denied. Required roles: ${requiredRoles.join(", ")}`,
        );
      }
    }

    // ---- 9. Check permissions (if any required) ----
    if (requiredPermissions.length > 0) {
      const hasPermission = this.checkPermissions(
        expandedPermissions,
        requiredPermissions,
      );
      if (!hasPermission) {
        this.logFailedAuthorization(
          request,
          user,
          "permissions",
          requiredPermissions,
        );
        throw new ForbiddenException(
          `Access denied. Required permissions: ${requiredPermissions.join(", ")}`,
        );
      }
    }

    // ---- 10. All checks passed ----
    this.logSuccessfulAuthorization(request, user);
    return true;
  }

  // ---------------------- ROLE EXPANSION ----------------------
  /**
   * Expand a list of roles to include inherited roles recursively.
   */
  private expandRoles(roleNames: string[]): string[] {
    const result = new Set<string>();
    const visited = new Set<string>();

    const expand = (role: string) => {
      if (visited.has(role)) return;
      visited.add(role);
      result.add(role);

      const definition =
        this.roleHierarchy[role] || this.roleDefinitionsCache[role];
      if (definition && definition.inherits) {
        for (const parent of definition.inherits) {
          expand(parent);
        }
      }
    };

    for (const role of roleNames) {
      expand(role);
    }

    // Add 'everyone' pseudo-role (optional)
    // You could add logic here to include base roles like 'authenticated'
    return Array.from(result);
  }

  // ---------------------- PERMISSION EXPANSION ----------------------
  /**
   * Expand permissions by combining inherited permissions from roles and user's explicit permissions.
   */
  private expandPermissions(
    expandedRoles: string[],
    userExplicitPermissions: string[],
  ): string[] {
    const allPermissions = new Set<string>();

    // Add user's explicit permissions
    for (const perm of userExplicitPermissions) {
      allPermissions.add(perm);
    }

    // Add permissions from each role's definition
    for (const role of expandedRoles) {
      const definition =
        this.roleHierarchy[role] || this.roleDefinitionsCache[role];
      if (definition && definition.permissions) {
        for (const perm of definition.permissions) {
          allPermissions.add(perm);
        }
      }
    }

    // If any role has '*' permission, grant all
    if (allPermissions.has("*")) {
      return ["*"];
    }

    return Array.from(allPermissions);
  }

  // ---------------------- ROLE CHECK ----------------------
  /**
   * Check if the user's roles satisfy the required roles.
   * Strategy: check if any of the required roles is present in the user's expanded roles.
   */
  private checkRoles(userRoles: string[], requiredRoles: string[]): boolean {
    // If requiredRoles is empty, grant
    if (requiredRoles.length === 0) return true;

    // Check for wildcard role (if any role matches)
    if (requiredRoles.includes("*")) {
      return userRoles.length > 0;
    }

    // Default: OR logic (any role)
    for (const required of requiredRoles) {
      if (userRoles.includes(required)) {
        return true;
      }
    }

    // If strict mode is enabled, we could require all roles, but default is any.
    return false;
  }

  // ---------------------- PERMISSION CHECK ----------------------
  /**
   * Check if the user's permissions satisfy the required permissions.
   * Supports:
   * - Wildcard: '*' grants all
   * - Negation: '!permission' denies access if the permission is present
   * - AND/OR logic based on match strategy (default: all required)
   */
  private checkPermissions(
    userPermissions: string[],
    requiredPermissions: PermissionsDefinition | string[],
  ): boolean {
    // Normalize input
    let requiredList: string[] = [];
    let match: "all" | "any" = "all";
    let negations: string[] = [];

    if (Array.isArray(requiredPermissions)) {
      requiredList = requiredPermissions;
    } else {
      requiredList = requiredPermissions.required || [];
      match = requiredPermissions.match || "all";
      negations = requiredPermissions.negations || [];
    }

    if (requiredList.length === 0) return true;

    // Check negations first (explicit deny)
    if (negations.length > 0) {
      for (const neg of negations) {
        // If user has a negated permission, deny access
        if (userPermissions.includes(neg) || userPermissions.includes("*")) {
          return false;
        }
      }
    }

    // Check if user has wildcard permission
    if (userPermissions.includes("*")) {
      // Wildcard grants everything except negations (already checked)
      return true;
    }

    // Check required permissions
    if (match === "all") {
      // All required permissions must be present
      for (const required of requiredList) {
        // Check if required is a negative requirement (starts with !)
        if (required.startsWith("!")) {
          const permToDeny = required.substring(1);
          if (userPermissions.includes(permToDeny)) {
            return false; // Deny because user has the forbidden permission
          }
          // Otherwise continue (it's okay that they don't have it)
        } else {
          // Positive requirement
          if (!userPermissions.includes(required)) {
            return false;
          }
        }
      }
      return true;
    } else {
      // match === 'any': at least one required permission must be present
      for (const required of requiredList) {
        if (required.startsWith("!")) {
          // Negative requirement: if user has this permission, fail
          const permToDeny = required.substring(1);
          if (userPermissions.includes(permToDeny)) {
            return false;
          }
          // If they don't have it, it's fine, we can still continue to check positives
        } else {
          // Positive requirement: if user has this permission, grant
          if (userPermissions.includes(required)) {
            return true;
          }
        }
      }
      // If we reach here, no positive permission matched and no denial happened
      return false;
    }
  }

  // ---------------------- LOGGING HELPERS ----------------------
  private logUnAuthorized(request: Request, reason: string): void {
    const ip = request.ip || request.connection.remoteAddress || "0.0.0.0";
    this.logger.warn(
      `Authorization failed (no user) | ${request.method} ${request.url} | IP: ${ip} | ${reason}`,
    );
  }

  private logFailedAuthorization(
    request: Request,
    user: AuthUser,
    type: "roles" | "permissions",
    required: string[],
  ): void {
    const ip = request.ip || request.connection.remoteAddress || "0.0.0.0";
    const userRoles = user.roles || [];
    const userPermissions = user.permissions || [];
    this.logger.warn(
      `Authorization failed | User: ${user.id} (${user.email}) | ${type}: required [${required.join(", ")}] | ` +
        `User has ${type === "roles" ? "roles" : "permissions"}: [${(type === "roles" ? userRoles : userPermissions).join(", ")}] | ` +
        `${request.method} ${request.url} | IP: ${ip}`,
    );

    // Emit security event for audit
    if (this.eventEmitter) {
      this.eventEmitter.emit("auth.authorization.failed", {
        userId: user.id,
        email: user.email,
        path: request.url,
        method: request.method,
        required,
        type,
        ip,
        userAgent: request.headers["user-agent"],
        timestamp: new Date(),
      });
    }
  }

  private logSuccessfulAuthorization(request: Request, user: AuthUser): void {
    if (this.logger.isDebugEnabled()) {
      this.logger.debug(
        `Authorization succeeded | User: ${user.id} | ${request.method} ${request.url}`,
      );
    }
  }

  // ---------------------- PUBLIC API: CACHE MANAGEMENT ----------------------
  /**
   * Reload role definitions from cache or database.
   * Useful after updating roles/permissions.
   */
  async reloadRoleDefinitions(): Promise<void> {
    // In a production app, you would fetch from DB and populate the cache.
    // For now, we just log.
    this.logger.log("Reloading role definitions (placeholder)");
    // Optionally clear cache
    if (this.cacheManager) {
      await this.cacheManager.del("role_definitions");
      await this.cacheManager.del("permission_cache:*");
    }
  }

  /**
   * Add or update a role definition.
   */
  async updateRoleDefinition(
    roleName: string,
    definition: RoleDefinition,
  ): Promise<void> {
    this.roleDefinitionsCache[roleName] = definition;
    this.roleHierarchy[roleName] = definition;
    if (this.cacheManager) {
      await this.cacheManager.set(
        `role_def:${roleName}`,
        definition,
        this.cacheTtl,
      );
    }
    this.logger.log(`Updated role definition: ${roleName}`);
  }

  /**
   * Get all role definitions (cached).
   */
  getRoleDefinitions(): Record<string, RoleDefinition> {
    return { ...this.roleDefinitionsCache };
  }

  // ---------------------- PUBLIC API: PERMISSION HELPERS ----------------------
  /**
   * Check if a user has a specific permission (bypasses cache and metadata, pure function).
   */
  static hasPermission(user: AuthUser | null, permission: string): boolean {
    if (!user) return false;
    if (user.isAdmin) return true;
    const permissions = user.permissions || [];
    return permissions.includes(permission) || permissions.includes("*");
  }

  /**
   * Check if a user has a specific role.
   */
  static hasRole(user: AuthUser | null, role: string): boolean {
    if (!user) return false;
    if (user.isAdmin) return true;
    const roles = user.roles || [];
    return roles.includes(role);
  }

  // ---------------------- DECORATORS (re-export) ----------------------
  // The actual decorators are defined in the decorators file, but we also export them here for convenience.
  // They are: @Roles, @Permissions, @Public, @OptionalAuth

  // For completeness, we'll define them again (they should be imported from the decorators file).
  // Since this is a standalone file, we'll include them.
  // But to avoid duplication, we'll use the ones from the decorators file.
  // However, to make this file self-contained, we'll define them if not already imported.
}

// -------- DECORATORS (for completeness, but should be imported from decorator file) --------
// We define them here so that the guard works even if the decorator file is not loaded.
// In production, you'd import them from the shared decorators file.

import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const PERMISSIONS_KEY = "permissions";
export const IS_PUBLIC_KEY = "isPublic";
export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";

/**
 * Decorator to set required roles on a route.
 * @example @Roles('admin', 'moderator')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to set required permissions on a route.
 * @example @Permissions('read:users', 'write:users')
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to mark a route as public (no authentication required).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Decorator to mark a route as optional authentication (user may or may not be present).
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

// ---- Additional utility decorator for fine-grained permission matching ----
export const PERMISSION_MATCH_KEY = "permissionMatch";
export const PERMISSION_NEGATIONS_KEY = "permissionNegations";

/**
 * Define match strategy for permissions: 'all' (default) or 'any'.
 */
export const PermissionMatch = (match: "all" | "any") =>
  SetMetadata(PERMISSION_MATCH_KEY, match);

/**
 * Define negations – permissions that explicitly deny access.
 */
export const PermissionNegations = (...negations: string[]) =>
  SetMetadata(PERMISSION_NEGATIONS_KEY, negations);

// -------- END --------
