// backend/src/common/middleware/logger.middleware.ts
import {
  Injectable,
  NestMiddleware,
  Logger,
  Optional,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response, NextFunction } from "express";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { v4 as uuidv4 } from "uuid";

// -------- INTERFACES --------
export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  requestId: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  method: string;
  url: string;
  path: string;
  query: Record<string, any>;
  params: Record<string, any>;
  headers: Record<string, string>;
  body: any;
  ip: string;
  userAgent: string;
  statusCode: number;
  responseTimeMs: number;
  responseSize: number;
  responseHeaders: Record<string, string>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  meta?: Record<string, any>;
}

export interface LoggerConfig {
  /**
   * Enable request logging.
   * @default true
   */
  enabled: boolean;

  /**
   * Log level.
   * @default 'info'
   */
  level: "debug" | "info" | "warn" | "error";

  /**
   * Sampling rate (0.0 to 1.0).
   * @default 1.0
   */
  sampleRate: number;

  /**
   * Include headers in logs.
   * @default false
   */
  includeHeaders: boolean;

  /**
   * Include query parameters in logs.
   * @default true
   */
  includeQuery: boolean;

  /**
   * Include request body in logs.
   * @default false (in production) / true (in development)
   */
  includeBody: boolean;

  /**
   * Include response size in logs.
   * @default true
   */
  includeResponseSize: boolean;

  /**
   * Include response headers in logs.
   * @default false
   */
  includeResponseHeaders: boolean;

  /**
   * Maximum body size to log (in bytes).
   * @default 4096
   */
  maxBodySize: number;

  /**
   * Fields to redact from logs.
   * @default ['password', 'token', 'secret', 'authorization', 'cookie', 'credit_card']
   */
  redactFields: string[];

  /**
   * Paths to exclude from logging.
   * @default ['/health', '/metrics', '/ready', '/live']
   */
  excludePaths: string[];

  /**
   * Slow request threshold in milliseconds.
   * @default 1000
   */
  slowThresholdMs: number;

  /**
   * Output format: 'json' or 'human'.
   * @default 'human' (development) / 'json' (production)
   */
  outputFormat: "json" | "human" | "both";

  /**
   * Log request start (in development).
   * @default true
   */
  logRequestStart: boolean;

  /**
   * Log request completion (always true for production).
   * @default true
   */
  logRequestComplete: boolean;
}

// -------- DEFAULT CONFIGURATION --------
const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  level: "info",
  sampleRate: 1.0,
  includeHeaders: false,
  includeQuery: true,
  includeBody: false,
  includeResponseSize: true,
  includeResponseHeaders: false,
  maxBodySize: 4096,
  redactFields: [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "credit_card",
    "cvv",
    "ssn",
  ],
  excludePaths: ["/health", "/metrics", "/ready", "/live", "/favicon.ico"],
  slowThresholdMs: 1000,
  outputFormat: "human",
  logRequestStart: true,
  logRequestComplete: true,
};

