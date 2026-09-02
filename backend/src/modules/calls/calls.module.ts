// backend/src/modules/calls/calls.module.ts
/**
 * 📄 Calls Module
 *
 * The Calls module handles all call-related functionality including:
 * - Voice and video calls (one-to-one and group)
 * - WebRTC signaling (offer, answer, ICE candidates)
 * - Call history and statistics
 * - Call recording
 * - Call transfer
 *
 * This module is responsible for exposing the CallsController and providing
 * the CallsService to other modules.
 *
 * @module CallsModule
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
import { CallsController } from "./calls.controller";

// -------- SERVICES --------
import { CallsService } from "./calls.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { JwtUtil } from "../../common/utils/jwt.util";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SlugifyUtil } from "../../common/utils/slugify.util";
import { UsersService } from "../users/users.service";
import { GroupsService } from "../groups/groups.service";

// -------- GATEWAY --------
// We'll include CallsGateway if it exists, but we haven't created it yet.
// We'll add it as a provider placeholder.

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
export interface CallsModuleOptions {
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
   * Cache TTL for calls (seconds).
   * @default 300
   */
  cacheTtl?: number;

  /**
   * Maximum call duration in seconds.
   * @default 3600 (1 hour)
   */
  maxCallDuration?: number;

  /**
   * Enable call recording.
   * @default true
   */
  enableRecording?: boolean;

  /**
   * Enable call transfer.
   * @default true
   */
  enableTransfer?: boolean;

  /**
   * Enable push notifications for calls.
   * @default true
   */
  enablePushNotifications?: boolean;

  /**
   * Enable call history.
   * @default true
   */
  enableCallHistory?: boolean;

  /**
   * WebRTC ICE servers (STUN/TURN).
   * @example ['stun:stun.l.google.com:19302']
   */
  iceServers?: string[];
}

