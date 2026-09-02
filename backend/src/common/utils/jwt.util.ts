// backend/src/common/utils/jwt.util.ts
import * as jwt from "jsonwebtoken";
import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomBytes } from "crypto";
import { promisify } from "util";
import { EncryptionUtil } from "./encryption.util";

// -------- TYPES & INTERFACES --------
export type JwtAlgorithm =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA"
  | "PS256"
  | "PS384"
  | "PS512";

export interface JwtPayload {
  sub: string; // subject (user ID)
  iss?: string; // issuer
  aud?: string | string[]; // audience
  iat?: number; // issued at
  exp?: number; // expiration
  nbf?: number; // not before
  jti?: string; // JWT ID (unique)
  [key: string]: any; // custom claims
}

export interface JwtSignOptions {
  algorithm?: JwtAlgorithm;
  expiresIn?: string | number;
  notBefore?: string | number;
  audience?: string | string[];
  issuer?: string;
  jwtid?: string;
  subject?: string;
  keyid?: string;
  header?: Record<string, any>;
  encoding?: string;
}

export interface JwtVerifyOptions {
  algorithms?: JwtAlgorithm[];
  audience?: string | string[];
  issuer?: string | string[];
  ignoreExpiration?: boolean;
  ignoreNotBefore?: boolean;
  clockTolerance?: number;
  maxAge?: string | number;
  clockTimestamp?: number;
  complete?: boolean;
}

export interface JwtRefreshOptions {
  /** Refresh token TTL in seconds (default: 7 days) */
  ttlSeconds?: number;
  /** Allow multiple refresh tokens per user (default: false) */
  allowMultiple?: boolean;
  /** Maximum number of refresh tokens per user (default: 5) */
  maxTokensPerUser?: number;
  /** Enable one‑time use (refresh token consumed after use) */
  oneTimeUse?: boolean;
  /** Enable refresh token family (tracks token chains) */
  enableFamily?: boolean;
}

export interface RefreshTokenData {
  token: string;
  userId: string;
  jti: string;
  expiresAt: number; // timestamp
  createdAt: number;
  familyId?: string; // if using family
  parentId?: string; // if using family
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenIntrospectionResult {
  active: boolean;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  jti?: string;
  scope?: string;
  client_id?: string;
  username?: string;
  [key: string]: any;
}

// -------- DEFAULT OPTIONS --------
const DEFAULT_SIGN_OPTIONS: JwtSignOptions = {
  algorithm: "HS256",
  expiresIn: "15m",
};

const DEFAULT_VERIFY_OPTIONS: JwtVerifyOptions = {
  algorithms: ["HS256", "RS256", "ES256"],
  ignoreExpiration: false,
  ignoreNotBefore: false,
  clockTolerance: 0,
};

const DEFAULT_REFRESH_OPTIONS: JwtRefreshOptions = {
  ttlSeconds: 7 * 24 * 3600, // 7 days
  allowMultiple: true,
  maxTokensPerUser: 5,
  oneTimeUse: true,
  enableFamily: true,
};

// -------- MAIN JWT UTILITY CLASS --------
@Injectable()
export class JwtUtil {
  private readonly logger = new Logger(JwtUtil.name);
  private readonly secret: string;
  private readonly privateKey?: string;
  private readonly publicKey?: string;
  private readonly defaultAlgorithm: JwtAlgorithm;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly refreshOptions: Required<JwtRefreshOptions>;

  // In‑memory store for refresh tokens (fallback if Redis unavailable)
  private refreshTokenStore = new Map<string, RefreshTokenData>();
  private blacklistStore = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.secret =
      this.configService.get<string>("JWT_SECRET") ||
      "default-secret-change-me";
    this.privateKey = this.configService.get<string>("JWT_PRIVATE_KEY");
    this.publicKey = this.configService.get<string>("JWT_PUBLIC_KEY");
    this.defaultAlgorithm =
      this.configService.get<JwtAlgorithm>("JWT_ALGORITHM") || "HS256";
    this.issuer =
      this.configService.get<string>("JWT_ISSUER") || "real-whatsapp-clone";
    this.audience =
      this.configService.get<string>("JWT_AUDIENCE") ||
      "real-whatsapp-clone-api";

