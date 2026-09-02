// backend/src/modules/users/dto/update-status.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDate,
  IsEnum,
  IsObject,
  IsArray,
  IsNumber,
  IsInt,
  IsPositive,
  MaxLength,
  MinLength,
  ValidateIf,
  IsIn,
  ValidateNested,
  IsNotEmpty,
  IsHexColor,
  IsUrl,
  IsUUID,
  IsDateString,
  IsMongoId,
} from "class-validator";
import {
  Transform,
  Type,
  Expose,
  Exclude,
  plainToClass,
} from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// -------- ENUMS --------

export enum UserStatusType {
  ONLINE = "online",
  OFFLINE = "offline",
  AWAY = "away",
  BUSY = "busy",
  CUSTOM = "custom",
  DO_NOT_DISTURB = "do_not_disturb",
  IN_A_MEETING = "in_a_meeting",
  ON_VACATION = "on_vacation",
  WORKING = "working",
  BREAK = "break",
  SLEEPING = "sleeping",
  INVISIBLE = "invisible",
}

export enum StatusVisibility {
  PUBLIC = "public",
  CONTACTS = "contacts",
  PRIVATE = "private",
  CUSTOM = "custom", // specific users or groups
}

export enum StatusCategory {
  WORK = "work",
  PERSONAL = "personal",
  HEALTH = "health",
  TRAVEL = "travel",
  LEISURE = "leisure",
  PRODUCTIVITY = "productivity",
  SOCIAL = "social",
  OTHER = "other",
}

export enum StatusExpiryAction {
  NONE = "none",
  CLEAR = "clear",
  REVERT = "revert",
  REPLACE = "replace",
}

// -------- NESTED DTOs --------

/**
 * Status visibility settings.
 */
