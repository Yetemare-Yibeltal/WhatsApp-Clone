// backend/src/common/types/express-request.interface.ts
/**
 * 📄 Express Request Interface
 *
 * This file extends the Express Request type with all custom properties used
 * throughout the Real WhatsApp Clone application. It provides full type safety
 * for request objects in controllers, middleware, and guards.
 *
 * @category Types
 * @module ExpressRequest
 */

import { Request } from "express";
import { AuthUser } from "../decorators/current-user.decorator";
import { RequestIdContext } from "../middleware/request-id.middleware";

// -------- INTERFACES --------

/**
 * Extended request context with additional request metadata.
 */
export interface ExtendedRequestContext extends RequestIdContext {
  /** Unique request ID for tracing */
  requestId: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Session ID for session tracking */
  sessionId?: string;
  /** Authenticated user (if any) */
  user?: AuthUser;
  /** Request start time (timestamp) */
  startTime: number;
  /** Request execution duration (ms) */
  duration?: number;
  /** Route path (template) */
  routePath?: string;
  /** Route parameters */
  routeParams?: Record<string, string>;
  /** Query parameters (validated) */
  validatedQuery?: Record<string, any>;
  /** Request body (validated) */
  validatedBody?: Record<string, any>;
  /** Request headers (parsed) */
  parsedHeaders?: Record<string, string>;
  /** Client IP address */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** Request path */
  path: string;
  /** Is the request authenticated? */
  isAuthenticated: boolean;
  /** Is the request from a trusted source? */
  isTrusted: boolean;
  /** Request metadata (custom) */
  meta?: Record<string, any>;
}

/**
 * Extended request with file uploads support.
 */
export interface FileRequest extends ExpressRequest {
  /** Single uploaded file */
  file?: Express.Multer.File;
  /** Multiple uploaded files */
  files?:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Extended request with pagination parameters.
 */
export interface PaginatedRequest extends ExpressRequest {
  /** Pagination parameters (parsed) */
  pagination: {
    page: number;
    limit: number;
    offset?: number;
    cursor?: string;
    includeTotal?: boolean;
  };
  /** Sort parameters (parsed) */
  sort?: {
    field: string;
    order: "asc" | "desc";
  }[];
  /** Filter parameters (parsed) */
  filter?: Record<string, any>;
  /** Search query */
  search?: string;
}

/**
 * Extended request with authentication.
 */
export interface AuthenticatedRequest extends ExpressRequest {
  /** Authenticated user (required) */
  user: AuthUser;
  /** User ID (shortcut) */
  userId: string;
  /** Is the user an admin? */
  isAdmin: boolean;
  /** User permissions */
  permissions: string[];
  /** User roles */
  roles: string[];
}

/**
 * Extended request with validation.
 */
export interface ValidatedRequest<T = any, U = any> extends ExpressRequest {
  /** Validated query parameters */
  validatedQuery: T;
  /** Validated request body */
  validatedBody: U;
  /** Validated route parameters */
  validatedParams: Record<string, string>;
}

// -------- EXPRESS REQUEST EXTENSION --------

/**
 * Main extended Express Request type.
 * This is the primary type used throughout the application.
 */
export interface ExpressRequest extends Request {
  // -------- Request Context --------
  /** Unique request ID for tracing */
  id: string;
  /** Unique request ID (alias) */
  requestId: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Session ID for session tracking */
  sessionId?: string;
  /** Request context (full) */
  context?: ExtendedRequestContext;

  // -------- User Authentication --------
  /** Authenticated user (if any) */
  user?: AuthUser;
  /** User ID shortcut */
  userId?: string;
  /** Is the request authenticated? */
  isAuthenticated?: boolean;

  // -------- Request Timing --------
  /** Request start time */
  _startTime?: number;
  /** Request duration (ms) */
  _duration?: number;

  // -------- Request Metadata --------
  /** Route path (template) */
  routePath?: string;
  /** Route parameters */
  routeParams?: Record<string, string>;

  // -------- Validated Data --------
  /** Validated query parameters */
  validatedQuery?: Record<string, any>;
  /** Validated request body */
  validatedBody?: Record<string, any>;
  /** Validated route parameters */
  validatedParams?: Record<string, string>;

  // -------- Parsed Data --------
  /** Parsed request headers */
  parsedHeaders?: Record<string, string>;
  /** Client IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;

  // -------- Security --------
  /** Is the request from a trusted source? */
  isTrusted?: boolean;
  /** Request fingerprint (for security) */
  fingerprint?: string;

  // -------- Custom Metadata --------
  /** Request metadata (custom) */
  meta?: Record<string, any>;

