// backend/src/common/decorators/public.decorator.ts
import {
  SetMetadata,
  CustomDecorator,
  applyDecorators,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiUnauthorizedResponse } from "@nestjs/swagger";

export const IS_PUBLIC_KEY = "isPublic";
export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";
export const PUBLIC_METADATA_KEY = "public_metadata";

export interface PublicMetadata {
  skipAuth: boolean;
  skipRateLimit?: boolean;
  skipLogging?: boolean;
  allowGuest?: boolean;
  allowWithoutVerification?: boolean;
  reason?: string;
}

/**
 * Decorator to mark a route or controller as publicly accessible
 * (no authentication required).
 *
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 *
 * @example
 * @Public({ skipRateLimit: true, allowGuest: true })
 * @Post('public-endpoint')
 * publicEndpoint() { ... }
 */
export function Public(
  options: Partial<PublicMetadata> | boolean = true,
): CustomDecorator {
  const metadata: PublicMetadata =
    typeof options === "boolean"
      ? { skipAuth: options }
      : { skipAuth: true, ...options };

  return SetMetadata(IS_PUBLIC_KEY, metadata);
}

/**
 * Decorator to mark a route as optional authentication.
 * If a token is provided, it will be validated, but missing token is allowed.
 *
 * @example
 * @OptionalAuth()
 * @Get('profile')
 * profile(@CurrentUser() user?: AuthUser) { ... }
 */
export function OptionalAuth(): CustomDecorator {
  return SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
}

/**
 * Check if a route is public based on metadata from Reflector.
 */
export function isRoutePublic(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata =
    reflector.get<PublicMetadata>(IS_PUBLIC_KEY, handler) ||
    reflector.get<PublicMetadata>(IS_PUBLIC_KEY, controller);
  return metadata?.skipAuth === true;
}

/**
 * Get public metadata for a route.
 */
export function getPublicMetadata(
  reflector: any,
  handler: any,
  controller: any,
): PublicMetadata | null {
  return (
    reflector.get<PublicMetadata>(IS_PUBLIC_KEY, handler) ||
    reflector.get<PublicMetadata>(IS_PUBLIC_KEY, controller) ||
    null
  );
}

/**
 * Check if a route allows guest access (unauthenticated but with limited permissions).
 */
export function allowsGuest(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.allowGuest === true;
}

/**
 * Check if a route allows access without email verification.
 */
export function allowsWithoutVerification(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.allowWithoutVerification === true;
}

/**
 * Check if a route should skip rate limiting.
 */
export function skipRateLimit(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.skipRateLimit === true;
}

/**
 * Check if a route should skip logging.
 */
export function skipLogging(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.skipLogging === true;
}

/**
 * Get the reason why a route is public (for audit/logging).
 */
export function getPublicReason(
  reflector: any,
  handler: any,
  controller: any,
): string | null {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.reason || null;
}

/**
 * Get all public routes from a controller (for documentation).
 */
export function getPublicRoutes(
  controller: any,
): Array<{ method: string; path: string; metadata: PublicMetadata }> {
  const routes: Array<{
    method: string;
    path: string;
    metadata: PublicMetadata;
  }> = [];
  const proto = Object.getPrototypeOf(controller);
  const methodNames = Object.getOwnPropertyNames(proto).filter(
    (name) => typeof proto[name] === "function" && name !== "constructor",
  );

  for (const methodName of methodNames) {
    const method = proto[methodName];
    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, method);
    if (metadata) {
      // Try to get path from route decorators (simplified)
      const path = Reflect.getMetadata("path", method) || "/";
      routes.push({ method: methodName, path, metadata });
    }
  }
  return routes;
}

/**
 * Decorator for public endpoints that also disables rate limiting.
 * Convenience shorthand: @Public({ skipRateLimit: true })
 */
export function PublicNoRateLimit(
  options: Partial<PublicMetadata> = {},
): CustomDecorator {
  return Public({ skipRateLimit: true, ...options });
}

/**
 * Decorator for guest endpoints (allows unauthenticated with limited permissions).
 * Convenience shorthand: @Public({ allowGuest: true })
 */
export function GuestEndpoint(
  options: Partial<PublicMetadata> = {},
): CustomDecorator {
  return Public({ allowGuest: true, ...options });
}

/**
 * Decorator for endpoints that don't require email verification.
 * Convenience shorthand: @Public({ allowWithoutVerification: true })
 */
export function UnverifiedAccess(
  options: Partial<PublicMetadata> = {},
): CustomDecorator {
  return Public({ allowWithoutVerification: true, ...options });
}

