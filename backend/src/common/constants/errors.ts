// backend/src/common/constants/errors.ts
/**
 * 📄 Error Constants
 *
 * This file defines all error codes, categories, and default messages
 * used throughout the Real WhatsApp Clone application.
 *
 * @category Constants
 * @module Errors
 */

// -------- ERROR CATEGORIES --------

/**
 * Error categories for classification.
 */
export enum ErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  RESOURCE = "resource",
  BUSINESS = "business",
  SYSTEM = "system",
  NETWORK = "network",
  DATABASE = "database",
  FILE = "file",
  EXTERNAL = "external",
  SECURITY = "security",
  RATE_LIMIT = "rate_limit",
}

/**
 * Error severity levels.
 */
export enum ErrorSeverity {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
  FATAL = "fatal",
}

// -------- ERROR CODE DEFINITIONS --------

/**
 * Error code definition interface.
 */
export interface ErrorDefinition {
  /** Unique error code */
  code: string;
  /** Error category */
  category: ErrorCategory;
  /** Default message (English) */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Severity level */
  severity: ErrorSeverity;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Whether the error should be logged */
  loggable: boolean;
  /** Whether the error should be shown to the client */
  clientFacing: boolean;
  /** Additional context fields */
  contextFields?: string[];
  /** Suggestions for fixing the error */
  suggestions?: string[];
  /** Alternative messages for different languages */
  messages?: Record<string, string>;
}

// -------- AUTHENTICATION ERRORS --------

export const AUTH_ERRORS: Record<string, ErrorDefinition> = {
  // Unauthorized
  AUTH_UNAUTHORIZED: {
    code: "AUTH_UNAUTHORIZED",
    category: ErrorCategory.AUTHENTICATION,
    message: "Authentication required. Please log in.",
    statusCode: 401,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["path", "method"],
    suggestions: ["Log in with valid credentials", "Check if token is valid"],
  },

  AUTH_INVALID_CREDENTIALS: {
    code: "AUTH_INVALID_CREDENTIALS",
    category: ErrorCategory.AUTHENTICATION,
    message: "Invalid email, phone number, or password.",
    statusCode: 401,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["identifier", "ip"],
    suggestions: [
      "Check your email/phone and password",
      "Reset your password if needed",
    ],
  },

  AUTH_TOKEN_EXPIRED: {
    code: "AUTH_TOKEN_EXPIRED",
    category: ErrorCategory.AUTHENTICATION,
    message:
      "Authentication token has expired. Please refresh or log in again.",
    statusCode: 401,
    severity: ErrorSeverity.INFO,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["tokenId", "userId"],
    suggestions: ["Refresh your token", "Log in again to get a new token"],
  },

  AUTH_TOKEN_INVALID: {
    code: "AUTH_TOKEN_INVALID",
    category: ErrorCategory.AUTHENTICATION,
    message: "Invalid authentication token.",
    statusCode: 401,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["tokenId", "reason"],
    suggestions: ["Log in again to get a valid token"],
  },

  AUTH_TOKEN_BLACKLISTED: {
    code: "AUTH_TOKEN_BLACKLISTED",
    category: ErrorCategory.AUTHENTICATION,
    message: "Token has been revoked. Please log in again.",
    statusCode: 401,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["tokenId", "userId", "reason"],
    suggestions: ["Log in again to get a new token"],
  },

  AUTH_FORBIDDEN: {
    code: "AUTH_FORBIDDEN",
    category: ErrorCategory.AUTHORIZATION,
    message:
      "Access forbidden. You do not have permission to access this resource.",
    statusCode: 403,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["path", "userId", "requiredRole", "requiredPermission"],
    suggestions: ["Contact administrator for access"],
  },

  AUTH_ACCOUNT_SUSPENDED: {
    code: "AUTH_ACCOUNT_SUSPENDED",
    category: ErrorCategory.AUTHENTICATION,
    message: "Your account has been suspended. Please contact support.",
    statusCode: 403,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "reason", "suspendedAt"],
    suggestions: ["Contact support to resolve this issue"],
  },

  AUTH_ACCOUNT_INACTIVE: {
    code: "AUTH_ACCOUNT_INACTIVE",
    category: ErrorCategory.AUTHENTICATION,
    message:
      "Your account is inactive. Please verify your email or contact support.",
    statusCode: 403,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "status"],
    suggestions: ["Verify your email address", "Contact support"],
  },

  AUTH_EMAIL_UNVERIFIED: {
    code: "AUTH_EMAIL_UNVERIFIED",
    category: ErrorCategory.AUTHENTICATION,
    message: "Please verify your email address to continue.",
    statusCode: 403,
    severity: ErrorSeverity.INFO,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "email"],
    suggestions: [
      "Check your email for verification link",
      "Request a new verification email",
    ],
  },

  AUTH_2FA_REQUIRED: {
    code: "AUTH_2FA_REQUIRED",
    category: ErrorCategory.AUTHENTICATION,
    message:
      "Two-factor authentication is required. Please provide your 2FA code.",
    statusCode: 401,
    severity: ErrorSeverity.INFO,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "method"],
    suggestions: ["Enter your 2FA code", "Use backup code if available"],
  },

  AUTH_2FA_INVALID: {
    code: "AUTH_2FA_INVALID",
    category: ErrorCategory.AUTHENTICATION,
    message: "Invalid two-factor authentication code. Please try again.",
    statusCode: 401,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "attempts"],
    suggestions: [
      "Check your authenticator app",
      "Use a backup code",
      "Request a new code",
    ],
  },

  AUTH_SESSION_EXPIRED: {
    code: "AUTH_SESSION_EXPIRED",
    category: ErrorCategory.AUTHENTICATION,
    message: "Your session has expired. Please log in again.",
    statusCode: 401,
    severity: ErrorSeverity.INFO,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "sessionId", "expiredAt"],
    suggestions: ["Log in again", "Request a new session"],
  },

  AUTH_INSUFFICIENT_PERMISSIONS: {
    code: "AUTH_INSUFFICIENT_PERMISSIONS",
    category: ErrorCategory.AUTHORIZATION,
    message: "Insufficient permissions to perform this action.",
    statusCode: 403,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "requiredPermission", "requiredRole"],
    suggestions: ["Contact administrator for additional permissions"],
  },

  AUTH_USER_NOT_FOUND: {
    code: "AUTH_USER_NOT_FOUND",
    category: ErrorCategory.AUTHENTICATION,
    message: "User not found with the provided credentials.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["identifier"],
    suggestions: [
      "Check your email/phone number",
      "Create a new account if you don't have one",
    ],
  },
} as const;

