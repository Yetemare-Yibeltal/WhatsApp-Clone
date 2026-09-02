// backend/src/common/pipes/validation.pipe.ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
  Optional,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  validate,
  ValidationError as ClassValidatorError,
} from "class-validator";
import { plainToClass } from "class-transformer";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

// -------- INTERFACES --------
export interface ValidationErrorDetail {
  field: string;
  value?: any;
  message: string;
  constraints?: { [type: string]: string };
  children?: ValidationErrorDetail[];
}

export interface ValidationErrorResponse {
  statusCode: 400;
  error: "Validation Error";
  message: string | string[];
  timestamp: string;
  path?: string;
  requestId?: string;
  details?: ValidationErrorDetail[];
}

export interface ValidationPipeOptions {
  /**
   * If true, strips properties that don't have any validation decorators.
   * @default true
   */
  whitelist?: boolean;

  /**
   * If true, throws an error when non‑whitelisted properties are present.
   * @default false
   */
  forbidNonWhitelisted?: boolean;

  /**
   * If true, transforms plain objects to class instances.
   * @default true
   */
  transform?: boolean;

  /**
   * Groups to apply during validation.
   */
  groups?: string[];

  /**
   * Dismiss default error messages and use custom ones.
   * @default false
   */
  dismissDefaultMessages?: boolean;

  /**
   * Enables detailed error reporting (includes nested errors).
   * @default true
   */
  detailedErrors?: boolean;

  /**
   * Enable validation logging.
   * @default true
   */
  logValidationErrors?: boolean;

  /**
   * Custom error message prefix.
   * @default 'Validation failed'
   */
  errorMessagePrefix?: string;

  /**
   * Enable strict mode (disallow unknown properties).
   * @default false
   */
  strict?: boolean;

  /**
   * Maximum payload size to validate (in bytes).
   * @default 1048576 (1MB)
   */
  maxPayloadSize?: number;

  /**
   * Skip validation for specific controller methods (by method name).
   */
  skipMethods?: string[];
}

// -------- DEFAULT OPTIONS --------
const DEFAULT_OPTIONS: Required<ValidationPipeOptions> = {
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
  groups: [],
  dismissDefaultMessages: false,
  detailedErrors: true,
  logValidationErrors: true,
  errorMessagePrefix: "Validation failed",
  strict: false,
  maxPayloadSize: 1048576, // 1MB
  skipMethods: [],
};

// -------- HELPER: FORMAT VALIDATION ERRORS --------
export class ValidationErrorFormatter {
  /**
   * Format a class-validator error tree into a flat list of detailed errors.
   */
  static formatErrors(
    errors: ClassValidatorError[],
    parentPath: string = "",
    maxDepth: number = 10,
  ): ValidationErrorDetail[] {
    const result: ValidationErrorDetail[] = [];

    for (const error of errors) {
      const currentPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      // Build constraints
      const constraints: { [type: string]: string } = {};
      if (error.constraints) {
        for (const [type, message] of Object.entries(error.constraints)) {
          constraints[type] = message;
        }
      }

      // Build detail
      const detail: ValidationErrorDetail = {
        field: currentPath,
        value: error.value,
        constraints:
          Object.keys(constraints).length > 0 ? constraints : undefined,
        message: Object.values(constraints).join("; ") || "Invalid value",
      };

      // Recursively process children
      if (error.children && error.children.length > 0 && maxDepth > 0) {
        const childErrors = this.formatErrors(
          error.children,
          currentPath,
          maxDepth - 1,
        );
        if (childErrors.length > 0) {
          detail.children = childErrors;
        }
        // If there is a constraint and also children, we merge the message
        if (detail.constraints) {
          detail.message = `${detail.message} (with nested errors)`;
        }
      }

      result.push(detail);
    }

    return result;
  }