/**
 * Combine Public decorator with specific Swagger documentation.
 * Useful for automatically generating API docs for public endpoints.
 */
export function PublicApi(
  options: Partial<PublicMetadata> = {},
  swaggerOptions?: { summary?: string; description?: string; tags?: string[] },
): MethodDecorator {
  const decorators: MethodDecorator[] = [];

  // Apply Public decorator
  decorators.push(Public(options) as MethodDecorator);

  // Apply Swagger decorators if options provided
  if (swaggerOptions) {
    const {
      ApiBearerAuth: SwaggerBearer,
      ApiUnauthorizedResponse: SwaggerUnauthorized,
    } = require("@nestjs/swagger");
    // For public endpoints, we don't want bearer auth
    // Instead, we can add a custom response
    // We'll use ApiResponse decorators manually if needed
  }

  return applyDecorators(...decorators) as MethodDecorator;
}

/**
 * Get the public status of a route with detailed context.
 */
export function getPublicStatus(
  reflector: any,
  handler: any,
  controller: any,
): {
  isPublic: boolean;
  isOptional: boolean;
  metadata: PublicMetadata | null;
} {
  const publicMetadata = getPublicMetadata(reflector, handler, controller);
  const isOptional =
    reflector.get<boolean>(IS_OPTIONAL_AUTH_KEY, handler) ||
    reflector.get<boolean>(IS_OPTIONAL_AUTH_KEY, controller);

  return {
    isPublic: publicMetadata?.skipAuth === true,
    isOptional: isOptional === true,
    metadata: publicMetadata,
  };
}

/**
 * Determine if a route requires authentication based on its metadata.
 * This is the inverse of isRoutePublic.
 */
export function requiresAuth(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const status = getPublicStatus(reflector, handler, controller);
  return !status.isPublic && !status.isOptional;
}

/**
 * Get the authentication requirement level for a route.
 */
export function getAuthLevel(
  reflector: any,
  handler: any,
  controller: any,
): "public" | "optional" | "required" {
  const status = getPublicStatus(reflector, handler, controller);
  if (status.isPublic) return "public";
  if (status.isOptional) return "optional";
  return "required";
}

/**
 * Utility to check if a route is public using Reflect metadata directly.
 * This is used by guards and middleware.
 */
export function isPublicRoute(
  handler: Function,
  controller: Function,
): boolean {
  const publicMeta =
    Reflect.getMetadata(IS_PUBLIC_KEY, handler) ||
    Reflect.getMetadata(IS_PUBLIC_KEY, controller);
  return publicMeta?.skipAuth === true;
}

/**
 * Utility to check if a route is optional auth.
 */
export function isOptionalAuthRoute(
  handler: Function,
  controller: Function,
): boolean {
  return (
    Reflect.getMetadata(IS_OPTIONAL_AUTH_KEY, handler) ||
    Reflect.getMetadata(IS_OPTIONAL_AUTH_KEY, controller)
  );
}

/**
 * List of default public routes (e.g., health, metrics, etc.).
 * These are automatically considered public without needing @Public decorator.
 */
export const DEFAULT_PUBLIC_ROUTES = [
  "/health",
  "/ready",
  "/live",
  "/metrics",
  "/ping",
  "/version",
  "/uptime",
  "/api/docs",
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/2fa/setup",
  "/api/v1/auth/2fa/verify",
];

/**
 * Check if a path is in the default public routes list.
 */
export function isDefaultPublicPath(path: string): boolean {
  return DEFAULT_PUBLIC_ROUTES.some((route) => {
    if (route.includes("*")) {
      const regex = new RegExp(route.replace(/\*/g, ".*"));
      return regex.test(path);
    }
    return path.startsWith(route) || path === route;
  });
}

/**
 * Get all default public routes as an array.
 */
export function getDefaultPublicRoutes(): string[] {
  return [...DEFAULT_PUBLIC_ROUTES];
}

/**
 * Add a custom route to the default public routes list.
 */
export function addDefaultPublicRoute(route: string): void {
  if (!DEFAULT_PUBLIC_ROUTES.includes(route)) {
    DEFAULT_PUBLIC_ROUTES.push(route);
  }
}

/**
 * Remove a route from the default public routes list.
 */
export function removeDefaultPublicRoute(route: string): void {
  const index = DEFAULT_PUBLIC_ROUTES.indexOf(route);
  if (index > -1) {
    DEFAULT_PUBLIC_ROUTES.splice(index, 1);
  }
}

