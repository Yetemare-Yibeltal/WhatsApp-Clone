// backend/src/common/middleware/request-id.middleware.ts
import {
  Injectable,
  NestMiddleware,
  Logger,
  Inject,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { AsyncLocalStorage } from "async_hooks";

// -------- INTERFACES --------
export interface RequestIdContext {
  requestId: string;
  correlationId?: string;
  parentId?: string;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  path: string;
  method: string;
  ip: string;
  userAgent: string;
  isAsync: boolean;
}

export interface RequestIdOptions {
  /**
   * Header name for request ID.
   * @default 'x-request-id'
   */
  requestIdHeader: string;

  /**
   * Header name for correlation ID.
   * @default 'x-correlation-id'
   */
  correlationIdHeader: string;

  /**
   * Header name for parent request ID (for distributed tracing).
   * @default 'x-parent-id'
   */
  parentIdHeader: string;

  /**
   * Header name for session ID.
   * @default 'x-session-id'
   */
  sessionIdHeader: string;

  /**
   * Generate request ID if not provided in headers.
   * @default true
   */
  generateIfMissing: boolean;

  /**
   * Generation strategy: 'uuid', 'nanoid', 'timestamp', 'combined'.
   * @default 'combined'
   */
  generationStrategy: "uuid" | "nanoid" | "timestamp" | "combined";

  /**
   * Include correlation ID in response headers.
   * @default true
   */
  includeCorrelationInResponse: boolean;

  /**
   * Include request ID in response headers.
   * @default true
   */
  includeRequestIdInResponse: boolean;

  /**
   * Set request ID on request object.
   * @default true
   */
  setOnRequest: boolean;

  /**
   * Store context in AsyncLocalStorage.
   * @default true
   */
  enableAsyncStorage: boolean;

  /**
   * Log request ID with each log message.
   * @default true
   */
  logWithRequestId: boolean;

  /**
   * Exclude certain paths from request ID generation.
   * @default ['/health', '/metrics', '/ready']
   */
  excludePaths: string[];

  /**
   * Maximum length of generated request ID.
   * @default 36
   */
  maxIdLength: number;
}

// -------- ASYNC STORAGE (for request context propagation) --------
export const requestIdStorage = new AsyncLocalStorage<RequestIdContext>();

// -------- REQUEST ID GENERATOR FUNCTIONS --------
export class RequestIdGenerator {
  /**
   * Generate a UUID v4 request ID.
   */
  static generateUuid(): string {
    return uuidv4();
  }

  /**
   * Generate a nano ID (12 characters).
   */
  static generateNanoId(): string {
    return randomBytes(8).toString("hex");
  }

  /**
   * Generate a timestamp-based ID.
   */
  static generateTimestampId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString("hex");
    return `${timestamp}-${random}`;
  }

  /**
   * Generate a combined ID (timestamp + uuid).
   */
  static generateCombinedId(): string {
    const timestamp = Date.now().toString(36);
    const uuid = uuidv4().substring(0, 8);
    return `${timestamp}-${uuid}`;
  }

  /**
   * Generate a request ID based on the configured strategy.
   */
  static generate(
    strategy: RequestIdOptions["generationStrategy"] = "combined",
  ): string {
    switch (strategy) {
      case "uuid":
        return this.generateUuid();
      case "nanoid":
        return this.generateNanoId();
      case "timestamp":
        return this.generateTimestampId();
      case "combined":
      default:
        return this.generateCombinedId();
    }
  }
}

