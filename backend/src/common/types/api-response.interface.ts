// backend/src/common/types/api-response.interface.ts
/**
 * 📄 API Response Interfaces
 *
 * This file defines all standardized API response types used across the Real WhatsApp Clone API.
 * These types ensure consistent response formats for all endpoints, including success,
 * error, paginated, and bulk responses.
 *
 * @category Types
 * @module ApiResponse
 */

// -------- ENUMS --------

/**
 * HTTP status codes (commonly used).
 */
export enum HttpStatus {
  // 2xx Success
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  PARTIAL_CONTENT = 206,

  // 3xx Redirection
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,

  // 4xx Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  NOT_ACCEPTABLE = 406,
  CONFLICT = 409,
  GONE = 410,
  LENGTH_REQUIRED = 411,
  PRECONDITION_FAILED = 412,
  PAYLOAD_TOO_LARGE = 413,
  URI_TOO_LONG = 414,
  UNSUPPORTED_MEDIA_TYPE = 415,
  RANGE_NOT_SATISFIABLE = 416,
  EXPECTATION_FAILED = 417,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * API error codes (custom business errors).
 */
export enum ApiErrorCode {
  // Authentication errors
  AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED",
  AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",
  AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID",
  AUTH_FORBIDDEN = "AUTH_FORBIDDEN",
  AUTH_ACCOUNT_SUSPENDED = "AUTH_ACCOUNT_SUSPENDED",
  AUTH_ACCOUNT_INACTIVE = "AUTH_ACCOUNT_INACTIVE",
  AUTH_2FA_REQUIRED = "AUTH_2FA_REQUIRED",
  AUTH_2FA_INVALID = "AUTH_2FA_INVALID",
  AUTH_EMAIL_UNVERIFIED = "AUTH_EMAIL_UNVERIFIED",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  VALIDATION_INVALID_INPUT = "VALIDATION_INVALID_INPUT",
  VALIDATION_MISSING_FIELD = "VALIDATION_MISSING_FIELD",
  VALIDATION_INVALID_FORMAT = "VALIDATION_INVALID_FORMAT",

  // Resource errors
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  RESOURCE_LOCKED = "RESOURCE_LOCKED",

  // Permission errors
  PERMISSION_DENIED = "PERMISSION_DENIED",
  PERMISSION_INSUFFICIENT = "PERMISSION_INSUFFICIENT",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // File errors
  FILE_UPLOAD_ERROR = "FILE_UPLOAD_ERROR",
  FILE_INVALID_TYPE = "FILE_INVALID_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_VIRUS_DETECTED = "FILE_VIRUS_DETECTED",

  // Database errors
  DB_CONNECTION_ERROR = "DB_CONNECTION_ERROR",
  DB_QUERY_ERROR = "DB_QUERY_ERROR",
  DB_UNIQUE_CONSTRAINT = "DB_UNIQUE_CONSTRAINT",
  DB_FOREIGN_KEY_VIOLATION = "DB_FOREIGN_KEY_VIOLATION",

  // Business logic errors
  BUSINESS_ERROR = "BUSINESS_ERROR",
  BUSINESS_INVALID_OPERATION = "BUSINESS_INVALID_OPERATION",
  BUSINESS_INSUFFICIENT_FUNDS = "BUSINESS_INSUFFICIENT_FUNDS",
  BUSINESS_USER_NOT_FOUND = "BUSINESS_USER_NOT_FOUND",
  BUSINESS_GROUP_NOT_FOUND = "BUSINESS_GROUP_NOT_FOUND",

  // System errors
  SYSTEM_ERROR = "SYSTEM_ERROR",
  SYSTEM_MAINTENANCE = "SYSTEM_MAINTENANCE",
  SYSTEM_TIMEOUT = "SYSTEM_TIMEOUT",