// -------- VALIDATION ERRORS --------

export const VALIDATION_ERRORS: Record<string, ErrorDefinition> = {
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    category: ErrorCategory.VALIDATION,
    message: "Validation failed. Please check your input.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["fields", "errors"],
    suggestions: ["Check all required fields", "Fix invalid field values"],
  },

  VALIDATION_INVALID_INPUT: {
    code: "VALIDATION_INVALID_INPUT",
    category: ErrorCategory.VALIDATION,
    message: "Invalid input provided.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "value", "expected"],
    suggestions: ["Provide valid input for all fields"],
  },

  VALIDATION_MISSING_FIELD: {
    code: "VALIDATION_MISSING_FIELD",
    category: ErrorCategory.VALIDATION,
    message: "Required field is missing.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field"],
    suggestions: ["Provide all required fields"],
  },

  VALIDATION_INVALID_FORMAT: {
    code: "VALIDATION_INVALID_FORMAT",
    category: ErrorCategory.VALIDATION,
    message: "Invalid format. Please check the field format.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "format", "value"],
    suggestions: ["Use the correct format for the field"],
  },

  VALIDATION_INVALID_EMAIL: {
    code: "VALIDATION_INVALID_EMAIL",
    category: ErrorCategory.VALIDATION,
    message: "Invalid email address format.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["email"],
    suggestions: ["Provide a valid email address"],
  },

  VALIDATION_INVALID_PHONE: {
    code: "VALIDATION_INVALID_PHONE",
    category: ErrorCategory.VALIDATION,
    message: "Invalid phone number format. Use E.164 format.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["phone"],
    suggestions: ["Use E.164 format (e.g., +1234567890)"],
  },

  VALIDATION_INVALID_PASSWORD: {
    code: "VALIDATION_INVALID_PASSWORD",
    category: ErrorCategory.VALIDATION,
    message: "Password does not meet the requirements.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["requirements"],
    suggestions: [
      "Use at least 8 characters",
      "Include uppercase, lowercase, number, and special character",
    ],
  },

  VALIDATION_INVALID_URL: {
    code: "VALIDATION_INVALID_URL",
    category: ErrorCategory.VALIDATION,
    message: "Invalid URL format.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["url"],
    suggestions: ["Provide a valid URL"],
  },

  VALIDATION_INVALID_UUID: {
    code: "VALIDATION_INVALID_UUID",
    category: ErrorCategory.VALIDATION,
    message: "Invalid UUID format.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["uuid"],
    suggestions: ["Provide a valid UUID"],
  },

  VALIDATION_VALUE_TOO_LONG: {
    code: "VALIDATION_VALUE_TOO_LONG",
    category: ErrorCategory.VALIDATION,
    message: "Value exceeds maximum allowed length.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "maxLength", "currentLength"],
    suggestions: ["Reduce the length of the input"],
  },

  VALIDATION_VALUE_TOO_SHORT: {
    code: "VALIDATION_VALUE_TOO_SHORT",
    category: ErrorCategory.VALIDATION,
    message: "Value does not meet minimum length requirement.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "minLength", "currentLength"],
    suggestions: ["Increase the length of the input"],
  },

  VALIDATION_VALUE_OUT_OF_RANGE: {
    code: "VALIDATION_VALUE_OUT_OF_RANGE",
    category: ErrorCategory.VALIDATION,
    message: "Value is out of allowed range.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "min", "max", "value"],
    suggestions: ["Provide a value within the allowed range"],
  },

  VALIDATION_DUPLICATE_VALUE: {
    code: "VALIDATION_DUPLICATE_VALUE",
    category: ErrorCategory.VALIDATION,
    message: "Value already exists. Please use a unique value.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "value"],
    suggestions: ["Use a different, unique value"],
  },

  VALIDATION_INVALID_CHOICE: {
    code: "VALIDATION_INVALID_CHOICE",
    category: ErrorCategory.VALIDATION,
    message: "Invalid selection. Please choose from the allowed options.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "value", "allowedValues"],
    suggestions: ["Select from the allowed options"],
  },
} as const;