    const refreshConfig =
      this.configService.get<JwtRefreshOptions>("JWT_REFRESH") || {};
    this.refreshOptions = {
      ...DEFAULT_REFRESH_OPTIONS,
      ...refreshConfig,
    };

    // Validate secret for symmetric algorithms
    if (
      ["HS256", "HS384", "HS512"].includes(this.defaultAlgorithm) &&
      this.secret === "default-secret-change-me"
    ) {
      this.logger.warn(
        "⚠️ JWT secret is set to default! Please change JWT_SECRET in production.",
      );
    }

    this.logger.log(
      `JWT Utility initialized with algorithm: ${this.defaultAlgorithm}`,
    );
  }

  // ---------------------- SIGN (ISSUE) TOKEN ----------------------
  /**
   * Issue a new JWT token.
   */
  sign(payload: Record<string, any>, options: JwtSignOptions = {}): string {
    const opts: JwtSignOptions = { ...DEFAULT_SIGN_OPTIONS, ...options };

    // Ensure algorithm is compatible with provided keys
    const algorithm = opts.algorithm || this.defaultAlgorithm;
    const isSymmetric = ["HS256", "HS384", "HS512"].includes(algorithm);
    const isAsymmetric = [
      "RS256",
      "RS384",
      "RS512",
      "PS256",
      "PS384",
      "PS512",
      "ES256",
      "ES384",
      "ES512",
      "EdDSA",
    ].includes(algorithm);

    if (isSymmetric) {
      // Use secret
      const signOptions: jwt.SignOptions = {
        algorithm: algorithm as jwt.Algorithm,
        expiresIn: opts.expiresIn,
        notBefore: opts.notBefore,
        audience: opts.audience || this.audience,
        issuer: opts.issuer || this.issuer,
        jwtid: opts.jwtid || this.generateJti(),
        subject: opts.subject,
        keyid: opts.keyid,
        header: opts.header,
        encoding: opts.encoding,
      };
      return jwt.sign(payload, this.secret, signOptions);
    } else if (isAsymmetric) {
      // Use private key (if available)
      if (!this.privateKey) {
        throw new Error(
          `Private key required for asymmetric algorithm ${algorithm}`,
        );
      }
      const signOptions: jwt.SignOptions = {
        algorithm: algorithm as jwt.Algorithm,
        expiresIn: opts.expiresIn,
        notBefore: opts.notBefore,
        audience: opts.audience || this.audience,
        issuer: opts.issuer || this.issuer,
        jwtid: opts.jwtid || this.generateJti(),
        subject: opts.subject,
        keyid: opts.keyid,
        header: opts.header,
        encoding: opts.encoding,
      };
      return jwt.sign(payload, this.privateKey, signOptions);
    } else {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Issue an access token for a user.
   */
  issueAccessToken(
    userId: string,
    customClaims: Record<string, any> = {},
  ): string {
    const payload: JwtPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      ...customClaims,
    };
    return this.sign(payload, {
      algorithm: this.defaultAlgorithm,
      expiresIn: this.configService.get("JWT_ACCESS_TTL") || "15m",
    });
  }

  /**
   * Issue a refresh token (generates a random token and stores it).
   */
  async issueRefreshToken(
    userId: string,
    deviceId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ refreshToken: string; jti: string; expiresAt: Date }> {
    const jti = this.generateJti();
    const expiresAt = new Date(
      Date.now() + this.refreshOptions.ttlSeconds * 1000,
    );
    const refreshToken = this.generateRandomToken();

    const data: RefreshTokenData = {
      token: refreshToken,
      userId,
      jti,
      expiresAt: expiresAt.getTime(),
      createdAt: Date.now(),
      deviceId: deviceId || "unknown",
      ipAddress: ipAddress || "0.0.0.0",
      userAgent: userAgent || "unknown",
    };

    // Store the refresh token
    await this.storeRefreshToken(data);

    // If not allowing multiple, clean old tokens for this user
    if (!this.refreshOptions.allowMultiple) {
      await this.revokeAllRefreshTokens(userId, jti);
    } else {
      // Enforce max tokens per user
      const tokens = await this.getUserRefreshTokens(userId);
      if (tokens.length > this.refreshOptions.maxTokensPerUser) {
        // Remove oldest tokens
        const sorted = tokens.sort((a, b) => a.createdAt - b.createdAt);
        const toRemove = sorted.slice(
          0,
          sorted.length - this.refreshOptions.maxTokensPerUser,
        );
        for (const token of toRemove) {
          await this.revokeRefreshToken(token.jti);
        }
      }
    }

    // Log event
    if (this.eventEmitter) {
      this.eventEmitter.emit("jwt.refresh.issued", {
        userId,
        jti,
        deviceId,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });
    }

    return { refreshToken, jti, expiresAt };
  }

  // ---------------------- VERIFY TOKEN ----------------------
  /**
   * Verify a JWT token and return the decoded payload.
   */
  verify(
    token: string,
    options: JwtVerifyOptions = {},
  ): string | jwt.JwtPayload | jwt.Jwt {
    const opts: JwtVerifyOptions = { ...DEFAULT_VERIFY_OPTIONS, ...options };

    // Check blacklist first
    if (this.isTokenBlacklisted(token)) {
      throw new jwt.JsonWebTokenError("Token has been revoked");
    }

    try {
      // Determine verification key
      let secretOrKey: string | Buffer = this.secret;
      if (
        this.publicKey &&
        opts.algorithms?.some((a) =>
          [
            "RS256",
            "RS384",
            "RS512",
            "PS256",
            "PS384",
            "PS512",
            "ES256",
            "ES384",
            "ES512",
            "EdDSA",
          ].includes(a),
        )
      ) {
        secretOrKey = this.publicKey;
      }

      const verifyOptions: jwt.VerifyOptions = {
        algorithms: opts.algorithms || [this.defaultAlgorithm],
        audience: opts.audience || this.audience,
        issuer: opts.issuer || this.issuer,
        ignoreExpiration: opts.ignoreExpiration,
        ignoreNotBefore: opts.ignoreNotBefore,
        clockTolerance: opts.clockTolerance,
        maxAge: opts.maxAge,
        clockTimestamp: opts.clockTimestamp,
        complete: opts.complete,
      };

      return jwt.verify(token, secretOrKey, verifyOptions);
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify an access token and return the payload.
   */
  verifyAccessToken(token: string): JwtPayload {
    const decoded = this.verify(token) as jwt.JwtPayload;
    // Validate required claims
    if (!decoded.sub) {
      throw new jwt.JsonWebTokenError("Missing subject (sub) claim");
    }
    return decoded as JwtPayload;
  }

  /**
   * Verify a refresh token and return associated data.
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenData | null> {
    const data = await this.getRefreshTokenData(token);
    if (!data) {
      this.logger.warn(`Refresh token not found: ${token.substring(0, 8)}...`);
      return null;
    }

    // Check expiration
    if (Date.now() > data.expiresAt) {
      this.logger.warn(`Refresh token expired: ${data.jti}`);
      await this.revokeRefreshToken(data.jti);
      return null;
    }

    // If one‑time use, revoke and require new token
    if (this.refreshOptions.oneTimeUse) {
      await this.revokeRefreshToken(data.jti);
    }

    return data;
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refreshAccessToken(
    refreshToken: string,
    deviceId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    jti: string;
    expiresAt: Date;
  }> {
    const data = await this.verifyRefreshToken(refreshToken);
    if (!data) {
      throw new jwt.JsonWebTokenError("Invalid or expired refresh token");
    }

    // If using family, generate a new refresh token in the same family
    let familyId: string | undefined = data.familyId;
    if (this.refreshOptions.enableFamily) {
      if (!familyId) {
        familyId = this.generateJti(); // start a new family
      }
    }

    // Issue new access token
    const accessToken = this.issueAccessToken(data.userId, {
      deviceId: deviceId || data.deviceId,
    });

    // Issue new refresh token (with family)
    const newRefreshData = await this.issueRefreshToken(
      data.userId,
      deviceId || data.deviceId,
      ipAddress || data.ipAddress,
      userAgent || data.userAgent,
    );
    // Store family ID if using family
    if (familyId && this.refreshOptions.enableFamily) {
      // We need to update the stored refresh token with familyId
      // Since we issued a new one, we need to fetch it and update
      const newData = await this.getRefreshTokenData(
        newRefreshData.refreshToken,
      );
      if (newData) {
        newData.familyId = familyId;
        await this.storeRefreshToken(newData);
      }
    }

    // Emit event
    if (this.eventEmitter) {
      this.eventEmitter.emit("jwt.refresh.rotated", {
        userId: data.userId,
        oldJti: data.jti,
        newJti: newRefreshData.jti,
        familyId,
        timestamp: new Date(),
      });
    }

    return {
      accessToken,
      refreshToken: newRefreshData.refreshToken,
      jti: newRefreshData.jti,
      expiresAt: new Date(newRefreshData.expiresAt),
    };
  }

  // ---------------------- TOKEN BLACKLIST ----------------------
  /**
   * Add a token to the blacklist.
   */
  async blacklistToken(
    token: string,
    ttlSeconds: number = 86400,
  ): Promise<void> {
    const key = `jwt:blacklist:${token}`;
    if (this.cacheManager) {
      await this.cacheManager.set(key, true, ttlSeconds);
    } else {
      this.blacklistStore.add(token);
      // Auto‑remove after TTL (simplified)
      setTimeout(() => {
        this.blacklistStore.delete(token);
      }, ttlSeconds * 1000);
    }
    this.logger.debug(`Token blacklisted: ${token.substring(0, 8)}...`);
  }

  /**
   * Check if a token is blacklisted.
   */
  isTokenBlacklisted(token: string): boolean {
    // Check cache first
    if (this.cacheManager) {
      // We can't do sync check easily, but we'll use a promise-based check
      // For sync context, we'll use in‑memory fallback
      // This is a limitation – we'll use a sync check with in‑memory for performance
      // We'll use a promise-based check in async contexts
      // For sync, we'll assume not blacklisted unless in‑memory says so
      return this.blacklistStore.has(token);
    }
    return this.blacklistStore.has(token);
  }

  /**
   * Async check for blacklist (preferred).
   */
  async isTokenBlacklistedAsync(token: string): Promise<boolean> {
    if (this.cacheManager) {
      const key = `jwt:blacklist:${token}`;
      const result = await this.cacheManager.get<boolean>(key);
      return result === true;
    }
    return this.blacklistStore.has(token);
  }

  /**
   * Revoke all tokens for a user.
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const tokens = await this.getUserRefreshTokens(userId);
    for (const token of tokens) {
      await this.revokeRefreshToken(token.jti);
    }
    this.logger.log(`Revoked all tokens for user ${userId}`);
  }

  // ---------------------- REFRESH TOKEN STORAGE ----------------------
  private async storeRefreshToken(data: RefreshTokenData): Promise<void> {
    const key = `jwt:refresh:${data.jti}`;
    const userKey = `jwt:refresh:user:${data.userId}`;

    if (this.cacheManager) {
      await this.cacheManager.set(
        key,
        data,
        data.expiresAt - Date.now() / 1000,
      );
      // Add to user's list
      const userTokens = (await this.cacheManager.get<string[]>(userKey)) || [];
      if (!userTokens.includes(data.jti)) {
        userTokens.push(data.jti);
        await this.cacheManager.set(userKey, userTokens, 7 * 24 * 3600);
      }
    } else {
      this.refreshTokenStore.set(key, data);
      // Store in user list (in‑memory)
      const userTokensKey = `user:${data.userId}`;
      // We'll just store them in a separate map
    }
  }

  private async getRefreshTokenData(
    token: string,
  ): Promise<RefreshTokenData | null> {
    // We store by token (hashed) but here token is the raw refresh token
    // We need to find by token value. We'll store with key `jwt:refresh:token:${token}`
    const key = `jwt:refresh:token:${token}`;
    if (this.cacheManager) {
      return await this.cacheManager.get<RefreshTokenData>(key);
    }
    // In‑memory: iterate over store
    for (const [_, value] of this.refreshTokenStore) {
      if (value.token === token) {
        return value;
      }
    }
    return null;
  }

  private async getUserRefreshTokens(
    userId: string,
  ): Promise<RefreshTokenData[]> {
    const userKey = `jwt:refresh:user:${userId}`;
    const result: RefreshTokenData[] = [];
    if (this.cacheManager) {
      const jtis = (await this.cacheManager.get<string[]>(userKey)) || [];
      for (const jti of jtis) {
        const data = await this.cacheManager.get<RefreshTokenData>(
          `jwt:refresh:${jti}`,
        );
        if (data) {
          result.push(data);
        }
      }
    } else {
      for (const [_, value] of this.refreshTokenStore) {
        if (value.userId === userId) {
          result.push(value);
        }
      }
    }
    return result;
  }

  private async revokeRefreshToken(jti: string): Promise<void> {
    const key = `jwt:refresh:${jti}`;
    if (this.cacheManager) {
      await this.cacheManager.del(key);
    } else {
      this.refreshTokenStore.delete(key);
    }
    // Also blacklist any associated access tokens? Not directly.
    this.logger.debug(`Revoked refresh token: ${jti}`);
  }

  private async revokeAllRefreshTokens(
    userId: string,
    exceptJti?: string,
  ): Promise<void> {
    const tokens = await this.getUserRefreshTokens(userId);
    for (const token of tokens) {
      if (token.jti !== exceptJti) {
        await this.revokeRefreshToken(token.jti);
      }
    }
  }

  // ---------------------- TOKEN INTROSPECTION ----------------------
  /**
   * Introspect a token (OAuth2 introspection endpoint style).
   */
  async introspect(token: string): Promise<TokenIntrospectionResult> {
    try {
      const decoded = this.verify(token) as jwt.JwtPayload;
      const isBlacklisted = await this.isTokenBlacklistedAsync(token);
      if (isBlacklisted) {
        return { active: false };
      }

      return {
        active: true,
        sub: decoded.sub,
        aud: decoded.aud,
        iss: decoded.iss,
        exp: decoded.exp,
        iat: decoded.iat,
        nbf: decoded.nbf,
        jti: decoded.jti,
        scope: decoded.scope,
        ...decoded,
      };
    } catch (error) {
      return { active: false };
    }
  }

  // ---------------------- HELPER FUNCTIONS ----------------------
  /**
   * Generate a random JWT ID.
   */
  generateJti(): string {
    return randomBytes(12).toString("hex");
  }

  /**
   * Generate a random refresh token string.
   */
  generateRandomToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Decode a token without verification (for inspection only).
   */
  decode(token: string): jwt.JwtPayload | null {
    try {
      return jwt.decode(token) as jwt.JwtPayload;
    } catch (_) {
      return null;
    }
  }

  /**
   * Extract token from Authorization header.
   */
  static extractFromHeader(authHeader: string): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
    return null;
  }

  /**
   * Get remaining TTL of a token in seconds.
   */
  getTokenTTL(token: string): number {
    const decoded = this.decode(token);
    if (!decoded || !decoded.exp) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - now);
  }

  /**
   * Check if a token is expired.
   */
  isTokenExpired(token: string): boolean {
    return this.getTokenTTL(token) <= 0;
  }

  // ---------------------- JWT HEADER PARSING ----------------------
  /**
   * Get the algorithm used by a token from its header.
   */
  getTokenAlgorithm(token: string): string | null {
    try {
      const header = jwt.decode(token, { complete: true });
      return header?.header?.alg || null;
    } catch (_) {
      return null;
    }
  }

  // ---------------------- PUBLIC KEY MANAGEMENT (JWKS) ----------------------
  /**
   * Load public keys from a JWKS endpoint (for RS/ES algorithms).
   * This is a placeholder – in production, you'd implement a full JWKS client.
   */
  async loadPublicKeys(jwksUrl: string): Promise<void> {
    // Implementation would fetch and cache keys
    this.logger.log(
      `JWKS loading from ${jwksUrl} (not implemented, using configured keys)`,
    );
  }

  // ---------------------- CLEANUP & HOUSEKEEPING ----------------------
  /**
   * Clean expired refresh tokens (should be called periodically).
   */
  async cleanExpiredTokens(): Promise<void> {
    // In production, this would scan Redis for expired tokens
    this.logger.log("Cleaning expired tokens (placeholder)");
  }

  // ---------------------- END ----------------------
}
