// backend/src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
  Inject,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { v4 as uuidv4 } from "uuid";

// -------- INTERFACES --------
export interface LogEntry {
  timestamp: string;
  requestId: string;
  correlationId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  ip: string;
  userAgent: string;
  userId: string | null;
  sessionId: string | null;
  query: Record<string, any>;
  body: Record<string, any> | null;
  headers: Record<string, string>;
  responseSize: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  meta?: Record<string, any>;
}

export interface LoggingConfig {
  enabled: boolean;
  level: "debug" | "info" | "warn" | "error";
  sampleRate: number;
  includeHeaders: boolean;
  includeQuery: boolean;
  includeBody: boolean;
  includeResponseSize: boolean;
  maxBodySize: number;
  redactFields: string[];
  excludePaths: string[];
  slowThresholdMs: number;
  outputFormat: "json" | "human" | "both";
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private readonly config: LoggingConfig;
  private readonly isDevelopment: boolean;
  private requestCounter = 0;
  private readonly counterResetInterval = 60000; // 1 minute

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";

    this.config = {
      enabled: this.configService.get("ENABLE_REQUEST_LOGGING") !== false,
      level: this.configService.get("LOG_LEVEL") || "info",
      sampleRate: parseFloat(
        this.configService.get("LOG_SAMPLE_RATE") || "1.0",
      ),
      includeHeaders: this.configService.get("LOG_INCLUDE_HEADERS") === "true",
      includeQuery: this.configService.get("LOG_INCLUDE_QUERY") !== "false",
      includeBody:
        this.configService.get("LOG_INCLUDE_BODY") === "true" &&
        this.isDevelopment,
      includeResponseSize:
        this.configService.get("LOG_INCLUDE_RESPONSE_SIZE") !== "false",
      maxBodySize: parseInt(
        this.configService.get("LOG_MAX_BODY_SIZE") || "4096",
        10,
      ),
      redactFields: (
        this.configService.get("LOG_REDACT_FIELDS") ||
        "password,token,secret,credit_card,authorization,cookie"
      ).split(","),
      excludePaths: (
        this.configService.get("LOG_EXCLUDE_PATHS") ||
        "/health,/metrics,/ready,/live"
      ).split(","),
      slowThresholdMs: parseInt(
        this.configService.get("LOG_SLOW_THRESHOLD_MS") || "1000",
        10,
      ),
      outputFormat: this.configService.get("LOG_OUTPUT_FORMAT") || "human",
    };

    // Reset counter every minute
    setInterval(() => {
      this.requestCounter = 0;
    }, this.counterResetInterval);