// -------- RESOURCE ERRORS --------

export const RESOURCE_ERRORS: Record<string, ErrorDefinition> = {
  RESOURCE_NOT_FOUND: {
    code: "RESOURCE_NOT_FOUND",
    category: ErrorCategory.RESOURCE,
    message: "Requested resource not found.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId"],
    suggestions: ["Check the resource ID", "Verify the resource exists"],
  },

  RESOURCE_ALREADY_EXISTS: {
    code: "RESOURCE_ALREADY_EXISTS",
    category: ErrorCategory.RESOURCE,
    message: "Resource already exists.",
    statusCode: 409,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "identifier"],
    suggestions: [
      "Use a different identifier",
      "Check if resource already exists",
    ],
  },

  RESOURCE_CONFLICT: {
    code: "RESOURCE_CONFLICT",
    category: ErrorCategory.RESOURCE,
    message: "Resource conflict. The resource has been modified.",
    statusCode: 409,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId"],
    suggestions: ["Refresh the resource and try again"],
  },

  RESOURCE_LOCKED: {
    code: "RESOURCE_LOCKED",
    category: ErrorCategory.RESOURCE,
    message: "Resource is locked and cannot be modified.",
    statusCode: 409,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId", "lockedBy"],
    suggestions: [
      "Wait for the lock to be released",
      "Contact the resource owner",
    ],
  },

  RESOURCE_DELETED: {
    code: "RESOURCE_DELETED",
    category: ErrorCategory.RESOURCE,
    message: "Resource has been deleted.",
    statusCode: 410,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId", "deletedAt"],
    suggestions: ["The resource is no longer available"],
  },

  RESOURCE_EXPIRED: {
    code: "RESOURCE_EXPIRED",
    category: ErrorCategory.RESOURCE,
    message: "Resource has expired.",
    statusCode: 410,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId", "expiredAt"],
    suggestions: ["Request a new resource"],
  },

  RESOURCE_INVALID_STATE: {
    code: "RESOURCE_INVALID_STATE",
    category: ErrorCategory.RESOURCE,
    message: "Resource is in an invalid state for this operation.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId", "state"],
    suggestions: [
      "Check the resource state",
      "Perform the operation at the correct time",
    ],
  },

  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    category: ErrorCategory.RESOURCE,
    message: "User not found.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId"],
    suggestions: ["Check the user ID", "Verify the user exists"],
  },

  GROUP_NOT_FOUND: {
    code: "GROUP_NOT_FOUND",
    category: ErrorCategory.RESOURCE,
    message: "Group not found.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["groupId"],
    suggestions: ["Check the group ID", "Verify the group exists"],
  },

  MESSAGE_NOT_FOUND: {
    code: "MESSAGE_NOT_FOUND",
    category: ErrorCategory.RESOURCE,
    message: "Message not found.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["messageId"],
    suggestions: ["Check the message ID", "Verify the message exists"],
  },

  FILE_NOT_FOUND: {
    code: "FILE_NOT_FOUND",
    category: ErrorCategory.RESOURCE,
    message: "File not found.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["fileId"],
    suggestions: ["Check the file ID", "Verify the file exists"],
  },

  CALL_NOT_FOUND: {
    code: "CALL_NOT_FOUND",
    category: ErrorCategory.RESOURCE,
    message: "Call not found.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["callId"],
    suggestions: ["Check the call ID", "Verify the call exists"],
  },
} as const;