  /**
   * Get a flat list of error messages from nested errors.
   */
  static getFlattenedMessages(errors: ClassValidatorError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }
      if (error.children && error.children.length > 0) {
        messages.push(...this.getFlattenedMessages(error.children));
      }
    }

    return messages;
  }

  /**
   * Get a detailed object mapping fields to error messages.
   */
  static getFieldErrorMap(
    errors: ClassValidatorError[],
    parentPath: string = "",
  ): Record<string, string[]> {
    const map: Record<string, string[]> = {};

    for (const error of errors) {
      const currentPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        map[currentPath] = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        const childMap = this.getFieldErrorMap(error.children, currentPath);
        for (const [key, messages] of Object.entries(childMap)) {
          if (!map[key]) {
            map[key] = [];
          }
          map[key].push(...messages);
        }
      }
    }

    return map;
  }

  /**
   * Generate a human-readable summary of validation errors.
   */
  static getSummary(errors: ClassValidatorError[]): string {
    const messages = this.getFlattenedMessages(errors);
    return messages.join("; ") || "Validation failed";
  }
}

// -------- MAIN PIPE --------
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(ValidationPipe.name);
  private readonly options: Required<ValidationPipeOptions>;
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {
    this.isDevelopment = this.configService.get("nodeEnv") === "development";

    // Load config from environment
    const envConfig =
      this.configService.get<Partial<ValidationPipeOptions>>("validation") ||
      {};

    this.options = {
      ...DEFAULT_OPTIONS,
      ...envConfig,
      // Override based on environment if not explicitly set
      detailedErrors:
        envConfig.detailedErrors !== undefined
          ? envConfig.detailedErrors
          : this.isDevelopment
            ? true
            : false,
      logValidationErrors:
        envConfig.logValidationErrors !== undefined
          ? envConfig.logValidationErrors
          : this.isDevelopment
            ? true
            : true,
    };

    this.logger.log("Validation Pipe initialized with options:", this.options);
  }

  // ---------------------- TRANSFORM & VALIDATE ----------------------
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // ---- 1. Skip validation for certain types ----
    const metatype = metadata.metatype;
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // ---- 2. Check if method should be skipped ----
    const methodName = metadata.data || "unknown";
    if (
      this.options.skipMethods &&
      this.options.skipMethods.includes(methodName)
    ) {
      return value;
    }

    // ---- 3. Check payload size ----
    if (this.options.maxPayloadSize > 0) {
      const size = this.estimateSize(value);
      if (size > this.options.maxPayloadSize) {
        this.logger.warn(
          `Payload size ${size} exceeds limit ${this.options.maxPayloadSize} for ${metadata.type} ${methodName}`,
        );
        throw new BadRequestException({
          statusCode: 400,
          error: "Payload Too Large",
          message: `Payload exceeds maximum allowed size of ${this.options.maxPayloadSize} bytes`,
        });
      }
    }

    // ---- 4. Transform plain object to class instance ----
    let object = plainToClass(metatype, value, {
      enableImplicitConversion: true,
      excludeExtraneousValues: this.options.whitelist,
    });

    // ---- 5. Validate the object ----
    const validationErrors = await validate(object, {
      whitelist: this.options.whitelist,
      forbidNonWhitelisted: this.options.forbidNonWhitelisted,
      groups: this.options.groups,
      dismissDefaultMessages: this.options.dismissDefaultMessages,
    });

    // ---- 6. Handle validation errors ----
    if (validationErrors.length > 0) {
      // Log the validation failure
      if (this.options.logValidationErrors) {
        this.logValidationErrors(validationErrors, metadata, value);
      }

      // Format error response
      const errorResponse = this.buildErrorResponse(validationErrors, metadata);

      // Emit event for monitoring
      if (this.eventEmitter) {
        this.eventEmitter.emit("validation.failed", {
          method: metadata.type || "unknown",
          path: metadata.data || "unknown",
          errors: validationErrors,
          timestamp: new Date(),
          requestId: this.getRequestId(),
        });
      }

      throw new BadRequestException(errorResponse);
    }

    // ---- 7. If strict mode, ensure no unknown properties ----
    if (this.options.strict) {
      // If object has extra properties not in the DTO, reject (even if whitelist is on)
      // We check by comparing keys
      const dtoKeys = Object.keys(metatype.prototype?.properties || {});
      const inputKeys = Object.keys(value);
      const unknownKeys = inputKeys.filter(
        (key) => !dtoKeys.includes(key) && !key.startsWith("_"),
      );
      if (unknownKeys.length > 0) {
        const errorResponse = {
          statusCode: 400,
          error: "Unknown Properties",
          message: `Unknown properties are not allowed: ${unknownKeys.join(", ")}`,
          timestamp: new Date().toISOString(),
          details: unknownKeys.map((key) => ({
            field: key,
            message: "Unknown property",
          })),
        };
        throw new BadRequestException(errorResponse);
      }
    }

    // ---- 8. Return validated object ----
    return object;
  }

  // ---------------------- HELPER: TO VALIDATE? ----------------------
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  // ---------------------- HELPER: ESTIMATE PAYLOAD SIZE ----------------------
  private estimateSize(value: any): number {
    try {
      const str = JSON.stringify(value);
      return str ? str.length : 0;
    } catch (_) {
      // If serialization fails, return a safe large number to avoid false positives
      return 0;
    }
  }

  // ---------------------- HELPER: LOG VALIDATION ERRORS ----------------------
  private logValidationErrors(
    errors: ClassValidatorError[],
    metadata: ArgumentMetadata,
    originalValue: any,
  ): void {
    const requestId = this.getRequestId();
    const method = metadata.type || "unknown";
    const data = metadata.data || "unknown";
    const summary = ValidationErrorFormatter.getSummary(errors);
    const fieldMap = ValidationErrorFormatter.getFieldErrorMap(errors);

    this.logger.warn(
      `[${requestId}] Validation failed for ${method} (${data}) | Summary: ${summary}`,
    );
    if (this.isDevelopment) {
      this.logger.debug(
        `[${requestId}] Field errors: ${JSON.stringify(fieldMap)}`,
      );
      this.logger.debug(
        `[${requestId}] Original input: ${JSON.stringify(originalValue).substring(0, 500)}`,
      );
    }
  }

  // ---------------------- HELPER: BUILD ERROR RESPONSE ----------------------
  private buildErrorResponse(
    errors: ClassValidatorError[],
    metadata: ArgumentMetadata,
  ): ValidationErrorResponse {
    const requestId = this.getRequestId();
    const now = new Date().toISOString();

    // Build basic response
    const response: ValidationErrorResponse = {
      statusCode: 400,
      error: "Validation Error",
      message: this.options.errorMessagePrefix,
      timestamp: now,
      requestId,
      path: metadata.type || undefined,
    };

    // Add detailed errors if enabled
    if (this.options.detailedErrors) {
      const details = ValidationErrorFormatter.formatErrors(errors);
      response.details = details;
      // Also provide a combined message
      const messages = ValidationErrorFormatter.getFlattenedMessages(errors);
      response.message =
        messages.length > 0
          ? messages.join("; ")
          : this.options.errorMessagePrefix;
    } else {
      // Simplified: just a summary message
      const summary = ValidationErrorFormatter.getSummary(errors);
      response.message = `${this.options.errorMessagePrefix}: ${summary}`;
    }

    return response;
  }

  // ---------------------- HELPER: GET REQUEST ID ----------------------
  private getRequestId(): string {
    try {
      // Try to get from AsyncLocalStorage (RequestIdMiddleware)
      const storage = require("async_hooks").AsyncLocalStorage;
      const store = storage?.getStore?.();
      if (store && store.requestId) {
        return store.requestId;
      }
    } catch (_) {
      // ignore
    }
    return "unknown";
  }

  // ---------------------- PUBLIC API: CONFIGURATION MANAGEMENT ----------------------
  /**
   * Update pipe options at runtime.
   */
  updateOptions(options: Partial<ValidationPipeOptions>): void {
    Object.assign(this.options, options);
    this.logger.log("Validation Pipe options updated:", this.options);
  }

  /**
   * Get current options.
   */
  getOptions(): Required<ValidationPipeOptions> {
    return { ...this.options };
  }

  /**
   * Add a validation group to the active groups.
   */
  addGroup(group: string): void {
    if (!this.options.groups.includes(group)) {
      this.options.groups.push(group);
    }
  }

  /**
   * Remove a validation group.
   */
  removeGroup(group: string): void {
    this.options.groups = this.options.groups.filter((g) => g !== group);
  }

  /**
   * Set active validation groups.
   */
  setGroups(groups: string[]): void {
    this.options.groups = groups;
  }

  /**
   * Skip validation for a specific method.
   */
  skipMethod(methodName: string): void {
    if (!this.options.skipMethods.includes(methodName)) {
      this.options.skipMethods.push(methodName);
    }
  }

  /**
   * Unskip a method.
   */
  unskipMethod(methodName: string): void {
    this.options.skipMethods = this.options.skipMethods.filter(
      (m) => m !== methodName,
    );
  }

  // ---------------------- STATIC HELPER: VALIDATE OBJECT MANUALLY ----------------------
  /**
   * Validate an object manually outside of the NestJS pipeline.
   * Useful for services that need to validate data.
   */
  static async validateObject<T extends object>(
    object: T,
    options?: Partial<ValidationPipeOptions>,
  ): Promise<T> {
    const defaultOpts: Required<ValidationPipeOptions> = {
      ...DEFAULT_OPTIONS,
      ...(options || {}),
    };

    // Transform to class instance if needed
    let instance = object;
    if (defaultOpts.transform && object.constructor !== Object) {
      // Already a class instance
    }

    // If not a class instance, we cannot easily validate
    if (object.constructor === Object) {
      // We need the class type to validate against.
      // This method requires the class type as a parameter, so we handle it separately.
      throw new Error(
        "validateObject requires a class instance, not a plain object.",
      );
    }

    const errors = await validate(object, {
      whitelist: defaultOpts.whitelist,
      forbidNonWhitelisted: defaultOpts.forbidNonWhitelisted,
      groups: defaultOpts.groups,
      dismissDefaultMessages: defaultOpts.dismissDefaultMessages,
    });

    if (errors.length > 0) {
      const details = ValidationErrorFormatter.formatErrors(errors);
      const messages = ValidationErrorFormatter.getFlattenedMessages(errors);
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: messages.join("; "),
        details,
      });
    }

    return object;
  }

  /**
   * Validate a plain object against a DTO class.
   */
  static async validatePlain<T extends object>(
    plainObject: any,
    ClassType: new (...args: any[]) => T,
    options?: Partial<ValidationPipeOptions>,
  ): Promise<T> {
    const defaultOpts: Required<ValidationPipeOptions> = {
      ...DEFAULT_OPTIONS,
      ...(options || {}),
    };

    // Transform to class instance
    const instance = plainToClass(ClassType, plainObject, {
      enableImplicitConversion: true,
      excludeExtraneousValues: defaultOpts.whitelist,
    });

    const errors = await validate(instance, {
      whitelist: defaultOpts.whitelist,
      forbidNonWhitelisted: defaultOpts.forbidNonWhitelisted,
      groups: defaultOpts.groups,
      dismissDefaultMessages: defaultOpts.dismissDefaultMessages,
    });

    if (errors.length > 0) {
      const details = ValidationErrorFormatter.formatErrors(errors);
      const messages = ValidationErrorFormatter.getFlattenedMessages(errors);
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: messages.join("; "),
        details,
      });
    }

    return instance;
  }

  // ---------------------- STATIC HELPER: CREATE CUSTOM VALIDATOR ----------------------
  /**
   * Create a custom validation function for a specific DTO.
   */
  static createValidator<T extends object>(
    ClassType: new (...args: any[]) => T,
    options?: Partial<ValidationPipeOptions>,
  ): (data: any) => Promise<T> {
    return async (data: any): Promise<T> => {
      return this.validatePlain(data, ClassType, options);
    };
  }

  // ---------------------- END ----------------------
}
