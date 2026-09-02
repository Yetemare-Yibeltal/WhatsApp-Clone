// backend/src/common/pipes/parse-int.pipe.ts
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
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { isUUID } from "class-validator";

// -------- INTERFACES --------
export interface ParseIntOptions {
  /**
   * Default value when parsing fails (if optional is true).
   */
  defaultValue?: number;

  /**
   * Minimum allowed value (inclusive).
   */
  min?: number;

  /**
   * Maximum allowed value (inclusive).
   */
  max?: number;

  /**
   * If true, returns undefined when value is missing.
   * @default false
   */
  optional?: boolean;

  /**
   * If true, returns null when value is missing.
   * @default false
   */
  nullable?: boolean;

  /**
   * Custom error message.
   */
  errorMessage?: string;

  /**
   * Allow negative numbers.
   * @default true
   */
  allowNegative?: boolean;

  /**
   * Allow zero.
   * @default true
   */
  allowZero?: boolean;

  /**
   * The base to parse the integer (2-36).
   * @default 10
   */
  radix?: number;

  /**
   * Log validation failures.
   * @default true
   */
  logErrors?: boolean;

  /**
   * Custom field name for error messages.
   */
  fieldName?: string;

  /**
   * If true, validates that the value is a valid UUID (instead of integer).
   * @default false
   */
  isUuid?: boolean;

  /**
   * UUID version to validate against (1-5).
   */
  uuidVersion?: 1 | 2 | 3 | 4 | 5;
}

export interface ParseIntOptionsWithArray extends ParseIntOptions {
  /**
   * If true, handles comma-separated list of IDs.
   * @default false
   */
  array?: boolean;

  /**
   * Max number of items in the array.
   */
  maxItems?: number;

  /**
   * Min number of items in the array.
   */
  minItems?: number;
}

export type ParseIntPipeOptions = ParseIntOptions | ParseIntOptionsWithArray;

export interface ParsedIntResult {
  value: number | null | undefined;
  valid: boolean;
  originalValue: any;
  reason?: string;
  field?: string;
}

// -------- DEFAULT OPTIONS --------
const DEFAULT_OPTIONS: Required<ParseIntOptions> = {
  defaultValue: undefined as any,
  min: -Infinity,
  max: Infinity,
  optional: false,
  nullable: false,
  errorMessage: "Invalid ID format. Expected a valid integer.",
  allowNegative: true,
  allowZero: true,
  radix: 10,
  logErrors: true,
  fieldName: "id",
  isUuid: false,
  uuidVersion: 4,
};

// -------- MAIN PIPE --------
@Injectable()
export class ParseIntPipe implements PipeTransform<
  string | string[],
  number | number[] | null | undefined
