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
  enabled: boolean;
  level: "debug" | "info" | "warn" | "error";
  sampleRate: number;
  includeHeaders: boolean;
  includeQuery: boolean;
  includeBody: boolean;
  includeResponseSize: boolean;
  includeResponseHeaders: boolean;
  maxBodySize: number;
  redactFields: string[];
  excludePaths: string[];
  slowThresholdMs: number;
  outputFormat: "json" | "human" | "both";
  logRequestStart: boolean;
  logRequestComplete: boolean;
}

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

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);
  private readonly config: LoggerConfig;
  private readonly isDevelopment: boolean;
  private requestCounter = 0;
  private readonly counterResetInterval = 60000;

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

    const envConfig =
      this.configService.get<Partial<LoggerConfig>>("logging") || {};

    this.config = {
      ...DEFAULT_CONFIG,
      ...envConfig,
      includeBody:
        envConfig.includeBody !== undefined
          ? envConfig.includeBody
          : this.isDevelopment
            ? true
            : false,
      outputFormat:
        envConfig.outputFormat || (this.isDevelopment ? "human" : "json"),
    };

    setInterval(() => {
      this.requestCounter = 0;
    }, this.counterResetInterval);

    this.logger.log("Logger Middleware initialized with config:", this.config);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.config.enabled) return next();

    const path = req.url;
    if (this.shouldExcludePath(path)) return next();

    if (!this.shouldSample()) return next();

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
      const bodyStr = JSON.stringify(body);
      if (bodyStr && bodyStr.length > this.config.maxBodySize) {
        body = {
          _truncated: true,
          _originalSize: bodyStr.length,
          _preview: bodyStr.substring(0, this.config.maxBodySize) + "...",
        };
      }
    }

    if (this.config.logRequestStart && this.isDevelopment) {
      this.logger.debug(
        `[${requestId}] → ${method} ${url} | User: ${userId || "anonymous"} | IP: ${ip}`,
      );
    }

    let responseSize = 0;
    let statusCode = 200;
    let responseHeaders: Record<string, string> = {};

    const originalEnd = res.end;
    const originalWrite = res.write;
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

    res.on("finish", () => {
      statusCode = res.statusCode;
      responseHeaders = this.config.includeResponseHeaders
        ? (res.getHeaders() as Record<string, string>)
        : {};
      responseSize = this.config.includeResponseSize
        ? parseInt(res.get("Content-Length") as string) || writtenDataSize || 0
        : 0;

      const responseTime = Date.now() - startTime;
      const isSlow = responseTime > this.config.slowThresholdMs;

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

      this.updateStats(statusCode, method, responseTime);

      if (this.config.logRequestComplete) {
        this.logEntry(logEntry);
      }

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

      if (isSlow) {
        this.logger.warn(
          `[${requestId}] ⚠️ SLOW REQUEST: ${method} ${url} → ${statusCode} (${responseTime}ms)`,
        );
      }
    });

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

    next();
  }

  private shouldExcludePath(path: string): boolean {
    return this.config.excludePaths.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(path);
      }
      return path.includes(pattern);
    });
  }

  private shouldSample(): boolean {
    if (this.config.sampleRate >= 1.0) return true;
    if (this.config.sampleRate <= 0) return false;
    this.requestCounter++;
    return this.requestCounter % Math.floor(1 / this.config.sampleRate) === 0;
  }

  private getRequestId(req: Request): string {
    return (
      (req as any).id ||
      (req.headers["x-request-id"] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    );
  }

  private getCorrelationId(req: Request): string | undefined {
    return (
      (req as any).correlationId || (req.headers["x-correlation-id"] as string)
    );
  }

  private getSessionId(req: Request): string | undefined {
    return (
      (req as any).sessionId ||
      (req.headers["x-session-id"] as string) ||
      req.cookies?.["session_id"]
    );
  }

  private getUserId(req: Request): string | undefined {
    const user = (req as any).user;
    return user?.id || user?.userId || (req as any).userId;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"] as string;
    if (forwarded) {
      const ips = forwarded.split(",").map((ip) => ip.trim());
      return ips[0] || "0.0.0.0";
    }
    return req.ip || req.connection.remoteAddress || "0.0.0.0";
  }

  private getLogLevel(statusCode: number): "debug" | "info" | "warn" | "error" {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    if (statusCode >= 300) return "info";
    return "debug";
  }

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

  private updateStats(
    statusCode: number,
    method: string,
    responseTime: number,
  ): void {
    this.stats.totalRequests++;
    if (statusCode >= 400) this.stats.totalErrors++;
    if (responseTime > this.config.slowThresholdMs)
      this.stats.totalSlowRequests++;
    const total = this.stats.totalRequests;
    this.stats.averageResponseTime =
      this.stats.averageResponseTime +
      (responseTime - this.stats.averageResponseTime) / total;
    if (!this.stats.byStatus[statusCode]) this.stats.byStatus[statusCode] = 0;
    this.stats.byStatus[statusCode]++;
    if (!this.stats.byMethod[method]) this.stats.byMethod[method] = 0;
    this.stats.byMethod[method]++;
  }

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

  private formatLogEntry(entry: LogEntry): string {
    if (
      this.config.outputFormat === "json" ||
      this.config.outputFormat === "both"
    ) {
      const jsonEntry: any = { ...entry };
      Object.keys(jsonEntry).forEach((key) => {
        if (jsonEntry[key] === undefined) delete jsonEntry[key];
      });
      return JSON.stringify(jsonEntry);
    }
    const statusIcon =
      entry.statusCode >= 500 ? "❌" : entry.statusCode >= 400 ? "⚠️" : "✅";
    const slowIndicator = entry.meta?.isSlow ? " ⚠️ SLOW" : "";
    const errorInfo = entry.error ? ` | Error: ${entry.error.message}` : "";
    return `${entry.timestamp} [${entry.requestId}] ${statusIcon} ${entry.method} ${entry.url} → ${entry.statusCode} (${entry.responseTimeMs}ms)${slowIndicator}${errorInfo} | User: ${entry.userId || "anon"} | IP: ${entry.ip}`;
  }

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

  static getCurrentRequestId(): string {
    return process.env.CURRENT_REQUEST_ID || "unknown";
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    Object.assign(this.config, config);
    this.logger.log("Logger configuration updated:", this.config);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  addExcludePath(path: string): void {
    if (!this.config.excludePaths.includes(path)) {
      this.config.excludePaths.push(path);
    }
  }

  removeExcludePath(path: string): void {
    this.config.excludePaths = this.config.excludePaths.filter(
      (p) => p !== path,
    );
  }

  addRedactField(field: string): void {
    if (!this.config.redactFields.includes(field)) {
      this.config.redactFields.push(field);
    }
  }

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
}
