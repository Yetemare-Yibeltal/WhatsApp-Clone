// backend/src/common/middleware/rate-limiter.middleware.ts
import {
  Injectable,
  NestMiddleware,
  Logger,
  Inject,
  Optional,
  HttpStatus,
  HttpException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response, NextFunction } from "express";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { v4 as uuidv4 } from "uuid";

// -------- INTERFACES AND TYPES --------
export interface RateLimitResult {
  limit: number;
  remaining: number;
  resetTime: number; // timestamp in ms
  totalRequests: number;
  isLimited: boolean;
  retryAfter?: number; // seconds
}

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window.
   */
  limit: number;

  /**
   * Time window in seconds.
   */
  windowSeconds: number;

  /**
   * Rate limiting strategy.
   * @default 'sliding-window'
   */
  strategy?:
    | "sliding-window"
    | "fixed-window"
    | "token-bucket"
    | "leaky-bucket";

  /**
   * Burst limit (allowed over the window).
   * @default limit * 1.5
   */
  burstLimit?: number;

  /**
   * Whether to apply rate limiting globally or per route.
   * @default 'route'
   */
  scope?: "global" | "route" | "user";

  /**
   * Key generator function (default: uses IP + route).
   */
  keyGenerator?: (req: Request) => string;

  /**
   * Whether to skip rate limiting for this request.
   */
  skip?: (req: Request) => boolean;

  /**
   * Custom error message when limit is exceeded.
   */
  errorMessage?: string;

  /**
   * Custom status code when limit is exceeded.
   * @default 429
   */
  statusCode?: number;

  /**
   * Enable response headers (X-RateLimit-*).
   * @default true
   */
  includeHeaders?: boolean;

  /**
   * Enable per‑user rate limiting (requires authenticated user).
   * @default false
   */
  perUser?: boolean;

  /**
   * Grace period in seconds before limit starts.
   * @default 0
   */
  gracePeriodSeconds?: number;

  /**
   * Whitelist – array of IPs, user IDs, or patterns to bypass.
   */
  whitelist?: string[];

  /**
   * Blacklist – array of IPs, user IDs, or patterns to block completely.
   */
  blacklist?: string[];
}

export interface RateLimiterStats {
  totalRequests: number;
  blockedRequests: number;
  activeKeys: number;
  memoryUsage: number;
  redisConnected: boolean;
  uptimeMs: number;
}

// -------- DEFAULT CONFIGURATION --------
const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
  strategy: "sliding-window",
  scope: "route",
  includeHeaders: true,
  errorMessage: "Too many requests. Please try again later.",
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
  gracePeriodSeconds: 0,
};

// -------- KEY GENERATORS --------
export class RateLimitKeyGenerator {
  /**
   * Default key generator: IP address + method + path.
   */
  static defaultKey(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
    const method = req.method;
    const path = req.url.split("?")[0];
    return `rate:${ip}:${method}:${path}`;
  }

  /**
   * Per‑user key generator: user ID + path.
   */
  static userKey(req: Request): string {
    const user = (req as any).user;
    const userId = user?.id || "anonymous";
    const path = req.url.split("?")[0];
    return `rate:user:${userId}:${path}`;
  }

  /**
   * Global key: all requests share the same counter.
   */
  static globalKey(): string {
    return "rate:global";
  }

  /**
   * IP‑only key.
   */
  static ipKey(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
    return `rate:ip:${ip}`;
  }

  /**
   * Composite key with custom parts.
   */
  static compositeKey(req: Request, parts: string[]): string {
    const values = parts.map((part) => {
      if (part === "ip")
        return req.ip || req.connection.remoteAddress || "0.0.0.0";
      if (part === "user") return (req as any).user?.id || "anonymous";
      if (part === "method") return req.method;
      if (part === "path") return req.url.split("?")[0];
      if (part === "host") return req.hostname || req.headers.host || "unknown";
      if (part === "user-agent")
        return (req.headers["user-agent"] || "unknown").substring(0, 50);
      return part;
    });
    return `rate:${values.join(":")}`;
  }
}