// -------- MAIN MIDDLEWARE --------
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestIdMiddleware.name);
  private readonly options: RequestIdOptions;
  private readonly isDevelopment: boolean;

  // Statistics for monitoring
  private requestCount = 0;
  private readonly statsResetInterval = 60000; // 1 minute

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";

    // Load configuration from environment
    const config = this.configService.get<RequestIdOptions>("requestId") || {};

    this.options = {
      requestIdHeader: config.requestIdHeader || "x-request-id",
      correlationIdHeader: config.correlationIdHeader || "x-correlation-id",
      parentIdHeader: config.parentIdHeader || "x-parent-id",
      sessionIdHeader: config.sessionIdHeader || "x-session-id",
      generateIfMissing: config.generateIfMissing !== false,
      generationStrategy: config.generationStrategy || "combined",
      includeCorrelationInResponse:
        config.includeCorrelationInResponse !== false,
      includeRequestIdInResponse: config.includeRequestIdInResponse !== false,
      setOnRequest: config.setOnRequest !== false,
      enableAsyncStorage: config.enableAsyncStorage !== false,
      logWithRequestId: config.logWithRequestId !== false,
      excludePaths: config.excludePaths || [
        "/health",
        "/metrics",
        "/ready",
        "/live",
      ],
      maxIdLength: config.maxIdLength || 36,
    };

    // Reset stats periodically
    setInterval(() => {
      this.requestCount = 0;
    }, this.statsResetInterval);

    this.logger.log(
      "Request ID Middleware initialized with options:",
      this.options,
    );
  }

  // ---------------------- MAIN MIDDLEWARE HANDLER ----------------------
  use(req: Request, res: Response, next: NextFunction): void {
    // ---- 1. Check if path should be excluded ----
    const path = req.url;
    if (this.shouldExcludePath(path)) {
      // Still set a minimal request ID for logging, but don't store context
      const minimalId = RequestIdGenerator.generate("timestamp");
      req.id = minimalId;
      req.requestId = minimalId;
      res.setHeader("X-Request-ID", minimalId);
      return next();
    }

    // ---- 2. Extract or generate request ID ----
    const startTime = Date.now();
    const requestId = this.getOrGenerateRequestId(req);
    const correlationId = this.getCorrelationId(req);
    const parentId = this.getParentId(req);
    const sessionId = this.getSessionId(req);

    // ---- 3. Truncate IDs if needed ----
    const truncatedRequestId = this.truncateId(requestId);
    const truncatedCorrelationId = correlationId
      ? this.truncateId(correlationId)
      : undefined;
    const truncatedParentId = parentId ? this.truncateId(parentId) : undefined;

    // ---- 4. Set request ID on request object ----
    if (this.options.setOnRequest) {
      req.id = truncatedRequestId;
      req.requestId = truncatedRequestId;
      (req as any).correlationId = truncatedCorrelationId;
      (req as any).parentId = truncatedParentId;
      (req as any).sessionId = sessionId;
    }

    // ---- 5. Set response headers ----
    if (this.options.includeRequestIdInResponse) {
      res.setHeader("X-Request-ID", truncatedRequestId);
    }
    if (this.options.includeCorrelationInResponse && truncatedCorrelationId) {
      res.setHeader("X-Correlation-ID", truncatedCorrelationId);
    }
    if (truncatedParentId) {
      res.setHeader("X-Parent-ID", truncatedParentId);
    }

    // ---- 6. Build request context ----
    const context: RequestIdContext = {
      requestId: truncatedRequestId,
      correlationId: truncatedCorrelationId,
      parentId: truncatedParentId,
      sessionId: sessionId || undefined,
      userId: undefined, // Will be set by auth middleware later
      timestamp: Date.now(),
      path: req.url,
      method: req.method,
      ip: this.getClientIp(req),
      userAgent: req.headers["user-agent"] || "unknown",
      isAsync: false,
    };

    // ---- 7. Store context in AsyncLocalStorage ----
    if (this.options.enableAsyncStorage) {
      requestIdStorage.enterWith(context);
    }

    // ---- 8. Add request ID to logger context ----
    // This allows the logger to automatically include the request ID
    const originalLoggerContext = (this.logger as any).context || {};
    Object.assign(originalLoggerContext, { requestId: truncatedRequestId });
    if (truncatedCorrelationId) {
      Object.assign(originalLoggerContext, {
        correlationId: truncatedCorrelationId,
      });
    }

    // ---- 9. Log request start (in development) ----
    if (this.isDevelopment && this.options.logWithRequestId) {
      this.logger.debug(
        `[${truncatedRequestId}] → ${req.method} ${req.url} | IP: ${context.ip}`,
      );
    }

    // ---- 10. Track request count ----
    this.requestCount++;

    // ---- 11. Handle response finish ----
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Update context with response info
      const updatedContext: RequestIdContext = {
        ...context,
        isAsync: false,
      };

      // Log response (if enabled)
      if (this.options.logWithRequestId) {
        const logLevel =
          statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "debug";
        const message = `[${truncatedRequestId}] ← ${req.method} ${req.url} → ${statusCode} (${duration}ms)`;

        if (logLevel === "error") {
          this.logger.error(message);
        } else if (logLevel === "warn") {
          this.logger.warn(message);
        } else if (this.isDevelopment) {
          this.logger.debug(message);
        }
      }

      // Emit event for monitoring (if event emitter is injected)
      // We'll use a static method to emit events from the context
      if (global.requestIdEmitter) {
        global.requestIdEmitter.emit("request.completed", {
          requestId: truncatedRequestId,
          correlationId: truncatedCorrelationId,
          path: req.url,
          method: req.method,
          statusCode,
          duration,
          ip: context.ip,
          timestamp: new Date(),
        });
      }
    });

    // ---- 12. Handle errors ----
    res.on("error", (error) => {
      this.logger.error(
        `[${truncatedRequestId}] Response error: ${error.message}`,
        error.stack,
      );
    });

    // ---- 13. Continue to next middleware ----
    next();
  }

  // ---------------------- HELPER: SHOULD EXCLUDE PATH ----------------------
  private shouldExcludePath(path: string): boolean {
    return this.options.excludePaths.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(path);
      }
      return path.includes(pattern);
    });
  }

  // ---------------------- HELPER: GET OR GENERATE REQUEST ID ----------------------
  private getOrGenerateRequestId(req: Request): string {
    // Try to extract from headers
    const headerId = req.headers[this.options.requestIdHeader] as string;
    if (headerId && this.options.generateIfMissing) {
      return headerId;
    }

    // Generate a new ID
    return RequestIdGenerator.generate(this.options.generationStrategy);
  }

  // ---------------------- HELPER: GET CORRELATION ID ----------------------
  private getCorrelationId(req: Request): string | undefined {
    return (
      (req.headers[this.options.correlationIdHeader] as string) || undefined
    );
  }

  // ---------------------- HELPER: GET PARENT ID ----------------------
  private getParentId(req: Request): string | undefined {
    return (req.headers[this.options.parentIdHeader] as string) || undefined;
  }

  // ---------------------- HELPER: GET SESSION ID ----------------------
  private getSessionId(req: Request): string | undefined {
    return (
      (req.headers[this.options.sessionIdHeader] as string) ||
      req.cookies?.["session_id"] ||
      undefined
    );
  }

  // ---------------------- HELPER: TRUNCATE ID ----------------------
  private truncateId(id: string): string {
    if (id.length <= this.options.maxIdLength) {
      return id;
    }
    return id.substring(0, this.options.maxIdLength);
  }

  // ---------------------- HELPER: GET CLIENT IP ----------------------
  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"] as string;
    if (forwarded) {
      const ips = forwarded.split(",").map((ip) => ip.trim());
      return ips[0] || "0.0.0.0";
    }
    return req.ip || req.connection.remoteAddress || "0.0.0.0";
  }

  // ---------------------- STATIC HELPER: GET CURRENT REQUEST ID ----------------------
  /**
   * Get the current request ID from AsyncLocalStorage.
   * This can be called from any service that needs the current request context.
   */
  static getCurrentRequestId(): string | undefined {
    const context = requestIdStorage.getStore();
    return context?.requestId;
  }

  /**
   * Get the current correlation ID from AsyncLocalStorage.
   */
  static getCurrentCorrelationId(): string | undefined {
    const context = requestIdStorage.getStore();
    return context?.correlationId;
  }

  /**
   * Get the current session ID from AsyncLocalStorage.
   */
  static getCurrentSessionId(): string | undefined {
    const context = requestIdStorage.getStore();
    return context?.sessionId;
  }

  /**
   * Get the current user ID from AsyncLocalStorage.
   */
  static getCurrentUserId(): string | undefined {
    const context = requestIdStorage.getStore();
    return context?.userId;
  }

  /**
   * Get the complete current request context from AsyncLocalStorage.
   */
  static getCurrentContext(): RequestIdContext | undefined {
    return requestIdStorage.getStore();
  }

  /**
   * Run a function with a specific request context.
   * Useful for async operations that need to maintain request context.
   */
  static runWithContext<T>(context: RequestIdContext, fn: () => T): T {
    return requestIdStorage.run(context, fn);
  }

  /**
   * Update the current context with new values.
   * Useful for adding user ID after authentication.
   */
  static updateContext(updates: Partial<RequestIdContext>): void {
    const currentContext = requestIdStorage.getStore();
    if (currentContext) {
      Object.assign(currentContext, updates);
      requestIdStorage.enterWith(currentContext);
    }
  }

  /**
   * Create a child context for a sub-operation.
   * This generates a new request ID that traces back to the parent.
   */
  static createChildContext(operation: string): RequestIdContext {
    const parentContext = requestIdStorage.getStore();
    const childId = RequestIdGenerator.generate("combined");
    return {
      requestId: childId,
      correlationId: parentContext?.correlationId || childId,
      parentId: parentContext?.requestId,
      sessionId: parentContext?.sessionId,
      userId: parentContext?.userId,
      timestamp: Date.now(),
      path: `${parentContext?.path || "unknown"}/${operation}`,
      method: parentContext?.method || "async",
      ip: parentContext?.ip || "0.0.0.0",
      userAgent: parentContext?.userAgent || "unknown",
      isAsync: true,
    };
  }

  // ---------------------- CONFIGURATION MANAGEMENT ----------------------
  /**
   * Update the middleware configuration at runtime.
   */
  updateOptions(options: Partial<RequestIdOptions>): void {
    Object.assign(this.options, options);
    this.logger.log(
      "Request ID Middleware configuration updated:",
      this.options,
    );
  }

  /**
   * Get current configuration.
   */
  getOptions(): RequestIdOptions {
    return { ...this.options };
  }

  /**
   * Add a path to the exclude list.
   */
  addExcludePath(path: string): void {
    if (!this.options.excludePaths.includes(path)) {
      this.options.excludePaths.push(path);
    }
  }

  /**
   * Remove a path from the exclude list.
   */
  removeExcludePath(path: string): void {
    this.options.excludePaths = this.options.excludePaths.filter(
      (p) => p !== path,
    );
  }

  // ---------------------- STATISTICS ----------------------
  /**
   * Get request statistics for the current period.
   */
  getStats(): {
    requestCount: number;
    uptimeMs: number;
    config: RequestIdOptions;
  } {
    return {
      requestCount: this.requestCount,
      uptimeMs: Date.now() - (process as any).uptimeStart || 0,
      config: { ...this.options },
    };
  }

  // ---------------------- END ----------------------
}

// -------- DECORATOR FOR EASY CONTEXT ACCESS --------
// This can be used in controllers to get the request ID without injecting the middleware

/**
 * Decorator to inject the current request ID into a controller parameter.
 * @example
 * @Get('test')
 * test(@RequestId() requestId: string) { ... }
 */
export function RequestId(): ParameterDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) => {
    // This is a placeholder; the actual injection is done by the framework.
    // We'll implement it as a custom param decorator in the controller.
    // For now, this just serves as documentation.
  };
}

// -------- GLOBAL EVENT EMITTER (for monitoring) --------
// We'll use a global variable to avoid circular dependencies
// In production, you'd inject the EventEmitter2 properly
(global as any).requestIdEmitter = null;

// -------- EXPRESS TYPING EXTENSION --------
declare global {
  namespace Express {
    interface Request {
      id: string;
      requestId: string;
      correlationId?: string;
      parentId?: string;
      sessionId?: string;
      context?: RequestIdContext;
    }
  }
}

// -------- END --------