// -------- BUSINESS ERRORS --------

export const BUSINESS_ERRORS: Record<string, ErrorDefinition> = {
  BUSINESS_ERROR: {
    code: "BUSINESS_ERROR",
    category: ErrorCategory.BUSINESS,
    message: "Business rule violation.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["rule", "context"],
    suggestions: ["Review business rules"],
  },

  BUSINESS_INVALID_OPERATION: {
    code: "BUSINESS_INVALID_OPERATION",
    category: ErrorCategory.BUSINESS,
    message: "Invalid operation for the current state.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["operation", "state"],
    suggestions: [
      "Check the current state",
      "Perform the operation at the correct time",
    ],
  },

  BUSINESS_CANNOT_DELETE: {
    code: "BUSINESS_CANNOT_DELETE",
    category: ErrorCategory.BUSINESS,
    message: "Cannot delete resource due to existing dependencies.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId", "dependencies"],
    suggestions: ["Remove dependencies first"],
  },

  BUSINESS_CANNOT_UPDATE: {
    code: "BUSINESS_CANNOT_UPDATE",
    category: ErrorCategory.BUSINESS,
    message: "Cannot update resource due to business constraints.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["resourceType", "resourceId", "constraint"],
    suggestions: ["Check business constraints"],
  },

  BUSINESS_USER_BLOCKED: {
    code: "BUSINESS_USER_BLOCKED",
    category: ErrorCategory.BUSINESS,
    message: "User has been blocked. Cannot perform this action.",
    statusCode: 403,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "reason"],
    suggestions: ["Contact support to unblock the user"],
  },

  BUSINESS_USER_ALREADY_CONTACT: {
    code: "BUSINESS_USER_ALREADY_CONTACT",
    category: ErrorCategory.BUSINESS,
    message: "User is already in your contacts.",
    statusCode: 409,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId"],
    suggestions: ["User is already a contact"],
  },

  BUSINESS_USER_NOT_CONTACT: {
    code: "BUSINESS_USER_NOT_CONTACT",
    category: ErrorCategory.BUSINESS,
    message: "User is not in your contacts.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId"],
    suggestions: ["Add the user as a contact first"],
  },

  BUSINESS_GROUP_ALREADY_MEMBER: {
    code: "BUSINESS_GROUP_ALREADY_MEMBER",
    category: ErrorCategory.BUSINESS,
    message: "User is already a member of this group.",
    statusCode: 409,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["groupId", "userId"],
    suggestions: ["User is already a member"],
  },

  BUSINESS_GROUP_NOT_MEMBER: {
    code: "BUSINESS_GROUP_NOT_MEMBER",
    category: ErrorCategory.BUSINESS,
    message: "User is not a member of this group.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["groupId", "userId"],
    suggestions: ["Add the user to the group first"],
  },

  BUSINESS_GROUP_FULL: {
    code: "BUSINESS_GROUP_FULL",
    category: ErrorCategory.BUSINESS,
    message: "Group has reached maximum capacity.",
    statusCode: 409,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["groupId", "maxMembers"],
    suggestions: ["Remove inactive members", "Create a new group"],
  },

  BUSINESS_INVITE_EXPIRED: {
    code: "BUSINESS_INVITE_EXPIRED",
    category: ErrorCategory.BUSINESS,
    message: "Group invite has expired.",
    statusCode: 410,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["inviteId", "expiredAt"],
    suggestions: ["Request a new invite"],
  },

  BUSINESS_INVITE_INVALID: {
    code: "BUSINESS_INVITE_INVALID",
    category: ErrorCategory.BUSINESS,
    message: "Invalid group invite.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["inviteId"],
    suggestions: ["Check the invite code", "Request a new invite"],
  },

  BUSINESS_MESSAGE_DELETED: {
    code: "BUSINESS_MESSAGE_DELETED",
    category: ErrorCategory.BUSINESS,
    message: "Message has been deleted.",
    statusCode: 410,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["messageId"],
    suggestions: ["Message is no longer available"],
  },
} as const;

