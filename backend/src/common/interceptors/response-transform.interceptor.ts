// backend/src/common/interceptors/response-transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
  Optional,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, throwError } from "rxjs";
import { map, tap, catchError } from "rxjs/operators";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { EventEmitter2 } from "@nestjs/event-emitter";

// -------- DECORATORS (defined here for self‑containment) --------
export const EXCLUDE_TRANSFORM_KEY = "excludeTransform";
export const ExcludeTransform = () => SetMetadata(EXCLUDE_TRANSFORM_KEY, true);

export const MESSAGE_KEY = "responseMessage";
export const Message = (message: string) => SetMetadata(MESSAGE_KEY, message);

export const STATUS_CODE_KEY = "responseStatusCode";
export const StatusCode = (code: number) => SetMetadata(STATUS_CODE_KEY, code);

export interface TransformedResponse<T = any> {
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
  path: string;
  method: string;
  requestId: string;
  correlationId?: string;
  pagination?: {
    page: number | null;
    limit: number | null;
    total: number | null;
    hasMore: boolean;
  };
  errors?: any;
  meta?: Record<string, any>;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  TransformedResponse<T>
> {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);
  private readonly isDevelopment: boolean;
  private readonly enableLogging: boolean;
  private readonly enableCompression: boolean;
  private readonly excludePaths: string[];
  private readonly logSlowResponsesMs: number = 1000;
  private readonly responseTimeThresholdMs: number = 500;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";
    this.enableLogging =
      this.configService.get("ENABLE_RESPONSE_LOGGING") !== false;
    this.enableCompression =
      this.configService.get("ENABLE_RESPONSE_COMPRESSION") === true;
    this.excludePaths =
      this.configService.get("EXCLUDE_TRANSFORM_PATHS")?.split(",") || [];
  }

  // ---------------------- MAIN INTERCEPTOR ----------------------
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Check if this route should be excluded from transformation
    const handler = context.getHandler();
    const controller = context.getClass();
    const excludeTransform =
      this.reflector.get<boolean>(EXCLUDE_TRANSFORM_KEY, handler) ||
      this.reflector.get<boolean>(EXCLUDE_TRANSFORM_KEY, controller);

    // Check if path should be excluded
    const path = request.url;
    const shouldExclude = this.excludePaths.some((pattern) =>
      path.includes(pattern),
    );

    if (excludeTransform || shouldExclude) {
      // Pass through without transforming
      return next.handle();
    }

    // ---- Request context ----
    const requestId = this.getRequestId(request);
    const correlationId = this.getCorrelationId(request);
    const method = request.method;
    const startTime = Date.now();

    // Get custom message/status from decorators if set
    let customMessage =
      this.reflector.get<string>(MESSAGE_KEY, handler) ||
      this.reflector.get<string>(MESSAGE_KEY, controller);
    let customStatusCode =
      this.reflector.get<number>(STATUS_CODE_KEY, handler) ||
      this.reflector.get<number>(STATUS_CODE_KEY, controller);

    // Default status code (200 OK) unless overridden
    const defaultStatusCode = customStatusCode || HttpStatus.OK;

    // ---- Process the response ----
    return next.handle().pipe(
      map((data: any) => {
        // ---- 1. Check for streaming or binary responses ----
        if (this.isStreamResponse(response)) {
          // Do not transform streaming responses (file downloads, etc.)
          return data;
        }

        // ---- 2. Check if data is already in our format (maybe from a nested call) ----
        if (this.isAlreadyTransformed(data)) {
          return data;
        }

        // ---- 3. Extract pagination metadata if present ----
        let pagination: TransformedResponse["pagination"] | undefined;
        let responseData = data;

        if (
          data &&
          typeof data === "object" &&
          data.data !== undefined &&
          data.pagination !== undefined
        ) {
          // The controller returned { data, pagination } structure
          responseData = data.data;
          pagination = {
            page: data.pagination.page || null,
            limit: data.pagination.limit || null,
            total: data.pagination.total || null,
            hasMore: data.pagination.hasMore || false,
          };
        } else if (
          data &&
          typeof data === "object" &&
          data.meta &&
          data.meta.pagination
        ) {
          // Alternative: { data: [...], meta: { pagination: {...} } }
          responseData = data.data;
          const metaPagination = data.meta.pagination;
          pagination = {
            page: metaPagination.page || null,
            limit: metaPagination.limit || null,
            total: metaPagination.total || null,
            hasMore: metaPagination.hasMore || false,
          };
        }

        // ---- 4. Build the transformed response ----
        const transformed: TransformedResponse<T> = {
          statusCode: defaultStatusCode,
          message:
            customMessage || this.getDefaultMessage(request.method, path),
          data: responseData !== undefined ? responseData : null,
          timestamp: new Date().toISOString(),
          path: path,
          method: method,
          requestId: requestId,
          correlationId: correlationId,
        };

        if (pagination) {
          transformed.pagination = pagination;
        }

        // Add any additional meta from the original response
        if (
          data &&
          typeof data === "object" &&
          data.meta &&
          !data.meta.pagination
        ) {
          transformed.meta = data.meta;
        }

        // ---- 5. Set response headers ----
        response.setHeader("X-Request-ID", requestId);
        if (correlationId) {
          response.setHeader("X-Correlation-ID", correlationId);
        }
        response.setHeader("X-Response-Time", `${Date.now() - startTime}ms`);
        response.setHeader("X-Status-Code", defaultStatusCode.toString());

        // ---- 6. Log response if enabled ----
        if (this.enableLogging) {
          const duration = Date.now() - startTime;
          this.logResponse(request, response, duration, defaultStatusCode);
        }

        // ---- 7. Emit event for audit/analytics ----
        if (this.eventEmitter) {
          this.eventEmitter.emit("response.success", {
            requestId,
            correlationId,
            path,
            method,
            statusCode: defaultStatusCode,
            userId: (request as any).user?.id,
            timestamp: new Date(),
          });
        }

        return transformed;
      }),
      catchError((err) => {
        // Let the exception filter handle errors
        return throwError(() => err);
      }),
      tap({
        error: (err) => {
          // Log failed attempts (the exception filter already logs, but we add extra context)
          const duration = Date.now() - startTime;
          this.logger.debug(
            `Response error | ${method} ${path} | ${duration}ms | ${err.message}`,
          );
        },
      }),
    );
  }

  // ---------------------- HELPER: GET REQUEST ID ----------------------
  private getRequestId(request: Request): string {
    return (
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-amzn-trace-id"] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    );
  }

  // ---------------------- HELPER: GET CORRELATION ID ----------------------
  private getCorrelationId(request: Request): string | undefined {
    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string)
    );
  }

  // ---------------------- HELPER: IS STREAM RESPONSE? ----------------------
  private isStreamResponse(response: Response): boolean {
    // Check if response is a stream (file download, SSE, etc.)
    // We check if headers already indicate content-type for streams
    const contentType = response.getHeader("Content-Type");
    if (contentType) {
      const type = String(contentType);
      if (
        type.startsWith("application/octet-stream") ||
        type.startsWith("video/") ||
        type.startsWith("audio/") ||
        type.startsWith("image/") ||
        type === "text/event-stream"
      ) {
        return true;
      }
    }
    return false;
  }

  // ---------------------- HELPER: IS ALREADY TRANSFORMED? ----------------------
  private isAlreadyTransformed(data: any): boolean {
    if (
      data &&
      typeof data === "object" &&
      data.statusCode !== undefined &&
      data.timestamp !== undefined &&
      data.data !== undefined
    ) {
      return true;
    }
    return false;
  }

  // ---------------------- HELPER: GET DEFAULT MESSAGE ----------------------
  private getDefaultMessage(method: string, path: string): string {
    // Map HTTP methods to default messages
    const messages: Record<string, string> = {
      GET: "Resource retrieved successfully",
      POST: "Resource created successfully",
      PUT: "Resource updated successfully",
      PATCH: "Resource updated successfully",
      DELETE: "Resource deleted successfully",
    };
    return messages[method] || "Request completed successfully";
  }

  // ---------------------- HELPER: LOG RESPONSE ----------------------
  private logResponse(
    request: Request,
    response: Response,
    duration: number,
    statusCode: number,
  ): void {
    const method = request.method;
    const path = request.url;
    const ip = this.getClientIp(request);
    const userAgent = request.headers["user-agent"] || "unknown";
    const userId = (request as any).user?.id || "anonymous";

    if (duration > this.responseTimeThresholdMs) {
      this.logger.warn(
        `SLOW RESPONSE | ${method} ${path} | ${duration}ms | ${statusCode} | User: ${userId} | IP: ${ip}`,
      );
    } else if (this.isDevelopment) {
      this.logger.debug(
        `${method} ${path} | ${duration}ms | ${statusCode} | User: ${userId}`,
      );
    }

    // If logging is enabled, we could also send to a metrics system
    if (duration > this.logSlowResponsesMs) {
      // Emit event for slow response monitoring
      if (this.eventEmitter) {
        this.eventEmitter.emit("response.slow", {
          path,
          method,
          duration,
          statusCode,
          userId,
          ip,
          userAgent,
          timestamp: new Date(),
        });
      }
    }
  }

  // ---------------------- HELPER: GET CLIENT IP ----------------------
  private getClientIp(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"] as string;
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return request.ip || request.connection.remoteAddress || "0.0.0.0";
  }

  // ---------------------- EXTRA UTILITY: BUILD PAGINATED RESPONSE ----------------------
  /**
   * A static helper for controllers to easily return paginated data.
   * Example: return ResponseTransformInterceptor.paginatedResponse(data, total, page, limit)
   */
  static paginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  } {
    const hasMore = total > page * limit;
    return {
      data,
      pagination: { page, limit, total, hasMore },
    };
  }

  // ---------------------- EXTRA UTILITY: BUILD SUCCESS RESPONSE ----------------------
  /**
   * Build a success response without using the interceptor (e.g., for custom handlers).
   */
  static buildSuccess<T>(
    data: T,
    message?: string,
    statusCode: number = HttpStatus.OK,
    meta?: Record<string, any>,
  ): any {
    return {
      data,
      message: message || "Success",
      statusCode,
      meta,
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------- EXTRA UTILITY: BUILD ERROR RESPONSE ----------------------
  /**
   * Build an error response (for manual use).
   */
  static buildError(message: string, statusCode: number, details?: any): any {
    return {
      statusCode,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------- EXTRA UTILITY: EXCLUDE PATHS DYNAMICALLY ----------------------
  /**
   * Add paths to exclude from transformation at runtime.
   */
  addExcludePath(pattern: string): void {
    if (!this.excludePaths.includes(pattern)) {
      this.excludePaths.push(pattern);
    }
  }

  // ---------------------- EXTRA UTILITY: CLEAR EXCLUDE PATHS ----------------------
  clearExcludePaths(): void {
    this.excludePaths.length = 0;
  }

  // ---------------------- EXTRA UTILITY: GET RESPONSE METRICS ----------------------
  /**
   * Return aggregated response metrics (for monitoring).
   */
  getMetrics(): { total: number; averageMs: number; slowCount: number } {
    // Placeholder; in production, you'd maintain counters.
    return { total: 0, averageMs: 0, slowCount: 0 };
  }

  // ---------------------- EXTRA UTILITY: SET CUSTOM MESSAGE FOR ROUTE ----------------------
  /**
   * Programmatically set a response message for a route (used in controllers or middleware).
   */
  static setMessageForRoute(
    reflector: Reflector,
    handler: any,
    message: string,
  ): void {
    Reflect.defineMetadata(MESSAGE_KEY, message, handler);
  }

  // ---------------------- EXTRA UTILITY: SET CUSTOM STATUS FOR ROUTE ----------------------
  static setStatusCodeForRoute(
    reflector: Reflector,
    handler: any,
    statusCode: number,
  ): void {
    Reflect.defineMetadata(STATUS_CODE_KEY, statusCode, handler);
  }

  // ---------------------- END ----------------------
}
