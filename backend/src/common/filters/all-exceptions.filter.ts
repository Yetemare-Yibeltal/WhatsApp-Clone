// backend/src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
  Optional,
  Inject,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Request, Response } from "express";
import { ValidationError } from "class-validator";
import { Prisma } from "@prisma/client";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ConfigService } from "@nestjs/config";

export interface ErrorResponse {
  timestamp: string;
  path: string;
  method: string;
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  correlationId?: string;
  details?: Record<string, any>;
  stack?: string;
}

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isDevelopment: boolean;
  private readonly errorLogSamplingRate = 0.1; // log only 10% of errors to avoid flood (can be configured)
  private readonly logCounter = new Map<
    string,
    { count: number; lastLogTime: number }
  >();
  private readonly rateLimitWindow = 60_000; // 1 minute

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly configService: ConfigService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";
  }

  // ---------------------- MAIN CATCH HANDLER ----------------------
  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Determine request ID (from header or generate)
    const requestId =
      (request.headers["x-request-id"] as string) || this.generateRequestId();
    const correlationId =
      (request.headers["x-correlation-id"] as string) || requestId;

    // Build base error context
    const path = request.url;
    const method = request.method;
    const ip = this.getClientIp(request);
    const userAgent = request.headers["user-agent"] || "unknown";

    // ---- 1. Determine HTTP status and error details ----
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = "InternalServerError";
    let errorMessage = "An unexpected error occurred. Please try again later.";
    let errorDetails: Record<string, any> | null = null;
    let stackTrace: string | null = null;

    // ---- 2. Classify the exception ----
    if (exception instanceof HttpException) {
      // NestJS built-in HTTP exception
      statusCode = exception.getStatus();
      const responseBody = exception.getResponse();
      errorName = exception.name;

      if (typeof responseBody === "string") {
        errorMessage = responseBody;
      } else if (typeof responseBody === "object") {
        const body = responseBody as any;
        errorMessage = body.message || body.error || responseBody.toString();
        if (body.details) {
          errorDetails = body.details;
        }
        // If it's a validation error (class-validator), extract field details
        if (body.message && Array.isArray(body.message)) {
          // This is a validation error array
          errorMessage = body.message.join(", ");
          errorDetails = { validationErrors: body.message };
        }
      }

      // Also capture stack if available
      if (exception.stack) {
        stackTrace = exception.stack;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma known errors (unique constraint, foreign key, etc.)
      statusCode = HttpStatus.CONFLICT;
      errorName = "DatabaseError";

      switch (exception.code) {
        case "P2002":
          // Unique constraint failed
          statusCode = HttpStatus.CONFLICT;
          const target = exception.meta?.target as string[];
          errorMessage = `A record with the same ${target?.join(", ") || "value"} already exists.`;
          errorDetails = { fields: target, model: exception.meta?.modelName };
          break;
        case "P2003":
          // Foreign key constraint failed
          statusCode = HttpStatus.BAD_REQUEST;
          errorMessage = "The referenced record does not exist.";
          errorDetails = { field: exception.meta?.field_name };
          break;
        case "P2025":
          // Record not found
          statusCode = HttpStatus.NOT_FOUND;
          errorMessage = "The requested record was not found.";
          break;
        case "P2014":
          // The change you are trying to make would violate the required relation
          statusCode = HttpStatus.BAD_REQUEST;
          errorMessage = "The operation would violate a required relation.";
          break;
        default:
          errorMessage = `Database error: ${exception.message}`;
          break;
      }
      stackTrace = exception.stack || null;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Validation error from Prisma (e.g., missing required field)
      statusCode = HttpStatus.BAD_REQUEST;
      errorName = "ValidationError";
      errorMessage = "Invalid data provided to the database.";
      errorDetails = { message: exception.message };
      stackTrace = exception.stack || null;
    } else if (exception instanceof JsonWebTokenError) {
      statusCode = HttpStatus.UNAUTHORIZED;
      errorName = "JWTError";
      errorMessage = "Invalid authentication token.";
      stackTrace = exception.stack || null;
    } else if (exception instanceof TokenExpiredError) {
      statusCode = HttpStatus.UNAUTHORIZED;
      errorName = "JWTExpired";
      errorMessage = "Authentication token has expired. Please log in again.";
      stackTrace = exception.stack || null;
    } else if (exception instanceof Error) {
      // General error
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = exception.name || "Error";
      errorMessage = exception.message || "Internal server error";
      stackTrace = exception.stack || null;
    } else {
      // Unknown exception type (e.g., string, number)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = "UnknownError";
      errorMessage = "An unexpected error occurred.";
      stackTrace = null;
    }

    // ---- 3. Sanitise messages for production ----
    // In production, we may want to hide sensitive details (like DB errors)
    if (
      !this.isDevelopment &&
      statusCode === HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      errorMessage = "An unexpected error occurred. Please try again later.";
      // Do not expose DB error details in production
      errorDetails = null;
    }

    // ---- 4. Build the error response object ----
    const errorResponse: ErrorResponse = {
      timestamp: new Date().toISOString(),
      path,
      method,
      statusCode,
      error: errorName,
      message: errorMessage,
      requestId,
      correlationId,
    };

    if (errorDetails && this.isDevelopment) {
      errorResponse.details = errorDetails;
    }

    if (this.isDevelopment && stackTrace) {
      errorResponse.stack = stackTrace;
    }

    // ---- 5. Rate‑limited error logging ----
    const shouldLog = this.shouldLogError(statusCode, errorName, path);
    if (shouldLog) {
      this.logError(
        exception,
        statusCode,
        errorName,
        errorMessage,
        request,
        stackTrace,
      );
    }

    // ---- 6. Emit event for monitoring (e.g., Sentry, DataDog) ----
    if (this.eventEmitter && statusCode >= 500) {
      this.eventEmitter.emit("error.critical", {
        exception,
        statusCode,
        errorName,
        errorMessage,
        path,
        method,
        requestId,
        correlationId,
        userId: (request as any).user?.id,
        ip,
        userAgent,
        timestamp: new Date(),
      });
    }

    // ---- 7. Send response ----
    response.status(statusCode).json(errorResponse);
  }

  // ---------------------- HELPER: GENERATE REQUEST ID ----------------------
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  // ---------------------- HELPER: GET CLIENT IP ----------------------
  private getClientIp(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"] as string;
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return request.ip || request.connection.remoteAddress || "0.0.0.0";
  }

  // ---------------------- HELPER: RATE‑LIMITED LOGGING ----------------------
  private shouldLogError(
    statusCode: number,
    errorName: string,
    path: string,
  ): boolean {
    // Always log 500 errors (server errors)
    if (statusCode >= 500) return true;

    // For 4xx, log only a sample to avoid flooding
    const key = `${statusCode}:${errorName}:${path}`;
    const now = Date.now();
    const entry = this.logCounter.get(key);

    if (!entry) {
      this.logCounter.set(key, { count: 1, lastLogTime: now });
      return true;
    }

    if (now - entry.lastLogTime > this.rateLimitWindow) {
      // Reset counter after window
      this.logCounter.set(key, { count: 1, lastLogTime: now });
      return true;
    }

    // Increment and check sampling
    entry.count++;
    if (entry.count % 10 === 0) {
      // Log every 10th occurrence
      return true;
    }
    return false;
  }

  // ---------------------- HELPER: LOG ERROR ----------------------
  private logError(
    exception: unknown,
    statusCode: number,
    errorName: string,
    errorMessage: string,
    request: Request,
    stackTrace: string | null,
  ): void {
    const logContext = {
      statusCode,
      errorName,
      errorMessage,
      path: request.url,
      method: request.method,
      ip: this.getClientIp(request),
      userAgent: request.headers["user-agent"],
      userId: (request as any).user?.id || "anonymous",
      requestId: request.headers["x-request-id"],
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${errorName}: ${errorMessage} | Path: ${request.url} | User: ${logContext.userId}`,
        stackTrace || exception instanceof Error ? exception.stack : "",
        logContext,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `${errorName}: ${errorMessage} | Path: ${request.url} | User: ${logContext.userId}`,
        logContext,
      );
    } else {
      this.logger.debug(
        `${errorName}: ${errorMessage} | Path: ${request.url}`,
        logContext,
      );
    }
  }

  // ---------------------- EXTRA UTILITY: FORMAT VALIDATION ERRORS ----------------------
  /**
   * Format class-validator errors into a concise object.
   * Can be used by controllers to standardise validation responses.
   */
  static formatValidationErrors(
    errors: ValidationError[],
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const error of errors) {
      if (error.children && error.children.length > 0) {
        const childErrors = AllExceptionsFilter.formatValidationErrors(
          error.children,
        );
        for (const [key, messages] of Object.entries(childErrors)) {
          result[`${error.property}.${key}`] = messages;
        }
      } else {
        result[error.property] = Object.values(error.constraints || {});
      }
    }
    return result;
  }

  // ---------------------- EXTRA UTILITY: SANITISE ERROR FOR RESPONSE ----------------------
  /**
   * Remove sensitive information (e.g., SQL, passwords) from error messages.
   */
  static sanitiseErrorMessage(message: string): string {
    // Remove SQL queries
    let sanitised = message.replace(
      /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)[^;]*/gi,
      "[SQL REDACTED]",
    );
    // Remove potential email/password patterns
    sanitised = sanitised.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[EMAIL REDACTED]",
    );
    sanitised = sanitised.replace(/Bearer\s+[^\s]+/g, "Bearer [REDACTED]");
    return sanitised;
  }

  // ---------------------- EXTRA UTILITY: IS ERROR RETRYABLE ----------------------
  /**
   * Determine if an error is transient and can be retried.
   */
  static isRetryableError(exception: unknown): boolean {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma connection errors, timeouts, lock errors
      return ["P1000", "P1001", "P1002", "P1008", "P1017", "P2024"].includes(
        exception.code,
      );
    }
    if (exception instanceof Error) {
      // Network errors, timeouts
      return (
        exception.message.includes("timeout") ||
        exception.message.includes("ECONNRESET")
      );
    }
    return false;
  }

  // ---------------------- EXTRA UTILITY: EXTRACT ERROR DETAILS FROM DB ----------------------
  /**
   * Extract meaningful details from a Prisma error for display.
   */
  static extractPrismaErrorDetails(
    error: Prisma.PrismaClientKnownRequestError,
  ): any {
    const meta = error.meta || {};
    switch (error.code) {
      case "P2002":
        return { fields: meta.target, model: meta.modelName };
      case "P2003":
        return { field: meta.field_name };
      case "P2025":
        return { recordId: meta.record_id };
      default:
        return { code: error.code };
    }
  }

  // ---------------------- EXTRA UTILITY: GET USER-FRIENDLY ERROR MESSAGE ----------------------
  /**
   * Return a user‑friendly message for common database errors.
   */
  static getUserFriendlyMessage(exception: unknown): string {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002":
          return "A record with these details already exists.";
        case "P2003":
          return "Unable to create record because the referenced item does not exist.";
        case "P2025":
          return "The record you are looking for could not be found.";
        case "P2014":
          return "This operation would violate a required relationship.";
        default:
          return "A database error occurred. Please try again.";
      }
    }
    if (exception instanceof JsonWebTokenError) {
      return "Invalid authentication token. Please log in again.";
    }
    if (exception instanceof TokenExpiredError) {
      return "Your session has expired. Please log in again.";
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 400) return "Invalid request. Please check your input.";
      if (status === 401) return "You are not authenticated. Please log in.";
      if (status === 403)
        return "You do not have permission to access this resource.";
      if (status === 404) return "The requested resource was not found.";
      if (status === 409) return "Conflict with existing data.";
      if (status === 429) return "Too many requests. Please slow down.";
    }
    return "An unexpected error occurred. Please try again later.";
  }

  // ---------------------- EXTRA UTILITY: IS CRITICAL ERROR ----------------------
  /**
   * Determine if an error is critical (e.g., 5xx, security-related).
   */
  static isCriticalError(exception: unknown): boolean {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return status >= 500 || status === 401 || status === 403;
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // DB errors that indicate connection issues
      return ["P1000", "P1001", "P1002", "P1008", "P1017"].includes(
        exception.code,
      );
    }
    return (
      exception instanceof Error &&
      (exception.message.includes("database") ||
        exception.message.includes("connection"))
    );
  }

  // ---------------------- END ----------------------
}