// -------- SYSTEM ERRORS --------

export const SYSTEM_ERRORS: Record<string, ErrorDefinition> = {
  SYSTEM_ERROR: {
    code: "SYSTEM_ERROR",
    category: ErrorCategory.SYSTEM,
    message: "An unexpected system error occurred.",
    statusCode: 500,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["errorId", "stack"],
    suggestions: ["Try again later", "Contact support if the issue persists"],
  },

  SYSTEM_MAINTENANCE: {
    code: "SYSTEM_MAINTENANCE",
    category: ErrorCategory.SYSTEM,
    message: "System is currently under maintenance. Please try again later.",
    statusCode: 503,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["maintenanceWindow", "estimatedEnd"],
    suggestions: ["Check back after the maintenance window"],
  },

  SYSTEM_TIMEOUT: {
    code: "SYSTEM_TIMEOUT",
    category: ErrorCategory.SYSTEM,
    message: "Request timed out. Please try again.",
    statusCode: 504,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["timeoutMs", "endpoint"],
    suggestions: [
      "Try again with a simpler request",
      "Check your network connection",
    ],
  },

  SYSTEM_BUSY: {
    code: "SYSTEM_BUSY",
    category: ErrorCategory.SYSTEM,
    message: "System is currently busy. Please try again later.",
    statusCode: 503,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["load", "queueLength"],
    suggestions: ["Try again after a few seconds"],
  },

  SYSTEM_UPGRADE_REQUIRED: {
    code: "SYSTEM_UPGRADE_REQUIRED",
    category: ErrorCategory.SYSTEM,
    message: "System upgrade required. Please update your client.",
    statusCode: 426,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["minVersion", "currentVersion"],
    suggestions: ["Update your client to the latest version"],
  },
} as const;

// -------- DATABASE ERRORS --------

export const DATABASE_ERRORS: Record<string, ErrorDefinition> = {
  DB_CONNECTION_ERROR: {
    code: "DB_CONNECTION_ERROR",
    category: ErrorCategory.DATABASE,
    message: "Database connection error.",
    statusCode: 503,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["errorId", "host"],
    suggestions: [
      "Check database connectivity",
      "Contact system administrator",
    ],
  },

  DB_QUERY_ERROR: {
    code: "DB_QUERY_ERROR",
    category: ErrorCategory.DATABASE,
    message: "Database query error.",
    statusCode: 500,
    severity: ErrorSeverity.ERROR,
    retryable: false,
    loggable: true,
    clientFacing: false,
    contextFields: ["errorId", "query"],
    suggestions: ["Contact system administrator"],
  },

  DB_UNIQUE_CONSTRAINT: {
    code: "DB_UNIQUE_CONSTRAINT",
    category: ErrorCategory.DATABASE,
    message: "Duplicate entry. A record with this value already exists.",
    statusCode: 409,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "value"],
    suggestions: ["Use a unique value for this field"],
  },

  DB_FOREIGN_KEY_VIOLATION: {
    code: "DB_FOREIGN_KEY_VIOLATION",
    category: ErrorCategory.DATABASE,
    message: "Referenced record does not exist.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["field", "reference"],
    suggestions: ["Check that the referenced record exists"],
  },

  DB_RECORD_NOT_FOUND: {
    code: "DB_RECORD_NOT_FOUND",
    category: ErrorCategory.DATABASE,
    message: "Record not found in database.",
    statusCode: 404,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["table", "id"],
    suggestions: ["Check the record ID", "Verify the record exists"],
  },

  DB_TRANSACTION_ERROR: {
    code: "DB_TRANSACTION_ERROR",
    category: ErrorCategory.DATABASE,
    message: "Transaction error. Please try again.",
    statusCode: 500,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["errorId"],
    suggestions: ["Try again", "Contact support if issue persists"],
  },
} as const;

// -------- FILE ERRORS --------

