// backend/src/modules/messages/messages.module.ts
/**
 * 📄 Messages Module
 *
 * The Messages module handles all messaging-related functionality including:
 * - Sending, editing, deleting, and forwarding messages
 * - Real-time messaging via WebSocket gateway
 * - Message status tracking (sent, delivered, read)
 * - Reactions and pinning
 * - Attachments and file management
 * - Search and filtering
 *
 * This module is responsible for exposing the MessagesController and providing
 * the MessagesService and MessagesGateway to other modules.
 *
 * @module MessagesModule
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
import { MessagesController } from "./messages.controller";

// -------- GATEWAY --------
import { MessagesGateway } from "./messages.gateway";

// -------- SERVICES --------
import { MessagesService } from "./messages.service";
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

// -------- FORWARD REFERENCE (to avoid circular dependency with Users/Groups) --------
// We may need to import UsersModule and GroupsModule if we use their services.
// We'll use forwardRef to avoid circular issues.

// -------- TYPES --------
export interface MessagesModuleOptions {
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
   * Message edit window in seconds.
   * @default 300 (5 minutes)
   */
  editWindowSeconds?: number;

  /**
   * Maximum message length.
   * @default 10000
   */
  maxMessageLength?: number;

  /**
   * Maximum attachments per message.
   * @default 20
   */
  maxAttachmentsPerMessage?: number;

  /**
   * Maximum file size per attachment in bytes.
   * @default 100 * 1024 * 1024 (100MB)
   */
  maxAttachmentSize?: number;

  /**
   * Whether to enable message encryption.
   * @default true
   */
  enableEncryption?: boolean;

  /**
   * Rate limiting for messages (per minute).
   * @default { ttl: 60, max: 50 }
   */
  rateLimit?: {
    ttl: number;
    max: number;
  };

  /**
   * Cache TTL for messages (seconds).
   * @default 300
   */
  cacheTtl?: number;

  /**
   * Enable read receipts.
   * @default true
   */
  enableReadReceipts?: boolean;

  /**
   * Enable typing indicators.
   * @default true
   */
  enableTypingIndicators?: boolean;

  /**
   * Enable push notifications for messages.
   * @default true
   */
  enablePushNotifications?: boolean;

  /**
   * Enable message history.
   * @default true
   */
  enableMessageHistory?: boolean;

  /**
   * Enable reactions.
   * @default true
   */
  enableReactions?: boolean;

  /**
   * Enable message pinning.
   * @default true
   */
  enablePinning?: boolean;
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
    // Cache module for message caching
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get<number>("MESSAGE_CACHE_TTL") || 300,
        max: 1000,
        store:
          configService.get<string>("CACHE_STORE") === "redis"
            ? require("cache-manager-redis-store")
            : undefined,
        host: configService.get<string>("REDIS_HOST") || "localhost",
        port: configService.get<number>("REDIS_PORT") || 6379,
        password: configService.get<string>("REDIS_PASSWORD"),
        db: 2, // Use different DB for messages
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
    // Optional: forwardRef to UsersModule and GroupsModule if needed
    // forwardRef(() => UsersModule),
    // forwardRef(() => GroupsModule),
  ],
  controllers: [MessagesController],
  providers: [
    // Main services
    MessagesService,
    MessagesGateway,
    PrismaService,
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
    MessagesService,
    MessagesGateway,
    JwtUtil,
    EncryptionUtil,
    SanitizeUtil,
    SlugifyUtil,
    PrismaService,
  ],
})
export class MessagesModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagesModule.name);

  constructor(
    private readonly messagesService: MessagesService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * On module initialization, perform any necessary setup.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("Messages Module initialized");

    // Initialize any cron jobs or background tasks
    // For example, clean expired messages, process scheduled deletions, etc.

    // Check database connectivity (if needed)
    try {
      await this.messagesService["prisma"].$queryRaw`SELECT 1`;
      this.logger.debug("Database connection verified");
    } catch (error) {
      this.logger.warn(`Database connection check failed: ${error.message}`);
    }

    // Log configuration (if any)
    if (this.configService) {
      const config = {
        cacheTtl: this.configService.get<number>("MESSAGE_CACHE_TTL"),
        editWindowSeconds: this.configService.get<number>(
          "MESSAGE_EDIT_WINDOW",
        ),
        maxMessageLength: this.configService.get<number>("MESSAGE_MAX_LENGTH"),
        rateLimit: this.configService.get<object>("MESSAGE_RATE_LIMIT"),
        enableEncryption: this.configService.get<boolean>(
          "MESSAGE_ENABLE_ENCRYPTION",
        ),
        enableReactions: this.configService.get<boolean>(
          "MESSAGE_ENABLE_REACTIONS",
        ),
        enablePinning: this.configService.get<boolean>(
          "MESSAGE_ENABLE_PINNING",
        ),
        enableReadReceipts: this.configService.get<boolean>(
          "MESSAGE_ENABLE_READ_RECEIPTS",
        ),
        enableTypingIndicators: this.configService.get<boolean>(
          "MESSAGE_ENABLE_TYPING_INDICATORS",
        ),
      };
      this.logger.debug(`Module configuration: ${JSON.stringify(config)}`);
    }

    // Emit module ready event
    // Could use event emitter if available
    // this.eventEmitter.emit('module.messages.ready', { timestamp: new Date() });
  }

  /**
   * On module destruction, clean up resources.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log("Messages Module shutting down");
    // Close WebSocket server if needed
    // We'll handle this in the gateway's onModuleDestroy
    // Any cleanup needed
  }

  /**
   * Static method to register the module with custom options.
   * @param options - Module configuration options
   * @returns Dynamic module
   */
  static register(options: MessagesModuleOptions): DynamicModule {
    const providers: Provider[] = [
      // Override providers based on options
      {
        provide: "MESSAGES_MODULE_OPTIONS",
        useValue: options,
      },
      {
        provide: MessagesService,
        useClass: MessagesService,
      },
      {
        provide: MessagesGateway,
        useClass: MessagesGateway,
      },
      // ... other providers
    ];

    return {
      module: MessagesModule,
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
      ],
      controllers: [MessagesController],
      providers,
      exports: [MessagesService, MessagesGateway, "MESSAGES_MODULE_OPTIONS"],
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
    ) => Promise<MessagesModuleOptions> | MessagesModuleOptions;
    inject?: any[];
    isGlobal?: boolean;
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: "MESSAGES_MODULE_OPTIONS",
        useFactory: options.useFactory || (() => ({})),
        inject: options.inject || [],
      },
      {
        provide: MessagesService,
        useClass: MessagesService,
      },
      {
        provide: MessagesGateway,
        useClass: MessagesGateway,
      },
    ];

    return {
      module: MessagesModule,
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
            ttl: configService.get<number>("MESSAGE_CACHE_TTL") || 300,
            max: 1000,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
      ],
      controllers: [MessagesController],
      providers,
      exports: [MessagesService, MessagesGateway, "MESSAGES_MODULE_OPTIONS"],
      global: options.isGlobal || false,
    };
  }

  /**
   * ForRoot method for configuring the module as a global module.
   * @param options - Module options
   * @returns Dynamic module
   */
  static forRoot(options: MessagesModuleOptions = {}): DynamicModule {
    return this.register({ ...options, isGlobal: true });
  }

  /**
   * ForRootAsync for async configuration.
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (
      ...args: any[]
    ) => Promise<MessagesModuleOptions> | MessagesModuleOptions;
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
    webSocketEvents: string[];
  } {
    return {
      name: "MessagesModule",
      version: "1.0.0",
      description:
        "Handles messaging, real-time chat, reactions, pinning, attachments, and search.",
      routes: [
        "/messages/chat/:chatId",
        "/messages/:messageId",
        "/messages",
        "/messages/:messageId",
        "/messages/:messageId/reactions",
        "/messages/:messageId/pin",
        "/messages/search",
        "/messages/:messageId/forward",
        "/messages/:messageId/attachments",
      ],
      webSocketEvents: [
        "message:send",
        "message:receive",
        "message:edit",
        "message:delete",
        "typing:start",
        "typing:stop",
        "read:receipt",
        "presence:online",
        "presence:offline",
        "join-room",
        "leave-room",
      ],
    };
  }

  /**
   * Get the module's providers for testing.
   */
  static getProviders(): Provider[] {
    return [
      MessagesService,
      MessagesGateway,
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
    return [MessagesController];
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
  static validateOptions(options: MessagesModuleOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.jwtSecret && options.jwtSecret.length < 16) {
      errors.push("JWT secret must be at least 16 characters");
    }

    if (options.editWindowSeconds && options.editWindowSeconds < 0) {
      errors.push("Edit window must be a positive number");
    }

    if (options.maxMessageLength && options.maxMessageLength < 1) {
      errors.push("Max message length must be at least 1");
    }

    if (
      options.maxAttachmentsPerMessage &&
      options.maxAttachmentsPerMessage < 0
    ) {
      errors.push("Max attachments per message must be a non-negative number");
    }

    if (options.maxAttachmentSize && options.maxAttachmentSize < 0) {
      errors.push("Max attachment size must be a positive number");
    }

    if (options.rateLimit) {
      if (options.rateLimit.ttl < 1) {
        errors.push("Rate limit TTL must be at least 1 second");
      }
      if (options.rateLimit.max < 1) {
        errors.push("Rate limit max must be at least 1");
      }
    }

    if (options.cacheTtl && options.cacheTtl < 0) {
      errors.push("Cache TTL must be a positive number");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default configuration.
   */
  static getDefaultOptions(): MessagesModuleOptions {
    return {
      isGlobal: false,
      jwtExpiresIn: "15m",
      editWindowSeconds: 300,
      maxMessageLength: 10000,
      maxAttachmentsPerMessage: 20,
      maxAttachmentSize: 100 * 1024 * 1024, // 100MB
      enableEncryption: true,
      rateLimit: {
        ttl: 60,
        max: 50,
      },
      cacheTtl: 300,
      enableReadReceipts: true,
      enableTypingIndicators: true,
      enablePushNotifications: true,
      enableMessageHistory: true,
      enableReactions: true,
      enablePinning: true,
    };
  }

  /**
   * Merge options with defaults.
   */
  static mergeOptions(
    options: Partial<MessagesModuleOptions>,
  ): MessagesModuleOptions {
    const defaults = this.getDefaultOptions();
    return {
      ...defaults,
      ...options,
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
    return "/api/v1/messages";
  }

  // -------- END --------
}
