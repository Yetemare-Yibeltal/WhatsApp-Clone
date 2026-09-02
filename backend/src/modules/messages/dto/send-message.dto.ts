// backend/src/modules/messages/dto/send-message.dto.ts
/**
 * 📄 Send Message DTO
 *
 * Defines the data transfer object for sending a new message.
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
  IsArray,
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
import { MessageType } from "../../../common/types/socket-payload.interface";
import { SanitizeUtil } from "../../../common/utils/sanitize.util";
import { isUUID } from "class-validator";

// -------- ENUMS --------

export enum MessagePriority {
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export enum MessageVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
  ENCRYPTED = "encrypted",
}

// -------- NESTED DTOs --------

/**
 * Attachment metadata for messages.
 */
export class AttachmentDto {
  @ApiPropertyOptional({
    description: "File name",
    example: "document.pdf",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  fileName?: string | null;

  @ApiPropertyOptional({
    description: "File size in bytes",
    example: 1024,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  fileSize?: number | null;

  @ApiPropertyOptional({
    description: "MIME type",
    example: "application/pdf",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  mimeType?: string | null;

  @ApiPropertyOptional({
    description: "Storage path or URL",
    example: "https://storage.example.com/files/document.pdf",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid URL format" })
  @Transform(({ value }) => value?.trim() || null)
  url?: string | null;

  @ApiPropertyOptional({
    description: "Thumbnail URL",
    example: "https://storage.example.com/thumbnails/document.jpg",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid thumbnail URL format" })
  @Transform(({ value }) => value?.trim() || null)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({
    description: "Image/video width in pixels",
    example: 1920,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number | null;

  @ApiPropertyOptional({
    description: "Image/video height in pixels",
    example: 1080,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number | null;

  @ApiPropertyOptional({
    description: "Duration in seconds (for audio/video)",
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  duration?: number | null;

  @ApiPropertyOptional({
    description: "Additional attachment metadata",
    example: { caption: "This is a document" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}

/**
 * Mention data for messages.
 */
export class MentionDto {
  @ApiProperty({
    description: "User ID being mentioned",
    example: "user_abc123",
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: "Display name of the mentioned user",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  displayName?: string | null;

  @ApiPropertyOptional({
    description: "Position in the message content where the mention starts",
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  startIndex?: number | null;

  @ApiPropertyOptional({
    description: "Position in the message content where the mention ends",
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  endIndex?: number | null;
}

/**
 * Location data for location messages.
 */
export class LocationDto {
  @ApiProperty({
    description: "Latitude coordinate",
    example: 40.7128,
  })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({
    description: "Longitude coordinate",
    example: -74.006,
  })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiPropertyOptional({
    description: "Location name/address",
    example: "New York, NY, USA",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  address?: string | null;

  @ApiPropertyOptional({
    description: "Location URL (e.g., Google Maps link)",
    example: "https://maps.google.com/...",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid location URL format" })
  @Transform(({ value }) => value?.trim() || null)
  url?: string | null;
}

/**
 * Poll data for poll messages.
 */
export class PollOptionDto {
  @ApiProperty({
    description: "Poll option text",
    example: "Option A",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  text: string;

  @ApiPropertyOptional({
    description: "Option ID (for tracking)",
    example: "opt_abc123",
  })
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @ApiPropertyOptional({
    description: "Initial vote count (for existing polls)",
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  votes?: number | null;

  @ApiPropertyOptional({
    description: "Additional option metadata",
    example: { color: "#FF6B6B" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}

export class PollDto {
  @ApiProperty({
    description: "Poll question",
    example: "Which option do you prefer?",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  question: string;

  @ApiProperty({
    description: "Poll options",
    type: [PollOptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  @ArrayMinSize(2, { message: "Poll must have at least 2 options" })
  @ArrayMaxSize(10, { message: "Poll cannot have more than 10 options" })
  options: PollOptionDto[];

  @ApiPropertyOptional({
    description: "Whether multiple selections are allowed",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  multipleChoice?: boolean;

  @ApiPropertyOptional({
    description: "Poll expiry time (ISO 8601)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date | null;

  @ApiPropertyOptional({
    description: "Whether votes are anonymous",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;

  @ApiPropertyOptional({
    description: "Additional poll metadata",
    example: { category: "feedback" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}

// -------- MAIN DTO --------

/**
 * DTO for sending a new message.
 */
export class SendMessageDto {
  // -------- REQUIRED FIELDS --------
  @ApiProperty({
    description: "Chat ID where the message will be sent",
    example: "chat_abc123",
  })
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({
    description: "Message content",
    example: "Hello World!",
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
    description: "Message type",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({
    description: "Reply to a specific message ID",
    example: "msg_def456",
  })
  @IsOptional()
  @IsUUID()
  replyToId?: string | null;

  @ApiPropertyOptional({
    description: "List of mentioned user IDs",
    example: ["user_abc123", "user_def456"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(100, { message: "Cannot mention more than 100 users" })
  mentions?: string[];

  @ApiPropertyOptional({
    description: "Message priority",
    enum: MessagePriority,
    default: MessagePriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;

  @ApiPropertyOptional({
    description: "Message visibility",
    enum: MessageVisibility,
    default: MessageVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(MessageVisibility)
  visibility?: MessageVisibility;

  @ApiPropertyOptional({
    description: "Attachments for the message",
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @ArrayMaxSize(20, { message: "Cannot attach more than 20 files" })
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description: "Location data for location messages",
    type: LocationDto,
  })
  @ValidateIf((o) => o.messageType === MessageType.LOCATION)
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto | null;

  @ApiPropertyOptional({
    description: "Poll data for poll messages",
    type: PollDto,
  })
  @ValidateIf((o) => o.messageType === MessageType.POLL)
  @IsOptional()
  @ValidateNested()
  @Type(() => PollDto)
  poll?: PollDto | null;

  @ApiPropertyOptional({
    description: "Contact data for contact sharing",
    example: {
      name: "Jane Doe",
      phone: "+15551234567",
      email: "jane@example.com",
    },
  })
  @ValidateIf((o) => o.messageType === MessageType.CONTACT)
  @IsOptional()
  @IsObject()
  contact?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: "Message metadata (custom key-value pairs)",
    example: {
      category: "work",
      importance: "high",
      tags: ["project", "urgent"],
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;

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
    description: "Delivery expiry timestamp (ISO 8601)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deliveryExpiry?: Date | null;

  @ApiPropertyOptional({
    description: "Schedule delivery timestamp (ISO 8601)",
    example: "2024-12-31T10:00:00Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date | null;

  @ApiPropertyOptional({
    description: "Whether to request read receipt",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requestReadReceipt?: boolean;

  @ApiPropertyOptional({
    description: "Whether to request delivery receipt",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requestDeliveryReceipt?: boolean;

  @ApiPropertyOptional({
    description: "Client message ID (for deduplication)",
    example: "client_msg_123",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  clientMessageId?: string | null;

  @ApiPropertyOptional({
    description: "Message thread ID (for threading)",
    example: "thread_abc123",
  })
  @IsOptional()
  @IsUUID()
  threadId?: string | null;

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

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  @Exclude({ toPlainOnly: true })
  _skipValidation: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<SendMessageDto> = {}) {
    Object.assign(this, partial);
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Validate message content based on message type.
   */
  validateContentForType(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.messageType === MessageType.TEXT && !this.content) {
      errors.push("Text message requires content");
    }

    if (this.messageType === MessageType.LOCATION && !this.location) {
      errors.push("Location message requires location data");
    }

    if (this.messageType === MessageType.POLL && !this.poll) {
      errors.push("Poll message requires poll data");
    }

    if (this.messageType === MessageType.CONTACT && !this.contact) {
      errors.push("Contact message requires contact data");
    }

    if (
      this.messageType === MessageType.IMAGE ||
      this.messageType === MessageType.VIDEO ||
      this.messageType === MessageType.AUDIO ||
      this.messageType === MessageType.DOCUMENT
    ) {
      if (!this.attachments || this.attachments.length === 0) {
        errors.push(
          `${this.messageType} message requires at least one attachment`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate mentions (ensure users exist).
   */
  async validateMentions(
    userValidationFn: (userId: string) => Promise<boolean>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.mentions || this.mentions.length === 0) {
      return { valid: true, errors: [] };
    }

    for (const userId of this.mentions) {
      const exists = await userValidationFn(userId);
      if (!exists) {
        errors.push(`Mentioned user "${userId}" does not exist`);
      }
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
   * Check if the message is a self-destructing message.
   */
  isSelfDestructing(): boolean {
    return (
      !!this.deliveryExpiry &&
      this.deliveryExpiry.getTime() < Date.now() + 24 * 60 * 60 * 1000
    );
  }

  /**
   * Check if the message is scheduled for future delivery.
   */
  isScheduled(): boolean {
    return !!this.scheduledAt && this.scheduledAt.getTime() > Date.now();
  }

  /**
   * Get the message type category.
   */
  getMessageCategory(): "text" | "media" | "interactive" | "system" {
    const mediaTypes = [
      MessageType.IMAGE,
      MessageType.VIDEO,
      MessageType.AUDIO,
      MessageType.VOICE_NOTE,
      MessageType.DOCUMENT,
      MessageType.GIF,
      MessageType.STICKER,
    ];

    const interactiveTypes = [
      MessageType.POLL,
      MessageType.LOCATION,
      MessageType.CONTACT,
    ];

    const systemTypes = [MessageType.EVENT, MessageType.SYSTEM];

    if (systemTypes.includes(this.messageType)) return "system";
    if (interactiveTypes.includes(this.messageType)) return "interactive";
    if (mediaTypes.includes(this.messageType)) return "media";
    return "text";
  }

  /**
   * Check if the message contains any attachments.
   */
  hasAttachments(): boolean {
    return !!this.attachments && this.attachments.length > 0;
  }

  /**
   * Check if the message contains mentions.
   */
  hasMentions(): boolean {
    return !!this.mentions && this.mentions.length > 0;
  }

  /**
   * Check if the message is a reply.
   */
  isReply(): boolean {
    return !!this.replyToId;
  }

  /**
   * Check if the message is encrypted.
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
   * Get the effective message priority.
   */
  getEffectivePriority(): MessagePriority {
    if (this.priority) return this.priority;
    if (this.messageType === MessageType.EVENT) return MessagePriority.HIGH;
    if (this.isSelfDestructing()) return MessagePriority.URGENT;
    return MessagePriority.NORMAL;
  }

  /**
   * Validate attachments.
   */
  validateAttachments(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.attachments) return { valid: true, errors: [] };

    const totalSize = this.attachments.reduce(
      (sum, att) => sum + (att.fileSize || 0),
      0,
    );
    const maxTotalSize = 100 * 1024 * 1024; // 100MB

    if (totalSize > maxTotalSize) {
      errors.push(
        `Total attachments size (${totalSize} bytes) exceeds limit (${maxTotalSize} bytes)`,
      );
    }

    for (const att of this.attachments) {
      if (att.fileName && att.fileName.length > 255) {
        errors.push(`File name "${att.fileName}" exceeds 255 characters`);
      }
      if (att.fileSize && att.fileSize > 100 * 1024 * 1024) {
        errors.push(`File "${att.fileName}" exceeds 100MB limit`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for service layer.
   */
  toServicePayload(): {
    chatId: string;
    content: string;
    messageType: MessageType;
    replyToId?: string;
    mentions?: string[];
    attachments?: any[];
    metadata?: Record<string, any>;
    encryptedContent?: string;
    encryptionKeyId?: string;
    signature?: string;
    scheduledAt?: Date;
    deliveryExpiry?: Date;
    priority: MessagePriority;
    visibility: MessageVisibility;
    clientMessageId?: string;
  } {
    const payload: any = {
      chatId: this.chatId,
      content: this.getSanitizedContent(),
      messageType: this.messageType || MessageType.TEXT,
      priority: this.getEffectivePriority(),
      visibility: this.visibility || MessageVisibility.PUBLIC,
    };

    if (this.replyToId) payload.replyToId = this.replyToId;
    if (this.mentions && this.mentions.length > 0)
      payload.mentions = this.mentions;
    if (this.attachments && this.attachments.length > 0)
      payload.attachments = this.attachments;
    if (this.metadata) payload.metadata = this.metadata;
    if (this.encryptedContent) payload.encryptedContent = this.encryptedContent;
    if (this.encryptionKeyId) payload.encryptionKeyId = this.encryptionKeyId;
    if (this.signature) payload.signature = this.signature;
    if (this.scheduledAt) payload.scheduledAt = this.scheduledAt;
    if (this.deliveryExpiry) payload.deliveryExpiry = this.deliveryExpiry;
    if (this.clientMessageId) payload.clientMessageId = this.clientMessageId;

    return payload;
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<SendMessageDto> {
    return {
      chatId: this.chatId,
      content: this.getSanitizedContent(),
      messageType: this.messageType,
      replyToId: this.replyToId,
      mentions: this.mentions,
      priority: this.priority,
      visibility: this.visibility,
      attachments: this.attachments,
      metadata: this.metadata,
      scheduledAt: this.scheduledAt,
      deliveryExpiry: this.deliveryExpiry,
      requestReadReceipt: this.requestReadReceipt,
      clientMessageId: this.clientMessageId,
    };
  }

  // -------- FACTORY METHODS --------

  /**
   * Create a test message DTO.
   */
  static createTestMessage(
    overrides: Partial<SendMessageDto> = {},
  ): SendMessageDto {
    return new SendMessageDto({
      chatId: "test_chat_123",
      content: "This is a test message",
      messageType: MessageType.TEXT,
      priority: MessagePriority.NORMAL,
      visibility: MessageVisibility.PUBLIC,
      requestReadReceipt: true,
      requestDeliveryReceipt: true,
      ...overrides,
    });
  }

  /**
   * Create a test message with attachments.
   */
  static createTestMessageWithAttachments(
    overrides: Partial<SendMessageDto> = {},
  ): SendMessageDto {
    return new SendMessageDto({
      chatId: "test_chat_123",
      content: "Test message with attachments",
      messageType: MessageType.IMAGE,
      attachments: [
        {
          fileName: "test.jpg",
          fileSize: 1024 * 100,
          mimeType: "image/jpeg",
          url: "https://example.com/test.jpg",
          width: 1920,
          height: 1080,
        },
      ],
      ...overrides,
    });
  }

  /**
   * Create a test location message.
   */
  static createTestLocationMessage(
    overrides: Partial<SendMessageDto> = {},
  ): SendMessageDto {
    return new SendMessageDto({
      chatId: "test_chat_123",
      content: "Sharing location",
      messageType: MessageType.LOCATION,
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        address: "New York, NY, USA",
      },
      ...overrides,
    });
  }

  /**
   * Create a test poll message.
   */
  static createTestPollMessage(
    overrides: Partial<SendMessageDto> = {},
  ): SendMessageDto {
    return new SendMessageDto({
      chatId: "test_chat_123",
      content: "Please vote",
      messageType: MessageType.POLL,
      poll: {
        question: "What is your favorite color?",
        options: [{ text: "Red" }, { text: "Blue" }, { text: "Green" }],
        multipleChoice: false,
        anonymous: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      ...overrides,
    });
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): SendMessageDto {
    return plainToClass(SendMessageDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