export const FILE_ERRORS: Record<string, ErrorDefinition> = {
  FILE_UPLOAD_ERROR: {
    code: "FILE_UPLOAD_ERROR",
    category: ErrorCategory.FILE,
    message: "File upload failed. Please try again.",
    statusCode: 500,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["fileName", "size", "error"],
    suggestions: ["Check file permissions", "Try uploading again"],
  },

  FILE_INVALID_TYPE: {
    code: "FILE_INVALID_TYPE",
    category: ErrorCategory.FILE,
    message: "File type is not allowed.",
    statusCode: 400,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["mimeType", "allowedTypes"],
    suggestions: ["Upload a file with an allowed type"],
  },

  FILE_TOO_LARGE: {
    code: "FILE_TOO_LARGE",
    category: ErrorCategory.FILE,
    message: "File size exceeds maximum allowed.",
    statusCode: 413,
    severity: ErrorSeverity.INFO,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["size", "maxSize"],
    suggestions: ["Reduce file size", "Upload a smaller file"],
  },

  FILE_VIRUS_DETECTED: {
    code: "FILE_VIRUS_DETECTED",
    category: ErrorCategory.FILE,
    message: "Security threat detected in file. Upload blocked.",
    statusCode: 400,
    severity: ErrorSeverity.CRITICAL,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["fileName", "threat"],
    suggestions: ["Upload a different file"],
  },

  FILE_CORRUPTED: {
    code: "FILE_CORRUPTED",
    category: ErrorCategory.FILE,
    message: "File appears to be corrupted or incomplete.",
    statusCode: 400,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["fileName"],
    suggestions: [
      "Try uploading the file again",
      "Check if the file is damaged",
    ],
  },
} as const;

// -------- RATE LIMIT ERRORS --------

export const RATE_LIMIT_ERRORS: Record<string, ErrorDefinition> = {
  RATE_LIMIT_EXCEEDED: {
    code: "RATE_LIMIT_EXCEEDED",
    category: ErrorCategory.RATE_LIMIT,
    message: "Too many requests. Please slow down.",
    statusCode: 429,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["limit", "window", "resetAt"],
    suggestions: ["Wait and try again", "Reduce request frequency"],
  },

  RATE_LIMIT_USER_EXCEEDED: {
    code: "RATE_LIMIT_USER_EXCEEDED",
    category: ErrorCategory.RATE_LIMIT,
    message: "User rate limit exceeded. Please slow down.",
    statusCode: 429,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "limit", "resetAt"],
    suggestions: ["Wait and try again", "Reduce request frequency"],
  },

  RATE_LIMIT_IP_EXCEEDED: {
    code: "RATE_LIMIT_IP_EXCEEDED",
    category: ErrorCategory.RATE_LIMIT,
    message: "IP rate limit exceeded. Please slow down.",
    statusCode: 429,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["ip", "limit", "resetAt"],
    suggestions: [
      "Wait and try again",
      "Reduce request frequency from this IP",
    ],
  },

  RATE_LIMIT_GLOBAL_EXCEEDED: {
    code: "RATE_LIMIT_GLOBAL_EXCEEDED",
    category: ErrorCategory.RATE_LIMIT,
    message: "Global rate limit exceeded. Please try again later.",
    statusCode: 429,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["limit", "resetAt"],
    suggestions: ["Wait and try again later"],
  },
} as const;

// -------- NETWORK ERRORS --------

export const NETWORK_ERRORS: Record<string, ErrorDefinition> = {
  NETWORK_TIMEOUT: {
    code: "NETWORK_TIMEOUT",
    category: ErrorCategory.NETWORK,
    message: "Network request timed out.",
    statusCode: 504,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["endpoint", "timeoutMs"],
    suggestions: ["Check your network connection", "Try again later"],
  },

  NETWORK_CONNECTION_REFUSED: {
    code: "NETWORK_CONNECTION_REFUSED",
    category: ErrorCategory.NETWORK,
    message: "Network connection refused.",
    statusCode: 503,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["host", "port"],
    suggestions: ["Check service availability", "Try again later"],
  },

  NETWORK_DNS_ERROR: {
    code: "NETWORK_DNS_ERROR",
    category: ErrorCategory.NETWORK,
    message: "DNS resolution failed.",
    statusCode: 503,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["host"],
    suggestions: ["Check DNS configuration", "Contact network administrator"],
  },
} as const;

// -------- SECURITY ERRORS --------