  // Unknown
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// -------- BASE INTERFACES --------

/**
 * Base response with common fields.
 */
export interface BaseApiResponse<T = any> {
  /** HTTP status code */
  statusCode: number;
  /** Response message */
  message: string;
  /** Response data (null for errors) */
  data: T | null;
  /** Timestamp when the response was generated */
  timestamp: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** API version */
  version?: string;
  /** Additional metadata */
  meta?: Record<string, any>;
}

/**
 * Success response (200-299).
 */
export interface SuccessApiResponse<T = any> extends BaseApiResponse<T> {
  /** Status code (2xx) */
  statusCode: 200 | 201 | 202 | 204 | 206;
  /** Success message */
  message: string;
  /** Data payload */
  data: T;
  /** Success flag */
  success: true;
}

/**
 * Error response (4xx, 5xx).
 */
export interface ErrorApiResponse extends BaseApiResponse<null> {
  /** Status code (4xx, 5xx) */
  statusCode:
    | 400
    | 401
    | 402
    | 403
    | 404
    | 405
    | 406
    | 409
    | 410
    | 411
    | 412
    | 413
    | 414
    | 415
    | 416
    | 417
    | 422
    | 429
    | 500
    | 501
    | 502
    | 503
    | 504;
  /** Error code (for client-side handling) */
  errorCode: ApiErrorCode | string;
  /** Error message */
  message: string;
  /** Error details (optional) */
  details?: {
    /** Field-specific validation errors */
    validationErrors?: Record<string, string[]>;
    /** Additional error context */
    context?: Record<string, any>;
    /** Stack trace (development only) */
    stack?: string;
  };
  /** Success flag */
  success: false;
  /** Error type for categorization */
  errorType:
    | "validation"
    | "authentication"
    | "authorization"
    | "resource"
    | "business"
    | "system";
}

/**
 * Paginated response.
 */
export interface PaginatedApiResponse<T = any> extends SuccessApiResponse<T[]> {
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of items */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there are more items */
    hasMore: boolean;
    /** Next page cursor (for cursor-based pagination) */
    nextCursor?: string;
    /** Previous page cursor (for cursor-based pagination) */
    prevCursor?: string;
  };
}

/**
 * Bulk operation response.
 */
export interface BulkApiResponse<T = any> extends SuccessApiResponse<T[]> {
  /** Bulk operation metadata */
  bulk: {
    /** Total items processed */
    total: number;
    /** Number of successful operations */
    succeeded: number;
    /** Number of failed operations */
    failed: number;
    /** List of failures with details */
    failures?: Array<{
      index: number;
      id?: string;
      error: string;
      errorCode?: ApiErrorCode;
    }>;
  };
}

// -------- RESPONSE BUILDER CLASS --------

/**
 * Response builder utility class for creating standardized API responses.
 */
export class ApiResponseBuilder {
  /**
   * Create a success response.
   */
  static success<T>(
    data: T,
    message: string = "Operation completed successfully",
    statusCode: 200 | 201 | 202 | 204 | 206 = 200,
    meta?: Record<string, any>,
    requestId?: string,
    correlationId?: string,
  ): SuccessApiResponse<T> {
    const response: SuccessApiResponse<T> = {
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      meta,
      success: true,
    };

    return response;
  }

  /**
   * Create a success response with no data (204 No Content).
   */
  static noContent(
    message: string = "Operation completed successfully",
    requestId?: string,
    correlationId?: string,
  ): SuccessApiResponse<null> {
    return {
      statusCode: 204,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      success: true,
    };
  }

