// backend/src/common/interceptors/timeout.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
  Inject,
  HttpStatus,
  HttpException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout, tap } from "rxjs/operators";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Request, Response } from "express";

export const TIMEOUT_KEY = "request_timeout";
export const SKIP_TIMEOUT_KEY = "skip_timeout";
export const CUSTOM_TIMEOUT_KEY = "custom_timeout";

export interface TimeoutConfig {
  defaultTimeout: number;
  maxTimeout: number;
  enableLogging: boolean;
  enableMetrics: boolean;
  timeoutStatusCode: number;
  timeoutMessage: string;
  retryOnTimeout: boolean;
  retryCount: number;
  retryDelay: number;
}

export interface TimeoutMetrics {
  total: number;
  timedOut: number;
  completed: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  byPath: Record<string, { count: number; timedOut: number; avgTime: number }>;
  byMethod: Record<
    string,
    { count: number; timedOut: number; avgTime: number }
  >;
}

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);
  private readonly config: TimeoutConfig;
  private readonly isDevelopment: boolean;
  private readonly metrics: TimeoutMetrics = {
    total: 0,
    timedOut: 0,
    completed: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    byPath: {},
    byMethod: {},
  };
  private readonly metricsResetInterval: number = 60000;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";
    this.config = {
      defaultTimeout: parseInt(
        this.configService.get("REQUEST_TIMEOUT_MS") || "30000",
        10,
      ),
      maxTimeout: parseInt(
        this.configService.get("REQUEST_MAX_TIMEOUT_MS") || "120000",
        10,
      ),
      enableLogging:
        this.configService.get("ENABLE_TIMEOUT_LOGGING") !== "false",
      enableMetrics:
        this.configService.get("ENABLE_TIMEOUT_METRICS") !== "false",
      timeoutStatusCode: parseInt(
        this.configService.get("TIMEOUT_STATUS_CODE") || "408",
        10,
      ),
      timeoutMessage:
        this.configService.get("TIMEOUT_MESSAGE") ||
        "Request timed out. Please try again later.",
      retryOnTimeout:
        this.configService.get("TIMEOUT_RETRY_ENABLED") === "true",
      retryCount: parseInt(
        this.configService.get("TIMEOUT_RETRY_COUNT") || "1",
        10,
      ),
      retryDelay: parseInt(
        this.configService.get("TIMEOUT_RETRY_DELAY_MS") || "1000",
        10,
      ),
    };

    setInterval(() => {
      if (this.config.enableMetrics) {
        this.logger.debug(`Timeout metrics: ${JSON.stringify(this.metrics)}`);
      }
    }, this.metricsResetInterval);

    this.logger.log("TimeoutInterceptor initialized with config:", this.config);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const handler = context.getHandler();
    const controller = context.getClass();

    const skipTimeout =
      this.reflector.get<boolean>(SKIP_TIMEOUT_KEY, handler) ||
      this.reflector.get<boolean>(SKIP_TIMEOUT_KEY, controller);
    if (skipTimeout) {
      return next.handle();
    }

    const customTimeout =
      this.reflector.get<number>(CUSTOM_TIMEOUT_KEY, handler) ||
      this.reflector.get<number>(CUSTOM_TIMEOUT_KEY, controller);
    const timeoutMs = this.getEffectiveTimeout(customTimeout);

    const requestId = this.getRequestId(request);
    const path = request.url;
    const method = request.method;
    const startTime = Date.now();

    if (this.config.enableLogging && this.isDevelopment) {
      this.logger.debug(
        `[${requestId}] Request timeout set to ${timeoutMs}ms for ${method} ${path}`,
      );
    }

    const timeout$ = next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        const duration = Date.now() - startTime;
        this.updateMetrics(path, method, duration, true);

        if (err instanceof TimeoutError) {
          this.logTimeoutError(
            request,
            response,
            duration,
            timeoutMs,
            requestId,
          );

          if (this.eventEmitter) {
            this.eventEmitter.emit("request.timeout", {
              requestId,
              path,
              method,
              duration,
              timeoutMs,
              timestamp: new Date(),
            });
          }

          if (this.config.retryOnTimeout && this.config.retryCount > 0) {
            this.logger.warn(
              `[${requestId}] Retrying request after timeout...`,
            );
            return next.handle().pipe(
              timeout(timeoutMs),
              catchError((retryErr) => {
                if (retryErr instanceof TimeoutError) {
                  return throwError(() =>
                    this.createTimeoutError(requestId, duration),
                  );
                }
                return throwError(() => retryErr);
              }),
            );
          }

          return throwError(() => this.createTimeoutError(requestId, duration));
        }
        this.updateMetrics(path, method, duration, false);
        return throwError(() => err);
      }),
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.updateMetrics(path, method, duration, false);
          response.setHeader("X-Response-Time", `${duration}ms`);
          response.setHeader("X-Timeout-Ms", `${timeoutMs}ms`);
        },
        error: () => {
          const duration = Date.now() - startTime;
          response.setHeader("X-Response-Time", `${duration}ms`);
        },
      }),
    );

    return timeout$;
  }

  private getEffectiveTimeout(customTimeout: number | undefined): number {
    if (customTimeout !== undefined && customTimeout > 0) {
      return Math.min(customTimeout, this.config.maxTimeout);
    }
    return this.config.defaultTimeout;
  }

  private getRequestId(request: Request): string {
    return (request as any).id || (request as any).requestId || "unknown";
  }

  private createTimeoutError(
    requestId: string,
    duration: number,
  ): HttpException {
    return new HttpException(
      {
        statusCode: this.config.timeoutStatusCode,
        message: this.config.timeoutMessage,
        error: "Request Timeout",
        requestId,
        durationMs: duration,
      },
      this.config.timeoutStatusCode,
    );
  }

  private logTimeoutError(
    request: Request,
    response: Response,
    duration: number,
    timeoutMs: number,
    requestId: string,
  ): void {
    const ip = request.ip || request.connection.remoteAddress || "0.0.0.0";
    const userAgent = request.headers["user-agent"] || "unknown";
    const userId = (request as any).user?.id || "anonymous";

    this.logger.warn(
      `[${requestId}] Request timed out | ${request.method} ${request.url} | ` +
        `Duration: ${duration}ms | Timeout: ${timeoutMs}ms | ` +
        `User: ${userId} | IP: ${ip} | UA: ${userAgent}`,
    );

    if (this.cacheManager) {
      const key = `timeout:${requestId}`;
      this.cacheManager.set(
        key,
        {
          path: request.url,
          method: request.method,
          duration,
          timeoutMs,
          userId,
          ip,
          userAgent,
          timestamp: new Date(),
        },
        3600,
      );
    }
  }

  private updateMetrics(
    path: string,
    method: string,
    duration: number,
    timedOut: boolean,
  ): void {
    if (!this.config.enableMetrics) return;

    this.metrics.total++;
    if (timedOut) {
      this.metrics.timedOut++;
    } else {
      this.metrics.completed++;
    }

    const total = this.metrics.total;
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime +
      (duration - this.metrics.averageResponseTime) / total;
    this.metrics.maxResponseTime = Math.max(
      this.metrics.maxResponseTime,
      duration,
    );
    this.metrics.minResponseTime = Math.min(
      this.metrics.minResponseTime,
      duration,
    );

    const pathKey = `${method}:${path}`;
    if (!this.metrics.byPath[pathKey]) {
      this.metrics.byPath[pathKey] = { count: 0, timedOut: 0, avgTime: 0 };
    }
    const pathStats = this.metrics.byPath[pathKey];
    pathStats.count++;
    if (timedOut) pathStats.timedOut++;
    pathStats.avgTime =
      pathStats.avgTime + (duration - pathStats.avgTime) / pathStats.count;

    if (!this.metrics.byMethod[method]) {
      this.metrics.byMethod[method] = { count: 0, timedOut: 0, avgTime: 0 };
    }
    const methodStats = this.metrics.byMethod[method];
    methodStats.count++;
    if (timedOut) methodStats.timedOut++;
    methodStats.avgTime =
      methodStats.avgTime +
      (duration - methodStats.avgTime) / methodStats.count;
  }

  getMetrics(): TimeoutMetrics {
    return {
      ...this.metrics,
      minResponseTime:
        this.metrics.minResponseTime === Infinity
          ? 0
          : this.metrics.minResponseTime,
    };
  }

  resetMetrics(): void {
    this.metrics.total = 0;
    this.metrics.timedOut = 0;
    this.metrics.completed = 0;
    this.metrics.averageResponseTime = 0;
    this.metrics.maxResponseTime = 0;
    this.metrics.minResponseTime = Infinity;
    this.metrics.byPath = {};
    this.metrics.byMethod = {};
    this.logger.log("Timeout metrics reset");
  }

  updateConfig(config: Partial<TimeoutConfig>): void {
    Object.assign(this.config, config);
    this.logger.log("Timeout config updated:", this.config);
  }

  getConfig(): TimeoutConfig {
    return { ...this.config };
  }
}
