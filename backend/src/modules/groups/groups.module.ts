// backend/src/modules/groups/groups.module.ts
/**
 * 📄 Groups Module
 *
 * The Groups module handles all group-related functionality including:
 * - Group creation, updates, deletion, and restoration
 * - Member management (add, remove, promote, demote)
 * - Invite generation and acceptance/rejection
 * - Group settings and privacy
 * - Group search and filtering
 *
 * This module is responsible for exposing the GroupsController and providing
 * the GroupsService to other modules.
 *
 * @module GroupsModule
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
import { GroupsController } from "./groups.controller";

// -------- SERVICES --------
import { GroupsService } from "./groups.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { JwtUtil } from "../../common/utils/jwt.util";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SlugifyUtil } from "../../common/utils/slugify.util";
import { UsersService } from "../users/users.service";

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
export interface GroupsModuleOptions {
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
   * Maximum number of members per group.
   * @default 1000
   */
  maxGroupMembers?: number;

  /**
   * Cache TTL for groups (seconds).
   * @default 300
   */
  cacheTtl?: number;

  /**
   * Enable group encryption.
   * @default true
   */
  enableEncryption?: boolean;

  /**
   * Enable group invites.
   * @default true
   */
  enableInvites?: boolean;

  /**
   * Default invite expiration in seconds.
   * @default 86400 (24 hours)
   */
  defaultInviteExpiration?: number;

  /**
   * Enable push notifications for group events.
   * @default true
   */
  enablePushNotifications?: boolean;

  /**
   * Enable group history (audit logs).
   * @default true
   */
  enableGroupHistory?: boolean;
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
    // Cache module for group caching
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get<number>("GROUP_CACHE_TTL") || 300,
        max: 1000,
        store:
          configService.get<string>("CACHE_STORE") === "redis"
            ? require("cache-manager-redis-store")
            : undefined,
        host: configService.get<string>("REDIS_HOST") || "localhost",
        port: configService.get<number>("REDIS_PORT") || 6379,
        password: configService.get<string>("REDIS_PASSWORD"),
        db: 3, // Use different DB for groups
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
    // Forward reference to UsersModule to avoid circular dependency
    forwardRef(() => require("../users/users.module").UsersModule),
  ],
  controllers: [GroupsController],
  providers: [
    // Main services
    GroupsService,
    PrismaService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,
    UsersService,

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
    GroupsService,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,
    PrismaService,
  ],
})
export class GroupsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GroupsModule.name);

  constructor(
    private readonly groupsService: GroupsService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * On module initialization, perform any necessary setup.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("Groups Module initialized");

    // Initialize any cron jobs or background tasks
    // For example, clean expired invites, sync group counts, etc.

    // Check database connectivity (if needed)
    try {
      await this.groupsService["prisma"].$queryRaw`SELECT 1`;
      this.logger.debug("Database connection verified");
    } catch (error) {
      this.logger.warn(`Database connection check failed: ${error.message}`);
    }

    // Log configuration (if any)
    if (this.configService) {
      const config = {
        cacheTtl: this.configService.get<number>("GROUP_CACHE_TTL"),
        maxGroupMembers: this.configService.get<number>("GROUP_MAX_MEMBERS"),
        defaultInviteExpiration: this.configService.get<number>(
          "GROUP_INVITE_EXPIRATION",
        ),
        enableEncryption: this.configService.get<boolean>(
          "GROUP_ENABLE_ENCRYPTION",
        ),
        enableInvites: this.configService.get<boolean>("GROUP_ENABLE_INVITES"),
      };
      this.logger.debug(`Module configuration: ${JSON.stringify(config)}`);
    }

    // Emit module ready event
    // Could use event emitter if available
    // this.eventEmitter.emit('module.groups.ready', { timestamp: new Date() });
  }

  /**
   * On module destruction, clean up resources.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log("Groups Module shutting down");
    // Any cleanup needed
  }

  /**
   * Static method to register the module with custom options.
   * @param options - Module configuration options
   * @returns Dynamic module
   */
  static register(options: GroupsModuleOptions): DynamicModule {
    const providers: Provider[] = [
      // Override providers based on options
      {
        provide: "GROUPS_MODULE_OPTIONS",
        useValue: options,
      },
      {
        provide: GroupsService,
        useClass: GroupsService,
      },
      // ... other providers
    ];

    return {
      module: GroupsModule,
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
      ],
      controllers: [GroupsController],
      providers,
      exports: [GroupsService, "GROUPS_MODULE_OPTIONS"],
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
    ) => Promise<GroupsModuleOptions> | GroupsModuleOptions;
    inject?: any[];
    isGlobal?: boolean;
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: "GROUPS_MODULE_OPTIONS",
        useFactory: options.useFactory || (() => ({})),
        inject: options.inject || [],
      },
      {
        provide: GroupsService,
        useClass: GroupsService,
      },
    ];

    return {
      module: GroupsModule,
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
            ttl: configService.get<number>("GROUP_CACHE_TTL") || 300,
            max: 1000,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        forwardRef(() => require("../users/users.module").UsersModule),
      ],
      controllers: [GroupsController],
      providers,
      exports: [GroupsService, "GROUPS_MODULE_OPTIONS"],
      global: options.isGlobal || false,
    };
  }

  /**
   * ForRoot method for configuring the module as a global module.
   * @param options - Module options
   * @returns Dynamic module
   */
  static forRoot(options: GroupsModuleOptions = {}): DynamicModule {
    return this.register({ ...options, isGlobal: true });
  }

  /**
   * ForRootAsync for async configuration.
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (
      ...args: any[]
    ) => Promise<GroupsModuleOptions> | GroupsModuleOptions;
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
      name: "GroupsModule",
      version: "1.0.0",
      description:
        "Handles group management, member management, invites, and group settings.",
      routes: [
        "/groups",
        "/groups/:id",
        "/groups/:id/members",
        "/groups/:id/members/:userId",
        "/groups/:id/members/:userId/promote",
        "/groups/:id/members/:userId/demote",
        "/groups/:id/invites",
        "/groups/invites/accept",
        "/groups/invites/reject",
        "/groups/user/me",
      ],
    };
  }

  /**
   * Get the module's providers for testing.
   */
  static getProviders(): Provider[] {
    return [
      GroupsService,
      PrismaService,
      JwtUtil,
      EncryptionUtil,
      SanitizeUtil,
      SlugifyUtil,
      UsersService,
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
    return [GroupsController];
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
  static validateOptions(options: GroupsModuleOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.jwtSecret && options.jwtSecret.length < 16) {
      errors.push("JWT secret must be at least 16 characters");
    }

    if (options.maxGroupMembers && options.maxGroupMembers < 1) {
      errors.push("Max group members must be at least 1");
    }

    if (options.cacheTtl && options.cacheTtl < 0) {
      errors.push("Cache TTL must be a positive number");
    }

    if (
      options.defaultInviteExpiration &&
      options.defaultInviteExpiration < 0
    ) {
      errors.push("Default invite expiration must be a positive number");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default configuration.
   */
  static getDefaultOptions(): GroupsModuleOptions {
    return {
      isGlobal: false,
      jwtExpiresIn: "15m",
      maxGroupMembers: 1000,
      cacheTtl: 300,
      enableEncryption: true,
      enableInvites: true,
      defaultInviteExpiration: 86400, // 24 hours
      enablePushNotifications: true,
      enableGroupHistory: true,
    };
  }

  /**
   * Merge options with defaults.
   */
  static mergeOptions(
    options: Partial<GroupsModuleOptions>,
  ): GroupsModuleOptions {
    const defaults = this.getDefaultOptions();
    return {
      ...defaults,
      ...options,
    };
  }

  /**
   * Get the module's global prefix.
   */
  static getPrefix(): string {
    return "/api/v1/groups";
  }

  // -------- END --------
}
