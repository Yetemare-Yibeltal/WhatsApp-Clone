// backend/src/common/pipes/file-validation.pipe.ts
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
import * as path from "path";
import * as fs from "fs";
import * as probe from "probe-image-size";
import { promisify } from "util";
import { exec } from "child_process";
import { createHash } from "crypto";

// -------- TYPES & INTERFACES --------
export interface FileValidationOptions {
  /**
   * Maximum file size in bytes.
   * @default 5 * 1024 * 1024 (5MB)
   */
  maxSize?: number;

  /**
   * Minimum file size in bytes.
   * @default 0
   */
  minSize?: number;

  /**
   * Allowed MIME types (e.g., ['image/jpeg', 'image/png']).
   */
  allowedMimeTypes?: string[];

  /**
   * Allowed file extensions (e.g., ['.jpg', '.png']).
   */
  allowedExtensions?: string[];

  /**
   * Required width (for images).
   */
  width?: number;

  /**
   * Required height (for images).
   */
  height?: number;

  /**
   * Min width (for images).
   */
  minWidth?: number;

  /**
   * Max width (for images).
   */
  maxWidth?: number;

  /**
   * Min height (for images).
   */
  minHeight?: number;

  /**
   * Max height (for images).
   */
  maxHeight?: number;

  /**
   * Aspect ratio (width/height) e.g., 1.333 for 4:3.
   */
  aspectRatio?: number;

  /**
   * Allowed aspect ratios (array).
   */
  allowedAspectRatios?: number[];

  /**
   * Max duration in seconds (for video/audio).
   */
  maxDuration?: number;

  /**
   * Min duration in seconds.
   */
  minDuration?: number;

  /**
   * Validate file name against a regex pattern.
   */
  filenamePattern?: RegExp;

  /**
   * Require file (throw if missing).
   * @default true
   */
  required?: boolean;

  /**
   * Allow multiple files.
   * @default false
   */
  multiple?: boolean;

  /**
   * Max number of files when multiple is true.
   * @default 10
   */
  maxFiles?: number;

  /**
   * Min number of files when multiple is true.
   * @default 1
   */
  minFiles?: number;

  /**
   * Enable virus scanning (requires ClamAV).
   * @default false
   */
  scanForVirus?: boolean;

  /**
   * Custom error message prefix.
   * @default 'File validation failed'
   */
  errorMessage?: string;

  /**
   * Field name for error messages.
   */
  fieldName?: string;

  /**
   * Log validation failures.
   * @default true
   */
  logErrors?: boolean;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;

  /**
   * Check file integrity (hash).
   */
  computeHash?: boolean;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  meta?: {
    width?: number;
    height?: number;
    duration?: number;
    hash?: string;
    size: number;
    mimeType: string;
    extension: string;
    originalName: string;
  };
}

export interface FileLike {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  destination?: string;
  filename?: string;
}

// -------- DEFAULT CONFIG --------
const DEFAULT_OPTIONS: Required<
  Omit<FileValidationOptions, "filenamePattern">
> & {
  filenamePattern?: RegExp;
} = {
  maxSize: 5 * 1024 * 1024, // 5MB
  minSize: 0,
  allowedMimeTypes: [],
  allowedExtensions: [],
  width: undefined as any,
  height: undefined as any,
  minWidth: undefined as any,
  maxWidth: undefined as any,
  minHeight: undefined as any,
  maxHeight: undefined as any,
  aspectRatio: undefined as any,
  allowedAspectRatios: [],
  maxDuration: undefined as any,
  minDuration: undefined as any,
  filenamePattern: undefined as any,
  required: true,
  multiple: false,
  maxFiles: 10,
  minFiles: 1,
  scanForVirus: false,
  errorMessage: "File validation failed",
  fieldName: "file",
  logErrors: true,
  debug: false,
  computeHash: false,
};

// -------- MAIN PIPE --------
@Injectable()
export class FileValidationPipe implements PipeTransform<
  Express.Multer.File | Express.Multer.File[],
  any