  // -------- File Uploads --------
  /** Single uploaded file */
  file?: Express.Multer.File;
  /** Multiple uploaded files */
  files?:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] };

  // -------- Pagination --------
  /** Pagination parameters (parsed) */
  pagination?: {
    page: number;
    limit: number;
    offset?: number;
    cursor?: string;
    includeTotal?: boolean;
  };
  /** Sort parameters (parsed) */
  sort?: {
    field: string;
    order: "asc" | "desc";
  }[];
  /** Filter parameters (parsed) */
  filter?: Record<string, any>;
  /** Search query */
  search?: string;

  // -------- Helper Methods --------
  /**
   * Get the authenticated user (throws if not authenticated).
   */
  getUser(): AuthUser;

  /**
   * Get the authenticated user or null if not authenticated.
   */
  getUserOrNull(): AuthUser | null;

  /**
   * Check if the request is authenticated.
   */
  isAuthenticatedRequest(): boolean;

  /**
   * Get the user ID (throws if not authenticated).
   */
  getUserId(): string;

  /**
   * Get the user ID or null if not authenticated.
   */
  getUserIdOrNull(): string | null;

  /**
   * Check if the user has a specific role.
   */
  hasRole(role: string): boolean;

  /**
   * Check if the user has all specified roles.
   */
  hasAllRoles(roles: string[]): boolean;

  /**
   * Check if the user has a specific permission.
   */
  hasPermission(permission: string): boolean;

  /**
   * Check if the user has all specified permissions.
   */
  hasAllPermissions(permissions: string[]): boolean;

  /**
   * Get the request ID.
   */
  getRequestId(): string;

  /**
   * Get the correlation ID (or request ID if not set).
   */
  getCorrelationId(): string;

  /**
   * Get the session ID (or null if not set).
   */
  getSessionId(): string | null;

  /**
   * Get the client IP address.
   */
  getClientIp(): string;

  /**
   * Get the user agent string.
   */
  getUserAgent(): string;

  /**
   * Get the request duration (ms).
   */
  getDuration(): number;

  /**
   * Set metadata on the request.
   */
  setMeta(key: string, value: any): void;

  /**
   * Get metadata from the request.
   */
  getMeta<T = any>(key: string): T | undefined;

  /**
   * Get all metadata from the request.
   */
  getAllMeta(): Record<string, any>;

  /**
   * Check if the request is from a trusted source.
   */
  isTrustedRequest(): boolean;

  /**
   * Get the request fingerprint (for security).
   */
  getFingerprint(): string;

  /**
   * Get the request context (full).
   */
  getContext(): ExtendedRequestContext;

  /**
   * Update the request context.
   */
  updateContext(updates: Partial<ExtendedRequestContext>): void;

  /**
   * Check if the request has a specific header.
   */
  hasHeader(name: string): boolean;

  /**
   * Get a header value (case-insensitive).
   */
  getHeaderValue(name: string): string | undefined;

  /**
   * Get all headers as a record.
   */
  getAllHeaders(): Record<string, string>;

  /**
   * Get the request path (without query string).
   */
  getPath(): string;

  /**
   * Get the full URL (including protocol, host, path, query).
   */
  getFullUrl(): string;

  /**
   * Get the base URL (protocol + host).
   */
  getBaseUrl(): string;

  /**
   * Check if the request is a GET request.
   */
  isGet(): boolean;

  /**
   * Check if the request is a POST request.
   */
  isPost(): boolean;

  /**
   * Check if the request is a PUT request.
   */
  isPut(): boolean;

  /**
   * Check if the request is a PATCH request.
   */
  isPatch(): boolean;

  /**
   * Check if the request is a DELETE request.
   */
  isDelete(): boolean;

  /**
   * Check if the request is an AJAX request.
   */
  isAjax(): boolean;

  /**
   * Check if the request is a WebSocket upgrade request.
   */
  isWebSocket(): boolean;

  /**
   * Get the accepted content types.
   */
  getAcceptedTypes(): string[];

  /**
   * Check if the request accepts JSON.
   */
  acceptsJson(): boolean;

  /**
   * Check if the request accepts HTML.
   */
  acceptsHtml(): boolean;

  /**
   * Get the request body size (bytes).
   */
  getBodySize(): number;

  /**
   * Get the request query parameters as a record.
   */
  getQueryParams(): Record<string, string>;

  /**
   * Get a specific query parameter.
   */
  getQueryParam(name: string): string | undefined;

  /**
   * Get the request cookies as a record.
   */
  getCookies(): Record<string, string>;

  /**
   * Get a specific cookie value.
   */
  getCookie(name: string): string | undefined;

  /**
   * Get the request hostname.
   */
  getHostname(): string;

  /**
   * Get the request protocol (http or https).
   */
  getProtocol(): string;

  /**
   * Check if the request is over HTTPS.
   */
  isHttps(): boolean;

  /**
   * Get the request referrer.
   */
  getReferrer(): string | undefined;

  /**
   * Get the request origin.
   */
  getOrigin(): string | undefined;

  /**
   * Get the request timestamp.
   */
  getTimestamp(): number;

  /**
   * Get the request ISO timestamp.
   */
  getIsoTimestamp(): string;

  /**
   * Log a message with request context.
   */
  log(message: string, level?: "debug" | "info" | "warn" | "error"): void;
}

