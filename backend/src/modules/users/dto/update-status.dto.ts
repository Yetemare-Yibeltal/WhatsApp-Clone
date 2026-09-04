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
} from "class-validator";
import { Transform, Type, Exclude, plainToClass } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
  CUSTOM = "custom",
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

export class StatusVisibilityDto {
  @ApiPropertyOptional({
    enum: StatusVisibility,
    default: StatusVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(StatusVisibility)
  level?: StatusVisibility;

  @ApiPropertyOptional({ example: ["user_1", "user_2"] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ example: ["group_1", "group_2"] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  groupIds?: string[];

  @ApiPropertyOptional({ example: ["user_3"] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  excludeUserIds?: string[];
}

export class StatusScheduleDto {
  @ApiPropertyOptional({ example: "2024-01-15T10:00:00Z" })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: "2024-01-15T12:00:00Z" })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({
    enum: StatusExpiryAction,
    default: StatusExpiryAction.CLEAR,
  })
  @IsOptional()
  @IsEnum(StatusExpiryAction)
  expiryAction?: StatusExpiryAction;

  @ValidateIf((o) => o.expiryAction === StatusExpiryAction.REPLACE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  replacementStatus?: string;

  @ValidateIf((o) => o.expiryAction === StatusExpiryAction.REVERT)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  revertToStatus?: string;

  @ApiPropertyOptional({ example: "FREQ=DAILY;INTERVAL=1" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recurrence?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}

export class UpdateStatusDto {
  @ApiProperty({ description: "Status message", maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || "")
  status: string;

  @ApiPropertyOptional({ enum: UserStatusType, default: UserStatusType.CUSTOM })
  @IsOptional()
  @IsEnum(UserStatusType)
  type?: UserStatusType;

  @ApiPropertyOptional({ example: "🚀" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim() || null)
  emoji?: string | null;

  @ApiPropertyOptional({ example: "#FF6B6B" })
  @IsOptional()
  @IsHexColor()
  @Transform(({ value }) => value?.trim() || null)
  color?: string | null;

  @ApiPropertyOptional({ enum: StatusCategory })
  @IsOptional()
  @IsEnum(StatusCategory)
  category?: StatusCategory;

  @ApiPropertyOptional({ example: "2024-01-15T12:00:00Z" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    enum: StatusExpiryAction,
    default: StatusExpiryAction.CLEAR,
  })
  @IsOptional()
  @IsEnum(StatusExpiryAction)
  expiryAction?: StatusExpiryAction;

  @ValidateIf((o) => o.expiryAction === StatusExpiryAction.REPLACE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  replacementStatus?: string | null;

  @ApiPropertyOptional({ type: StatusVisibilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusVisibilityDto)
  visibility?: StatusVisibilityDto;

  @ApiPropertyOptional({ type: StatusScheduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusScheduleDto)
  schedule?: StatusScheduleDto;

  @ApiPropertyOptional({ example: { location: "Office", mood: "productive" } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clear?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;

  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  constructor(partial: Partial<UpdateStatusDto> = {}) {
    Object.assign(this, partial);
    this.sanitize();
  }

  private sanitize(): void {
    if (this.status) {
      this.status = this.status.trim().replace(/\s+/g, " ");
    }
    if (this.emoji) {
      this.emoji = this.emoji.trim();
    }
    if (this.color) {
      this.color = this.color.trim();
    }
  }

  isValid(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.clear && !this.status) {
    } else if (!this.status && !this.clear) {
      errors.push("Status message is required unless clearing");
    }
    if (this.status && this.status.length > 100)
      errors.push("Status cannot exceed 100 characters");
    if (this.emoji && this.emoji.length > 10)
      errors.push("Emoji cannot exceed 10 characters");
    if (this.color && !this.isValidHexColor(this.color))
      errors.push("Invalid hex color format");
    if (this.expiresAt && this.schedule?.endAt)
      errors.push("Cannot specify both expiresAt and schedule.endAt");
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
      if (start >= end)
        errors.push("Scheduled start time must be before end time");
    }
    if (this.schedule && this.schedule.recurrence) {
      if (!this.schedule.recurrence.includes("FREQ="))
        errors.push("Invalid recurrence rule format");
    }
    return { valid: errors.length === 0, errors };
  }

  private isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  isClear(): boolean {
    return this.clear === true;
  }

  hasExpiration(): boolean {
    return !!this.expiresAt || !!this.schedule?.endAt;
  }

  getExpiration(): Date | null {
    if (this.expiresAt) return new Date(this.expiresAt);
    if (this.schedule?.endAt) return new Date(this.schedule.endAt);
    return null;
  }

  isScheduled(): boolean {
    if (!this.schedule?.startAt) return false;
    return new Date(this.schedule.startAt) > new Date();
  }

  getStatusType(): UserStatusType {
    return this.type || UserStatusType.CUSTOM;
  }

  getFullStatus(): string {
    let full = "";
    if (this.emoji) full += this.emoji + " ";
    full += this.status || "";
    return full.trim();
  }

  getSummary(): string {
    const parts: string[] = [];
    if (this.emoji) parts.push(this.emoji);
    if (this.status) parts.push(this.status);
    if (this.type && this.type !== UserStatusType.CUSTOM)
      parts.push(`(${this.type})`);
    if (this.category) parts.push(`[${this.category}]`);
    return parts.join(" ");
  }

  isDndOrBusy(): boolean {
    return (
      this.type === UserStatusType.DO_NOT_DISTURB ||
      this.type === UserStatusType.BUSY ||
      this.type === UserStatusType.IN_A_MEETING
    );
  }

  shouldNotify(): boolean {
    if (this.type === UserStatusType.DO_NOT_DISTURB) return false;
    if (this.type === UserStatusType.SLEEPING) return false;
    return true;
  }

  getCategory(): StatusCategory {
    if (this.category) return this.category;
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

  getExpiryAction(): StatusExpiryAction {
    return this.expiryAction || StatusExpiryAction.CLEAR;
  }

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
    if (this.visibility) {
      update.visibility = this.visibility;
    }
    if (this.schedule) {
      update.schedule = this.schedule;
    }
    if (this.replacementStatus) {
      update.replacementStatus = this.replacementStatus;
    }
    return update;
  }

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

  static createClearStatus(): UpdateStatusDto {
    return new UpdateStatusDto({ status: "", clear: true });
  }

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

  static createScheduledStatus(
    status: string,
    startAt: Date,
    endAt: Date,
    overrides: Partial<UpdateStatusDto> = {},
  ): UpdateStatusDto {
    return new UpdateStatusDto({
      status,
      type: UserStatusType.CUSTOM,
      schedule: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        expiryAction: StatusExpiryAction.REVERT,
      },
      ...overrides,
    });
  }

  static fromPlain(obj: any): UpdateStatusDto {
    return plainToClass(UpdateStatusDto, obj, {
      enableImplicitConversion: true,
    });
  }

  toHistoryEntry(): Partial<any> {
    return {
      status: this.status || "",
      type: this.type || UserStatusType.CUSTOM,
      emoji: this.emoji || undefined,
      setAt: new Date(),
      wasActive: !this.clear && !!this.status,
    };
  }

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
    return { valid: errors.length === 0, errors };
  }
}