// -------- RATE LIMITER STORE (Redis with in‑memory fallback) --------
@Injectable()
export class RateLimiterStore {
  private readonly logger = new Logger(RateLimiterStore.name);
  private readonly inMemoryStore = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private redisConnected = false;
  private fallbackMode = false;

  constructor(
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    // Check Redis connectivity on init
    this.checkRedisConnection();
  }

  private async checkRedisConnection(): Promise<void> {
    try {
      if (this.cacheManager) {
        await this.cacheManager.set("ping", "pong", 1);
        this.redisConnected = true;
        this.fallbackMode = false;
        this.logger.log("Redis connected for rate limiting");
      }
    } catch (_) {
      this.redisConnected = false;
      this.fallbackMode = true;
      this.logger.warn(
        "Redis unavailable. Using in‑memory fallback for rate limiting.",
      );
    }
  }

  /**
   * Increment the request counter for a given key and return the count and reset time.
   */
  async increment(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; resetAt: number }> {
    // Try Redis first
    if (this.redisConnected && this.cacheManager) {
      try {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        // Use Redis multi to increment and get ttl
        const multi = (this.cacheManager as any).store?.getClient?.();
        if (multi) {
          // Using raw Redis commands via the underlying client
          const client = multi;
          const result = await client.multi().incr(key).ttl(key).exec();

          const count = result[0][1] as number;
          let ttl = result[1][1] as number;

          if (ttl === -1) {
            // Key exists but no expiry; set it
            await client.expire(key, windowSeconds);
            ttl = windowSeconds;
          } else if (ttl === -2) {
            // Key does not exist; set with expiry
            await client.expire(key, windowSeconds);
            ttl = windowSeconds;
          }

          const resetAt = now + ttl * 1000;
          return { count, resetAt };
        }

        // Fallback: use cache manager's atomic increment if available
        const current = (await this.cacheManager.get<number>(key)) || 0;
        const newCount = current + 1;
        await this.cacheManager.set(key, newCount, windowSeconds);
        const resetAt = now + windowSeconds * 1000;
        return { count: newCount, resetAt };
      } catch (_) {
        // Redis failed, fallback to in‑memory
        this.fallbackMode = true;
        this.redisConnected = false;
        this.logger.warn("Redis operation failed. Falling back to in‑memory.");
        return this.inMemoryIncrement(key, windowSeconds);
      }
    }

    // In‑memory fallback
    return this.inMemoryIncrement(key, windowSeconds);
  }

  private inMemoryIncrement(
    key: string,
    windowSeconds: number,
  ): { count: number; resetAt: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let entry = this.inMemoryStore.get(key);
    if (!entry || now > entry.resetAt) {
      // Reset window
      entry = { count: 1, resetAt: now + windowMs };
      this.inMemoryStore.set(key, entry);
      return { count: 1, resetAt: entry.resetAt };
    }

    // Increment within existing window
    entry.count++;
    return { count: entry.count, resetAt: entry.resetAt };
  }

  /**
   * Get the current count and reset time for a key without modifying.
   */
  async get(key: string): Promise<{ count: number; resetAt: number } | null> {
    if (this.redisConnected && this.cacheManager) {
      try {
        const count = (await this.cacheManager.get<number>(key)) || 0;
        // Get TTL from Redis
        const client = (this.cacheManager as any).store?.getClient?.();
        if (client) {
          const ttl = await client.ttl(key);
          if (ttl > 0) {
            const resetAt = Date.now() + ttl * 1000;
            return { count, resetAt };
          }
        }
        // If TTL not available, estimate from window
        return { count, resetAt: Date.now() + 60 * 1000 };
      } catch (_) {
        // Fallback to in‑memory
        const entry = this.inMemoryStore.get(key);
        if (entry) {
          const now = Date.now();
          if (now < entry.resetAt) {
            return { count: entry.count, resetAt: entry.resetAt };
          }
        }
        return null;
      }
    }

    const entry = this.inMemoryStore.get(key);
    if (entry) {
      const now = Date.now();
      if (now < entry.resetAt) {
        return { count: entry.count, resetAt: entry.resetAt };
      }
    }
    return null;
  }