// -------- TYPE GUARDS --------

/**
 * Type guard to check if a request is authenticated.
 */
export function isAuthenticatedRequest(
  request: ExpressRequest,
): request is AuthenticatedRequest {
  return !!request.user && !!request.user.id;
}

/**
 * Type guard to check if a request has file uploads.
 */
export function hasFile(request: ExpressRequest): request is FileRequest {
  return !!request.file || !!request.files;
}

/**
 * Type guard to check if a request has pagination parameters.
 */
export function hasPagination(
  request: ExpressRequest,
): request is PaginatedRequest {
  return (
    !!request.pagination &&
    !!request.pagination.page &&
    !!request.pagination.limit
  );
}

/**
 * Type guard to check if a request has validation data.
 */
export function hasValidation<T = any, U = any>(
  request: ExpressRequest,
): request is ValidatedRequest<T, U> {
  return (
    !!request.validatedBody ||
    !!request.validatedQuery ||
    !!request.validatedParams
  );
}

// -------- REQUEST HELPER FUNCTIONS --------

/**
 * Helper functions for working with Express requests.
 */
export class RequestHelper {
  /**
   * Get the client IP address from a request.
   */
  static getClientIp(request: ExpressRequest): string {
    return (
      request.ipAddress ||
      request.ip ||
      request.connection?.remoteAddress ||
      "0.0.0.0"
    );
  }

  /**
   * Get the user agent from a request.
   */
  static getUserAgent(request: ExpressRequest): string {
    return request.userAgent || request.headers["user-agent"] || "unknown";
  }

  /**
   * Get the request ID from a request.
   */
  static getRequestId(request: ExpressRequest): string {
    return request.requestId || request.id || "unknown";
  }

  /**
   * Get the correlation ID from a request.
   */
  static getCorrelationId(request: ExpressRequest): string {
    return request.correlationId || request.requestId || "unknown";
  }

  /**
   * Get the session ID from a request.
   */
  static getSessionId(request: ExpressRequest): string | null {
    return request.sessionId || null;
  }

  /**
   * Get the authenticated user from a request.
   */
  static getUser(request: ExpressRequest): AuthUser | null {
    return request.user || null;
  }

  /**
   * Get the user ID from a request.
   */
  static getUserId(request: ExpressRequest): string | null {
    return request.user?.id || request.userId || null;
  }

  /**
   * Check if a request is authenticated.
   */
  static isAuthenticated(request: ExpressRequest): boolean {
    return !!request.user && !!request.user.id;
  }

  /**
   * Check if a user has a specific role.
   */
  static hasRole(request: ExpressRequest, role: string): boolean {
    if (!request.user) return false;
    if (request.user.isAdmin) return true;
    const roles = request.user.roles || [];
    return roles.includes(role);
  }

  /**
   * Check if a user has a specific permission.
   */
  static hasPermission(request: ExpressRequest, permission: string): boolean {
    if (!request.user) return false;
    if (request.user.isAdmin) return true;
    const permissions = request.user.permissions || [];
    return permissions.includes(permission);
  }