/**
 * Clear all default public routes.
 */
export function clearDefaultPublicRoutes(): void {
  DEFAULT_PUBLIC_ROUTES.length = 0;
}

/**
 * Reset default public routes to default values.
 */
export function resetDefaultPublicRoutes(): void {
  DEFAULT_PUBLIC_ROUTES.length = 0;
  DEFAULT_PUBLIC_ROUTES.push(
    "/health",
    "/ready",
    "/live",
    "/metrics",
    "/ping",
    "/version",
    "/uptime",
    "/api/docs",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/2fa/setup",
    "/api/v1/auth/2fa/verify",
  );
}

/**
 * Get all public routes (including default and those marked with @Public).
 * This is useful for generating documentation or monitoring.
 */
export function getAllPublicRoutes(
  reflector: any,
  controllers: any[],
): Array<{
  controller: string;
  handler: string;
  path: string;
  metadata: PublicMetadata;
}> {
  const routes: Array<{
    controller: string;
    handler: string;
    path: string;
    metadata: PublicMetadata;
  }> = [];

  for (const controller of controllers) {
    const controllerName = controller.name || "UnknownController";
    const proto = Object.getPrototypeOf(controller);
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (name) => typeof proto[name] === "function" && name !== "constructor",
    );

    for (const methodName of methodNames) {
      const method = proto[methodName];
      const metadata =
        Reflect.getMetadata(IS_PUBLIC_KEY, method) ||
        Reflect.getMetadata(IS_PUBLIC_KEY, controller);
      if (metadata) {
        const path = Reflect.getMetadata("path", method) || "/";
        routes.push({
          controller: controllerName,
          handler: methodName,
          path,
          metadata,
        });
      }
    }
  }

  return routes;
}

/**
 * Check if a route is public either by metadata or default path.
 */
export function isRoutePublicOrDefault(
  reflector: any,
  handler: any,
  controller: any,
  path: string,
): boolean {
  const status = getPublicStatus(reflector, handler, controller);
  return status.isPublic || isDefaultPublicPath(path);
}

/**
 * Get the authentication requirement for a route as a string.
 */
export function getAuthRequirementString(
  reflector: any,
  handler: any,
  controller: any,
  path: string,
): string {
  const level = getAuthLevel(reflector, handler, controller);
  if (level === "public") return "Public";
  if (level === "optional") return "Optional Authentication";
  return "Authentication Required";
}

/**
 * Decorator for marking a route as public with a specific reason.
 * Useful for audit logs.
 */
export function PublicWithReason(
  reason: string,
  options: Partial<PublicMetadata> = {},
): CustomDecorator {
  return Public({ ...options, reason });
}

/**
 * Skip all security checks (auth, rate limiting, etc.) for a route.
 * Use with caution!
 */
export function SkipAllSecurity(
  options: Partial<PublicMetadata> = {},
): CustomDecorator {
  return Public({
    skipAuth: true,
    skipRateLimit: true,
    skipLogging: true,
    allowGuest: true,
    allowWithoutVerification: true,
    ...options,
    reason: options.reason || "Skipping all security checks",
  });
}

/**
 * Decorator for endpoints that are public but require API key authentication.
 * This is a hybrid approach where the endpoint is public but still requires an API key.
 * @param apiKey - The API key to validate.
 */
export function PublicWithApiKey(apiKey: string): CustomDecorator {
  // This would be implemented with a custom guard that checks the API key.
  // For now, we just set a metadata value.
  return SetMetadata("api_key", apiKey);
}

/**
 * Helper function to check if a route is public using both Reflect and default paths.
 * Used by guards and middleware.
 */
export function isPublic(
  reflector: any,
  handler: any,
  controller: any,
  path: string,
): boolean {
  if (isDefaultPublicPath(path)) return true;
  const status = getPublicStatus(reflector, handler, controller);
  return status.isPublic;
}

/**
 * Helper function to check if a route allows guest access.
 */
export function isGuestAllowed(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.allowGuest === true;
}

/**
 * Helper function to check if a route allows unverified access.
 */
export function isUnverifiedAllowed(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.allowWithoutVerification === true;
}

/**
 * Helper function to check if a route should skip rate limiting.
 */
export function shouldSkipRateLimit(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.skipRateLimit === true;
}

/**
 * Helper function to check if a route should skip logging.
 */
export function shouldSkipLogging(
  reflector: any,
  handler: any,
  controller: any,
): boolean {
  const metadata = getPublicMetadata(reflector, handler, controller);
  return metadata?.skipLogging === true;
}