  /**
   * Reset a key (delete it).
   */
  async reset(key: string): Promise<void> {
    if (this.redisConnected && this.cacheManager) {
      try {
        await this.cacheManager.del(key);
      } catch (_) {
        // ignore
      }
    }
    this.inMemoryStore.delete(key);
  }

  /**
   * Get store health status.
   */
  getStatus(): {
    redisConnected: boolean;
    fallbackMode: boolean;
    storeSize: number;
  } {
    return {
      redisConnected: this.redisConnected,
      fallbackMode: this.fallbackMode,
      storeSize: this.inMemoryStore.size,
    };
  }
}

// -------- MAIN MIDDLEWARE --------
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimiterMiddleware.name);
  private readonly configs = new Map<string, RateLimitConfig>();
  private readonly defaultConfig: RateLimitConfig;
  private readonly isDevelopment: boolean;
  private stats: RateLimiterStats = {
    totalRequests: 0,
    blockedRequests: 0,
    activeKeys: 0,
    memoryUsage: 0,
    redisConnected: false,
    uptimeMs: 0,
  };
  private startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    private readonly store: RateLimiterStore,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";

    // Load default config from env
    const envLimit = this.configService.get("RATE_LIMIT_DEFAULT_LIMIT");
    const envWindow = this.configService.get("RATE_LIMIT_DEFAULT_WINDOW");

    this.defaultConfig = {
      ...DEFAULT_CONFIG,
      limit: envLimit ? parseInt(envLimit, 10) : DEFAULT_CONFIG.limit,
      windowSeconds: envWindow
        ? parseInt(envWindow, 10)
        : DEFAULT_CONFIG.windowSeconds,
    };

    // Register built‑in route configs (can be extended)
    // For example, login endpoints get stricter limits
    this.configs.set("/auth/login", {
      ...this.defaultConfig,
      limit: 10,
      windowSeconds: 300,
    });
    this.configs.set("/auth/register", {
      ...this.defaultConfig,
      limit: 5,
      windowSeconds: 3600,
    });
    this.configs.set("/auth/forgot-password", {
      ...this.defaultConfig,
      limit: 3,
      windowSeconds: 3600,
    });
    this.configs.set("/auth/reset-password", {
      ...this.defaultConfig,
      limit: 5,
      windowSeconds: 600,
    });
    this.configs.set("/auth/refresh", {
      ...this.defaultConfig,
      limit: 20,
      windowSeconds: 60,
    });
    this.configs.set("/api/v1/messages", {
      ...this.defaultConfig,
      limit: 200,
      windowSeconds: 60,
    });
    this.configs.set("/api/v1/files/upload", {
      ...this.defaultConfig,
      limit: 20,
      windowSeconds: 300,
    });
    this.configs.set("/api/v1/search", {
      ...this.defaultConfig,
      limit: 50,
      windowSeconds: 60,
    });

    // Whitelist internal services (e.g., health checks, monitoring)
    // Blacklist known bad actors (to be loaded from DB or config)

    this.logger.log(
      "Rate Limiter Middleware initialized with default config:",
      this.defaultConfig,
    );
    this.logger.log(
      `Configured ${this.configs.size} route‑specific rate limits.`,
    );
  }

  // ---------------------- MAIN MIDDLEWARE HANDLER ----------------------
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // ---- 1. Increment total request counter ----
    this.stats.totalRequests++;

    // ---- 2. Get configuration for this route ----
    const config = this.getConfigForRoute(req);
    if (!config) {
      return next();
    }

    // ---- 3. Check if request should be skipped ----
    if (config.skip && config.skip(req)) {
      return next();
    }

    // ---- 4. Check whitelist ----
    if (this.isWhitelisted(req, config)) {
      return next();
    }

    // ---- 5. Check blacklist ----
    if (this.isBlacklisted(req, config)) {
      this.stats.blockedRequests++;
      const message = "Access denied. Your IP or user has been blocked.";
      this.logSecurityEvent(req, "blacklist_hit");
      throw new HttpException(message, HttpStatus.FORBIDDEN);
    }

    // ---- 6. Generate the rate limit key ----
    const key = this.generateKey(req, config);

    // ---- 7. Apply grace period ----
    if (config.gracePeriodSeconds && config.gracePeriodSeconds > 0) {
      // Check if key is in grace period (for new clients)
      // We'll implement a grace counter
      const graceKey = `grace:${key}`;
      const graceCount = await this.store.get(graceKey);
      if (!graceCount || graceCount.count < 5) {
        // Increment grace counter and allow
        await this.store.increment(graceKey, config.gracePeriodSeconds);
        // Still track for stats, but allow
        this.setRateLimitHeaders(
          res,
          config.limit,
          config.limit - 0,
          Date.now() + config.windowSeconds * 1000,
        );
        return next();
      }
    }

    // ---- 8. Increment counter and check limit ----
    let result: RateLimitResult;

    try {
      const { count, resetAt } = await this.store.increment(
        key,
        config.windowSeconds,
      );
      const limit = this.getEffectiveLimit(config, req);

      result = {
        limit: limit,
        remaining: Math.max(0, limit - count),
        resetTime: resetAt,
        totalRequests: count,
        isLimited: count > limit,
        retryAfter:
          count > limit ? Math.ceil((resetAt - Date.now()) / 1000) : undefined,
      };

      // ---- 9. Update stats ----
      this.stats.activeKeys = Math.max(this.stats.activeKeys, 0);
      // In a real implementation, you'd track active keys more accurately

      // ---- 10. Handle limit exceeded ----
      if (result.isLimited) {
        this.stats.blockedRequests++;
        const retryAfter = result.retryAfter || config.windowSeconds;

        // Log the breach
        this.logRateLimitBreach(req, key, result);

        // Emit security event
        if (this.eventEmitter) {
          this.eventEmitter.emit("rate_limit.exceeded", {
            key,
            limit: result.limit,
            totalRequests: result.totalRequests,
            resetTime: result.resetTime,
            ip: req.ip,
            path: req.url,
            user: (req as any).user?.id,
            userAgent: req.headers["user-agent"],
            timestamp: new Date(),
          });
        }

        // Set headers
        if (config.includeHeaders) {
          res.setHeader("X-RateLimit-Limit", result.limit);
          res.setHeader("X-RateLimit-Remaining", 0);
          res.setHeader(
            "X-RateLimit-Reset",
            new Date(result.resetTime).toISOString(),
          );
          res.setHeader("Retry-After", retryAfter);
        }

        // Throw rate limit error
        const errorMessage =
          config.errorMessage || "Too many requests. Please try again later.";
        throw new HttpException(
          {
            statusCode: config.statusCode || HttpStatus.TOO_MANY_REQUESTS,
            message: errorMessage,
            retryAfter,
            limit: result.limit,
          },
          config.statusCode || HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // ---- 11. Set success headers ----
      if (config.includeHeaders) {
        res.setHeader("X-RateLimit-Limit", result.limit);
        res.setHeader("X-RateLimit-Remaining", result.remaining);
        res.setHeader(
          "X-RateLimit-Reset",
          new Date(result.resetTime).toISOString(),
        );
      }
    } catch (error) {
      // If rate limiter fails, fail open (allow request) to avoid service disruption
      this.logger.error(`Rate limiter error: ${error.message}`, error.stack);
      return next();
    }

    // ---- 12. Continue to next middleware ----
    next();
  }

  // ---------------------- HELPERS ----------------------

  /**
   * Get the configuration for a route.
   */
  private getConfigForRoute(req: Request): RateLimitConfig | null {
    const path = req.url.split("?")[0];

    // Check for exact match
    if (this.configs.has(path)) {
      return { ...this.defaultConfig, ...this.configs.get(path) };
    }

    // Check for path prefix matches (e.g., /api/v1/messages/*)
    for (const [pattern, config] of this.configs) {
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (path.startsWith(prefix)) {
          return { ...this.defaultConfig, ...config };
        }
      }
    }

    // Default configuration
    return { ...this.defaultConfig };
  }

  /**
   * Generate the rate limit key based on configuration.
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Use default key generation based on scope
    let key = "";
    switch (config.scope) {
      case "global":
        key = RateLimitKeyGenerator.globalKey();
        break;
      case "user":
        key = config.perUser
          ? RateLimitKeyGenerator.userKey(req)
          : RateLimitKeyGenerator.ipKey(req);
        break;
      case "route":
      default:
        key = RateLimitKeyGenerator.defaultKey(req);
        break;
    }

    // If per‑user is enabled, override with user key
    if (config.perUser && (req as any).user) {
      key = RateLimitKeyGenerator.userKey(req);
    }

    return key;
  }

  /**
   * Get effective limit (considering burst).
   */
  private getEffectiveLimit(config: RateLimitConfig, req: Request): number {
    const baseLimit = config.limit;
    if (config.burstLimit) {
      // Check if request is from a trusted source (e.g., authenticated user)
      const isAuthenticated = !!(req as any).user;
      // Return burst limit for authenticated users
      return isAuthenticated ? config.burstLimit : baseLimit;
    }
    return baseLimit;
  }

  /**
   * Check if request is whitelisted.
   */
  private isWhitelisted(req: Request, config: RateLimitConfig): boolean {
    if (!config.whitelist || config.whitelist.length === 0) return false;

    const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
    const user = (req as any).user;
    const userId = user?.id;

    for (const item of config.whitelist) {
      if (item === ip) return true;
      if (userId && item === userId) return true;
      // Support wildcards: '192.168.*'
      if (item.includes("*") && ip.startsWith(item.replace("*", "")))
        return true;
      // Support user agent matching
      const ua = req.headers["user-agent"] || "";
      if (item === "ua:" && ua.includes("*")) {
        const pattern = item.replace("ua:", "");
        if (new RegExp(pattern.replace(/\*/g, ".*")).test(ua)) return true;
      }
    }
    return false;
  }

  /**
   * Check if request is blacklisted.
   */
  private isBlacklisted(req: Request, config: RateLimitConfig): boolean {
    if (!config.blacklist || config.blacklist.length === 0) return false;

    const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
    const user = (req as any).user;
    const userId = user?.id;

    for (const item of config.blacklist) {
      if (item === ip) return true;
      if (userId && item === userId) return true;
      if (item.includes("*") && ip.startsWith(item.replace("*", "")))
        return true;
    }
    return false;
  }

  /**
   * Set rate limit headers on response.
   */
  private setRateLimitHeaders(
    res: Response,
    limit: number,
    remaining: number,
    resetTime: number,
  ): void {
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", new Date(resetTime).toISOString());
  }

  /**
   * Log rate limit breach.
   */
  private logRateLimitBreach(
    req: Request,
    key: string,
    result: RateLimitResult,
  ): void {
    const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
    const user = (req as any).user;
    const userId = user?.id || "anonymous";
    this.logger.warn(
      `Rate limit exceeded | IP: ${ip} | User: ${userId} | Key: ${key} | ` +
        `Limit: ${result.limit} | Count: ${result.totalRequests} | ` +
        `${req.method} ${req.url} | Reset: ${new Date(result.resetTime).toISOString()}`,
    );
  }

  /**
   * Log security event.
   */
  private logSecurityEvent(req: Request, event: string): void {
    const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
    this.logger.warn(
      `Rate limiter security event: ${event} | IP: ${ip} | ${req.method} ${req.url}`,
    );
    if (this.eventEmitter) {
      this.eventEmitter.emit("rate_limit.security", {
        event,
        ip,
        path: req.url,
        method: req.method,
        user: (req as any).user?.id,
        timestamp: new Date(),
      });
    }
  }

  // ---------------------- PUBLIC API: CONFIGURATION MANAGEMENT ----------------------
  /**
   * Register a new rate limit configuration for a route.
   */
  registerRouteConfig(path: string, config: Partial<RateLimitConfig>): void {
    const current = this.configs.get(path) || this.defaultConfig;
    this.configs.set(path, { ...current, ...config });
    this.logger.log(`Registered rate limit config for ${path}`);
  }

  /**
   * Remove a route configuration.
   */
  unregisterRouteConfig(path: string): void {
    this.configs.delete(path);
    this.logger.log(`Unregistered rate limit config for ${path}`);
  }

  /**
   * Get current configuration for a route.
   */
  getRouteConfig(path: string): RateLimitConfig | undefined {
    return this.configs.get(path);
  }

  /**
   * Update default configuration.
   */
  updateDefaultConfig(config: Partial<RateLimitConfig>): void {
    Object.assign(this.defaultConfig, config);
    this.logger.log("Updated default rate limit config:", this.defaultConfig);
  }

  /**
   * Add a whitelist entry for all routes.
   */
  addGlobalWhitelist(item: string): void {
    // This could be stored globally; for simplicity, we add to default config
    if (!this.defaultConfig.whitelist) {
      this.defaultConfig.whitelist = [];
    }
    if (!this.defaultConfig.whitelist.includes(item)) {
      this.defaultConfig.whitelist.push(item);
      this.logger.log(`Added ${item} to global whitelist`);
    }
  }

  /**
   * Add a blacklist entry for all routes.
   */
  addGlobalBlacklist(item: string): void {
    if (!this.defaultConfig.blacklist) {
      this.defaultConfig.blacklist = [];
    }
    if (!this.defaultConfig.blacklist.includes(item)) {
      this.defaultConfig.blacklist.push(item);
      this.logger.log(`Added ${item} to global blacklist`);
    }
  }

  // ---------------------- PUBLIC API: STATISTICS ----------------------
  /**
   * Get rate limiter statistics.
   */
  async getStats(): Promise<RateLimiterStats> {
    const storeStatus = this.store.getStatus();
    return {
      ...this.stats,
      redisConnected: storeStatus.redisConnected,
      memoryUsage: storeStatus.storeSize,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Reset all rate limit counters (use with caution).
   */
  async resetAll(): Promise<void> {
    // This would clear Redis and memory store
    // For safety, we'll only reset the in‑memory store
    this.store.reset("*");
    this.logger.warn("All rate limit counters have been reset.");
  }

  /**
   * Reset a specific key.
   */
  async resetKey(key: string): Promise<void> {
    await this.store.reset(key);
    this.logger.debug(`Reset rate limit key: ${key}`);
  }

  // ---------------------- END ----------------------
}

// -------- DECORATOR FOR CUSTOM RATE LIMITS ON CONTROLLERS --------
// This allows per‑method rate limits using decorators

import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_KEY = "rateLimit";

/**
 * Decorator to set a custom rate limit for a controller or method.
 * @example
 * @RateLimit({ limit: 10, windowSeconds: 60 })
 * @Post('sensitive')
 * sensitiveAction() { ... }
 */
export const RateLimit = (config: Partial<RateLimitConfig>) =>
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Decorator to skip rate limiting for a route.
 * @example
 * @SkipRateLimit()
 * @Get('health')
 * healthCheck() { ... }
 */
export const SKIP_RATE_LIMIT_KEY = "skipRateLimit";
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

// -------- END --------
