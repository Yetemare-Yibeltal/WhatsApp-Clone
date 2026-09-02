// backend/src/modules/messages/dto/delete-message.dto.ts
/**
 * 📄 Delete Message DTO
 *
 * Defines the data transfer object for deleting a message.
 * Includes validation, Swagger documentation, and helper methods.
 *
 * @module MessagesDTO
 * @category DTOs
 */

import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDate,
  MinLength,
  MaxLength,
  ValidateIf,
  IsNotEmpty,
  IsIn,
  IsInt,
  IsPositive,
} from "class-validator";
import {
  Transform,
  Type,
  Expose,
  Exclude,
  plainToClass,
} from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SanitizeUtil } from "../../../common/utils/sanitize.util";

// -------- ENUMS --------

export enum DeleteMode {
  /** Delete for everyone (sender/admin only) */
  FOR_EVERYONE = "for_everyone",
  /** Delete for self only (sender) */
  FOR_SELF = "for_self",
  /** Schedule deletion for later */
  SCHEDULED = "scheduled",
}

export enum RestoreAction {
  /** Restore the message */
  RESTORE = "restore",
  /** Permanently delete (no restore) */
  PERMANENT = "permanent",
  /** Keep in trash for later restore */
  TRASH = "trash",
}

// -------- MAIN DTO --------

/**
 * DTO for deleting a message.
 */
