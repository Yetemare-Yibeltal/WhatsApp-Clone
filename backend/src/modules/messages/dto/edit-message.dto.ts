// backend/src/modules/messages/dto/edit-message.dto.ts
/**
 * 📄 Edit Message DTO
 *
 * Defines the data transfer object for editing an existing message.
 * Includes validation, sanitization, and Swagger documentation.
 *
 * @module MessagesDTO
 * @category DTOs
 */

import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsNumber,
  IsDate,
  MinLength,
  MaxLength,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  IsUrl,
  IsInt,
  IsPositive,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
  IsJSON,
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
import {
  MessageType,
  MessageStatus,
} from "../../../common/types/socket-payload.interface";
import { SanitizeUtil } from "../../../common/utils/sanitize.util";

// -------- ENUMS --------

export enum EditMode {
  /** Replace the entire content */
  REPLACE = "replace",
  /** Append to the existing content */
  APPEND = "append",
  /** Prepend to the existing content */
  PREPEND = "prepend",
  /** Replace a specific portion (requires startIndex and endIndex) */
  REPLACE_PARTIAL = "replace_partial",
}

// -------- NESTED DTOs --------

/**
 * Partial edit options for specific content modifications.
 */
export class PartialEditDto {
  @ApiPropertyOptional({
    description: "Start index for partial replacement (0-based)",
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  startIndex?: number;

  @ApiPropertyOptional({
    description: "End index for partial replacement (exclusive)",
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  endIndex?: number;

  @ApiPropertyOptional({
    description: "Text to insert at the specified position",
    example: "inserted text",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim() || null)
  insertText?: string;

  @ApiPropertyOptional({
    description: "Text to replace the range with",
    example: "replacement text",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  replaceText?: string;
}

// -------- MAIN DTO --------

/**
 * DTO for editing an existing message.
 */
export class EditMessageDto {
  // -------- REQUIRED FIELDS --------
  @ApiProperty({
    description: "New message content",
    example: "Updated message content",
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: "Message cannot be empty" })
  @MaxLength(10000, { message: "Message cannot exceed 10000 characters" })
  @Transform(({ value }) => {
    const sanitized = SanitizeUtil.sanitizeInput(value, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
    });
    return sanitized;
  })
  content: string;

  // -------- OPTIONAL FIELDS --------
  @ApiPropertyOptional({
    description: "Edit mode",
    enum: EditMode,
    default: EditMode.REPLACE,
  })
  @IsOptional()
  @IsEnum(EditMode)
  editMode?: EditMode;

  @ApiPropertyOptional({
    description: "Partial edit options (required for REPLACE_PARTIAL mode)",
    type: PartialEditDto,
  })
  @ValidateIf((o) => o.editMode === EditMode.REPLACE_PARTIAL)
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialEditDto)
  partialEdit?: PartialEditDto | null;

  @ApiPropertyOptional({
    description: "Message type",
    enum: MessageType,
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({
    description: "Reason for editing (for audit logging)",
    example: "Correcting a typo",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  editReason?: string | null;

  @ApiPropertyOptional({
    description: "Metadata for the edited message",
    example: { category: "work", version: 2 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: "Message color (theme)",
    example: "#FF6B6B",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Invalid color format (use hex color)",
  })
  @Transform(({ value }) => value?.trim() || null)
  color?: string | null;

  @ApiPropertyOptional({
    description: "Whether to notify users about the edit",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyEdit?: boolean;

  @ApiPropertyOptional({
    description: "Whether to show edit history",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showEditHistory?: boolean;

  @ApiPropertyOptional({
    description: "New attachments for the message (replaces existing)",
    type: "array",
    items: {
      type: "object",
      properties: {
        fileName: { type: "string" },
        fileSize: { type: "number" },
        mimeType: { type: "string" },
        url: { type: "string" },
        thumbnailUrl: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        duration: { type: "number" },
      },
    },
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: "Cannot attach more than 20 files" })
  attachments?: Array<{
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    url?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    duration?: number;
  }> | null;

  @ApiPropertyOptional({
    description: "Whether to keep existing attachments",
    example: true,
  })
  @ValidateIf((o) => o.attachments !== undefined)
  @IsOptional()
  @IsBoolean()
  keepExistingAttachments?: boolean;

  @ApiPropertyOptional({
    description: "Additional mentions for the edited message",
    example: ["user_abc123", "user_def456"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(100, { message: "Cannot mention more than 100 users" })
  mentions?: string[];

  @ApiPropertyOptional({
    description: "Remove all existing mentions",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  removeAllMentions?: boolean;

  @ApiPropertyOptional({
    description: "Encrypted content (for E2EE messages)",
    example: "encrypted_payload_base64",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  encryptedContent?: string | null;

  @ApiPropertyOptional({
    description: "Encryption key identifier",
    example: "key_id_abc123",
  })
  @ValidateIf((o) => o.encryptedContent)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  encryptionKeyId?: string | null;

  @ApiPropertyOptional({
    description: "Message signature (for verification)",
    example: "signature_abc123",
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Transform(({ value }) => value?.trim() || null)
  signature?: string | null;

  @ApiPropertyOptional({
    description: "Edit timestamp override (for syncing)",
    example: "2024-01-15T10:30:00Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  editedAt?: Date | null;

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  @Exclude({ toPlainOnly: true })
  _skipValidation: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<EditMessageDto> = {}) {
    Object.assign(this, partial);
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Validate edit mode and content.
   */
  validateEditMode(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.editMode === EditMode.REPLACE_PARTIAL && !this.partialEdit) {
      errors.push("Partial edit options are required for REPLACE_PARTIAL mode");
    }

    if (this.editMode === EditMode.REPLACE_PARTIAL && this.partialEdit) {
      if (
        this.partialEdit.startIndex === undefined &&
        this.partialEdit.endIndex === undefined
      ) {
        errors.push(
          "At least startIndex or endIndex must be provided for partial edit",
        );
      }
      if (this.partialEdit.startIndex && this.partialEdit.startIndex < 0) {
        errors.push("startIndex must be non-negative");
      }
      if (
        this.partialEdit.endIndex &&
        this.partialEdit.endIndex <= (this.partialEdit.startIndex || 0)
      ) {
        errors.push("endIndex must be greater than startIndex");
      }
      if (
        this.partialEdit.startIndex !== undefined &&
        this.partialEdit.endIndex !== undefined
      ) {
        if (this.partialEdit.startIndex >= this.partialEdit.endIndex) {
          errors.push("startIndex must be less than endIndex");
        }
      }
    }

    if (this.attachments && this.attachments.length > 0) {
      // Validate attachments
      for (const att of this.attachments) {
        if (att.fileName && att.fileName.length > 255) {
          errors.push(`File name "${att.fileName}" exceeds 255 characters`);
        }
        if (att.fileSize && att.fileSize > 100 * 1024 * 1024) {
          errors.push(`File "${att.fileName}" exceeds 100MB limit`);
        }
      }
    }

    if (this.mentions && this.mentions.length > 100) {
      errors.push("Cannot mention more than 100 users");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get the sanitized content.
   */
  getSanitizedContent(): string {
    return SanitizeUtil.sanitizeInput(this.content, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 10000,
    });
  }

  /**
   * Get the content preview (truncated).
   */
  getContentPreview(length: number = 100): string {
    if (!this.content) return "";
    if (this.content.length <= length) return this.content;
    return this.content.substring(0, length) + "...";
  }

  /**
   * Check if the message has changed significantly.
   */
  hasSignificantChange(originalContent: string): boolean {
    const newContent = this.getSanitizedContent();
    const similarity = this.calculateSimilarity(originalContent, newContent);
    return similarity < 0.8; // Less than 80% similarity is significant
  }

  /**
   * Calculate similarity between two strings (simple Jaccard-like).
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 && !str2) return 1;
    if (!str1 || !str2) return 0;

    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check if the message should notify participants about the edit.
   */
  shouldNotifyEdit(originalContent: string): boolean {
    if (this.notifyEdit !== undefined) return this.notifyEdit;
    // Default: notify if content changed significantly
    return this.hasSignificantChange(originalContent);
  }

  /**
   * Check if the message is being encrypted.
   */
  isEncrypted(): boolean {
    return !!this.encryptedContent;
  }

  /**
   * Check if the message has a signature.
   */
  hasSignature(): boolean {
    return !!this.signature;
  }

  /**
   * Get the edit mode.
   */
  getEditMode(): EditMode {
    return this.editMode || EditMode.REPLACE;
  }

  /**
   * Get the effective content based on edit mode.
   */
  getEffectiveContent(originalContent: string): string {
    const mode = this.getEditMode();

    if (mode === EditMode.REPLACE) {
      return this.getSanitizedContent();
    }

    if (mode === EditMode.APPEND) {
      return originalContent + " " + this.getSanitizedContent();
    }

    if (mode === EditMode.PREPEND) {
      return this.getSanitizedContent() + " " + originalContent;
    }

    if (mode === EditMode.REPLACE_PARTIAL && this.partialEdit) {
      const start = this.partialEdit.startIndex || 0;
      const end = this.partialEdit.endIndex || originalContent.length;
      const before = originalContent.substring(0, start);
      const after = originalContent.substring(end);
      const replacement = this.partialEdit.replaceText || "";
      return before + replacement + after;
    }

    return this.getSanitizedContent();
  }

  /**
   * Check if the message has attachments.
   */
  hasAttachments(): boolean {
    return !!this.attachments && this.attachments.length > 0;
  }

  /**
   * Check if the message has mentions.
   */
  hasMentions(): boolean {
    return !!this.mentions && this.mentions.length > 0;
  }

  /**
   * Get the edit history visibility.
   */
  getEditHistoryVisibility(): boolean {
    return this.showEditHistory !== undefined ? this.showEditHistory : true;
  }

  /**
   * Check if the edit is valid (within allowed window).
   */
  isValidEditWindow(createdAt: Date, maxWindowSeconds: number = 300): boolean {
    const now = new Date();
    const elapsed = (now.getTime() - createdAt.getTime()) / 1000;
    return elapsed <= maxWindowSeconds;
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for service layer.
   */
  toServicePayload(): {
    content: string;
    messageType?: MessageType;
    metadata?: Record<string, any>;
    encryptedContent?: string;
    encryptionKeyId?: string;
    signature?: string;
    attachments?: any[];
    keepExistingAttachments?: boolean;
    mentions?: string[];
    removeAllMentions?: boolean;
    editReason?: string;
    editedAt?: Date;
    notifyEdit?: boolean;
    showEditHistory?: boolean;
    color?: string;
  } {
    const payload: any = {
      content: this.getSanitizedContent(),
    };

    if (this.messageType) payload.messageType = this.messageType;
    if (this.metadata) payload.metadata = this.metadata;
    if (this.encryptedContent) payload.encryptedContent = this.encryptedContent;
    if (this.encryptionKeyId) payload.encryptionKeyId = this.encryptionKeyId;
    if (this.signature) payload.signature = this.signature;
    if (this.attachments !== undefined) payload.attachments = this.attachments;
    if (this.keepExistingAttachments !== undefined)
      payload.keepExistingAttachments = this.keepExistingAttachments;
    if (this.mentions) payload.mentions = this.mentions;
    if (this.removeAllMentions !== undefined)
      payload.removeAllMentions = this.removeAllMentions;
    if (this.editReason) payload.editReason = this.editReason;
    if (this.editedAt) payload.editedAt = this.editedAt;
    if (this.notifyEdit !== undefined) payload.notifyEdit = this.notifyEdit;
    if (this.showEditHistory !== undefined)
      payload.showEditHistory = this.showEditHistory;
    if (this.color) payload.color = this.color;

    return payload;
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<EditMessageDto> {
    return {
      content: this.getSanitizedContent(),
      editMode: this.editMode,
      partialEdit: this.partialEdit,
      messageType: this.messageType,
      editReason: this.editReason,
      metadata: this.metadata,
      color: this.color,
      notifyEdit: this.notifyEdit,
      showEditHistory: this.showEditHistory,
      attachments: this.attachments,
      keepExistingAttachments: this.keepExistingAttachments,
      mentions: this.mentions,
      removeAllMentions: this.removeAllMentions,
    };
  }

  // -------- FACTORY METHODS --------

  /**
   * Create a test edit DTO.
   */
  static createTestEdit(
    overrides: Partial<EditMessageDto> = {},
  ): EditMessageDto {
    return new EditMessageDto({
      content: "Updated test content",
      editMode: EditMode.REPLACE,
      editReason: "Test edit",
      notifyEdit: true,
      showEditHistory: true,
      ...overrides,
    });
  }

  /**
   * Create a test edit DTO for appending content.
   */
  static createTestAppendEdit(
    overrides: Partial<EditMessageDto> = {},
  ): EditMessageDto {
    return new EditMessageDto({
      content: "additional content",
      editMode: EditMode.APPEND,
      editReason: "Appending test content",
      ...overrides,
    });
  }

  /**
   * Create a test edit DTO for partial replacement.
   */
  static createTestPartialEdit(
    overrides: Partial<EditMessageDto> = {},
  ): EditMessageDto {
    return new EditMessageDto({
      content: "replacement text",
      editMode: EditMode.REPLACE_PARTIAL,
      partialEdit: {
        startIndex: 5,
        endIndex: 15,
        replaceText: "new text",
      },
      editReason: "Partial replacement test",
      ...overrides,
    });
  }

  /**
   * Create a test edit DTO with metadata.
   */
  static createTestEditWithMetadata(
    overrides: Partial<EditMessageDto> = {},
  ): EditMessageDto {
    return new EditMessageDto({
      content: "Updated content with metadata",
      editMode: EditMode.REPLACE,
      metadata: { version: 2, updatedBy: "test-user" },
      editReason: "Adding metadata",
      ...overrides,
    });
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): EditMessageDto {
    return plainToClass(EditMessageDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