// -------- MAIN MODULE --------

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
    // Cache module for call caching
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get<number>("CALL_CACHE_TTL") || 300,
        max: 1000,
        store:
          configService.get<string>("CACHE_STORE") === "redis"
            ? require("cache-manager-redis-store")
            : undefined,
        host: configService.get<string>("REDIS_HOST") || "localhost",
        port: configService.get<number>("REDIS_PORT") || 6379,
        password: configService.get<string>("REDIS_PASSWORD"),
        db: 4, // Use different DB for calls
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
    // Forward reference to UsersModule and GroupsModule to avoid circular dependency
    forwardRef(() => require("../users/users.module").UsersModule),
    forwardRef(() => require("../groups/groups.module").GroupsModule),
  ],
  controllers: [CallsController],
  providers: [
    // Main services
    CallsService,
    PrismaService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,
    UsersService,
    GroupsService,

    // Gateway (placeholder - we'll add it when created)
    // If CallsGateway exists, we add it here.

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
    CallsService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,
    PrismaService,
  ],
})
export class CallsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallsModule.name);

  constructor(
    private readonly callsService: CallsService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * On module initialization, perform any necessary setup.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("Calls Module initialized");

    // Initialize any cron jobs or background tasks
    // For example, clean stale calls, purge old recordings, etc.

    // Check database connectivity (if needed)
    try {
      await this.callsService["prisma"].$queryRaw`SELECT 1`;
      this.logger.debug("Database connection verified");
    } catch (error) {
      this.logger.warn(`Database connection check failed: ${error.message}`);
    }

    // Log configuration (if any)
    if (this.configService) {
      const config = {
        cacheTtl: this.configService.get<number>("CALL_CACHE_TTL"),
        maxCallDuration: this.configService.get<number>("CALL_MAX_DURATION"),
        enableRecording: this.configService.get<boolean>(
          "CALL_ENABLE_RECORDING",
        ),
        enableTransfer: this.configService.get<boolean>("CALL_ENABLE_TRANSFER"),
        enablePushNotifications: this.configService.get<boolean>(
          "CALL_ENABLE_PUSH_NOTIFICATIONS",
        ),
        iceServers: this.configService.get<string[]>("CALL_ICE_SERVERS"),
      };
      this.logger.debug(`Module configuration: ${JSON.stringify(config)}`);
    }

    // Emit module ready event
    // Could use event emitter if available
    // this.eventEmitter.emit('module.calls.ready', { timestamp: new Date() });
  }

  /**
   * On module destruction, clean up resources.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log("Calls Module shutting down");
    // Any cleanup needed
  }

  /**
   * Static method to register the module with custom options.
   * @param options - Module configuration options
   * @returns Dynamic module
   */
  static register(options: CallsModuleOptions): DynamicModule {
    const providers: Provider[] = [
      // Override providers based on options
      {
        provide: "CALLS_MODULE_OPTIONS",
        useValue: options,
      },
      {
        provide: CallsService,
        useClass: CallsService,
      },
      // ... other providers
    ];

    return {
      module: CallsModule,
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
          ttl: options.cacheTtl || 300,
          max: 1000,
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        forwardRef(() => require("../users/users.module").UsersModule),
        forwardRef(() => require("../groups/groups.module").GroupsModule),
      ],
      controllers: [CallsController],
      providers,
      exports: [CallsService, "CALLS_MODULE_OPTIONS"],
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
    ) => Promise<CallsModuleOptions> | CallsModuleOptions;
    inject?: any[];
    isGlobal?: boolean;
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: "CALLS_MODULE_OPTIONS",
        useFactory: options.useFactory || (() => ({})),
        inject: options.inject || [],
      },
      {
        provide: CallsService,
        useClass: CallsService,
      },
    ];

    return {
      module: CallsModule,
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
            ttl: configService.get<number>("CALL_CACHE_TTL") || 300,
            max: 1000,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        forwardRef(() => require("../users/users.module").UsersModule),
        forwardRef(() => require("../groups/groups.module").GroupsModule),
      ],
      controllers: [CallsController],
      providers,
      exports: [CallsService, "CALLS_MODULE_OPTIONS"],
      global: options.isGlobal || false,
    };
  }

  /**
   * ForRoot method for configuring the module as a global module.
   * @param options - Module options
   * @returns Dynamic module
   */
  static forRoot(options: CallsModuleOptions = {}): DynamicModule {
    return this.register({ ...options, isGlobal: true });
  }

  /**
   * ForRootAsync for async configuration.
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (
      ...args: any[]
    ) => Promise<CallsModuleOptions> | CallsModuleOptions;
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
      name: "CallsModule",
      version: "1.0.0",
      description:
        "Handles voice and video calls, WebRTC signaling, call history, recording, and transfer.",
      routes: [
        "/calls",
        "/calls/:id",
        "/calls/:id/answer",
        "/calls/:id/end",
        "/calls/:id/signal",
        "/calls/:id/transfer",
        "/calls/:id/recording/start",
        "/calls/:id/recording/stop",
        "/calls/stats/me",
      ],
    };
  }

  /**
   * Get the module's providers for testing.
   */
  static getProviders(): Provider[] {
    return [
      CallsService,
      PrismaService,
      JwtUtil,
      EncryptionUtil,
      SanitizeUtil,
      SlugifyUtil,
      UsersService,
      GroupsService,
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
    return [CallsController];
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
  static validateOptions(options: CallsModuleOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.jwtSecret && options.jwtSecret.length < 16) {
      errors.push("JWT secret must be at least 16 characters");
    }

    if (options.cacheTtl && options.cacheTtl < 0) {
      errors.push("Cache TTL must be a positive number");
    }

    if (options.maxCallDuration && options.maxCallDuration < 0) {
      errors.push("Max call duration must be a positive number");
    }

    if (options.iceServers && options.iceServers.length > 0) {
      for (const server of options.iceServers) {
        if (!server.startsWith("stun:") && !server.startsWith("turn:")) {
          errors.push(`ICE server "${server}" must start with stun: or turn:`);
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
  static getDefaultOptions(): CallsModuleOptions {
    return {
      isGlobal: false,
      jwtExpiresIn: "15m",
      cacheTtl: 300,
      maxCallDuration: 3600, // 1 hour
      enableRecording: true,
      enableTransfer: true,
      enablePushNotifications: true,
      enableCallHistory: true,
      iceServers: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    };
  }

  /**
   * Merge options with defaults.
   */
  static mergeOptions(
    options: Partial<CallsModuleOptions>,
  ): CallsModuleOptions {
    const defaults = this.getDefaultOptions();
    return {
      ...defaults,
      ...options,
      iceServers: options.iceServers || defaults.iceServers,
    };
  }

  /**
   * Get the module's global prefix.
   */
  static getPrefix(): string {
    return "/api/v1/calls";
  }

  // -------- END --------
}
