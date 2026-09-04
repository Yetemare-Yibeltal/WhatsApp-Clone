// backend/src/modules/auth/strategies/refresh.strategy.ts
import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
  Optional,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-strategy";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { JwtUtil } from "../../../common/utils/jwt.util";
import { EncryptionUtil } from "../../../common/utils/encryption.util";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  deviceId?: string;
}

export interface RefreshTokenResult {
  user: any;
  token: string;
  jti: string;
  deviceId?: string;
}

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, "refresh") {
  private readonly logger = new Logger(RefreshStrategy.name);
  private readonly jwtSecret: string;
  private readonly refreshExpiresIn: string;
  private readonly enableRotation: boolean;
  private readonly enableBlacklist: boolean;
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtUtil: JwtUtil,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    super();
    this.jwtSecret =
      this.configService.get<string>("JWT_REFRESH_SECRET") ||
      this.configService.get<string>("JWT_SECRET");
    if (!this.jwtSecret) {
      throw new Error("JWT_REFRESH_SECRET is not defined");
    }
    this.refreshExpiresIn =
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "7d";
    this.enableRotation =
      this.configService.get("ENABLE_TOKEN_ROTATION") !== false;
    this.enableBlacklist =
      this.configService.get("ENABLE_TOKEN_BLACKLIST") !== false;
    this.cacheTtl = parseInt(
      this.configService.get("REFRESH_TOKEN_CACHE_TTL") || "3600",
      10,
    );
    this.logger.log(
      "RefreshStrategy initialized with rotation:",
      this.enableRotation,
    );
  }

  async authenticate(req: Request, options?: any): Promise<void> {
    this.logger.debug("RefreshStrategy authenticate called");

    try {
      const token = this.extractToken(req);
      if (!token) {
        this.logger.warn("No refresh token provided");
        return this.fail("No refresh token provided", 401);
      }

      const result = await this.validateRefreshToken(token, req);
      if (!result) {
        this.logger.warn("Invalid refresh token");
        return this.fail("Invalid refresh token", 401);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: result.user.id },
        include: { profile: true },
      });

      if (!user) {
        this.logger.warn(`User ${result.user.id} not found`);
        return this.fail("User not found", 401);
      }

      if (!user.isActive) {
        this.logger.warn(`User ${user.id} is inactive`);
        return this.fail("User account is inactive", 403);
      }

      if (
        user.accountStatus === "suspended" ||
        user.accountStatus === "banned"
      ) {
        this.logger.warn(`User ${user.id} is ${user.accountStatus}`);
        return this.fail(`Account is ${user.accountStatus}`, 403);
      }

      const { passwordHash, twoFactorSecret, ...safeUser } = user;

      if (this.enableRotation) {
        await this.rotateToken(token, result.jti, result.user.id, req);
      }

      this.logger.debug(`Refresh token validated for user ${safeUser.id}`);
      return this.success(
        {
          user: safeUser,
          refreshToken: token,
          jti: result.jti,
        },
        { info: "Refresh token validated" },
      );
    } catch (error) {
      this.logger.error(`RefreshStrategy error: ${error.message}`);
      return this.fail(error.message || "Invalid refresh token", 401);
    }
  }

  private extractToken(req: Request): string | null {
    const headerToken = req.headers["authorization"]?.replace("Bearer ", "");
    if (headerToken) {
      const parts = headerToken.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        return parts[1];
      }
      return headerToken;
    }

    const bodyToken = req.body?.refreshToken;
    if (bodyToken) {
      return bodyToken;
    }

    const cookieToken = req.cookies?.["refreshToken"];
    if (cookieToken) {
      return cookieToken;
    }

    const queryToken = req.query?.["refresh_token"] as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  private async validateRefreshToken(
    token: string,
    req: Request,
  ): Promise<{ user: any; jti: string; deviceId?: string } | null> {
    try {
      const payload = this.jwtUtil.verify(token, {
        algorithms: ["HS512"],
      }) as RefreshTokenPayload;

      if (!payload.sub || !payload.jti) {
        this.logger.warn("Invalid refresh token payload: missing sub or jti");
        return null;
      }

      const session = await this.prisma.session.findUnique({
        where: { id: payload.jti },
        include: { user: true },
      });

      if (!session) {
        this.logger.warn(`Session ${payload.jti} not found`);
        return null;
      }

      if (session.expiresAt < new Date()) {
        this.logger.warn(`Session ${payload.jti} expired`);
        await this.prisma.session.delete({ where: { id: payload.jti } });
        if (this.cacheManager) {
          await this.cacheManager.set(
            `refresh:blacklist:${payload.jti}`,
            true,
            86400,
          );
        }
        return null;
      }

      if (session.revokedAt) {
        this.logger.warn(`Session ${payload.jti} revoked`);
        return null;
      }

      if (this.enableBlacklist && this.cacheManager) {
        const blacklisted = await this.cacheManager.get(
          `refresh:blacklist:${payload.jti}`,
        );
        if (blacklisted) {
          this.logger.warn(`Session ${payload.jti} blacklisted`);
          return null;
        }
      }

      const user = session.user;
      if (!user) {
        this.logger.warn(`User not found for session ${payload.jti}`);
        return null;
      }

      return {
        user,
        jti: payload.jti,
        deviceId: session.deviceId || undefined,
      };
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        this.logger.warn("Refresh token expired");
        return null;
      }
      if (error.name === "JsonWebTokenError") {
        this.logger.warn("Invalid refresh token signature");
        return null;
      }
      this.logger.error(`Refresh token validation error: ${error.message}`);
      return null;
    }
  }

  private async rotateToken(
    oldToken: string,
    oldJti: string,
    userId: string,
    req: Request,
  ): Promise<void> {
    this.logger.debug(`Rotating refresh token for user ${userId}`);

    const deviceId =
      req.body?.deviceId ||
      req.cookies?.["deviceId"] ||
      (req.query?.deviceId as string) ||
      undefined;

    try {
      const newJti = this.jwtUtil.generateJti();
      const newRefreshToken = this.jwtUtil.generateRandomToken();

      const expiresAt = new Date();
      const ttlSeconds = this.jwtUtil.parseDuration(this.refreshExpiresIn);
      expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

      const hashedToken = await EncryptionUtil.hashPassword(newRefreshToken);

      await this.prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: oldJti },
          data: {
            revokedAt: new Date(),
          },
        });

        await tx.session.create({
          data: {
            userId,
            refreshToken: hashedToken,
            deviceId: deviceId || null,
            ipAddress: req.ip || req.connection.remoteAddress || "0.0.0.0",
            userAgent: req.headers["user-agent"] || "Unknown",
            expiresAt,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      if (this.cacheManager) {
        await this.cacheManager.set(
          `refresh:blacklist:${oldJti}`,
          true,
          ttlSeconds,
        );
        await this.cacheManager.set(
          `refresh:token:${newRefreshToken}`,
          { jti: newJti, userId },
          ttlSeconds,
        );
        await this.cacheManager.set(
          `refresh:user:${userId}:${newJti}`,
          { jti: newJti, expiresAt },
          ttlSeconds,
        );
      }

      if (this.eventEmitter) {
        this.eventEmitter.emit("auth.refresh.rotated", {
          userId,
          oldJti,
          newJti,
          deviceId,
          timestamp: new Date(),
        });
      }

      this.logger.log(
        `Refresh token rotated for user ${userId}: ${oldJti} -> ${newJti}`,
      );
    } catch (error) {
      this.logger.error(`Token rotation failed: ${error.message}`);
    }
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    this.logger.debug(`Revoking refresh token ${jti}`);
    try {
      await this.prisma.session.update({
        where: { id: jti },
        data: { revokedAt: new Date() },
      });
      if (this.cacheManager) {
        await this.cacheManager.set(`refresh:blacklist:${jti}`, true, 86400);
      }
      this.logger.log(`Refresh token ${jti} revoked`);
    } catch (error) {
      this.logger.error(
        `Failed to revoke refresh token ${jti}: ${error.message}`,
      );
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    this.logger.debug(`Revoking all refresh tokens for user ${userId}`);
    try {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (this.cacheManager) {
        await this.cacheManager.set(
          `refresh:user:${userId}:revoke_all`,
          true,
          86400,
        );
      }
      this.logger.log(`All refresh tokens revoked for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to revoke all tokens for user ${userId}: ${error.message}`,
      );
    }
  }

  async validateSession(jti: string): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: jti },
      });
      if (!session) return false;
      if (session.revokedAt) return false;
      if (session.expiresAt < new Date()) return false;
      if (this.cacheManager) {
        const blacklisted = await this.cacheManager.get(
          `refresh:blacklist:${jti}`,
        );
        if (blacklisted) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  private fail(message: string, status: number): void {
    throw new UnauthorizedException({ message, statusCode: status });
  }

  private success(result: any, info: any): void {
    this.success(result);
  }
}