  /**
   * Get all headers from a request as a record.
   */
  static getAllHeaders(request: ExpressRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      }
    }
    return headers;
  }

  /**
   * Get a header value (case-insensitive).
   */
  static getHeader(request: ExpressRequest, name: string): string | undefined {
    const headers = this.getAllHeaders(request);
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Get all cookies from a request.
   */
  static getCookies(request: ExpressRequest): Record<string, string> {
    return request.cookies || {};
  }

  /**
   * Get a specific cookie value.
   */
  static getCookie(request: ExpressRequest, name: string): string | undefined {
    return request.cookies?.[name];
  }

  /**
   * Get the full URL from a request.
   */
  static getFullUrl(request: ExpressRequest): string {
    const protocol = request.protocol || "http";
    const host = request.get("host") || "localhost";
    const path = request.originalUrl || request.url || "/";
    return `${protocol}://${host}${path}`;
  }

  /**
   * Get the base URL from a request.
   */
  static getBaseUrl(request: ExpressRequest): string {
    const protocol = request.protocol || "http";
    const host = request.get("host") || "localhost";
    return `${protocol}://${host}`;
  }

  /**
   * Get the request path (without query string).
   */
  static getPath(request: ExpressRequest): string {
    return request.path || request.url?.split("?")[0] || "/";
  }

  /**
   * Get query parameters as a record.
   */
  static getQueryParams(request: ExpressRequest): Record<string, string> {
    return request.query as Record<string, string>;
  }

  /**
   * Get a specific query parameter.
   */
  static getQueryParam(
    request: ExpressRequest,
    name: string,
  ): string | undefined {
    return request.query?.[name] as string | undefined;
  }

  /**
   * Check if the request accepts a specific content type.
   */
  static accepts(request: ExpressRequest, type: string): boolean {
    if (!request.accepts) return false;
    const accepted = request.accepts(type);
    return !!accepted;
  }

  /**
   * Check if the request accepts JSON.
   */
  static acceptsJson(request: ExpressRequest): boolean {
    return this.accepts(request, "application/json");
  }

  /**
   * Check if the request is an AJAX request.
   */
  static isAjax(request: ExpressRequest): boolean {
    return (
      request.xhr ||
      false ||
      request.headers["x-requested-with"] === "XMLHttpRequest" ||
      request.headers["content-type"] === "application/json"
    );
  }

  /**
   * Check if the request is a WebSocket upgrade.
   */
  static isWebSocket(request: ExpressRequest): boolean {
    return (
      request.headers.upgrade === "websocket" ||
      request.headers["sec-websocket-key"] !== undefined
    );
  }

  /**
   * Get the request hostname.
   */
  static getHostname(request: ExpressRequest): string {
    return (
      request.hostname || request.get("host")?.split(":")[0] || "localhost"
    );
  }

  /**
   * Check if the request is over HTTPS.
   */
  static isHttps(request: ExpressRequest): boolean {
    return (
      request.secure ||
      request.protocol === "https" ||
      request.headers["x-forwarded-proto"] === "https"
    );
  }

  /**
   * Get the request origin.
   */
  static getOrigin(request: ExpressRequest): string | undefined {
    return request.headers.origin as string;
  }

  /**
   * Get the request referrer.
   */
  static getReferrer(request: ExpressRequest): string | undefined {
    return request.headers.referer || request.headers.referrer;
  }

  /**
   * Create a request context from a request.
   */
  static createContext(request: ExpressRequest): ExtendedRequestContext {
    return {
      requestId: this.getRequestId(request),
      correlationId: this.getCorrelationId(request),
      sessionId: this.getSessionId(request) || undefined,
      user: request.user,
      startTime: request._startTime || Date.now(),
      duration: request._duration,
      routePath: request.routePath,
      routeParams: request.routeParams,
      validatedQuery: request.validatedQuery,
      validatedBody: request.validatedBody,
      parsedHeaders: request.parsedHeaders || this.getAllHeaders(request),
      ipAddress: this.getClientIp(request),
      userAgent: this.getUserAgent(request),
      method: request.method,
      url: request.url || request.originalUrl || "/",
      path: this.getPath(request),
      isAuthenticated: this.isAuthenticated(request),
      isTrusted: request.isTrusted || false,
      meta: request.meta || {},
    };
  }

  /**
   * Get the request timestamp.
   */
  static getTimestamp(request: ExpressRequest): number {
    return request._startTime || Date.now();
  }

  /**
   * Get the request ISO timestamp.
   */
  static getIsoTimestamp(request: ExpressRequest): string {
    return new Date(this.getTimestamp(request)).toISOString();
  }

  /**
   * Get the request duration.
   */
  static getDuration(request: ExpressRequest): number {
    if (request._duration) return request._duration;
    if (request._startTime) {
      return Date.now() - request._startTime;
    }
    return 0;
  }

  /**
   * Calculate the request fingerprint (for security).
   */
  static getFingerprint(request: ExpressRequest): string {
    const components = [
      this.getClientIp(request),
      this.getUserAgent(request),
      request.headers["accept-language"] || "en-US",
      request.headers["accept-encoding"] || "gzip",
    ];
    return components.join("|");
  }
}

// -------- DECORATOR HELPERS --------

/**
 * Decorator to inject the request object with full type safety.
 * This is a helper for creating custom parameter decorators.
 */
export function RequestParam() {
  // This is just a placeholder; the actual implementation is in the controller.
  // We use the built-in @Req() decorator from NestJS.
  return (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) => {
    // Implementation uses NestJS's built-in decorator system
  };
}

// -------- END --------