export const SECURITY_ERRORS: Record<string, ErrorDefinition> = {
  SECURITY_VIOLATION: {
    code: "SECURITY_VIOLATION",
    category: ErrorCategory.SECURITY,
    message: "Security violation detected.",
    statusCode: 403,
    severity: ErrorSeverity.CRITICAL,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "ip", "violation"],
    suggestions: ["Contact support", "Review security policies"],
  },

  SECURITY_BREACH: {
    code: "SECURITY_BREACH",
    category: ErrorCategory.SECURITY,
    message: "Security breach detected. Action blocked.",
    statusCode: 403,
    severity: ErrorSeverity.CRITICAL,
    retryable: false,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "ip", "breach"],
    suggestions: ["Contact support immediately"],
  },

  SECURITY_SUSPICIOUS_ACTIVITY: {
    code: "SECURITY_SUSPICIOUS_ACTIVITY",
    category: ErrorCategory.SECURITY,
    message: "Suspicious activity detected. Please verify your identity.",
    statusCode: 403,
    severity: ErrorSeverity.WARNING,
    retryable: true,
    loggable: true,
    clientFacing: true,
    contextFields: ["userId", "activity"],
    suggestions: [
      "Verify your identity",
      "Contact support if you believe this is an error",
    ],
  },
} as const;

// -------- EXTERNAL SERVICE ERRORS --------

export const EXTERNAL_ERRORS: Record<string, ErrorDefinition> = {
  EXTERNAL_SERVICE_ERROR: {
    code: "EXTERNAL_SERVICE_ERROR",
    category: ErrorCategory.EXTERNAL,
    message: "External service error. Please try again later.",
    statusCode: 502,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["service", "endpoint"],
    suggestions: ["Try again later", "Contact support if issue persists"],
  },

  EXTERNAL_SERVICE_UNAVAILABLE: {
    code: "EXTERNAL_SERVICE_UNAVAILABLE",
    category: ErrorCategory.EXTERNAL,
    message: "External service is currently unavailable.",
    statusCode: 503,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["service"],
    suggestions: ["Try again later", "Check service status"],
  },

  EXTERNAL_SERVICE_TIMEOUT: {
    code: "EXTERNAL_SERVICE_TIMEOUT",
    category: ErrorCategory.EXTERNAL,
    message: "External service request timed out.",
    statusCode: 504,
    severity: ErrorSeverity.ERROR,
    retryable: true,
    loggable: true,
    clientFacing: false,
    contextFields: ["service", "timeoutMs"],
    suggestions: ["Try again later", "Check service connectivity"],
  },
} as const;

// -------- ALL ERRORS REGISTRY --------

/**
 * Complete error registry with all error definitions.
 */
export const ALL_ERRORS: Record<string, ErrorDefinition> = {
  ...AUTH_ERRORS,
  ...VALIDATION_ERRORS,
  ...RESOURCE_ERRORS,
  ...BUSINESS_ERRORS,
  ...SYSTEM_ERRORS,
  ...DATABASE_ERRORS,
  ...FILE_ERRORS,
  ...RATE_LIMIT_ERRORS,
  ...NETWORK_ERRORS,
  ...SECURITY_ERRORS,
  ...EXTERNAL_ERRORS,
};

// -------- ERROR UTILITY FUNCTIONS --------

/**
 * Get error definition by code.
 */
export function getErrorDefinition(code: string): ErrorDefinition | undefined {
  return ALL_ERRORS[code];
}

/**
 * Get error message by code.
 */
export function getErrorMessage(code: string, language: string = "en"): string {
  const definition = getErrorDefinition(code);
  if (!definition) return `Unknown error: ${code}`;
  return definition.messages?.[language] || definition.message;
}

/**
 * Get HTTP status code for an error code.
 */
export function getErrorStatusCode(code: string): number {
  const definition = getErrorDefinition(code);
  return definition?.statusCode || 500;
}

/**
 * Get error category for an error code.
 */
export function getErrorCategory(code: string): ErrorCategory | undefined {
  const definition = getErrorDefinition(code);
  return definition?.category;
}

/**
 * Get error severity for an error code.
 */
export function getErrorSeverity(code: string): ErrorSeverity | undefined {
  const definition = getErrorDefinition(code);
  return definition?.severity;
}

/**
 * Check if an error is retryable.
 */
export function isErrorRetryable(code: string): boolean {
  const definition = getErrorDefinition(code);
  return definition?.retryable || false;
}

/**
 * Check if an error should be logged.
 */
export function isErrorLoggable(code: string): boolean {
  const definition = getErrorDefinition(code);
  return definition?.loggable !== false;
}

/**
 * Check if an error should be shown to the client.
 */
export function isErrorClientFacing(code: string): boolean {
  const definition = getErrorDefinition(code);
  return definition?.clientFacing !== false;
}