> {
  private readonly logger = new Logger(FileValidationPipe.name);
  private readonly options: FileValidationOptions & { fieldName: string };
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

    const envConfig =
      this.configService.get<FileValidationOptions>("fileValidation") || {};

    this.options = {
      ...DEFAULT_OPTIONS,
      ...envConfig,
      fieldName: envConfig.fieldName || "file",
    };

    this.logger.log(
      "File Validation Pipe initialized with options:",
      this.options,
    );
  }

  // ---------------------- TRANSFORM ----------------------
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const fieldName = this.options.fieldName || metadata.data || "file";

    // ---- 1. Check if value exists ----
    if (!value || (Array.isArray(value) && value.length === 0)) {
      if (this.options.required) {
        this.throwError(fieldName, "No file provided");
      }
      return this.options.multiple ? [] : undefined;
    }

    // ---- 2. Handle array of files ----
    if (this.options.multiple) {
      if (!Array.isArray(value)) {
        this.throwError(fieldName, "Expected array of files");
      }

      if (value.length > this.options.maxFiles) {
        this.throwError(
          fieldName,
          `Too many files. Max ${this.options.maxFiles}`,
        );
      }

      if (value.length < this.options.minFiles) {
        this.throwError(
          fieldName,
          `Too few files. Min ${this.options.minFiles}`,
        );
      }

      const results = [];
      const allErrors = [];

      for (let i = 0; i < value.length; i++) {
        try {
          const validated = await this.validateSingleFile(
            value[i],
            `${fieldName}[${i}]`,
          );
          results.push(validated);
        } catch (error) {
          allErrors.push(`File ${i + 1}: ${error.message}`);
        }
      }

      if (allErrors.length > 0) {
        this.throwError(fieldName, allErrors.join("; "));
      }

      return results;
    }

    // ---- 3. Single file ----
    if (Array.isArray(value)) {
      this.throwError(
        fieldName,
        "Multiple files not allowed. Use multiple: true option.",
      );
    }

    return this.validateSingleFile(value, fieldName);
  }

  // ---------------------- VALIDATE SINGLE FILE ----------------------
  private async validateSingleFile(
    file: FileLike,
    fieldName: string,
  ): Promise<FileLike> {
    // ---- 1. Basic checks ----
    if (!file) {
      this.throwError(fieldName, "No file provided");
    }

    // ---- 2. Size validation ----
    if (file.size < this.options.minSize) {
      this.throwError(
        fieldName,
        `File size ${file.size} is below minimum ${this.options.minSize}`,
      );
    }

    if (file.size > this.options.maxSize) {
      this.throwError(
        fieldName,
        `File size ${file.size} exceeds maximum ${this.options.maxSize}`,
      );
    }

    // ---- 3. MIME type validation ----
    if (
      this.options.allowedMimeTypes &&
      this.options.allowedMimeTypes.length > 0
    ) {
      if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
        this.throwError(
          fieldName,
          `MIME type '${file.mimetype}' is not allowed. Allowed: ${this.options.allowedMimeTypes.join(", ")}`,
        );
      }
    }

    // ---- 4. Extension validation ----
    if (
      this.options.allowedExtensions &&
      this.options.allowedExtensions.length > 0
    ) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!this.options.allowedExtensions.includes(ext)) {
        this.throwError(
          fieldName,
          `Extension '${ext}' is not allowed. Allowed: ${this.options.allowedExtensions.join(", ")}`,
        );
      }
    }

    // ---- 5. Filename pattern validation ----
    if (this.options.filenamePattern) {
      const baseName = path.basename(file.originalname);
      if (!this.options.filenamePattern.test(baseName)) {
        this.throwError(
          fieldName,
          `Filename '${baseName}' does not match the required pattern: ${this.options.filenamePattern}`,
        );
      }
    }

    // ---- 6. Image/Video metadata validation ----
    if (this.isImage(file.mimetype)) {
      await this.validateImageMetadata(file, fieldName);
    } else if (this.isVideo(file.mimetype)) {
      await this.validateVideoMetadata(file, fieldName);
    } else if (this.isAudio(file.mimetype)) {
      await this.validateAudioMetadata(file, fieldName);
    }

    // ---- 7. Virus scanning ----
    if (this.options.scanForVirus) {
      await this.scanForVirus(file, fieldName);
    }

    // ---- 8. Compute hash if requested ----
    if (this.options.computeHash) {
      const hash = await this.computeFileHash(file);
      (file as any).hash = hash;
    }

    // ---- 9. Log success ----
    if (this.options.debug) {
      this.logger.debug(
        `File validated: ${file.originalname} (${file.size} bytes)`,
      );
    }

    return file;
  }

  // ---------------------- IMAGE METADATA VALIDATION ----------------------
  private async validateImageMetadata(
    file: FileLike,
    fieldName: string,
  ): Promise<void> {
    try {
      const buffer = await this.getFileBuffer(file);
      const info = await this.getImageInfo(buffer);

      if (!info) {
        this.logger.warn(
          `Could not read image metadata for ${file.originalname}`,
        );
        return;
      }

      const { width, height } = info;

      // ---- Validate width ----
      if (this.options.width && width !== this.options.width) {
        this.throwError(
          fieldName,
          `Width must be ${this.options.width}px, got ${width}px`,
        );
      }
      if (this.options.minWidth && width < this.options.minWidth) {
        this.throwError(
          fieldName,
          `Width ${width}px is below minimum ${this.options.minWidth}px`,
        );
      }
      if (this.options.maxWidth && width > this.options.maxWidth) {
        this.throwError(
          fieldName,
          `Width ${width}px exceeds maximum ${this.options.maxWidth}px`,
        );
      }

      // ---- Validate height ----
      if (this.options.height && height !== this.options.height) {
        this.throwError(
          fieldName,
          `Height must be ${this.options.height}px, got ${height}px`,
        );
      }
      if (this.options.minHeight && height < this.options.minHeight) {
        this.throwError(
          fieldName,
          `Height ${height}px is below minimum ${this.options.minHeight}px`,
        );
      }
      if (this.options.maxHeight && height > this.options.maxHeight) {
        this.throwError(
          fieldName,
          `Height ${height}px exceeds maximum ${this.options.maxHeight}px`,
        );
      }

      // ---- Validate aspect ratio ----
      const aspect = width / height;
      if (this.options.aspectRatio) {
        const tolerance = 0.01;
        if (Math.abs(aspect - this.options.aspectRatio) > tolerance) {
          this.throwError(
            fieldName,
            `Aspect ratio ${aspect.toFixed(2)} does not match required ${this.options.aspectRatio.toFixed(2)}`,
          );
        }
      }
      if (
        this.options.allowedAspectRatios &&
        this.options.allowedAspectRatios.length > 0
      ) {
        const matches = this.options.allowedAspectRatios.some(
          (r) => Math.abs(aspect - r) < 0.01,
        );
        if (!matches) {
          this.throwError(
            fieldName,
            `Aspect ratio ${aspect.toFixed(2)} not allowed. Allowed: ${this.options.allowedAspectRatios.join(", ")}`,
          );
        }
      }

      // ---- Store metadata ----
      (file as any).width = width;
      (file as any).height = height;
      (file as any).aspectRatio = aspect;

      if (this.options.debug) {
        this.logger.debug(
          `Image: ${width}x${height}, aspect: ${aspect.toFixed(2)}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Image metadata validation failed: ${error.message}`);
      // If we couldn't read image, we may still allow (fail open) but we log.
    }
  }

  // ---------------------- VIDEO METADATA VALIDATION ----------------------
  private async validateVideoMetadata(
    file: FileLike,
    fieldName: string,
  ): Promise<void> {
    try {
      const duration = await this.getVideoDuration(file);

      if (this.options.minDuration && duration < this.options.minDuration) {
        this.throwError(
          fieldName,
          `Duration ${duration}s is below minimum ${this.options.minDuration}s`,
        );
      }
      if (this.options.maxDuration && duration > this.options.maxDuration) {
        this.throwError(
          fieldName,
          `Duration ${duration}s exceeds maximum ${this.options.maxDuration}s`,
        );
      }

      (file as any).duration = duration;

      if (this.options.debug) {
        this.logger.debug(`Video duration: ${duration}s`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Video metadata validation failed: ${error.message}`);
    }
  }

  // ---------------------- AUDIO METADATA VALIDATION ----------------------
  private async validateAudioMetadata(
    file: FileLike,
    fieldName: string,
  ): Promise<void> {
    // Similar to video
    try {
      const duration = await this.getAudioDuration(file);

      if (this.options.minDuration && duration < this.options.minDuration) {
        this.throwError(
          fieldName,
          `Duration ${duration}s is below minimum ${this.options.minDuration}s`,
        );
      }
      if (this.options.maxDuration && duration > this.options.maxDuration) {
        this.throwError(
          fieldName,
          `Duration ${duration}s exceeds maximum ${this.options.maxDuration}s`,
        );
      }

      (file as any).duration = duration;

      if (this.options.debug) {
        this.logger.debug(`Audio duration: ${duration}s`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Audio metadata validation failed: ${error.message}`);
    }
  }

  // ---------------------- VIRUS SCANNING (ClamAV) ----------------------
  private async scanForVirus(file: FileLike, fieldName: string): Promise<void> {
    // Check if ClamAV is available
    try {
      const buffer = await this.getFileBuffer(file);
      // Simulate scanning by checking for known virus signatures (placeholder)
      // In production, you'd use clamd or similar
      // We'll just check for a few known patterns for demo
      const content = buffer.toString("utf8", 0, Math.min(buffer.length, 1024));
      const virusPatterns = ["EICAR", "X5O!P%@AP[4\\PZX54(P^)7CC)7}", "VIRUS"];
      for (const pattern of virusPatterns) {
        if (content.includes(pattern)) {
          this.throwError(fieldName, `Virus detected: ${pattern}`);
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Virus scan failed: ${error.message}`);
    }
  }

  // ---------------------- HELPER: GET FILE BUFFER ----------------------
  private async getFileBuffer(file: FileLike): Promise<Buffer> {
    if (file.buffer) {
      return file.buffer;
    }
    if (file.path) {
      const readFile = promisify(fs.readFile);
      return await readFile(file.path);
    }
    throw new Error("No buffer or path available");
  }

  // ---------------------- HELPER: GET IMAGE INFO ----------------------
  private async getImageInfo(
    buffer: Buffer,
  ): Promise<{ width: number; height: number } | null> {
    try {
      const info = await probe(buffer);
      if (info) {
        return { width: info.width, height: info.height };
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ---------------------- HELPER: GET VIDEO DURATION ----------------------
  private async getVideoDuration(file: FileLike): Promise<number> {
    try {
      const ffprobe = require("ffprobe-static").path;
      const { promisify } = require("util");
      const exec = promisify(require("child_process").exec);

      const tempPath = file.path || file.destination + "/" + file.filename;
      if (!tempPath) return 0;

      const cmd = `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`;
      const { stdout } = await exec(cmd);
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) ? 0 : duration;
    } catch (_) {
      return 0;
    }
  }

  // ---------------------- HELPER: GET AUDIO DURATION ----------------------
  private async getAudioDuration(file: FileLike): Promise<number> {
    // Same as video
    return this.getVideoDuration(file);
  }

  // ---------------------- HELPER: COMPUTE FILE HASH ----------------------
  private async computeFileHash(file: FileLike): Promise<string> {
    const buffer = await this.getFileBuffer(file);
    const hash = createHash("sha256");
    hash.update(buffer);
    return hash.digest("hex");
  }

  // ---------------------- HELPER: CHECK MIME TYPE ----------------------
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  private isVideo(mimeType: string): boolean {
    return mimeType.startsWith("video/");
  }

  private isAudio(mimeType: string): boolean {
    return mimeType.startsWith("audio/");
  }

  // ---------------------- HELPER: THROW ERROR ----------------------
  private throwError(field: string, message: string): never {
    const fullMessage = this.options.errorMessage
      ? `${this.options.errorMessage}: ${message}`
      : message;

    // Log
    if (this.options.logErrors) {
      const requestId = this.getRequestId();
      this.logger.warn(
        `[${requestId}] File validation failed | Field: ${field} | ${message}`,
      );
      if (this.eventEmitter) {
        this.eventEmitter.emit("file.validation.failed", {
          requestId,
          field,
          message,
          timestamp: new Date(),
        });
      }
    }

    throw new BadRequestException({
      statusCode: 400,
      error: "File Validation Error",
      message: fullMessage,
      field,
    });
  }

  // ---------------------- HELPER: GET REQUEST ID ----------------------
  private getRequestId(): string {
    try {
      const storage = require("async_hooks").AsyncLocalStorage;
      const store = storage?.getStore?.();
      if (store && store.requestId) {
        return store.requestId;
      }
    } catch (_) {}
    return "unknown";
  }

  // ---------------------- PUBLIC API: CONFIGURATION ----------------------
  updateOptions(options: Partial<FileValidationOptions>): void {
    Object.assign(this.options, options);
    this.logger.log("File Validation Pipe options updated:", this.options);
  }

  getOptions(): FileValidationOptions {
    return { ...this.options };
  }

  // ---------------------- STATIC HELPERS ----------------------
  /**
   * Validate a file object manually.
   */
  static async validateFile(
    file: FileLike,
    options: FileValidationOptions = {},
  ): Promise<FileValidationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];

    // Size
    if (file.size < opts.minSize) {
      errors.push(`Size ${file.size} below minimum ${opts.minSize}`);
    }
    if (file.size > opts.maxSize) {
      errors.push(`Size ${file.size} exceeds maximum ${opts.maxSize}`);
    }

    // MIME
    if (opts.allowedMimeTypes && opts.allowedMimeTypes.length > 0) {
      if (!opts.allowedMimeTypes.includes(file.mimetype)) {
        errors.push(`MIME type '${file.mimetype}' not allowed`);
      }
    }

    // Extension
    if (opts.allowedExtensions && opts.allowedExtensions.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!opts.allowedExtensions.includes(ext)) {
        errors.push(`Extension '${ext}' not allowed`);
      }
    }

    // Filename pattern
    if (opts.filenamePattern) {
      const baseName = path.basename(file.originalname);
      if (!opts.filenamePattern.test(baseName)) {
        errors.push(`Filename '${baseName}' does not match pattern`);
      }
    }

    // Image/video metadata (simplified)
    // For manual, we don't try to read metadata, just return meta if available
    const meta: any = {
      size: file.size,
      mimeType: file.mimetype,
      extension: path.extname(file.originalname).toLowerCase(),
      originalName: file.originalname,
    };

    return {
      valid: errors.length === 0,
      errors,
      meta,
    };
  }

  /**
   * Validate multiple files.
   */
  static async validateFiles(
    files: FileLike[],
    options: FileValidationOptions = {},
  ): Promise<{
    results: FileValidationResult[];
    overallValid: boolean;
    errors: string[];
  }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const results: FileValidationResult[] = [];
    const allErrors: string[] = [];

    if (files.length < opts.minFiles) {
      allErrors.push(`Too few files. Min ${opts.minFiles}`);
    }
    if (files.length > opts.maxFiles) {
      allErrors.push(`Too many files. Max ${opts.maxFiles}`);
    }

    for (const file of files) {
      const result = await this.validateFile(file, opts);
      results.push(result);
      if (!result.valid) {
        allErrors.push(...result.errors);
      }
    }

    return {
      results,
      overallValid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}