// -------- MAIN MIDDLEWARE --------
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);
  private readonly config: LoggerConfig;
  private readonly isDevelopment: boolean;
  private requestCounter = 0;
  private readonly counterResetInterval = 60000; // 1 minute

  // Statistics
  private stats = {
    totalRequests: 0,
    totalErrors: 0,
    totalSlowRequests: 0,
    averageResponseTime: 0,
    byStatus: {} as Record<number, number>,
    byMethod: {} as Record<string, number>,
  };
  private statsStartTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";

    // Load config from environment
    const envConfig =
      this.configService.get<Partial<LoggerConfig>>("logging") || {};

    // Build final config
    this.config = {
      ...DEFAULT_CONFIG,
      ...envConfig,
      // Override includeBody based on environment if not explicitly set
      includeBody:
        envConfig.includeBody !== undefined
          ? envConfig.includeBody
          : this.isDevelopment
            ? true
            : false,
      // Override outputFormat based on environment if not explicitly set
      outputFormat:
        envConfig.outputFormat || (this.isDevelopment ? "human" : "json"),
    };

    // Reset counter periodically
    setInterval(() => {
      this.requestCounter = 0;
    }, this.counterResetInterval);

    this.logger.log("Logger Middleware initialized with config:", this.config);
  }

  // ---------------------- MAIN MIDDLEWARE HANDLER ----------------------
  use(req: Request, res: Response, next: NextFunction): void {
    // ---- 1. Check if logging is enabled ----
    if (!this.config.enabled) {
      return next();
    }

    // ---- 2. Check if path should be excluded ----
    const path = req.url;
    if (this.shouldExcludePath(path)) {
      return next();
    }

    // ---- 3. Sampling ----
    if (!this.shouldSample()) {
      return next();
    }

    // ---- 4. Build request context ----
    const startTime = Date.now();
    const requestId = this.getRequestId(req);
    const correlationId = this.getCorrelationId(req);
    const sessionId = this.getSessionId(req);
    const userId = this.getUserId(req);
    const method = req.method;
    const url = req.url;
    const pathname = url.split("?")[0];
    const ip = this.getClientIp(req);
    const userAgent = req.headers["user-agent"] || "unknown";

    // ---- 5. Extract request data (with redaction) ----
    const headers = this.config.includeHeaders
      ? this.redactSensitiveData(req.headers as Record<string, string>)
      : {};
    const query = this.config.includeQuery
      ? this.redactSensitiveData(req.query as Record<string, any>)
      : {};
    const params = this.redactSensitiveData(req.params as Record<string, any>);

    let body = null;
    if (this.config.includeBody && req.body) {
      body = this.redactSensitiveData(req.body);
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

    // ---- 6. Log request start (in development) ----
    if (this.config.logRequestStart && this.isDevelopment) {
      this.logger.debug(
        `[${requestId}] → ${method} ${url} | User: ${userId || "anonymous"} | IP: ${ip}`,
      );
    }

    // ---- 7. Set response tracking ----
    let responseSize = 0;
    let statusCode = 200;
    let responseHeaders: Record<string, string> = {};

    // Override res.end to capture response size
    const originalEnd = res.end;
    const originalWrite = res.write;

    // Track written data size
    let writtenDataSize = 0;

    (res as any).write = function (chunk: any, ...args: any[]) {
      if (chunk) {
        writtenDataSize += chunk.length || Buffer.byteLength(chunk);
      }
      return (originalWrite as any).call(this, chunk, ...args);
    };

    res.end = function (chunk: any, ...args: any[]) {
      if (chunk) {
        writtenDataSize += chunk.length || Buffer.byteLength(chunk);
      }
      return (originalEnd as any).call(this, chunk, ...args);
    };

    // ---- 8. Capture response headers on finish ----
    res.on("finish", () => {
      statusCode = res.statusCode;
      responseHeaders = this.config.includeResponseHeaders
        ? (res.getHeaders() as Record<string, string>)
        : {};
      responseSize = this.config.includeResponseSize
        ? parseInt(res.get("Content-Length") as string) || writtenDataSize || 0
        : 0;

      // ---- 9. Calculate response time ----
      const responseTime = Date.now() - startTime;
      const isSlow = responseTime > this.config.slowThresholdMs;

      // ---- 10. Build log entry ----
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: this.getLogLevel(statusCode),
        requestId,
        correlationId,
        sessionId,
        userId,
        method,
        url,
        path: pathname,
        query,
        params,
        headers,
        body,
        ip,
        userAgent,
        statusCode,
        responseTimeMs: responseTime,
        responseSize,
        responseHeaders,
        meta: {
          isSlow,
          environment: this.configService.get("nodeEnv"),
          nodeVersion: process.version,
        },
      };

      // ---- 11. Update statistics ----
      this.updateStats(statusCode, method, responseTime);

      // ---- 12. Log the entry ----
      if (this.config.logRequestComplete) {
        this.logEntry(logEntry);
      }

      // ---- 13. Emit events for monitoring ----
      if (this.eventEmitter) {
        this.eventEmitter.emit("request.logged", {
          requestId,
          correlationId,
          method,
          url,
          statusCode,
          responseTime,
          userId,
          ip,
          isSlow,
          timestamp: new Date(),
        });

        if (isSlow) {
          this.eventEmitter.emit("request.slow", {
            requestId,
            correlationId,
            method,
            url,
            statusCode,
            responseTime,
            userId,
            ip,
            timestamp: new Date(),
          });
        }

        if (statusCode >= 500) {
          this.eventEmitter.emit("request.error", {
            requestId,
            correlationId,
            method,
            url,
            statusCode,
            responseTime,
            userId,
            ip,
            timestamp: new Date(),
          });
        }
      }

      // ---- 14. Log slow request warning ----
      if (isSlow) {
        this.logger.warn(
          `[${requestId}] ⚠️ SLOW REQUEST: ${method} ${url} → ${statusCode} (${responseTime}ms)`,
        );
      }
    });

    // ---- 15. Handle errors ----
    res.on("error", (error) => {
      const responseTime = Date.now() - startTime;
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "error",
        requestId,
        correlationId,
        sessionId,
        userId,
        method,
        url,
        path: pathname,
        query,
        params,
        headers,
        body,
        ip,
        userAgent,
        statusCode: res.statusCode || 500,
        responseTimeMs: responseTime,
        responseSize: 0,
        responseHeaders: {},
        error: {
          name: error.name || "ResponseError",
          message: error.message || "Response stream error",
          stack: this.isDevelopment ? error.stack : undefined,
        },
      };
      this.logEntry(logEntry);
      this.updateStats(500, method, responseTime);
    });

    // ---- 16. Continue to next middleware ----
    next();
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
    return this.requestCounter % Math.floor(1 / this.config.sampleRate) === 0;
  }

  // ---------------------- HELPER: GET REQUEST ID ----------------------
  private getRequestId(req: Request): string {
    return (
      (req as any).id ||
      (req.headers["x-request-id"] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    );
  }

  // ---------------------- HELPER: GET CORRELATION ID ----------------------
  private getCorrelationId(req: Request): string | undefined {
    return (
      (req as any).correlationId || (req.headers["x-correlation-id"] as string)
    );
  }

  // ---------------------- HELPER: GET SESSION ID ----------------------
  private getSessionId(req: Request): string | undefined {
    return (
      (req as any).sessionId ||
      (req.headers["x-session-id"] as string) ||
      req.cookies?.["session_id"]
    );
  }

  // ---------------------- HELPER: GET USER ID ----------------------
  private getUserId(req: Request): string | undefined {
    const user = (req as any).user;
    return user?.id || user?.userId || (req as any).userId;
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

  // ---------------------- HELPER: GET LOG LEVEL ----------------------
  private getLogLevel(statusCode: number): "debug" | "info" | "warn" | "error" {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    if (statusCode >= 300) return "info";
    return "debug";
  }

  // ---------------------- HELPER: REDACT SENSITIVE DATA ----------------------
  private redactSensitiveData(data: any): any {
    if (!data || typeof data !== "object") return data;

    const result: any = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const shouldRedact = this.config.redactFields.some(
        (field) =>
          key.toLowerCase().includes(field.toLowerCase()) ||
          field.toLowerCase().includes(key.toLowerCase()),
      );

      if (shouldRedact) {
        result[key] = "[REDACTED]";
      } else if (value && typeof value === "object") {
        result[key] = this.redactSensitiveData(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // ---------------------- HELPER: UPDATE STATISTICS ----------------------
  private updateStats(
    statusCode: number,
    method: string,
    responseTime: number,
  ): void {
    this.stats.totalRequests++;
    if (statusCode >= 400) {
      this.stats.totalErrors++;
    }
    if (responseTime > this.config.slowThresholdMs) {
      this.stats.totalSlowRequests++;
    }

    // Average response time (moving average)
    const currentAvg = this.stats.averageResponseTime;
    const total = this.stats.totalRequests;
    this.stats.averageResponseTime =
      currentAvg + (responseTime - currentAvg) / total;

    // By status code
    if (!this.stats.byStatus[statusCode]) {
      this.stats.byStatus[statusCode] = 0;
    }
    this.stats.byStatus[statusCode]++;

    // By method
    if (!this.stats.byMethod[method]) {
      this.stats.byMethod[method] = 0;
    }
    this.stats.byMethod[method]++;
  }

  // ---------------------- HELPER: LOG ENTRY ----------------------
  private logEntry(entry: LogEntry): void {
    const level = entry.level || "info";
    const logMessage = this.formatLogEntry(entry);

    switch (level) {
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

  // ---------------------- HELPER: FORMAT LOG ENTRY ----------------------
  private formatLogEntry(entry: LogEntry): string {
    if (
      this.config.outputFormat === "json" ||
      this.config.outputFormat === "both"
    ) {
      // JSON format – clean up undefined fields
      const jsonEntry: any = { ...entry };
      // Remove undefined fields
      Object.keys(jsonEntry).forEach((key) => {
        if (jsonEntry[key] === undefined) {
          delete jsonEntry[key];
        }
      });
      return JSON.stringify(jsonEntry);
    }

    // Human-readable format
    const statusIcon =
      entry.statusCode >= 500 ? "❌" : entry.statusCode >= 400 ? "⚠️" : "✅";
    const slowIndicator = entry.meta?.isSlow ? " ⚠️ SLOW" : "";
    const errorInfo = entry.error ? ` | Error: ${entry.error.message}` : "";

    return `${entry.timestamp} [${entry.requestId}] ${statusIcon} ${entry.method} ${entry.url} → ${entry.statusCode} (${entry.responseTimeMs}ms)${slowIndicator}${errorInfo} | User: ${entry.userId || "anon"} | IP: ${entry.ip}`;
  }

  // ---------------------- STATIC HELPERS FOR EXTERNAL LOGGING ----------------------
  /**
   * Log a business event from anywhere in the application.
   */
  static logBusinessEvent(
    eventName: string,
    userId: string | null,
    details: Record<string, any>,
    logger: Logger = new Logger("BusinessLogger"),
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "info" as const,
      type: "business",
      event: eventName,
      userId,
      details,
      requestId: this.getCurrentRequestId(),
    };
    logger.log(JSON.stringify(logEntry));
  }

  /**
   * Log a security event from anywhere in the application.
   */
  static logSecurityEvent(
    eventName: string,
    userId: string | null,
    details: Record<string, any>,
    level: "warn" | "error" = "warn",
    logger: Logger = new Logger("SecurityLogger"),
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      type: "security",
      event: eventName,
      userId,
      details,
      requestId: this.getCurrentRequestId(),
    };
    if (level === "error") {
      logger.error(JSON.stringify(logEntry));
    } else {
      logger.warn(JSON.stringify(logEntry));
    }
  }

  /**
   * Log a performance metric.
   */
  static logPerformance(
    metricName: string,
    value: number,
    tags: Record<string, string> = {},
    logger: Logger = new Logger("PerformanceLogger"),
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "debug" as const,
      type: "performance",
      metric: metricName,
      value,
      tags,
      requestId: this.getCurrentRequestId(),
    };
    logger.debug(JSON.stringify(logEntry));
  }

  /**
   * Get current request ID from async storage (if available).
   */
  static getCurrentRequestId(): string {
    // This would use AsyncLocalStorage from the RequestIdMiddleware
    // For now, we return a placeholder
    return process.env.CURRENT_REQUEST_ID || "unknown";
  }

  // ---------------------- PUBLIC API: CONFIGURATION MANAGEMENT ----------------------
  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    Object.assign(this.config, config);
    this.logger.log("Logger configuration updated:", this.config);
  }

  /**
   * Get current configuration.
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Add a path to the exclude list.
   */
  addExcludePath(path: string): void {
    if (!this.config.excludePaths.includes(path)) {
      this.config.excludePaths.push(path);
    }
  }

  /**
   * Remove a path from the exclude list.
   */
  removeExcludePath(path: string): void {
    this.config.excludePaths = this.config.excludePaths.filter(
      (p) => p !== path,
    );
  }

  /**
   * Add a field to redact.
   */
  addRedactField(field: string): void {
    if (!this.config.redactFields.includes(field)) {
      this.config.redactFields.push(field);
    }
  }

  // ---------------------- PUBLIC API: STATISTICS ----------------------
  /**
   * Get request statistics.
   */
  getStats(): {
    totalRequests: number;
    totalErrors: number;
    totalSlowRequests: number;
    averageResponseTime: number;
    byStatus: Record<number, number>;
    byMethod: Record<string, number>;
    uptimeMs: number;
    config: LoggerConfig;
  } {
    return {
      ...this.stats,
      uptimeMs: Date.now() - this.statsStartTime,
      config: { ...this.config },
    };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      totalSlowRequests: 0,
      averageResponseTime: 0,
      byStatus: {},
      byMethod: {},
    };
    this.statsStartTime = Date.now();
    this.logger.log("Statistics have been reset.");
  }

  // ---------------------- END ----------------------
}

// -------- DECORATOR FOR CUSTOM LOGGING ON CONTROLLERS --------
import { SetMetadata } from "@nestjs/common";

export const LOG_LEVEL_KEY = "logLevel";
export const LOG_EXCLUDE_KEY = "logExclude";

/**
 * Set custom log level for a controller or method.
 * @example
 * @LogLevel('debug')
 * @Get('debug')
 * debugEndpoint() { ... }
 */
export const LogLevel = (level: "debug" | "info" | "warn" | "error") =>
  SetMetadata(LOG_LEVEL_KEY, level);

/**
 * Exclude a controller or method from logging.
 * @example
 * @LogExclude()
 * @Get('secret')
 * secretEndpoint() { ... }
 */
export const LogExclude = () => SetMetadata(LOG_EXCLUDE_KEY, true);

// -------- END --------