  /**
   * Create a paginated response.
   */
  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message: string = "Data retrieved successfully",
    requestId?: string,
    correlationId?: string,
    meta?: Record<string, any>,
  ): PaginatedApiResponse<T> {
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      statusCode: 200,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      meta,
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    };
  }

  /**
   * Create a cursor-based paginated response.
   */
  static cursorPaginated<T>(
    data: T[],
    limit: number,
    hasMore: boolean,
    nextCursor?: string,
    prevCursor?: string,
    message: string = "Data retrieved successfully",
    requestId?: string,
    correlationId?: string,
    meta?: Record<string, any>,
  ): PaginatedApiResponse<T> {
    return {
      statusCode: 200,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      meta,
      success: true,
      pagination: {
        page: 1, // Not applicable for cursor-based
        limit,
        total: 0, // Not applicable for cursor-based
        totalPages: 0, // Not applicable for cursor-based
        hasMore,
        nextCursor,
        prevCursor,
      },
    };
  }

  /**
   * Create a bulk operation response.
   */
  static bulk<T>(
    succeeded: T[],
    failed: Array<{
      index: number;
      id?: string;
      error: string;
      errorCode?: ApiErrorCode;
    }>,
    message: string = "Bulk operation completed",
    requestId?: string,
    correlationId?: string,
  ): BulkApiResponse<T> {
    const total = succeeded.length + failed.length;

    return {
      statusCode: 200,
      message,
      data: succeeded,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      success: true,
      bulk: {
        total,
        succeeded: succeeded.length,
        failed: failed.length,
        failures: failed.length > 0 ? failed : undefined,
      },
    };
  }

  /**
   * Create an error response.
   */
  static error(
    message: string,
    statusCode: number = 500,
    errorCode: ApiErrorCode | string = ApiErrorCode.UNKNOWN_ERROR,
    details?: {
      validationErrors?: Record<string, string[]>;
      context?: Record<string, any>;
      stack?: string;
    },
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    const errorType = this.determineErrorType(errorCode, statusCode);

    return {
      statusCode: statusCode as ErrorApiResponse["statusCode"],
      errorCode: errorCode as ApiErrorCode,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      details,
      success: false,
      errorType,
    };
  }

  /**
   * Create a validation error response.
   */
  static validationError(
    validationErrors: Record<string, string[]>,
    message: string = "Validation failed",
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    return this.error(
      message,
      422,
      ApiErrorCode.VALIDATION_ERROR,
      { validationErrors },
      requestId,
      correlationId,
    );
  }

  /**
   * Create a not found error response.
   */
  static notFound(
    resource: string,
    id?: string,
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    const message = id
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;
    return this.error(
      message,
      404,
      ApiErrorCode.RESOURCE_NOT_FOUND,
      { context: { resource, id } },
      requestId,
      correlationId,
    );
  }

  /**
   * Create an unauthorized error response.
   */
  static unauthorized(
    message: string = "Authentication required",
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    return this.error(
      message,
      401,
      ApiErrorCode.AUTH_UNAUTHORIZED,
      undefined,
      requestId,
      correlationId,
    );
  }

  /**
   * Create a forbidden error response.
   */
  static forbidden(
    message: string = "Access denied",
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    return this.error(
      message,
      403,
      ApiErrorCode.AUTH_FORBIDDEN,
      undefined,
      requestId,
      correlationId,
    );
  }

  /**
   * Create a conflict error response.
   */
  static conflict(
    message: string = "Resource conflict",
    context?: Record<string, any>,
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    return this.error(
      message,
      409,
      ApiErrorCode.RESOURCE_CONFLICT,
      { context },
      requestId,
      correlationId,
    );
  }

  /**
   * Create a rate limit error response.
   */
  static rateLimited(
    message: string = "Too many requests. Please try again later.",
    retryAfter?: number,
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    return this.error(
      message,
      429,
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      { context: { retryAfter } },
      requestId,
      correlationId,
    );
  }

  /**
   * Create an internal server error response.
   */
  static internalError(
    message: string = "An unexpected error occurred",
    stack?: string,
    requestId?: string,
    correlationId?: string,
  ): ErrorApiResponse {
    return this.error(
      message,
      500,
      ApiErrorCode.SYSTEM_ERROR,
      { stack: process.env.NODE_ENV === "development" ? stack : undefined },
      requestId,
      correlationId,
    );
  }

  /**
   * Determine error type based on error code and status code.
   */
  private static determineErrorType(
    errorCode: ApiErrorCode | string,
    statusCode: number,
  ): ErrorApiResponse["errorType"] {
    const code = String(errorCode);

    if (code.startsWith("AUTH_")) return "authentication";
    if (code.startsWith("PERMISSION_")) return "authorization";
    if (code.startsWith("RESOURCE_")) return "resource";
    if (code.startsWith("VALIDATION_")) return "validation";
    if (code.startsWith("BUSINESS_")) return "business";

    if (statusCode === 400) return "validation";
    if (statusCode === 401) return "authentication";
    if (statusCode === 403) return "authorization";
    if (statusCode === 404) return "resource";
    if (statusCode === 409) return "resource";
    if (statusCode === 422) return "validation";
    if (statusCode === 429) return "system";

    return "system";
  }
}

