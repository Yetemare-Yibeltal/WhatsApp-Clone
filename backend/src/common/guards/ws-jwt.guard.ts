// backend/src/common/guards/ws-jwt.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Inject,
  Optional,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { verify } from "jsonwebtoken";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AuthUser } from "../decorators/current-user.decorator";

export const WS_PUBLIC_KEY = "wsIsPublic";
export const WS_OPTIONAL_AUTH_KEY = "wsIsOptional";

export interface WsJwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface WsConnectionContext {
  socket: Socket;
  clientId: string;
  ip: string;
  userAgent: string;
  token: string | null;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);
  private readonly enableBlacklist: boolean;
  private readonly enableRateLimit: boolean;
  private readonly rateLimitTtl: number;
  private readonly rateLimitMax: number;
  private readonly tokenExtractors: Array<"query" | "headers" | "cookies">;
  private readonly jwtSecret: string;

  private rateLimits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.jwtSecret = this.configService.get<string>("jwtSecret");
    if (!this.jwtSecret) {
      throw new Error("JWT_SECRET is not defined for WebSocket guard");
    }

    this.enableBlacklist =
      this.configService.get("ENABLE_TOKEN_BLACKLIST") !== false;
    this.enableRateLimit =
      this.configService.get("ENABLE_WS_RATE_LIMIT") !== false;
    this.rateLimitTtl = parseInt(
      this.configService.get("WS_RATE_LIMIT_TTL") || "60",
      10,
    );
    this.rateLimitMax = parseInt(
      this.configService.get("WS_RATE_LIMIT_MAX") || "100",
      10,
    );

    const extractors = this.configService.get("WS_TOKEN_EXTRACTORS");
    if (extractors) {
      this.tokenExtractors = (
        typeof extractors === "string" ? extractors.split(",") : extractors
      ).map((e) => e.trim() as "query" | "headers" | "cookies");
    } else {
      this.tokenExtractors = ["query", "headers"];
    }

    this.logger.log("WebSocket JWT Guard initialized", {
      enableBlacklist: this.enableBlacklist,
      enableRateLimit: this.enableRateLimit,
      extractors: this.tokenExtractors,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const handler = context.getHandler();
    const controller = context.getClass();

    const isPublic =
      this.reflector.get<boolean>(WS_PUBLIC_KEY, handler) ||
      this.reflector.get<boolean>(WS_PUBLIC_KEY, controller);
    if (isPublic) {
      try {
        const token = this.extractToken(client);
        if (token) {
          const user = await this.validateToken(token, client);
          if (user) {
            client.data.user = user;
          }
        }
      } catch (_) {}
      return true;
    }

    const isOptional =
      this.reflector.get<boolean>(WS_OPTIONAL_AUTH_KEY, handler) ||
      this.reflector.get<boolean>(WS_OPTIONAL_AUTH_KEY, controller);
    if (isOptional) {
      try {
        const token = this.extractToken(client);
        if (token) {
          const user = await this.validateToken(token, client);
          if (user) {
            client.data.user = user;
          }
        }
        return true;
      } catch (_) {
        return true;
      }
    }

    const token = this.extractToken(client);
    if (!token) {
      this.logFailedAuth(client, "No token provided");
      throw new WsException("Authentication token required");
    }

    if (this.enableRateLimit) {
      await this.checkRateLimit(client);
    }

    let user: AuthUser;
    try {
      user = await this.validateToken(token, client);
    } catch (error) {
      this.logFailedAuth(client, error.message);
      throw new WsException(error.message || "Invalid authentication token");
    }

    if (!user) {
      this.logFailedAuth(client, "User not found");
      throw new WsException("User not found");
    }

    if (!user.isActive) {
      this.logFailedAuth(client, "User account suspended");
      throw new WsException("Account suspended");
    }

    if (this.enableBlacklist) {
      const isBlacklisted = await this.isTokenBlacklisted(token, user.id);
      if (isBlacklisted) {
        this.logFailedAuth(client, "Token blacklisted");
        throw new WsException("Token revoked. Please log in again.");
      }
    }

    client.data.user = user;
    this.logSuccessfulAuth(client, user);

    if (this.eventEmitter) {
      this.eventEmitter.emit("ws.authenticated", {
        userId: user.id,
        email: user.email,
        clientId: client.id,
        ip: this.getClientIp(client),
        userAgent: client.handshake.headers["user-agent"],
        timestamp: new Date(),
      });
    }

    return true;
  }

  private extractToken(client: Socket): string | null {
    const handshake = client.handshake;

    for (const extractor of this.tokenExtractors) {
      let token: string | null = null;

      switch (extractor) {
        case "query":
          token = (handshake.query?.token as string) || null;
          break;
        case "headers":
          const authHeader = handshake.headers?.authorization;
          if (authHeader) {
            const parts = authHeader.split(" ");
            if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
              token = parts[1];
            }
          }
          break;
        case "cookies":
          const cookie = handshake.headers?.cookie;
          if (cookie) {
            const match = cookie.match(/token=([^;]+)/);
            if (match) {
              token = match[1];
            }
          }
          break;
      }

      if (token) {
        this.logger.debug(
          `Token extracted via ${extractor} for client ${client.id}`,
        );
        return token;
      }
    }

    return null;
  }

  private async validateToken(
    token: string,
    client: Socket,
  ): Promise<AuthUser | null> {
    try {
      const payload = verify(token, this.jwtSecret) as WsJwtPayload;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { profile: true },
      });

      if (!user) {
        return null;
      }

      const { passwordHash, ...safeUser } = user;
      return safeUser as AuthUser;
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new UnauthorizedException("Token expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new UnauthorizedException("Invalid token");
      }
      throw new UnauthorizedException("Authentication failed");
    }
  }

  private async checkRateLimit(client: Socket): Promise<void> {
    const ip = this.getClientIp(client);
    const key = `ws:rate:${ip}`;

    if (this.cacheManager) {
      try {
        const current = (await this.cacheManager.get<number>(key)) || 0;
        if (current >= this.rateLimitMax) {
          this.logger.warn(`WS rate limit exceeded for IP ${ip}`);
          throw new ForbiddenException(
            "Too many connections. Please slow down.",
          );
        }
        await this.cacheManager.set(key, current + 1, this.rateLimitTtl);
        return;
      } catch (_) {}
    }

    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (entry) {
      if (now < entry.resetAt) {
        entry.count++;
        if (entry.count > this.rateLimitMax) {
          throw new ForbiddenException(
            "Too many connections. Please slow down.",
          );
        }
      } else {
        this.rateLimits.set(key, {
          count: 1,
          resetAt: now + this.rateLimitTtl * 1000,
        });
      }
    } else {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: now + this.rateLimitTtl * 1000,
      });
    }
  }

  private async isTokenBlacklisted(
    token: string,
    userId: string,
  ): Promise<boolean> {
    if (!this.cacheManager) return false;
    try {
      const key = `ws:blacklist:${token}`;
      const exists = await this.cacheManager.get(key);
      if (exists) return true;

      const userKey = `ws:blacklist:user:${userId}`;
      const tokens = (await this.cacheManager.get<string[]>(userKey)) || [];
      return tokens.includes(token);
    } catch (_) {
      return false;
    }
  }

  private getClientIp(client: Socket): string {
    const handshake = client.handshake;
    const forwarded = handshake.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = (
        typeof forwarded === "string" ? forwarded : forwarded[0] || ""
      )
        .split(",")
        .map((s) => s.trim());
      return ips[0] || "0.0.0.0";
    }
    return handshake.address || "0.0.0.0";
  }

  private logFailedAuth(client: Socket, reason: string): void {
    const ip = this.getClientIp(client);
    const ua = client.handshake.headers["user-agent"] || "unknown";
    this.logger.warn(
      `WebSocket auth failed | Client: ${client.id} | IP: ${ip} | UA: ${ua} | Reason: ${reason}`,
    );
    if (this.eventEmitter) {
      this.eventEmitter.emit("ws.auth.failed", {
        clientId: client.id,
        ip,
        userAgent: ua,
        reason,
        timestamp: new Date(),
      });
    }
  }

  private logSuccessfulAuth(client: Socket, user: AuthUser): void {
    this.logger.debug(
      `WebSocket authenticated | User: ${user.id} (${user.email}) | Client: ${client.id}`,
    );
  }

  async revokeToken(
    token: string,
    userId: string,
    ttl: number = 86400,
  ): Promise<void> {
    if (!this.cacheManager) return;
    try {
      const key = `ws:blacklist:${token}`;
      await this.cacheManager.set(key, true, ttl);
      const userKey = `ws:blacklist:user:${userId}`;
      const existing = (await this.cacheManager.get<string[]>(userKey)) || [];
      if (!existing.includes(token)) {
        existing.push(token);
        await this.cacheManager.set(userKey, existing, ttl);
      }
      this.logger.log(`WebSocket token revoked for user ${userId}`);
    } catch (_) {
      this.logger.warn(`Failed to revoke WS token for user ${userId}`);
    }
  }

  async revokeAllTokens(userId: string): Promise<void> {
    if (!this.cacheManager) return;
    try {
      const userKey = `ws:blacklist:user:${userId}`;
      await this.cacheManager.set(userKey, ["*"], 86400);
      this.logger.log(`All WebSocket tokens revoked for user ${userId}`);
    } catch (_) {
      this.logger.warn(`Failed to revoke all WS tokens for user ${userId}`);
    }
  }

  getActiveConnections(): number {
    return 0;
  }
}