export class StatusVisibilityDto {
  @ApiPropertyOptional({
    description: "Visibility level",
    enum: StatusVisibility,
    default: StatusVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(StatusVisibility)
  level?: StatusVisibility;

  @ApiPropertyOptional({
    description: "Specific user IDs for custom visibility",
    example: ["user_1", "user_2"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  userIds?: string[];

  @ApiPropertyOptional({
    description: "Specific group IDs for custom visibility",
    example: ["group_1", "group_2"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  groupIds?: string[];

  @ApiPropertyOptional({
    description: "Exclude these user IDs from visibility",
    example: ["user_3", "user_4"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  excludeUserIds?: string[];
}

/**
 * Status scheduling information.
 */
export class StatusScheduleDto {
  @ApiPropertyOptional({
    description: "Start time for the status (ISO 8601 datetime)",
    example: "2024-01-15T10:00:00Z",
  })
  @IsOptional()
  @IsDateString({}, { message: "Invalid start time format (use ISO 8601)" })
  startAt?: string;

  @ApiPropertyOptional({
    description: "End time for the status (ISO 8601 datetime)",
    example: "2024-01-15T12:00:00Z",
  })
  @IsOptional()
  @IsDateString({}, { message: "Invalid end time format (use ISO 8601)" })
  endAt?: string;

  @ApiPropertyOptional({
    description: "Action to take when the status expires",
    enum: StatusExpiryAction,
    default: StatusExpiryAction.CLEAR,
  })
  @IsOptional()
  @IsEnum(StatusExpiryAction)
  expiryAction?: StatusExpiryAction;

  @ApiPropertyOptional({
    description: "If expiryAction is REPLACE, the status to replace with",
  })
  @ValidateIf((o) => o.expiryAction === StatusExpiryAction.REPLACE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  replacementStatus?: string;

  @ApiPropertyOptional({
    description: "If expiryAction is REVERT, the previous status to revert to",
  })
  @ValidateIf((o) => o.expiryAction === StatusExpiryAction.REVERT)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  revertToStatus?: string;

  @ApiPropertyOptional({
    description: "Recurrence rule (RRULE) for recurring statuses",
    example: "FREQ=DAILY;INTERVAL=1",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recurrence?: string;

  @ApiPropertyOptional({
    description: "Use all-day scheduling",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}

/**
 * Status history entry (for response only).
 */
export class StatusHistoryEntryDto {
  @ApiProperty({ description: "History entry ID" })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({ description: "Status text" })
  @Expose()
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: "Status type" })
  @Expose()
  @IsOptional()
  @IsEnum(UserStatusType)
  type?: UserStatusType;

  @ApiPropertyOptional({ description: "Emoji" })
  @Expose()
  @IsOptional()
  @IsString()
  emoji?: string;

  @ApiProperty({ description: "Set at timestamp" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  setAt: Date;

  @ApiPropertyOptional({ description: "Expired at timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiredAt?: Date;

  @ApiPropertyOptional({ description: "Was this status active?" })
  @Expose()
  @IsOptional()
  @IsBoolean()
  wasActive?: boolean;
}

// -------- MAIN DTO --------

/**
 * DTO for updating a user's status message.
 */
export class UpdateStatusDto {
  // -------- STATUS CONTENT --------
  @ApiProperty({
    description: "Status text message",
    example: "Working on a new project",
    maxLength: 100,
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty({ message: "Status message is required" })
  @MinLength(1, { message: "Status cannot be empty" })
  @MaxLength(100, { message: "Status cannot exceed 100 characters" })
  @Transform(({ value }) => value?.trim() || "")
  status: string;

  // -------- STATUS TYPE --------
  @ApiPropertyOptional({
    description: "Status type",
    enum: UserStatusType,
    default: UserStatusType.CUSTOM,
  })
  @IsOptional()
  @IsEnum(UserStatusType, { message: "Invalid status type" })
  type?: UserStatusType;

  // -------- EMOJI --------
  @ApiPropertyOptional({
    description: "Emoji to display with the status",
    example: "🚀",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim() || null)
  emoji?: string | null;

  // -------- COLOR --------
  @ApiPropertyOptional({
    description: "Status color (hex code)",
    example: "#FF6B6B",
  })
  @IsOptional()
  @IsHexColor({ message: "Invalid hex color format" })
  @Transform(({ value }) => value?.trim() || null)
  color?: string | null;

  // -------- CATEGORY --------
  @ApiPropertyOptional({
    description: "Status category",
    enum: StatusCategory,
  })
  @IsOptional()
  @IsEnum(StatusCategory)
  category?: StatusCategory;

  // -------- EXPIRATION --------
  @ApiPropertyOptional({
    description: "Status expiration time (ISO 8601 datetime)",
    example: "2024-01-15T12:00:00Z",
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: "Invalid expiration date format (use ISO 8601)" },
  )
  expiresAt?: string;

  @ApiPropertyOptional({
    description: "Status expiry action",
    enum: StatusExpiryAction,
    default: StatusExpiryAction.CLEAR,
  })
  @IsOptional()
  @IsEnum(StatusExpiryAction)
  expiryAction?: StatusExpiryAction;

  @ApiPropertyOptional({
    description: "If expiryAction is REPLACE, the status to replace with",
  })
  @ValidateIf((o) => o.expiryAction === StatusExpiryAction.REPLACE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  replacementStatus?: string | null;

  // -------- VISIBILITY --------
  @ApiPropertyOptional({
    description: "Status visibility settings",
    type: StatusVisibilityDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusVisibilityDto)
  visibility?: StatusVisibilityDto;

  // -------- SCHEDULING --------
  @ApiPropertyOptional({
    description: "Status scheduling information",
    type: StatusScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusScheduleDto)
  schedule?: StatusScheduleDto;

  // -------- RICH METADATA --------
  @ApiPropertyOptional({
    description: "Additional metadata for the status",
    example: { location: "Office", mood: "productive" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;

  // -------- CONFIRMATION (for critical status changes) --------
  @ApiPropertyOptional({
    description: "Confirmation flag for status changes (e.g., setting DND)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  // -------- CLEAR STATUS --------
  @ApiPropertyOptional({
    description: "Clear the current status (set to default)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  clear?: boolean;

  // -------- REPLACE ALL --------
  @ApiPropertyOptional({
    description: "Replace all previous statuses with this one",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<UpdateStatusDto> = {}) {
    Object.assign(this, partial);
    this.sanitize();
  }

  // -------- SANITIZATION --------
  private sanitize(): void {
    if (this.status) {
      this.status = this.status.trim();
      // Remove multiple spaces
      this.status = this.status.replace(/\s+/g, " ");
    }
    if (this.emoji) {
      this.emoji = this.emoji.trim();
    }
    if (this.color) {
      this.color = this.color.trim();
    }
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Check if the status is valid.
   */
  isValid(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.clear && !this.status) {
      // If clear is true, status is not required
      // but we should still allow it
    } else if (!this.status && !this.clear) {
      errors.push("Status message is required unless clearing");
    }

    if (this.status && this.status.length > 100) {
      errors.push("Status cannot exceed 100 characters");
    }

    if (this.emoji && this.emoji.length > 10) {
      errors.push("Emoji cannot exceed 10 characters");
    }

    if (this.color && !this.isValidHexColor(this.color)) {
      errors.push("Invalid hex color format (use #RRGGBB or #RGB)");
    }

    if (this.expiresAt && this.schedule?.endAt) {
      errors.push("Cannot specify both expiresAt and schedule.endAt");
    }

    if (
      this.expiryAction === StatusExpiryAction.REPLACE &&
      !this.replacementStatus
    ) {
      errors.push(
        "Replacement status is required when expiryAction is REPLACE",
      );
    }

    if (
      this.expiryAction === StatusExpiryAction.REVERT &&
      !this.revertToStatus
    ) {
      errors.push("Revert status is required when expiryAction is REVERT");
    }

    if (this.schedule && this.schedule.startAt && this.schedule.endAt) {
      const start = new Date(this.schedule.startAt);
      const end = new Date(this.schedule.endAt);
      if (start >= end) {
        errors.push("Scheduled start time must be before end time");
      }
    }

    if (this.schedule && this.schedule.recurrence) {
      // Basic validation for RRULE
      if (!this.schedule.recurrence.includes("FREQ=")) {
        errors.push("Invalid recurrence rule format (must contain FREQ=)");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if hex color is valid.
   */
  private isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  /**
   * Check if the status should be cleared.
   */
  isClear(): boolean {
    return this.clear === true;
  }

  /**
   * Check if the status has an expiration.
   */
  hasExpiration(): boolean {
    return !!this.expiresAt || !!this.schedule?.endAt;
  }

  /**
   * Get the expiration timestamp.
   */
  getExpiration(): Date | null {
    if (this.expiresAt) {
      return new Date(this.expiresAt);
    }
    if (this.schedule?.endAt) {
      return new Date(this.schedule.endAt);
    }
    return null;
  }

  /**
   * Check if the status is scheduled for the future.
   */
  isScheduled(): boolean {
    if (!this.schedule?.startAt) return false;
    const start = new Date(this.schedule.startAt);
    return start > new Date();
  }

  /**
   * Get the status type, falling back to CUSTOM if not specified.
   */
  getStatusType(): UserStatusType {
    return this.type || UserStatusType.CUSTOM;
  }

  /**
   * Get the effective status text (with emoji prefix if present).
   */
  getFullStatus(): string {
    let full = "";
    if (this.emoji) {
      full += this.emoji + " ";
    }
    full += this.status || "";
    return full.trim();
  }

  /**
   * Get a human-readable status summary.
   */
  getSummary(): string {
    const parts: string[] = [];
    if (this.emoji) parts.push(this.emoji);
    if (this.status) parts.push(this.status);
    if (this.type && this.type !== UserStatusType.CUSTOM)
      parts.push(`(${this.type})`);
    if (this.category) parts.push(`[${this.category}]`);
    return parts.join(" ");
  }

  /**
   * Check if this status is a DND or busy status.
   */
  isDndOrBusy(): boolean {
    return (
      this.type === UserStatusType.DO_NOT_DISTURB ||
      this.type === UserStatusType.BUSY ||
      this.type === UserStatusType.IN_A_MEETING
    );
  }

  /**
   * Check if this status should trigger notifications.
   */
  shouldNotify(): boolean {
    if (this.type === UserStatusType.DO_NOT_DISTURB) return false;
    if (this.type === UserStatusType.SLEEPING) return false;
    return true;
  }

  /**
   * Get the status category default if not provided.
   */
  getCategory(): StatusCategory {
    if (this.category) return this.category;

    // Infer category from type
    switch (this.type) {
      case UserStatusType.WORKING:
      case UserStatusType.IN_A_MEETING:
        return StatusCategory.WORK;
      case UserStatusType.ON_VACATION:
        return StatusCategory.TRAVEL;
      case UserStatusType.SLEEPING:
        return StatusCategory.HEALTH;
      case UserStatusType.BREAK:
        return StatusCategory.LEISURE;
      case UserStatusType.DO_NOT_DISTURB:
      case UserStatusType.BUSY:
        return StatusCategory.PRODUCTIVITY;
      default:
        return StatusCategory.OTHER;
    }
  }

  /**
   * Get the expiry action default.
   */
  getExpiryAction(): StatusExpiryAction {
    return this.expiryAction || StatusExpiryAction.CLEAR;
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for database update.
   */
  toPrismaUpdate(): Record<string, any> {
    const update: Record<string, any> = {};

    if (this.clear) {
      update.status = null;
      update.emoji = null;
      update.color = null;
      update.type = null;
      update.category = null;
      update.expiresAt = null;
      update.metadata = null;
    } else {
      update.status = this.status;
      update.type = this.type || UserStatusType.CUSTOM;
      update.emoji = this.emoji || null;
      update.color = this.color || null;
      update.category = this.category || this.getCategory();

      if (this.expiresAt) {
        update.expiresAt = new Date(this.expiresAt);
      } else if (this.schedule?.endAt) {
        update.expiresAt = new Date(this.schedule.endAt);
      } else {
        update.expiresAt = null;
      }

      update.metadata = this.metadata || null;
    }

    // Visibility settings as JSON
    if (this.visibility) {
      update.visibility = this.visibility;
    }

    // Schedule settings as JSON
    if (this.schedule) {
      update.schedule = this.schedule;
    }

    // Replacement status for expiry
    if (this.replacementStatus) {
      update.replacementStatus = this.replacementStatus;
    }

    return update;
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<UpdateStatusDto> {
    return {
      status: this.status,
      type: this.type,
      emoji: this.emoji,
      color: this.color,
      category: this.category,
      expiresAt: this.expiresAt,
      expiryAction: this.expiryAction,
      replacementStatus: this.replacementStatus,
      visibility: this.visibility,
      schedule: this.schedule,
      metadata: this.metadata,
      clear: this.clear,
    };
  }

  /**
   * Create a default status DTO (for clearing status).
   */
  static createClearStatus(): UpdateStatusDto {
    const dto = new UpdateStatusDto({
      status: "",
      clear: true,
    });
    return dto;
  }

  /**
   * Create a status DTO for online status.
   */
  static createOnlineStatus(
    message: string = "Online",
    emoji: string = "🟢",
  ): UpdateStatusDto {
    return new UpdateStatusDto({
      status: message,
      type: UserStatusType.ONLINE,
      emoji,
      color: "#4CAF50",
      category: StatusCategory.SOCIAL,
    });
  }

  /**
   * Create a status DTO for busy/DND.
   */
  static createDndStatus(
    message: string = "Do Not Disturb",
    emoji: string = "🔴",
  ): UpdateStatusDto {
    return new UpdateStatusDto({
      status: message,
      type: UserStatusType.DO_NOT_DISTURB,
      emoji,
      color: "#F44336",
      category: StatusCategory.PRODUCTIVITY,
    });
  }

  /**
   * Create a status DTO for away.
   */
  static createAwayStatus(
    message: string = "Away",
    emoji: string = "🟡",
  ): UpdateStatusDto {
    return new UpdateStatusDto({
      status: message,
      type: UserStatusType.AWAY,
      emoji,
      color: "#FFC107",
      category: StatusCategory.PERSONAL,
    });
  }

  /**
   * Create a test status DTO.
   */
  static createTestStatus(
    overrides: Partial<UpdateStatusDto> = {},
  ): UpdateStatusDto {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    return new UpdateStatusDto({
      status: "Test status message",
      type: UserStatusType.CUSTOM,
      emoji: "🧪",
      color: "#9C27B0",
      category: StatusCategory.OTHER,
      expiresAt: inOneHour.toISOString(),
      expiryAction: StatusExpiryAction.CLEAR,
      metadata: { test: true, createdBy: "test-script" },
      ...overrides,
    });
  }

  /**
   * Create a scheduled status DTO.
   */
  static createScheduledStatus(
    status: string,
    startAt: Date,
    endAt: Date,
    overrides: Partial<UpdateStatusDto> = {},
  ): UpdateStatusDto {
    const dto = new UpdateStatusDto({
      status,
      type: UserStatusType.CUSTOM,
      schedule: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        expiryAction: StatusExpiryAction.REVERT,
      },
      ...overrides,
    });
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): UpdateStatusDto {
    return plainToClass(UpdateStatusDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- HISTORY MANAGEMENT --------

  /**
   * Generate a history entry from this status.
   */
  toHistoryEntry(): Partial<StatusHistoryEntryDto> {
    return {
      status: this.status || "",
      type: this.type || UserStatusType.CUSTOM,
      emoji: this.emoji || undefined,
      setAt: new Date(),
      wasActive: !this.clear && !!this.status,
    };
  }

  /**
   * Validate that the status message does not contain prohibited words.
   * (Simple implementation)
   */
  validateContent(prohibitedWords: string[] = []): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (!this.status) return { valid: true, errors: [] };

    const lowerStatus = this.status.toLowerCase();
    for (const word of prohibitedWords) {
      if (lowerStatus.includes(word.toLowerCase())) {
        errors.push(`Status contains prohibited word: "${word}"`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // -------- END --------
}