    this.logger.log(
      "Logging interceptor initialized with config:",
      this.config,
    );
  }

  // ---------------------- MAIN INTERCEPTOR ----------------------
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // ---- 1. Check if logging is enabled ----
    if (!this.config.enabled) {
      return next.handle();
    }

    // ---- 2. Check if path should be excluded ----
    const path = request.url;
    if (this.shouldExcludePath(path)) {
      return next.handle();
    }

    // ---- 3. Sampling ----
    if (!this.shouldSample()) {
      return next.handle();
    }

    // ---- 4. Build request context ----
    const startTime = Date.now();
    const requestId = this.getRequestId(request);
    const correlationId = this.getCorrelationId(request);
    const method = request.method;
    const ip = this.getClientIp(request);
    const userAgent = request.headers["user-agent"] || "unknown";
    const userId = (request as any).user?.id || null;
    const sessionId = (request.headers["x-session-id"] as string) || null;

    // Extract query and body safely
    const query = this.config.includeQuery
      ? this.sanitizeObject(request.query)
      : {};
    let body = null;
    if (this.config.includeBody && request.body) {
      body = this.sanitizeObject(request.body);
      // Truncate if too large
      const bodyStr = JSON.stringify(body);
      if (bodyStr && bodyStr.length > this.config.maxBodySize) {
        body = {
          _truncated: true,
          _originalSize: bodyStr.length,
          _preview: bodyStr.substring(0, this.config.maxBodySize) + "...",
        };
      }
    }

    // Extract headers (sanitized)
    const headers = this.config.includeHeaders
      ? this.sanitizeObject(request.headers)
      : {};

    // ---- 5. Set response headers for tracing ----
    response.setHeader("X-Request-ID", requestId);
    if (correlationId) {
      response.setHeader("X-Correlation-ID", correlationId);
    }

    // ---- 6. Log request start (debug level) ----
    if (this.isDevelopment && this.config.level === "debug") {
      this.logger.debug(
        `📥 REQUEST → ${method} ${path} | ID: ${requestId} | User: ${userId || "anonymous"}`,
      );
    }

    // ---- 7. Handle response ----
    let responseSize = 0;
    let statusCode = 200;

    return next.handle().pipe(
      tap((data) => {
        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Get status code from response
        statusCode = response.statusCode || 200;

        // Estimate response size (if available)
        if (this.config.includeResponseSize) {
          const bodySize = response.get("Content-Length");
          if (bodySize) {
            responseSize = parseInt(bodySize as string, 10);
          } else if (data) {
            try {
              responseSize = JSON.stringify(data).length;
            } catch (_) {
              responseSize = 0;
            }
          }
        }

        // Determine log level based on status code
        const level = this.getLogLevel(statusCode);

        // Check if response is slow
        const isSlow = responseTime > this.config.slowThresholdMs;

        // Build log entry
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          requestId,
          correlationId,
          method,
          path,
          statusCode,
          responseTimeMs: responseTime,
          ip,
          userAgent,
          userId,
          sessionId,
          query,
          body,
          headers,
          responseSize,
          level,
          message: `${method} ${path} → ${statusCode} (${responseTime}ms)${isSlow ? " ⚠️ SLOW" : ""}`,
          meta: {
            isSlow,
            environment: this.configService.get("nodeEnv"),
          },
        };

        // Log the entry
        this.logEntry(logEntry);

        // Emit event for monitoring
        if (this.eventEmitter) {
          this.eventEmitter.emit("request.completed", {
            requestId,
            correlationId,
            method,
            path,
            statusCode,
            responseTime,
            userId,
            ip,
            timestamp: new Date(),
          });
        }

        // If response is slow, emit a separate event
        if (isSlow) {
          if (this.eventEmitter) {
            this.eventEmitter.emit("request.slow", {
              requestId,
              correlationId,
              method,
              path,
              statusCode,
              responseTime,
              userId,
              timestamp: new Date(),
            });
          }
          this.logger.warn(
            `⚠️ SLOW REQUEST: ${method} ${path} took ${responseTime}ms (threshold: ${this.config.slowThresholdMs}ms)`,
          );
        }
      }),
      catchError((error) => {
        // Log errors
        const responseTime = Date.now() - startTime;
        statusCode = error.status || error.statusCode || 500;

        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          requestId,
          correlationId,
          method,
          path,
          statusCode,
          responseTimeMs: responseTime,
          ip,
          userAgent,
          userId,
          sessionId,
          query,
          body,
          headers,
          responseSize: 0,
          level: "error",
          message: `${method} ${path} → ${statusCode} ERROR (${responseTime}ms)`,
          error: {
            name: error.name || "Error",
            message: error.message || "Unknown error",
            stack: this.isDevelopment ? error.stack : undefined,
          },
        };

        this.logEntry(logEntry);

        if (this.eventEmitter) {
          this.eventEmitter.emit("request.error", {
            requestId,
            correlationId,
            method,
            path,
            statusCode,
            responseTime,
            userId,
            error: error.message,
            timestamp: new Date(),
          });
        }

        return throwError(() => error);
      }),
    );
  }

  // ---------------------- HELPER: SHOULD EXCLUDE PATH ----------------------
  private shouldExcludePath(path: string): boolean {
    return this.config.excludePaths.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(path);
      }
      return path.includes(pattern);
    });
  }

  // ---------------------- HELPER: SHOULD SAMPLE ----------------------
  private shouldSample(): boolean {
    if (this.config.sampleRate >= 1.0) return true;
    if (this.config.sampleRate <= 0) return false;

    this.requestCounter++;
    // Sample deterministically based on request counter
    return this.requestCounter % Math.floor(1 / this.config.sampleRate) === 0;
  }

  // ---------------------- HELPER: GET REQUEST ID ----------------------
  private getRequestId(request: Request): string {
    return (
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-amzn-trace-id"] as string) ||
      `req_${Date.now()}_${uuidv4().substring(0, 8)}`
    );
  }

  // ---------------------- HELPER: GET CORRELATION ID ----------------------
  private getCorrelationId(request: Request): string {
    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      uuidv4()
    );
  }

  // ---------------------- HELPER: GET CLIENT IP ----------------------
  private getClientIp(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"] as string;
    if (forwarded) {
      const ips = forwarded.split(",").map((ip) => ip.trim());
      return ips[0] || "0.0.0.0";
    }
    return request.ip || request.connection.remoteAddress || "0.0.0.0";
  }

  // ---------------------- HELPER: GET LOG LEVEL ----------------------
  private getLogLevel(statusCode: number): "debug" | "info" | "warn" | "error" {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    if (statusCode >= 300) return "info";
    return "debug";
  }

  // ---------------------- HELPER: SANITIZE OBJECT ----------------------
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    if (!obj || typeof obj !== "object") return obj;

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key should be redacted
      const shouldRedact = this.config.redactFields.some(
        (field) =>
          key.toLowerCase().includes(field.toLowerCase()) ||
          field.toLowerCase().includes(key.toLowerCase()),
      );

      if (shouldRedact) {
        result[key] = "[REDACTED]";
      } else if (
        value &&
        typeof value === "object" &&
        !Buffer.isBuffer(value)
      ) {
        // Recursively sanitize nested objects
        result[key] = this.sanitizeObject(value);
      } else if (Buffer.isBuffer(value)) {
        result[key] = "[BINARY DATA]";
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // ---------------------- HELPER: LOG ENTRY ----------------------
  private logEntry(entry: LogEntry): void {
    const logLevel = entry.level || "info";

    // Format the log entry
    let logMessage = "";

    if (
      this.config.outputFormat === "json" ||
      this.config.outputFormat === "both"
    ) {
      // JSON format (production-friendly)
      const jsonEntry = {
        ...entry,
        // Ensure we don't include undefined fields in JSON
        meta: entry.meta || undefined,
        error: entry.error || undefined,
      };
      const jsonString = JSON.stringify(jsonEntry);
      logMessage = jsonString;
    }

    if (
      this.config.outputFormat === "human" ||
      this.config.outputFormat === "both"
    ) {
      // Human-readable format
      const prefix = `[${entry.requestId}] ${entry.method} ${entry.path}`;
      const details = `→ ${entry.statusCode} (${entry.responseTimeMs}ms) | User: ${entry.userId || "anon"} | IP: ${entry.ip}`;
      const errorInfo = entry.error ? ` | Error: ${entry.error.message}` : "";
      const slowInfo = entry.meta?.isSlow ? " ⚠️ SLOW" : "";
      logMessage = `${prefix} ${details}${errorInfo}${slowInfo}`;
    }

    // Log with the appropriate level
    switch (logLevel) {
      case "debug":
        this.logger.debug(logMessage);
        break;
      case "info":
        this.logger.log(logMessage);
        break;
      case "warn":
        this.logger.warn(logMessage);
        break;
      case "error":
        this.logger.error(logMessage);
        break;
      default:
        this.logger.log(logMessage);
    }
  }

  // ---------------------- EXTRA UTILITY: GET LOGS FROM CACHE ----------------------
  /**
   * Retrieve recent logs from cache (for debugging).
   */
  async getRecentLogs(requestId?: string): Promise<LogEntry[]> {
    try {
      if (!this.cacheManager) return [];
      const key = requestId ? `logs:${requestId}` : "logs:recent";
      return (await this.cacheManager.get<LogEntry[]>(key)) || [];
    } catch (_) {
      return [];
    }
  }

  // ---------------------- EXTRA UTILITY: CLEAR LOGS ----------------------
  async clearLogs(requestId?: string): Promise<void> {
    try {
      if (!this.cacheManager) return;
      const key = requestId ? `logs:${requestId}` : "logs:recent";
      await this.cacheManager.del(key);
    } catch (_) {
      // ignore
    }
  }

  // ---------------------- EXTRA UTILITY: CONFIGURE DYNAMICALLY ----------------------
  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<LoggingConfig>): void {
    this.config.enabled = config.enabled ?? this.config.enabled;
    this.config.level = config.level ?? this.config.level;
    this.config.sampleRate = config.sampleRate ?? this.config.sampleRate;
    this.config.includeHeaders =
      config.includeHeaders ?? this.config.includeHeaders;
    this.config.includeQuery = config.includeQuery ?? this.config.includeQuery;
    this.config.includeBody = config.includeBody ?? this.config.includeBody;
    this.config.includeResponseSize =
      config.includeResponseSize ?? this.config.includeResponseSize;
    this.config.maxBodySize = config.maxBodySize ?? this.config.maxBodySize;
    this.config.slowThresholdMs =
      config.slowThresholdMs ?? this.config.slowThresholdMs;

    if (config.redactFields) {
      this.config.redactFields = config.redactFields;
    }
    if (config.excludePaths) {
      this.config.excludePaths = config.excludePaths;
    }

    this.logger.log("Logging configuration updated:", this.config);
  }

  // ---------------------- EXTRA UTILITY: GET CONFIG ----------------------
  getConfig(): LoggingConfig {
    return { ...this.config };
  }

  // ---------------------- EXTRA UTILITY: LOG CUSTOM EVENT ----------------------
  /**
   * Log a custom event outside of the request lifecycle.
   */
  logCustomEvent(
    message: string,
    level: "debug" | "info" | "warn" | "error" = "info",
    meta?: Record<string, any>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId: `custom_${uuidv4().substring(0, 8)}`,
      correlationId: uuidv4(),
      method: "CUSTOM",
      path: "custom",
      statusCode: 200,
      responseTimeMs: 0,
      ip: "0.0.0.0",
      userAgent: "internal",
      userId: "system",
      sessionId: null,
      query: {},
      body: null,
      headers: {},
      responseSize: 0,
      level,
      message,
      meta,
    };
    this.logEntry(entry);
  }

  // ---------------------- EXTRA UTILITY: LOG BUSINESS EVENT ----------------------
  /**
   * Log a business-specific event (e.g., "User created", "Payment processed").
   */
  logBusinessEvent(
    eventName: string,
    userId: string | null,
    details: Record<string, any>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId: `biz_${uuidv4().substring(0, 8)}`,
      correlationId: uuidv4(),
      method: "BUSINESS",
      path: eventName,
      statusCode: 200,
      responseTimeMs: 0,
      ip: "0.0.0.0",
      userAgent: "internal",
      userId: userId || "system",
      sessionId: null,
      query: {},
      body: null,
      headers: {},
      responseSize: 0,
      level: "info",
      message: `Business event: ${eventName}`,
      meta: details,
    };
    this.logEntry(entry);
  }

  // ---------------------- EXTRA UTILITY: LOG SECURITY EVENT ----------------------
  /**
   * Log security-related events (e.g., "Login attempt", "Suspicious activity").
   */
  logSecurityEvent(
    eventName: string,
    userId: string | null,
    details: Record<string, any>,
    level: "warn" | "error" = "warn",
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId: `sec_${uuidv4().substring(0, 8)}`,
      correlationId: uuidv4(),
      method: "SECURITY",
      path: eventName,
      statusCode: level === "error" ? 403 : 401,
      responseTimeMs: 0,
      ip: details.ip || "0.0.0.0",
      userAgent: details.userAgent || "unknown",
      userId: userId || "anonymous",
      sessionId: null,
      query: {},
      body: null,
      headers: {},
      responseSize: 0,
      level,
      message: `Security event: ${eventName}`,
      meta: details,
    };
    this.logEntry(entry);
  }

  // ---------------------- EXTRA UTILITY: GENERATE REQUEST SUMMARY ----------------------
  /**
   * Generate a summary of requests in the current window.
   */
  getRequestSummary(): {
    total: number;
    byStatus: Record<number, number>;
    byMethod: Record<string, number>;
    averageResponseTime: number;
    slowCount: number;
  } {
    // Placeholder; in production, you'd use a metrics store.
    // This is just an example of the interface.
    return {
      total: 0,
      byStatus: {},
      byMethod: {},
      averageResponseTime: 0,
      slowCount: 0,
    };
  }

  // ---------------------- END ----------------------
}