// -------- TYPE GUARDS --------

/**
 * Type guard to check if a response is a success response.
 */
export function isSuccessResponse<T>(
  response: BaseApiResponse<T> | ErrorApiResponse,
): response is SuccessApiResponse<T> {
  return "success" in response && response.success === true;
}

/**
 * Type guard to check if a response is an error response.
 */
export function isErrorResponse(
  response: BaseApiResponse<any> | ErrorApiResponse,
): response is ErrorApiResponse {
  return "success" in response && response.success === false;
}

/**
 * Type guard to check if a response is a paginated response.
 */
export function isPaginatedResponse<T>(
  response: BaseApiResponse<T> | ErrorApiResponse,
): response is PaginatedApiResponse<T> {
  return (
    isSuccessResponse(response) &&
    "pagination" in response &&
    !!response.pagination
  );
}

/**
 * Type guard to check if a response is a bulk response.
 */
export function isBulkResponse<T>(
  response: BaseApiResponse<T> | ErrorApiResponse,
): response is BulkApiResponse<T> {
  return isSuccessResponse(response) && "bulk" in response && !!response.bulk;
}

// -------- RESPONSE TRANSFORMATION HELPERS --------

/**
 * Transform any value into a standardized API response.
 */
export class ResponseTransformer {
  /**
   * Transform a value into a success response.
   */
  static toSuccess<T>(
    value: T,
    statusCode: number = 200,
    message?: string,
    requestId?: string,
  ): SuccessApiResponse<T> {
    return ApiResponseBuilder.success(
      value,
      message ||
        (statusCode === 201
          ? "Resource created successfully"
          : "Operation completed successfully"),
      statusCode as any,
      undefined,
      requestId,
    );
  }

  /**
   * Transform an error into a standardized error response.
   */
  static toError(
    error: Error | string,
    statusCode: number = 500,
    errorCode?: ApiErrorCode | string,
    requestId?: string,
  ): ErrorApiResponse {
    const message = typeof error === "string" ? error : error.message;
    const code = errorCode || ApiErrorCode.UNKNOWN_ERROR;
    const stack = error instanceof Error ? error.stack : undefined;

    return ApiResponseBuilder.error(
      message,
      statusCode,
      code,
      { stack: process.env.NODE_ENV === "development" ? stack : undefined },
      requestId,
    );
  }

  /**
   * Transform a paginated query result into a paginated response.
   */
  static toPaginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string,
  ): PaginatedApiResponse<T> {
    return ApiResponseBuilder.paginated(data, total, page, limit, message);
  }

  /**
   * Transform a cursor-based paginated query result.
   */
  static toCursorPaginated<T>(
    data: T[],
    limit: number,
    hasMore: boolean,
    nextCursor?: string,
    prevCursor?: string,
    message?: string,
  ): PaginatedApiResponse<T> {
    return ApiResponseBuilder.cursorPaginated(
      data,
      limit,
      hasMore,
      nextCursor,
      prevCursor,
      message,
    );
  }
}

// -------- ERROR MAPPING --------

/**
 * Map HTTP status codes to error codes.
 */