> {
  private readonly logger = new Logger(ParseIntPipe.name);
  private readonly options: Required<ParseIntOptions> & {
    array?: boolean;
    maxItems?: number;
    minItems?: number;
  };
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

    // Load from environment
    const envConfig =
      this.configService.get<Partial<ParseIntOptions>>("parseInt") || {};

    this.options = {
      ...DEFAULT_OPTIONS,
      ...envConfig,
      array: (envConfig as any).array || false,
      maxItems: (envConfig as any).maxItems || 100,
      minItems: (envConfig as any).minItems || 0,
    };

    this.logger.log("ParseInt Pipe initialized with options:", this.options);
  }

  // ---------------------- TRANSFORM ----------------------
  async transform(
    value: any,
    metadata: ArgumentMetadata,
  ): Promise<number | number[] | null | undefined> {
    const fieldName = this.options.fieldName || metadata.data || "value";

    // ---- 1. Check if value is missing ----
    if (value === undefined || value === null) {
      return this.handleMissingValue(fieldName, metadata);
    }

    // ---- 2. Handle array of values ----
    if (this.options.array) {
      return this.transformArray(value, fieldName, metadata);
    }

    // ---- 3. Handle single value ----
    return this.transformSingle(value, fieldName, metadata);
  }

  // ---------------------- TRANSFORM SINGLE VALUE ----------------------
  private transformSingle(
    value: any,
    fieldName: string,
    metadata: ArgumentMetadata,
  ): Promise<number | null | undefined> {
    // ---- 1. Handle string input ----
    let stringValue: string;
    if (typeof value === "number") {
      stringValue = String(value);
    } else if (typeof value === "string") {
      stringValue = value.trim();
    } else {
      return this.handleInvalidValue(
        value,
        fieldName,
        metadata,
        "Value must be a string or number",
      );
    }

    // ---- 2. Check for empty string ----
    if (stringValue === "") {
      return this.handleMissingValue(fieldName, metadata);
    }

    // ---- 3. Check if UUID validation is enabled ----
    if (this.options.isUuid) {
      return this.transformUuid(stringValue, fieldName, metadata);
    }

    // ---- 4. Parse integer ----
    const parsed = this.parseIntValue(stringValue, fieldName, metadata);
    return parsed;
  }

  // ---------------------- TRANSFORM UUID ----------------------
  private transformUuid(
    value: string,
    fieldName: string,
    metadata: ArgumentMetadata,
  ): Promise<number | null | undefined> {
    const version = this.options.uuidVersion || 4;

    if (!isUUID(value, version)) {
      const errorMsg =
        this.options.errorMessage || `Expected a valid UUID v${version}`;
      this.logParsingError(
        value,
        fieldName,
        metadata,
        "UUID validation failed",
      );
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: errorMsg,
        field: fieldName,
        value: value,
        expected: "UUID",
      });
    }

    // For UUID, we return the string as a number? No, we return the string.
    // But this pipe is for integers. So we should just validate and return the string.
    // However, the type signature expects number. So we'll convert to a number if possible,
    // or we'll throw an error. Better: we should have a separate UUID pipe.
    // For ParseIntPipe, we'll treat UUID as invalid for integers.
    // Actually, we'll override: if isUuid is true, we return the string as is (but type is number)
    // This is a design decision: we'll keep it as a string and let the type be number | string.
    // Since TypeScript requires consistency, we'll return the string but cast.
    // In a real application, you'd have a separate UUIDPipe.
    // For this implementation, we'll still require it to be a valid UUID.
    // We'll return the string as a "number" via BigInt? No, we'll return as string.
    // But the signature expects number. So we'll modify the return type to string.
    // To keep it simple, we'll throw an error and recommend using a UUID pipe.
    if (this.options.isUuid) {
      // We'll return the string but the type says number. We'll handle with a generic.
      this.logger.warn(
        `UUID validation requested but ParseIntPipe expects numbers. ` +
          `Value "${value}" will be treated as a string. Consider using a separate UUID pipe.`,
      );
      // We'll return as a number (using the numeric part) or throw.
      // We'll throw to avoid confusion.
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message:
          "This pipe does not support UUIDs. Please use a UUIDPipe instead.",
        field: fieldName,
        value: value,
      });
    }

    return value as any;
  }

  // ---------------------- TRANSFORM ARRAY ----------------------
  private transformArray(
    value: any,
    fieldName: string,
    metadata: ArgumentMetadata,
  ): Promise<number[] | null | undefined> {
    // ---- 1. Parse array from different formats ----
    let items: string[] = [];

    if (Array.isArray(value)) {
      items = value.map((v) => String(v).trim());
    } else if (typeof value === "string") {
      // Check if it's a comma-separated list
      if (value.includes(",")) {
        items = value.split(",").map((v) => v.trim());
      } else if (value.includes("&")) {
        items = value.split("&").map((v) => v.trim());
      } else {
        // Single value
        if (value === "") {
          return this.handleMissingValue(fieldName, metadata);
        }
        items = [value.trim()];
      }
    } else if (typeof value === "number") {
      items = [String(value)];
    } else {
      return this.handleInvalidValue(
        value,
        fieldName,
        metadata,
        "Expected array, string, or number",
      );
    }

    // ---- 2. Filter out empty values ----
    items = items.filter((v) => v !== "");

    // ---- 3. Check min/max items ----
    if (this.options.minItems && items.length < this.options.minItems) {
      const errorMsg = `Expected at least ${this.options.minItems} item(s)`;
      this.logParsingError(items, fieldName, metadata, errorMsg);
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: errorMsg,
        field: fieldName,
        value: items,
        minItems: this.options.minItems,
      });
    }

    if (this.options.maxItems && items.length > this.options.maxItems) {
      const errorMsg = `Expected at most ${this.options.maxItems} item(s)`;
      this.logParsingError(items, fieldName, metadata, errorMsg);
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: errorMsg,
        field: fieldName,
        value: items,
        maxItems: this.options.maxItems,
      });
    }

    // ---- 4. Parse each item ----
    const results: number[] = [];
    const errors: { index: number; value: string; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const parsed = this.parseIntValue(
          items[i],
          `${fieldName}[${i}]`,
          metadata,
        );
        if (parsed !== null && parsed !== undefined) {
          results.push(parsed);
        }
      } catch (error) {
        errors.push({
          index: i,
          value: items[i],
          error: error.message,
        });
      }
    }

    // ---- 5. Handle validation errors ----
    if (errors.length > 0) {
      const errorMsg = `Invalid values at indices: ${errors.map((e) => e.index).join(", ")}`;
      this.logParsingError(items, fieldName, metadata, errorMsg);
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: errorMsg,
        field: fieldName,
        value: items,
        errors: errors,
      });
    }

    // ---- 6. Return array ----
    return results;
  }

  // ---------------------- PARSE INTEGER VALUE ----------------------
  private parseIntValue(
    value: string,
    fieldName: string,
    metadata: ArgumentMetadata,
  ): number | null | undefined {
    // ---- 1. Check for empty string ----
    if (value === "") {
      return this.handleMissingValue(fieldName, metadata);
    }

    // ---- 2. Parse the integer ----
    const radix = this.options.radix || 10;
    const parsed = parseInt(value, radix);

    // ---- 3. Check for NaN ----
    if (isNaN(parsed)) {
      this.logParsingError(value, fieldName, metadata, "NaN");
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message:
          this.options.errorMessage || `'${value}' is not a valid integer`,
        field: fieldName,
        value: value,
      });
    }

    // ---- 4. Check for float (non-integer) ----
    const floatParsed = parseFloat(value);
    if (floatParsed !== parsed) {
      this.logParsingError(value, fieldName, metadata, "Non-integer value");
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: this.options.errorMessage || `'${value}' must be an integer`,
        field: fieldName,
        value: value,
      });
    }

    // ---- 5. Check for allowed zero ----
    if (!this.options.allowZero && parsed === 0) {
      this.logParsingError(value, fieldName, metadata, "Zero not allowed");
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message: this.options.errorMessage || "Zero is not allowed",
        field: fieldName,
        value: value,
      });
    }

    // ---- 6. Check for negative ----
    if (!this.options.allowNegative && parsed < 0) {
      this.logParsingError(value, fieldName, metadata, "Negative not allowed");
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message:
          this.options.errorMessage || "Negative numbers are not allowed",
        field: fieldName,
        value: value,
      });
    }

    // ---- 7. Check min/max ----
    if (parsed < this.options.min!) {
      this.logParsingError(value, fieldName, metadata, "Below minimum");
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message:
          this.options.errorMessage ||
          `Value must be at least ${this.options.min}`,
        field: fieldName,
        value: value,
        min: this.options.min,
      });
    }

    if (parsed > this.options.max!) {
      this.logParsingError(value, fieldName, metadata, "Above maximum");
      throw new BadRequestException({
        statusCode: 400,
        error: "Validation Error",
        message:
          this.options.errorMessage ||
          `Value must be at most ${this.options.max}`,
        field: fieldName,
        value: value,
        max: this.options.max,
      });
    }

    // ---- 8. Return parsed value ----
    return parsed;
  }

  // ---------------------- HANDLE MISSING VALUE ----------------------
  private handleMissingValue(
    fieldName: string,
    metadata: ArgumentMetadata,
  ): number | null | undefined {
    if (this.options.nullable) {
      return null;
    }
    if (this.options.optional) {
      return undefined;
    }
    if (this.options.defaultValue !== undefined) {
      return this.options.defaultValue;
    }

    const errorMsg = this.options.errorMessage || `'${fieldName}' is required`;
    this.logParsingError(undefined, fieldName, metadata, "Missing value");
    throw new BadRequestException({
      statusCode: 400,
      error: "Validation Error",
      message: errorMsg,
      field: fieldName,
      value: undefined,
    });
  }

  // ---------------------- HANDLE INVALID VALUE ----------------------
  private handleInvalidValue(
    value: any,
    fieldName: string,
    metadata: ArgumentMetadata,
    reason: string,
  ): never {
    const errorMsg =
      this.options.errorMessage || `Invalid value for '${fieldName}'`;
    this.logParsingError(value, fieldName, metadata, reason);
    throw new BadRequestException({
      statusCode: 400,
      error: "Validation Error",
      message: errorMsg,
      field: fieldName,
      value: value,
      reason: reason,
    });
  }

  // ---------------------- LOGGING ----------------------
  private logParsingError(
    value: any,
    fieldName: string,
    metadata: ArgumentMetadata,
    reason: string,
  ): void {
    if (!this.options.logErrors) return;

    const requestId = this.getRequestId();
    const method = metadata.type || "unknown";
    const data = metadata.data || fieldName;

    this.logger.warn(
      `[${requestId}] ParseInt failed | Field: ${fieldName} | Method: ${method} | ` +
        `Value: ${JSON.stringify(value)} | Reason: ${reason}`,
    );

    if (this.isDevelopment) {
      this.logger.debug(
        `[${requestId}] Full metadata: ${JSON.stringify(metadata)}`,
      );
    }

    // Emit event for monitoring
    if (this.eventEmitter) {
      this.eventEmitter.emit("parseint.failed", {
        requestId,
        field: fieldName,
        value,
        reason,
        method,
        data,
        timestamp: new Date(),
      });
    }
  }

  // ---------------------- HELPER: GET REQUEST ID ----------------------
  private getRequestId(): string {
    try {
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
  updateOptions(options: Partial<ParseIntPipeOptions>): void {
    Object.assign(this.options, options);
    this.logger.log("ParseInt Pipe options updated:", this.options);
  }

  /**
   * Get current options.
   */
  getOptions(): ParseIntPipeOptions {
    return { ...this.options };
  }

  /**
   * Set the field name for error messages.
   */
  setFieldName(name: string): void {
    this.options.fieldName = name;
  }

  /**
   * Enable or disable array mode.
   */
  setArrayMode(enabled: boolean): void {
    this.options.array = enabled;
  }

  /**
   * Set min/max values.
   */
  setRange(min?: number, max?: number): void {
    if (min !== undefined) this.options.min = min;
    if (max !== undefined) this.options.max = max;
  }

  // ---------------------- STATIC HELPERS ----------------------
  /**
   * Parse an integer safely without throwing exceptions.
   */
  static safeParseInt(
    value: any,
    options: Partial<ParseIntOptions> = {},
  ): ParsedIntResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (value === undefined || value === null) {
      return {
        value: opts.nullable
          ? null
          : opts.optional
            ? undefined
            : opts.defaultValue,
        valid:
          opts.optional || opts.nullable || opts.defaultValue !== undefined,
        originalValue: value,
        reason:
          opts.optional || opts.nullable
            ? "Value is missing (allowed)"
            : "Value is missing",
      };
    }

    const stringValue = String(value).trim();
    if (stringValue === "") {
      return {
        value: opts.nullable
          ? null
          : opts.optional
            ? undefined
            : opts.defaultValue,
        valid:
          opts.optional || opts.nullable || opts.defaultValue !== undefined,
        originalValue: value,
        reason: "Empty string",
      };
    }

    const radix = opts.radix || 10;
    const parsed = parseInt(stringValue, radix);

    if (isNaN(parsed)) {
      return {
        value: opts.defaultValue,
        valid: false,
        originalValue: value,
        reason: "NaN",
      };
    }

    const floatParsed = parseFloat(stringValue);
    if (floatParsed !== parsed) {
      return {
        value: opts.defaultValue,
        valid: false,
        originalValue: value,
        reason: "Non-integer",
      };
    }

    if (!opts.allowZero && parsed === 0) {
      return {
        value: opts.defaultValue,
        valid: false,
        originalValue: value,
        reason: "Zero not allowed",
      };
    }

    if (!opts.allowNegative && parsed < 0) {
      return {
        value: opts.defaultValue,
        valid: false,
        originalValue: value,
        reason: "Negative not allowed",
      };
    }

    if (parsed < opts.min!) {
      return {
        value: opts.defaultValue,
        valid: false,
        originalValue: value,
        reason: `Below minimum (${opts.min})`,
      };
    }

    if (parsed > opts.max!) {
      return {
        value: opts.defaultValue,
        valid: false,
        originalValue: value,
        reason: `Above maximum (${opts.max})`,
      };
    }

    return {
      value: parsed,
      valid: true,
      originalValue: value,
      reason: "Success",
    };
  }

  /**
   * Parse an array of integers safely.
   */
  static safeParseIntArray(
    value: any,
    options: Partial<ParseIntOptionsWithArray> = {},
  ): {
    values: number[];
    errors: { index: number; value: any; reason: string }[];
  } {
    const opts = { ...DEFAULT_OPTIONS, ...options, array: true };

    let items: string[] = [];

    if (Array.isArray(value)) {
      items = value.map((v) => String(v).trim());
    } else if (typeof value === "string") {
      if (value.includes(",")) {
        items = value.split(",").map((v) => v.trim());
      } else if (value.includes("&")) {
        items = value.split("&").map((v) => v.trim());
      } else {
        items = value === "" ? [] : [value.trim()];
      }
    } else if (typeof value === "number") {
      items = [String(value)];
    } else {
      return {
        values: [],
        errors: [{ index: 0, value, reason: "Invalid input format" }],
      };
    }

    items = items.filter((v) => v !== "");

    const values: number[] = [];
    const errors: { index: number; value: any; reason: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = this.safeParseInt(items[i], opts);
      if (result.valid && result.value !== undefined && result.value !== null) {
        values.push(result.value);
      } else {
        errors.push({
          index: i,
          value: items[i],
          reason: result.reason || "Invalid",
        });
      }
    }

    return { values, errors };
  }

  // ---------------------- END ----------------------
}