export class DeleteMessageDto {
  // -------- REQUIRED FIELDS --------
  @ApiProperty({
    description: "Whether to delete the message for everyone",
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  forEveryone: boolean;

  // -------- OPTIONAL FIELDS --------
  @ApiPropertyOptional({
    description: "Reason for deleting the message",
    example: "Inappropriate content",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Reason cannot exceed 500 characters" })
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  @ApiPropertyOptional({
    description: "Delete mode",
    enum: DeleteMode,
    default: DeleteMode.FOR_EVERYONE,
  })
  @IsOptional()
  @IsEnum(DeleteMode)
  mode?: DeleteMode;

  @ApiPropertyOptional({
    description: "Whether to delete silently (no notification to participants)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  silent?: boolean;

  @ApiPropertyOptional({
    description: "Whether to delete all attachments with the message",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  deleteAttachments?: boolean;

  @ApiPropertyOptional({
    description: "Whether to keep a copy for the user (for self-delete)",
    example: false,
  })
  @ValidateIf((o) => o.mode === DeleteMode.FOR_SELF)
  @IsOptional()
  @IsBoolean()
  keepCopy?: boolean;

  @ApiPropertyOptional({
    description:
      "Whether to clear the message for everyone (replace with placeholder)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  clearContent?: boolean;

  @ApiPropertyOptional({
    description: "Custom placeholder text when clearing content",
    example: "This message was deleted",
    maxLength: 100,
  })
  @ValidateIf((o) => o.clearContent)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  placeholder?: string | null;

  @ApiPropertyOptional({
    description: "Scheduled deletion timestamp (ISO 8601)",
    example: "2024-12-31T23:59:59Z",
  })
  @ValidateIf((o) => o.mode === DeleteMode.SCHEDULED)
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date | null;

  @ApiPropertyOptional({
    description: "Restore action (for soft delete)",
    enum: RestoreAction,
    default: RestoreAction.TRASH,
  })
  @IsOptional()
  @IsEnum(RestoreAction)
  restoreAction?: RestoreAction;

  @ApiPropertyOptional({
    description: "Undo window in seconds (max time to restore)",
    example: 300,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  undoWindowSeconds?: number;

  @ApiPropertyOptional({
    description: "Confirm deletion (prevents accidental deletion)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  @ApiPropertyOptional({
    description: "Whether to notify the sender about the deletion",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifySender?: boolean;

  @ApiPropertyOptional({
    description: "Whether to delete all replies to this message",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  deleteReplies?: boolean;

  @ApiPropertyOptional({
    description: "Whether to delete all reactions to this message",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  deleteReactions?: boolean;

  @ApiPropertyOptional({
    description: "Custom metadata for the deletion event",
    example: { moderatedBy: "admin_123", action: "content-removal" },
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  metadata?: string | null;

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  @Exclude({ toPlainOnly: true })
  _skipValidation: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<DeleteMessageDto> = {}) {
    Object.assign(this, partial);
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Validate deletion options.
   */
  validateDeletion(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if deletion is confirmed
    if (!this.confirm) {
      errors.push("Deletion must be confirmed with confirm flag");
    }

    // Validate mode-specific requirements
    if (this.mode === DeleteMode.FOR_SELF && this.forEveryone) {
      errors.push("Cannot delete for self and for everyone simultaneously");
    }

    if (this.mode === DeleteMode.SCHEDULED && !this.scheduledAt) {
      errors.push("Scheduled deletion requires a scheduledAt timestamp");
    }

    if (this.mode === DeleteMode.SCHEDULED && this.scheduledAt) {
      const now = new Date();
      if (this.scheduledAt.getTime() <= now.getTime()) {
        errors.push("Scheduled deletion time must be in the future");
      }
    }

    if (this.clearContent && this.forEveryone === false) {
      errors.push(
        "Clearing content is only allowed when deleting for everyone",
      );
    }

    if (this.placeholder && !this.clearContent) {
      errors.push("Placeholder can only be set when clearing content");
    }

    if (this.undoWindowSeconds && this.undoWindowSeconds < 0) {
      errors.push("Undo window must be a positive number");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if the deletion is a permanent deletion.
   */
  isPermanent(): boolean {
    return (
      this.restoreAction === RestoreAction.PERMANENT ||
      (this.mode === DeleteMode.FOR_EVERYONE && !this.undoWindowSeconds)
    );
  }

  /**
   * Check if the deletion is reversible.
   */
  isReversible(): boolean {
    return (
      this.restoreAction === RestoreAction.TRASH ||
      (this.mode === DeleteMode.FOR_EVERYONE && !!this.undoWindowSeconds) ||
      this.mode === DeleteMode.FOR_SELF
    );
  }

  /**
   * Get the effective undo window in seconds.
   */
  getEffectiveUndoWindow(): number {
    if (this.undoWindowSeconds) return this.undoWindowSeconds;
    if (this.mode === DeleteMode.FOR_EVERYONE) return 300; // 5 minutes default
    if (this.mode === DeleteMode.FOR_SELF) return 86400; // 24 hours
    return 0;
  }

  /**
   * Get the effective placeholder text.
   */
  getEffectivePlaceholder(): string {
    if (this.placeholder) return this.placeholder;
    if (this.mode === DeleteMode.FOR_SELF) return "You deleted this message";
    return "This message was deleted";
  }

  /**
   * Check if attachments should be deleted.
   */
  shouldDeleteAttachments(): boolean {
    return this.deleteAttachments !== false; // default true
  }

  /**
   * Check if replies should be deleted.
   */
  shouldDeleteReplies(): boolean {
    return this.deleteReplies === true;
  }

  /**
   * Check if reactions should be deleted.
   */
  shouldDeleteReactions(): boolean {
    return this.deleteReactions !== false; // default true
  }

  /**
   * Check if sender should be notified.
   */
  shouldNotifySender(): boolean {
    return this.notifySender !== false; // default true
  }

  /**
   * Check if deletion is silent.
   */
  isSilent(): boolean {
    return this.silent === true;
  }

  /**
   * Check if content should be cleared.
   */
  shouldClearContent(): boolean {
    return this.clearContent === true;
  }

  /**
   * Check if a copy should be kept for self-delete.
   */
  shouldKeepCopy(): boolean {
    return this.keepCopy === true;
  }

  /**
   * Get deletion mode.
   */
  getDeletionMode(): DeleteMode {
    if (this.mode) return this.mode;
    if (this.forEveryone) return DeleteMode.FOR_EVERYONE;
    return DeleteMode.FOR_SELF;
  }

  /**
   * Check if deletion is scheduled.
   */
  isScheduled(): boolean {
    return this.mode === DeleteMode.SCHEDULED && !!this.scheduledAt;
  }

  /**
   * Get the scheduled deletion timestamp.
   */
  getScheduledTime(): Date | null {
    return this.scheduledAt || null;
  }

  /**
   * Check if deletion is confirmed.
   */
  isConfirmed(): boolean {
    return this.confirm === true;
  }

  /**
   * Get the sanitized reason.
   */
  getSanitizedReason(): string | null {
    if (!this.reason) return null;
    return SanitizeUtil.sanitizeInput(this.reason, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 500,
    });
  }

  /**
   * Check if the deletion is for everyone.
   */
  isForEveryone(): boolean {
    return this.forEveryone === true;
  }

  /**
   * Check if the deletion is for self only.
   */
  isForSelf(): boolean {
    return this.forEveryone === false;
  }

  /**
   * Get the restore action.
   */
  getRestoreAction(): RestoreAction {
    return this.restoreAction || RestoreAction.TRASH;
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for service layer.
   */
  toServicePayload(): {
    forEveryone: boolean;
    mode: DeleteMode;
    reason?: string;
    silent: boolean;
    deleteAttachments: boolean;
    keepCopy: boolean;
    clearContent: boolean;
    placeholder?: string;
    scheduledAt?: Date;
    restoreAction: RestoreAction;
    undoWindowSeconds: number;
    confirm: boolean;
    notifySender: boolean;
    deleteReplies: boolean;
    deleteReactions: boolean;
    metadata?: string;
  } {
    return {
      forEveryone: this.forEveryone,
      mode: this.getDeletionMode(),
      reason: this.getSanitizedReason() || undefined,
      silent: this.isSilent(),
      deleteAttachments: this.shouldDeleteAttachments(),
      keepCopy: this.shouldKeepCopy(),
      clearContent: this.shouldClearContent(),
      placeholder: this.shouldClearContent()
        ? this.getEffectivePlaceholder()
        : undefined,
      scheduledAt: this.getScheduledTime() || undefined,
      restoreAction: this.getRestoreAction(),
      undoWindowSeconds: this.getEffectiveUndoWindow(),
      confirm: this.isConfirmed(),
      notifySender: this.shouldNotifySender(),
      deleteReplies: this.shouldDeleteReplies(),
      deleteReactions: this.shouldDeleteReactions(),
      metadata: this.metadata || undefined,
    };
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<DeleteMessageDto> {
    return {
      forEveryone: this.forEveryone,
      reason: this.reason,
      mode: this.mode,
      silent: this.silent,
      deleteAttachments: this.deleteAttachments,
      keepCopy: this.keepCopy,
      clearContent: this.clearContent,
      placeholder: this.placeholder,
      scheduledAt: this.scheduledAt,
      restoreAction: this.restoreAction,
      undoWindowSeconds: this.undoWindowSeconds,
      confirm: this.confirm,
      notifySender: this.notifySender,
      deleteReplies: this.deleteReplies,
      deleteReactions: this.deleteReactions,
      metadata: this.metadata,
    };
  }

  // -------- FACTORY METHODS --------

  /**
   * Create a standard "delete for everyone" DTO.
   */
  static deleteForEveryone(reason?: string): DeleteMessageDto {
    return new DeleteMessageDto({
      forEveryone: true,
      mode: DeleteMode.FOR_EVERYONE,
      reason: reason || "Deleted by user",
      confirm: true,
      deleteAttachments: true,
      deleteReactions: true,
      restoreAction: RestoreAction.TRASH,
      undoWindowSeconds: 300,
    });
  }

  /**
   * Create a standard "delete for self" DTO.
   */
  static deleteForSelf(reason?: string): DeleteMessageDto {
    return new DeleteMessageDto({
      forEveryone: false,
      mode: DeleteMode.FOR_SELF,
      reason: reason || "Deleted by user",
      confirm: true,
      deleteAttachments: false,
      keepCopy: false,
      restoreAction: RestoreAction.TRASH,
      undoWindowSeconds: 86400,
    });
  }

  /**
   * Create a scheduled deletion DTO.
   */
  static scheduledDelete(scheduledAt: Date, reason?: string): DeleteMessageDto {
    return new DeleteMessageDto({
      forEveryone: true,
      mode: DeleteMode.SCHEDULED,
      scheduledAt,
      reason: reason || "Scheduled deletion",
      confirm: true,
      restoreAction: RestoreAction.PERMANENT,
      undoWindowSeconds: 0,
    });
  }

  /**
   * Create a permanent deletion DTO (no restore).
   */
  static permanentDelete(reason?: string): DeleteMessageDto {
    return new DeleteMessageDto({
      forEveryone: true,
      mode: DeleteMode.FOR_EVERYONE,
      reason: reason || "Permanent deletion",
      confirm: true,
      restoreAction: RestoreAction.PERMANENT,
      undoWindowSeconds: 0,
      deleteAttachments: true,
      deleteReactions: true,
      deleteReplies: true,
    });
  }

  /**
   * Create a test deletion DTO.
   */
  static createTestDelete(
    overrides: Partial<DeleteMessageDto> = {},
  ): DeleteMessageDto {
    return new DeleteMessageDto({
      forEveryone: true,
      mode: DeleteMode.FOR_EVERYONE,
      reason: "Test deletion",
      confirm: true,
      silent: false,
      deleteAttachments: true,
      restoreAction: RestoreAction.TRASH,
      undoWindowSeconds: 300,
      ...overrides,
    });
  }

  /**
   * Create a test self-deletion DTO.
   */
  static createTestSelfDelete(
    overrides: Partial<DeleteMessageDto> = {},
  ): DeleteMessageDto {
    return new DeleteMessageDto({
      forEveryone: false,
      mode: DeleteMode.FOR_SELF,
      reason: "Test self deletion",
      confirm: true,
      silent: false,
      deleteAttachments: false,
      keepCopy: true,
      restoreAction: RestoreAction.TRASH,
      undoWindowSeconds: 86400,
      ...overrides,
    });
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): DeleteMessageDto {
    return plainToClass(DeleteMessageDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