export class ErrorCodeMapper {
  private static statusToErrorCode: Map<number, ApiErrorCode> = new Map([
    [400, ApiErrorCode.VALIDATION_ERROR],
    [401, ApiErrorCode.AUTH_UNAUTHORIZED],
    [403, ApiErrorCode.AUTH_FORBIDDEN],
    [404, ApiErrorCode.RESOURCE_NOT_FOUND],
    [409, ApiErrorCode.RESOURCE_CONFLICT],
    [422, ApiErrorCode.VALIDATION_ERROR],
    [429, ApiErrorCode.RATE_LIMIT_EXCEEDED],
    [500, ApiErrorCode.SYSTEM_ERROR],
    [503, ApiErrorCode.SYSTEM_ERROR],
  ]);

  static getErrorCode(statusCode: number): ApiErrorCode {
    return this.statusToErrorCode.get(statusCode) || ApiErrorCode.UNKNOWN_ERROR;
  }

  static getStatusMessage(statusCode: number): string {
    const messages: Record<number, string> = {
      200: "OK",
      201: "Created",
      204: "No Content",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      409: "Conflict",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      503: "Service Unavailable",
    };
    return messages[statusCode] || "Unknown Status";
  }
}

// -------- RESPONSE VALIDATION --------

/**
 * Validate that a response object matches the expected format.
 */
export class ResponseValidator {
  /**
   * Validate a success response.
   */
  static validateSuccess<T>(
    response: any,
    expectedData?: T,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response || typeof response !== "object") {
      errors.push("Response must be an object");
      return { valid: false, errors };
    }

    if (!("success" in response) || response.success !== true) {
      errors.push("Response must have success: true");
    }

    if (!("statusCode" in response)) {
      errors.push("Response must have statusCode");
    }

    if (!("message" in response)) {
      errors.push("Response must have message");
    }

    if (!("timestamp" in response)) {
      errors.push("Response must have timestamp");
    }

    if (!("data" in response)) {
      errors.push("Response must have data");
    }

    if (expectedData !== undefined) {
      // This is a simplified check; in practice you'd use more robust validation
      if (response.data === null && expectedData !== null) {
        errors.push("Data is null but expected non-null");
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate an error response.
   */
  static validateError(response: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response || typeof response !== "object") {
      errors.push("Response must be an object");
      return { valid: false, errors };
    }

    if (!("success" in response) || response.success !== false) {
      errors.push("Response must have success: false");
    }

    if (!("statusCode" in response)) {
      errors.push("Response must have statusCode");
    }

    if (!("errorCode" in response)) {
      errors.push("Response must have errorCode");
    }

    if (!("message" in response)) {
      errors.push("Response must have message");
    }

    if (!("timestamp" in response)) {
      errors.push("Response must have timestamp");
    }

    if (!("data" in response) || response.data !== null) {
      errors.push("Response data must be null");
    }

    return { valid: errors.length === 0, errors };
  }
}

// -------- UTILITY FUNCTIONS --------

/**
 * Check if a response is an error response by status code.
 */
export function isErrorStatus(statusCode: number): boolean {
  return statusCode >= 400;
}

/**
 * Get the response type based on the response object.
 */
export function getResponseType(
  response: BaseApiResponse<any> | ErrorApiResponse,
): "success" | "error" | "paginated" | "bulk" {
  if (isErrorResponse(response)) return "error";
  if (isPaginatedResponse(response)) return "paginated";
  if (isBulkResponse(response)) return "bulk";
  return "success";
}

/**
 * Extract data from a response (safe).
 */
export function extractResponseData<T>(
  response: BaseApiResponse<T> | ErrorApiResponse,
): T | null {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  return null;
}

/**
 * Extract error details from a response (safe).
 */
export function extractErrorDetails(
  response: BaseApiResponse<any> | ErrorApiResponse,
): { errorCode: string; message: string; details?: any } | null {
  if (isErrorResponse(response)) {
    return {
      errorCode: response.errorCode,
      message: response.message,
      details: response.details,
    };
  }
  return null;
}

// -------- END --------
