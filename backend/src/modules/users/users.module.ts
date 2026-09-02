// backend/src/modules/users/users.module.ts
/**
 * 📄 User Module
 *
 * The User module handles all user-related functionality including:
 * - User registration and authentication
 * - Profile management
 * - Contact management
 * - Admin operations (suspend, ban, delete)
 * - User search and filtering
 *
 * This module is responsible for exposing the UsersController and providing
 * the UsersService to other modules.
 *
 * @module UsersModule
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
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, APP_GUARD } from "@nestjs/core";

// -------- CONTROLLERS --------
import { UsersController } from "./users.controller";

// -------- SERVICES --------
import { UsersService } from "./users.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { JwtUtil } from "../../common/utils/jwt.util";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SlugifyUtil } from "../../common/utils/slugify.util";

// -------- GUARDS --------
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

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

// -------- TYPES --------
export interface UserModuleOptions {
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
   * Enable 2FA by default for new users.
   * @default false
   */
  enable2faByDefault?: boolean;

  /**
   * Default user roles for new users.
   * @default ['user']
   */
  defaultRoles?: string[];

  /**
   * Cache TTL for user cache (seconds).
   * @default 300
   */
  cacheTtl?: number;

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
   * Allowed email domains (whitelist).
   */
  allowedEmailDomains?: string[];

  /**
   * Blocked email domains (blacklist).
   */
  blockedEmailDomains?: string[];
}

/**
 * User module for managing user accounts, profiles, and contacts.
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
        ttl: configService.get<number>("USER_CACHE_TTL") || 300,
        max: 100,
        store:
          configService.get<string>("CACHE_STORE") === "redis"
            ? require("cache-manager-redis-store")
            : undefined,
        host: configService.get<string>("REDIS_HOST") || "localhost",
        port: configService.get<number>("REDIS_PORT") || 6379,
        password: configService.get<string>("REDIS_PASSWORD"),
        db: 0,
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
  ],
  controllers: [UsersController],
  providers: [
    // Main service
    UsersService,

    // Database service
    PrismaService,

    // Utilities
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,

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
    UsersService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,
    PrismaService,
  ],
})
export class UsersModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsersModule.name);

  constructor(
    private readonly usersService: UsersService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * On module initialization, perform any necessary setup.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("User Module initialized");

    // Initialize any cron jobs or background tasks
    // For example, clean expired sessions, verify pending users, etc.
    // This is a placeholder for future implementation.

    // Check database connectivity (if needed)
    try {
      // We can do a quick health check
      await this.usersService["prisma"].$queryRaw`SELECT 1`;
      this.logger.debug("Database connection verified");
    } catch (error) {
      this.logger.warn(`Database connection check failed: ${error.message}`);
    }

    // Log configuration (if any)
    if (this.configService) {
      const config = {
        cacheTtl: this.configService.get<number>("USER_CACHE_TTL"),
        jwtExpiresIn: this.configService.get<string>("JWT_EXPIRES_IN"),
        emailVerification: this.configService.get<boolean>(
          "ENABLE_EMAIL_VERIFICATION",
        ),
      };
      this.logger.debug(`Module configuration: ${JSON.stringify(config)}`);
    }

    // Emit module ready event
    // Could use event emitter if available
    // this.eventEmitter.emit('module.user.ready', { timestamp: new Date() });
  }

  /**
   * On module destruction, clean up resources.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log("User Module shutting down");
    // Any cleanup needed
  }

  /**
   * Static method to register the module with custom options.
   * @param options - Module configuration options
   * @returns Dynamic module
   */
  static register(options: UserModuleOptions): DynamicModule {
    const providers: Provider[] = [
      // Override providers based on options
      {
        provide: "USER_MODULE_OPTIONS",
        useValue: options,
      },
      {
        provide: UsersService,
        useClass: UsersService,
      },
      // ... other providers
    ];

    return {
      module: UsersModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: options.isGlobal || false,
        }),
        JwtModule.register({
          secret: options.jwtSecret || "default-secret",
          signOptions: {
            expiresIn: options.jwtExpiresIn || "15m",
          },
        }),
        CacheModule.register({
          ttl: options.cacheTtl || 300,
          max: 100,
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
      ],
      controllers: [UsersController],
      providers,
      exports: [UsersService, "USER_MODULE_OPTIONS"],
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
    ) => Promise<UserModuleOptions> | UserModuleOptions;
    inject?: any[];
    isGlobal?: boolean;
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: "USER_MODULE_OPTIONS",
        useFactory: options.useFactory || (() => ({})),
        inject: options.inject || [],
      },
      {
        provide: UsersService,
        useClass: UsersService,
      },
    ];

    return {
      module: UsersModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: options.isGlobal || false,
        }),
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
            ttl: configService.get<number>("USER_CACHE_TTL") || 300,
            max: 100,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
      ],
      controllers: [UsersController],
      providers,
      exports: [UsersService, "USER_MODULE_OPTIONS"],
      global: options.isGlobal || false,
    };
  }

  /**
   * ForRoot method for configuring the module as a global module.
   * @param options - Module options
   * @returns Dynamic module
   */
  static forRoot(options: UserModuleOptions = {}): DynamicModule {
    return this.register({ ...options, isGlobal: true });
  }

  /**
   * ForRootAsync for async configuration.
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (
      ...args: any[]
    ) => Promise<UserModuleOptions> | UserModuleOptions;
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
      name: "UserModule",
      version: "1.0.0",
      description:
        "Handles user management, authentication, profiles, and contacts.",
      routes: [
        "/users",
        "/users/:id",
        "/users/me",
        "/users/:id/status",
        "/users/:id/contacts",
      ],
    };
  }

  /**
   * Get the module's providers for testing.
   */
  static getProviders(): Provider[] {
    return [
      UsersService,
      PrismaService,
      JwtUtil,
      EncryptionUtil,
      SanitizeUtil,
      SlugifyUtil,
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
    return [UsersController];
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
  static validateOptions(options: UserModuleOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.jwtSecret && options.jwtSecret.length < 16) {
      errors.push("JWT secret must be at least 16 characters");
    }

    if (options.defaultRoles && options.defaultRoles.length === 0) {
      errors.push("Default roles must have at least one role");
    }

    if (options.cacheTtl && options.cacheTtl < 0) {
      errors.push("Cache TTL must be a positive number");
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
   * Get default configuration.
   */
  static getDefaultOptions(): UserModuleOptions {
    return {
      isGlobal: false,
      jwtExpiresIn: "15m",
      jwtRefreshExpiresIn: "7d",
      enable2faByDefault: false,
      defaultRoles: ["user"],
      cacheTtl: 300,
      enableEmailVerification: true,
      enablePhoneVerification: false,
      allowedEmailDomains: [],
      blockedEmailDomains: [],
    };
  }

  /**
   * Merge options with defaults.
   */
  static mergeOptions(options: Partial<UserModuleOptions>): UserModuleOptions {
    const defaults = this.getDefaultOptions();
    return {
      ...defaults,
      ...options,
    };
  }

  // -------- END --------
}
