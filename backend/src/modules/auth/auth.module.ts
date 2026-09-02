// backend/src/modules/auth/auth.module.ts
/**
 * 📄 Auth Module
 *
 * The Auth module handles all authentication-related functionality including:
 * - User registration and login
 * - JWT issuance and validation
 * - Refresh token rotation
 * - Two-factor authentication (2FA)
 * - Password reset and email verification
 * - Session management
 *
 * This module exposes the AuthController and provides the AuthService
 * to other modules for authentication-related operations.
 *
 * @module AuthModule
 * @category Modules
 */

import {
  Module,
  Global,
  DynamicModule,
  Provider,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from "@nestjs/core";

// -------- CONTROLLERS --------
import { AuthController } from "./auth.controller";

// -------- SERVICES --------
import { AuthService } from "./auth.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { JwtUtil } from "../../common/utils/jwt.util";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";

// -------- STRATEGIES --------
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { RefreshStrategy } from "./strategies/refresh.strategy";

// -------- GUARDS --------
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";

// -------- INTERCEPTORS --------
import { ResponseTransformInterceptor } from "../../common/interceptors/response-transform.interceptor";
import { LoggingInterceptor } from "../../common/interceptors/logging.interceptor";

// -------- FILTERS --------
import { AllExceptionsFilter } from "../../common/filters/all-exceptions.filter";

// -------- PIPES --------
import { ValidationPipe } from "../../common/pipes/validation.pipe";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";

// -------- DECORATORS --------
import { CurrentUser } from "../../common/decorators/current-user.decorator";

// -------- CONSTANTS --------
import { APP_CONSTANTS } from "../../common/constants";
import { API_VERSION } from "../../common/constants/api-paths";

// -------- FORWARD REFERENCE (to avoid circular dependency) --------
// Import UsersModule if needed, but we may not need it if AuthService doesn't depend on UsersService.
// However, for completeness, we'll import it to allow future extensions.
// Since AuthService uses PrismaService directly, we don't need UsersModule.
// But we may want to use UsersService for some operations, so we'll import it with forwardRef.
// We'll keep it optional.

// -------- TYPES --------
export interface AuthModuleOptions {
  /**
   * Whether the module should be global.
   * @default false
   */
  isGlobal?: boolean;

  /**
   * JWT secret key (overrides config).
   */
  jwtSecret?: string;

  /**
   * JWT expiration time.
   * @default '15m'
   */
  jwtExpiresIn?: string;

  /**
   * Refresh token expiration time.
   * @default '7d'
   */
  jwtRefreshExpiresIn?: string;

  /**
   * Enable 2FA by default.
   * @default false
   */
  enable2faByDefault?: boolean;

  /**
   * Rate limiting for authentication endpoints.
   * @default { ttl: 60, max: 5 }
   */
  rateLimit?: {
    ttl: number;
    max: number;
  };

  /**
   * Enable email verification on registration.
   * @default true
   */
  enableEmailVerification?: boolean;

  /**
   * Enable phone verification on registration.
   * @default false
   */
  enablePhoneVerification?: boolean;

  /**
   * Cookie settings for refresh tokens.
   */
  cookie?: {
    secure: boolean;
    httpOnly: boolean;
    sameSite: "strict" | "lax" | "none";
    maxAge: number;
  };

  /**
   * Allowed email domains (whitelist).
   */
  allowedEmailDomains?: string[];

  /**
   * Blocked email domains (blacklist).
   */
  blockedEmailDomains?: string[];
}

/**
 * Auth module for authentication and authorization.
 */
@Module({
  imports: [
    // Core modules
    ConfigModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || "default-secret",
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "15m",
        },
      }),
      inject: [ConfigService],
    }),
    // Optional cache module (if Redis is configured)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get<number>("JWT_CACHE_TTL") || 3600,
        max: 1000,
        store:
          configService.get<string>("CACHE_STORE") === "redis"
            ? require("cache-manager-redis-store")
            : undefined,
        host: configService.get<string>("REDIS_HOST") || "localhost",
        port: configService.get<number>("REDIS_PORT") || 6379,
        password: configService.get<string>("REDIS_PASSWORD"),
        db: 1, // Use different DB for auth tokens
      }),
      inject: [ConfigService],
    }),
    // Event emitter for internal events
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    // Schedule module for cron jobs (cleanup, etc.)
    ScheduleModule.forRoot(),
    // Optional: forwardRef to UsersModule if needed
    // forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [
    // Main services
    AuthService,
    PrismaService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,

    // Strategies
    JwtStrategy,
    LocalStrategy,
    // RefreshStrategy (if needed)

    // Guards
    LocalAuthGuard,

    // Global guards (if not already provided elsewhere)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global pipes
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_PIPE,
      useClass: ParseIntPipe,
    },

    // Decorators (provided as providers for DI)
    CurrentUser,

    // Logger
    Logger,
  ],
  exports: [
    AuthService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    PrismaService,
    // Export strategies if needed
    // JwtStrategy,
    // LocalStrategy,
  ],
})
export class AuthModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthModule.name);

  constructor(
    private readonly authService: AuthService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * On module initialization, perform any necessary setup.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("Auth Module initialized");

    // Check database connectivity (if needed)
    try {
      await this.authService["prisma"].$queryRaw`SELECT 1`;
      this.logger.debug("Database connection verified");
    } catch (error) {
      this.logger.warn(`Database connection check failed: ${error.message}`);
    }

    // Log configuration (if any)
    if (this.configService) {
      const config = {
        jwtExpiresIn: this.configService.get<string>("JWT_EXPIRES_IN"),
        refreshExpiresIn: this.configService.get<string>(
          "JWT_REFRESH_EXPIRES_IN",
        ),
        emailVerification: this.configService.get<boolean>(
          "ENABLE_EMAIL_VERIFICATION",
        ),
      };
      this.logger.debug(`Module configuration: ${JSON.stringify(config)}`);
    }

    // Emit module ready event
    // Could use event emitter if available
    // this.eventEmitter.emit('module.auth.ready', { timestamp: new Date() });
  }

  /**
   * On module destruction, clean up resources.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log("Auth Module shutting down");
    // Any cleanup needed
  }

  /**
   * Static method to register the module with custom options.
   * @param options - Module configuration options
   * @returns Dynamic module
   */
  static register(options: AuthModuleOptions): DynamicModule {
    const providers: Provider[] = [
      // Override providers based on options
      {
        provide: "AUTH_MODULE_OPTIONS",
        useValue: options,
      },
      {
        provide: AuthService,
        useClass: AuthService,
      },
      // ... other providers
    ];

    return {
      module: AuthModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: options.isGlobal || false,
        }),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({
          secret: options.jwtSecret || "default-secret",
          signOptions: {
            expiresIn: options.jwtExpiresIn || "15m",
          },
        }),
        CacheModule.register({
          ttl: 3600,
          max: 1000,
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
      ],
      controllers: [AuthController],
      providers,
      exports: [AuthService, "AUTH_MODULE_OPTIONS"],
      global: options.isGlobal || false,
    };
  }

  /**
   * Async registration with factory provider.
   * @param options - Dynamic module options
   * @returns Dynamic module
   */
  static registerAsync(options: {
    imports?: any[];
    useFactory?: (
      ...args: any[]
    ) => Promise<AuthModuleOptions> | AuthModuleOptions;
    inject?: any[];
    isGlobal?: boolean;
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: "AUTH_MODULE_OPTIONS",
        useFactory: options.useFactory || (() => ({})),
        inject: options.inject || [],
      },
      {
        provide: AuthService,
        useClass: AuthService,
      },
    ];

    return {
      module: AuthModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: options.isGlobal || false,
        }),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.registerAsync({
          imports: options.imports || [],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get<string>("JWT_SECRET") || "default-secret",
            signOptions: {
              expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "15m",
            },
          }),
          inject: [ConfigService],
        }),
        CacheModule.registerAsync({
          imports: options.imports || [],
          useFactory: async (configService: ConfigService) => ({
            ttl: configService.get<number>("JWT_CACHE_TTL") || 3600,
            max: 1000,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
      ],
      controllers: [AuthController],
      providers,
      exports: [AuthService, "AUTH_MODULE_OPTIONS"],
      global: options.isGlobal || false,
    };
  }

  /**
   * ForRoot method for configuring the module as a global module.
   * @param options - Module options
   * @returns Dynamic module
   */
  static forRoot(options: AuthModuleOptions = {}): DynamicModule {
    return this.register({ ...options, isGlobal: true });
  }

  /**
   * ForRootAsync for async configuration.
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (
      ...args: any[]
    ) => Promise<AuthModuleOptions> | AuthModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return this.registerAsync({ ...options, isGlobal: true });
  }

  /**
   * Helper method to get module metadata.
   */
  static getModuleMetadata(): {
    name: string;
    version: string;
    description: string;
    routes: string[];
  } {
    return {
      name: "AuthModule",
      version: "1.0.0",
      description:
        "Handles authentication, registration, JWT, 2FA, and session management.",
      routes: [
        "/auth/register",
        "/auth/login",
        "/auth/refresh",
        "/auth/logout",
        "/auth/me",
        "/auth/verify-email",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/2fa/setup",
        "/auth/2fa/verify",
        "/auth/2fa/disable",
      ],
    };
  }

  /**
   * Get the module's providers for testing.
   */
  static getProviders(): Provider[] {
    return [
      AuthService,
      PrismaService,
      JwtUtil,
      EncryptionUtil,
      SanitizeUtil,
      JwtStrategy,
      LocalStrategy,
      LocalAuthGuard,
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
      {
        provide: APP_GUARD,
        useClass: RolesGuard,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: ResponseTransformInterceptor,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: LoggingInterceptor,
      },
      {
        provide: APP_FILTER,
        useClass: AllExceptionsFilter,
      },
      {
        provide: APP_PIPE,
        useClass: ValidationPipe,
      },
      {
        provide: APP_PIPE,
        useClass: ParseIntPipe,
      },
      CurrentUser,
      Logger,
    ];
  }

  /**
   * Get the module's controllers for testing.
   */
  static getControllers(): any[] {
    return [AuthController];
  }

  /**
   * Get the module's imports for testing.
   */
  static getImports(): any[] {
    return [
      ConfigModule,
      PassportModule,
      JwtModule,
      CacheModule,
      EventEmitterModule,
      ScheduleModule,
    ];
  }

  // -------- CONFIGURATION HELPERS --------

  /**
   * Validate module configuration.
   */
  static validateOptions(options: AuthModuleOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.jwtSecret && options.jwtSecret.length < 16) {
      errors.push("JWT secret must be at least 16 characters");
    }

    if (options.jwtExpiresIn && !this.isValidDuration(options.jwtExpiresIn)) {
      errors.push('Invalid JWT expiration format (use e.g., "15m", "1h")');
    }

    if (
      options.jwtRefreshExpiresIn &&
      !this.isValidDuration(options.jwtRefreshExpiresIn)
    ) {
      errors.push('Invalid refresh expiration format (use e.g., "7d", "30d")');
    }

    if (options.rateLimit) {
      if (options.rateLimit.ttl < 1) {
        errors.push("Rate limit TTL must be at least 1 second");
      }
      if (options.rateLimit.max < 1) {
        errors.push("Rate limit max must be at least 1");
      }
    }

    if (options.allowedEmailDomains && options.allowedEmailDomains.length > 0) {
      for (const domain of options.allowedEmailDomains) {
        if (!domain.includes(".")) {
          errors.push(`Invalid email domain: ${domain}`);
        }
      }
    }

    if (options.blockedEmailDomains && options.blockedEmailDomains.length > 0) {
      for (const domain of options.blockedEmailDomains) {
        if (!domain.includes(".")) {
          errors.push(`Invalid blocked email domain: ${domain}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a duration string (e.g., '15m', '1h', '7d').
   */
  private static isValidDuration(duration: string): boolean {
    const regex = /^[1-9]\d*[smhd]$/;
    return regex.test(duration);
  }

  /**
   * Get default configuration.
   */
  static getDefaultOptions(): AuthModuleOptions {
    return {
      isGlobal: false,
      jwtExpiresIn: "15m",
      jwtRefreshExpiresIn: "7d",
      enable2faByDefault: false,
      rateLimit: {
        ttl: 60,
        max: 5,
      },
      enableEmailVerification: true,
      enablePhoneVerification: false,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
      allowedEmailDomains: [],
      blockedEmailDomains: [],
    };
  }

  /**
   * Merge options with defaults.
   */
  static mergeOptions(options: Partial<AuthModuleOptions>): AuthModuleOptions {
    const defaults = this.getDefaultOptions();
    return {
      ...defaults,
      ...options,
      cookie: {
        ...defaults.cookie,
        ...(options.cookie || {}),
      },
      rateLimit: {
        ...defaults.rateLimit,
        ...(options.rateLimit || {}),
      },
    };
  }

  /**
   * Get the module's global prefix.
   */
  static getPrefix(): string {
    return "/api/v1/auth";
  }

  // -------- END --------
}