/**
 * Get suggestions for resolving an error.
 */
export function getErrorSuggestions(code: string): string[] {
  const definition = getErrorDefinition(code);
  return definition?.suggestions || ["Try again later"];
}

/**
 * Get all error codes by category.
 */
export function getErrorsByCategory(category: ErrorCategory): string[] {
  const codes: string[] = [];
  for (const [code, definition] of Object.entries(ALL_ERRORS)) {
    if (definition.category === category) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Get all error codes by severity.
 */
export function getErrorsBySeverity(severity: ErrorSeverity): string[] {
  const codes: string[] = [];
  for (const [code, definition] of Object.entries(ALL_ERRORS)) {
    if (definition.severity === severity) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Get all error codes by HTTP status.
 */
export function getErrorsByStatusCode(statusCode: number): string[] {
  const codes: string[] = [];
  for (const [code, definition] of Object.entries(ALL_ERRORS)) {
    if (definition.statusCode === statusCode) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Build an error response object.
 */
export function buildErrorResponse(
  code: string,
  context?: Record<string, any>,
  customMessage?: string,
): {
  errorCode: string;
  message: string;
  statusCode: number;
  context?: Record<string, any>;
} {
  const definition = getErrorDefinition(code);
  return {
    errorCode: code,
    message: customMessage || definition?.message || `Unknown error: ${code}`,
    statusCode: definition?.statusCode || 500,
    context,
  };
}

/**
 * Create a formatted error object for logging.
 */
export function formatErrorForLogging(
  code: string,
  error: Error,
  context?: Record<string, any>,
): Record<string, any> {
  const definition = getErrorDefinition(code);
  return {
    errorCode: code,
    category: definition?.category || "unknown",
    severity: definition?.severity || ErrorSeverity.ERROR,
    message: error.message,
    stack: error.stack,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Classify an error by code.
 */
export function classifyError(code: string): {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  statusCode: number;
  retryable: boolean;
} {
  const definition = getErrorDefinition(code);
  return {
    code,
    category: definition?.category || ErrorCategory.SYSTEM,
    severity: definition?.severity || ErrorSeverity.ERROR,
    statusCode: definition?.statusCode || 500,
    retryable: definition?.retryable || false,
  };
}

/**
 * Error class with built-in classification.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;

  constructor(code: string, message?: string, context?: Record<string, any>) {
    const definition = getErrorDefinition(code);
    super(message || definition?.message || `Unknown error: ${code}`);

    this.code = code;
    this.category = definition?.category || ErrorCategory.SYSTEM;
    this.severity = definition?.severity || ErrorSeverity.ERROR;
    this.statusCode = definition?.statusCode || 500;
    this.retryable = definition?.retryable || false;
    this.context = context;

    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Get the error response for the client.
   */
  toResponse(): {
    errorCode: string;
    message: string;
    statusCode: number;
    context?: Record<string, any>;
  } {
    return {
      errorCode: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
    };
  }

  /**
   * Get the error for logging.
   */
  toLog(): Record<string, any> {
    return {
      errorCode: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: this.context,
    };
  }
}

// -------- ERROR MESSAGE TEMPLATES --------

/**
 * Error message templates for common scenarios.
 */
export const ERROR_TEMPLATES = {
  NOT_FOUND: (resource: string, id: string) =>
    `${resource} with ID "${id}" not found.`,

  ALREADY_EXISTS: (resource: string, field: string, value: string) =>
    `${resource} with ${field} "${value}" already exists.`,

  INVALID_CREDENTIALS: (field: string) => `Invalid ${field} provided.`,

  REQUIRED_FIELD: (field: string) => `Field "${field}" is required.`,

  INVALID_FORMAT: (field: string, format: string) =>
    `Field "${field}" must be in "${format}" format.`,

  VALUE_TOO_LONG: (field: string, max: number) =>
    `Field "${field}" cannot exceed ${max} characters.`,

  VALUE_TOO_SHORT: (field: string, min: number) =>
    `Field "${field}" must be at least ${min} characters.`,

  OUT_OF_RANGE: (field: string, min: number, max: number) =>
    `Field "${field}" must be between ${min} and ${max}.`,

  PERMISSION_DENIED: (permission: string) =>
    `You do not have "${permission}" permission.`,

  RATE_LIMIT: (limit: number, window: string) =>
    `Too many requests. Limit is ${limit} per ${window}.`,
} as const;

// -------- END --------
