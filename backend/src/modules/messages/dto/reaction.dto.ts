// backend/src/modules/messages/dto/reaction.dto.ts
/**
 * 📄 Reaction DTO
 *
 * Defines the data transfer object for adding and removing reactions
 * to messages. Includes validation, Swagger documentation, and helper methods.
 *
 * @module MessagesDTO
 * @category DTOs
 */

import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsInt,
  IsPositive,
  IsObject,
  IsArray,
  MaxLength,
  MinLength,
  ValidateIf,
  IsNotEmpty,
  IsIn,
  Matches,
  IsDate,
  IsDateString,
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

export enum ReactionType {
  /** Standard Unicode emoji */
  EMOJI = "emoji",
  /** Custom emoji (server-defined) */
  CUSTOM = "custom",
  /** Animated emoji (GIF) */
  ANIMATED = "animated",
  /** Reaction group (e.g., "like", "love") */
  GROUP = "group",
  /** Sticker reaction */
  STICKER = "sticker",
}

export enum ReactionGroup {
  /** 👍 - Like/Agree */
  LIKE = "like",
  /** ❤️ - Love */
  LOVE = "love",
  /** 😂 - Laugh/Funny */
  LAUGH = "laugh",
  /** 😮 - Wow/Surprise */
  WOW = "wow",
  /** 😢 - Sad/Sympathy */
  SAD = "sad",
  /** 😡 - Angry/Disagree */
  ANGRY = "angry",
  /** 🎉 - Celebrate */
  CELEBRATE = "celebrate",
  /** 👏 - Applause */
  APPLAUSE = "applause",
  /** 🙏 - Thankful/Grateful */
  THANKFUL = "thankful",
  /** 🤔 - Thinking/Confused */
  THINKING = "thinking",
  /** 💯 - Perfect/100 */
  PERFECT = "perfect",
  /** 🔥 - Fire/Lit */
  FIRE = "fire",
  /** 💀 - Dead/Hilarious */
  DEAD = "dead",
  /** 🫡 - Salute/Respect */
  SALUTE = "salute",
}

export enum ReactionAction {
  /** Add a reaction */
  ADD = "add",
  /** Remove a reaction */
  REMOVE = "remove",
  /** Toggle reaction (add if not present, remove if present) */
  TOGGLE = "toggle",
  /** Replace existing reaction with a new one */
  REPLACE = "replace",
  /** Clear all reactions from a message */
  CLEAR = "clear",
}

// -------- NESTED DTOs --------

/**
 * Custom emoji definition.
 */
export class CustomEmojiDto {
  @ApiProperty({
    description: "Custom emoji ID",
    example: "emoji_abc123",
  })
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: "Custom emoji name",
    example: "party_parrot",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toLowerCase() || "")
  name: string;

  @ApiProperty({
    description: "Custom emoji URL",
    example: "https://storage.example.com/emojis/party_parrot.gif",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^https?:\/\/[^\s]+$/, {
    message: "Invalid URL format for custom emoji",
  })
  @Transform(({ value }) => value?.trim() || "")
  url: string;

  @ApiPropertyOptional({
    description: "Emoji category",
    example: "animals",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  category?: string | null;

  @ApiPropertyOptional({
    description: "Emoji tags for search",
    example: ["party", "celebrate", "fun"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  @ApiPropertyOptional({
    description: "Additional emoji metadata",
    example: { animated: true, width: 64, height: 64 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}

/**
 * Reaction metadata for tracking.
 */
export class ReactionMetadataDto {
  @ApiPropertyOptional({
    description: "Device ID where the reaction was added",
    example: "device_abc123",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  deviceId?: string | null;

  @ApiPropertyOptional({
    description: "IP address of the user who added the reaction",
    example: "192.168.1.1",
  })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  @Transform(({ value }) => value?.trim() || null)
  ipAddress?: string | null;

  @ApiPropertyOptional({
    description: "User agent of the device",
    example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  userAgent?: string | null;

  @ApiPropertyOptional({
    description: "Emoji picker position (for UI consistency)",
    example: { x: 100, y: 50 },
  })
  @IsOptional()
  @IsObject()
  position?: { x: number; y: number } | null;

  @ApiPropertyOptional({
    description: "Additional reaction metadata",
    example: { source: "quick_reaction", context: "chat" },
  })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any> | null;
}

// -------- MAIN DTO --------

/**
 * DTO for adding or removing a reaction to a message.
 */
export class ReactionDto {
  // -------- REQUIRED FIELDS --------
  @ApiProperty({
    description: "Reaction content (emoji or custom emoji ID)",
    example: "👍",
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: "Reaction cannot be empty" })
  @MaxLength(50, { message: "Reaction cannot exceed 50 characters" })
  @Transform(({ value }) => {
    const sanitized = SanitizeUtil.sanitizeInput(value, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
    });
    return sanitized;
  })
  reaction: string;

  // -------- OPTIONAL FIELDS --------
  @ApiPropertyOptional({
    description: "Reaction type",
    enum: ReactionType,
    default: ReactionType.EMOJI,
  })
  @IsOptional()
  @IsEnum(ReactionType)
  type?: ReactionType;

  @ApiPropertyOptional({
    description: "Reaction group (for categorized reactions)",
    enum: ReactionGroup,
  })
  @IsOptional()
  @IsEnum(ReactionGroup)
  group?: ReactionGroup;

  @ApiPropertyOptional({
    description: "Reaction action",
    enum: ReactionAction,
    default: ReactionAction.ADD,
  })
  @IsOptional()
  @IsEnum(ReactionAction)
  action?: ReactionAction;

  @ApiPropertyOptional({
    description: "Custom emoji data (for custom reactions)",
    type: CustomEmojiDto,
  })
  @ValidateIf(
    (o) => o.type === ReactionType.CUSTOM || o.type === ReactionType.ANIMATED,
  )
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomEmojiDto)
  customEmoji?: CustomEmojiDto | null;

  @ApiPropertyOptional({
    description: "Reaction metadata",
    type: ReactionMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReactionMetadataDto)
  metadata?: ReactionMetadataDto | null;

  @ApiPropertyOptional({
    description: "Whether to react with a skin tone variation",
    example: "🏿",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[🏻🏼🏽🏾🏿]$/, {
    message: "Invalid skin tone (use: 🏻 🏼 🏽 🏾 🏿)",
  })
  @Transform(({ value }) => value?.trim() || null)
  skinTone?: string | null;

  @ApiPropertyOptional({
    description: "Message ID to react to (for direct API calls)",
    example: "msg_abc123",
  })
  @IsOptional()
  @IsUUID()
  messageId?: string | null;

  @ApiPropertyOptional({
    description: "Chat ID (for validation)",
    example: "chat_abc123",
  })
  @IsOptional()
  @IsUUID()
  chatId?: string | null;

  @ApiPropertyOptional({
    description: "Timestamp when the reaction was added (ISO 8601)",
    example: "2024-01-15T10:30:00Z",
  })
  @IsOptional()
  @IsDateString()
  reactedAt?: string | null;

  @ApiPropertyOptional({
    description: "Whether to notify the message author about the reaction",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyAuthor?: boolean;

  @ApiPropertyOptional({
    description: "Whether the reaction is private (only visible to the user)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({
    description: "Reaction context (e.g., message, story, status)",
    example: "message",
  })
  @IsOptional()
  @IsString()
  @IsIn(["message", "story", "status", "comment"])
  context?: string;

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  @Exclude({ toPlainOnly: true })
  _skipValidation: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<ReactionDto> = {}) {
    Object.assign(this, partial);
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Validate reaction content.
   */
  validateReaction(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.reaction) {
      errors.push("Reaction is required");
      return { valid: false, errors };
    }

    // Check if reaction is a valid emoji or custom emoji reference
    const isEmoji =
      /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{1F1E0}-\u{1F1FF}]/u.test(
        this.reaction,
      );
    const isCustomEmojiId = /^emoji_[a-zA-Z0-9]+$/.test(this.reaction);

    if (!isEmoji && !isCustomEmojiId) {
      errors.push("Reaction must be a valid emoji or custom emoji ID");
    }

    // Validate skin tone (if provided)
    if (
      this.skinTone &&
      !["🏻", "🏼", "🏽", "🏾", "🏿"].includes(this.skinTone)
    ) {
      errors.push("Invalid skin tone. Use: 🏻 🏼 🏽 🏾 🏿");
    }

    // Validate custom emoji data (if type is CUSTOM or ANIMATED)
    if (
      this.type === ReactionType.CUSTOM ||
      this.type === ReactionType.ANIMATED
    ) {
      if (!this.customEmoji) {
        errors.push("Custom emoji data is required for custom reactions");
      }
    }

    // Validate action-specific requirements
    if (this.action === ReactionAction.CLEAR) {
      // Clear action doesn't require reaction content
      // But we should validate that messageId is provided
      if (!this.messageId) {
        errors.push("messageId is required for clearing reactions");
      }
    }

    if (this.action === ReactionAction.TOGGLE && !this.reaction) {
      errors.push("Reaction is required for toggle action");
    }

    if (this.action === ReactionAction.REPLACE && !this.reaction) {
      errors.push("Reaction is required for replace action");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get the sanitized reaction content.
   */
  getSanitizedReaction(): string {
    return SanitizeUtil.sanitizeInput(this.reaction, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 50,
    });
  }

  /**
   * Get the effective reaction type.
   */
  getEffectiveType(): ReactionType {
    if (this.type) return this.type;

    // Auto-detect type
    const isEmoji =
      /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{1F1E0}-\u{1F1FF}]/u.test(
        this.reaction,
      );
    if (isEmoji) return ReactionType.EMOJI;

    const isCustomId = /^emoji_[a-zA-Z0-9]+$/.test(this.reaction);
    if (isCustomId) return ReactionType.CUSTOM;

    return ReactionType.EMOJI; // Default
  }

  /**
   * Get the effective reaction action.
   */
  getEffectiveAction(): ReactionAction {
    return this.action || ReactionAction.ADD;
  }

  /**
   * Get the effective reaction group (if not provided, auto-detect).
   */
  getEffectiveGroup(): ReactionGroup | null {
    if (this.group) return this.group;

    // Map common emojis to groups
    const emojiMap: Record<string, ReactionGroup> = {
      "👍": ReactionGroup.LIKE,
      "❤️": ReactionGroup.LOVE,
      "♥️": ReactionGroup.LOVE,
      "😍": ReactionGroup.LOVE,
      "😂": ReactionGroup.LAUGH,
      "😆": ReactionGroup.LAUGH,
      "🤣": ReactionGroup.LAUGH,
      "😮": ReactionGroup.WOW,
      "😲": ReactionGroup.WOW,
      "😢": ReactionGroup.SAD,
      "😭": ReactionGroup.SAD,
      "😡": ReactionGroup.ANGRY,
      "🤬": ReactionGroup.ANGRY,
      "🎉": ReactionGroup.CELEBRATE,
      "👏": ReactionGroup.APPLAUSE,
      "🙏": ReactionGroup.THANKFUL,
      "🤔": ReactionGroup.THINKING,
      "💯": ReactionGroup.PERFECT,
      "🔥": ReactionGroup.FIRE,
      "💀": ReactionGroup.DEAD,
      "🫡": ReactionGroup.SALUTE,
    };

    const normalizedReaction = this.reaction.trim();
    return emojiMap[normalizedReaction] || null;
  }

  /**
   * Check if the reaction is a skin-tone variant.
   */
  hasSkinTone(): boolean {
    return !!this.skinTone;
  }

  /**
   * Get the reaction with skin tone applied.
   */
  getReactionWithSkinTone(): string {
    if (!this.skinTone) return this.reaction;
    // For emoji reactions, append skin tone
    // This is a simplified implementation
    const baseEmoji = this.reaction.replace(/[🏻🏼🏽🏾🏿]$/, "");
    return baseEmoji + this.skinTone;
  }

  /**
   * Check if the reaction is a standard emoji.
   */
  isStandardEmoji(): boolean {
    return this.getEffectiveType() === ReactionType.EMOJI;
  }

  /**
   * Check if the reaction is custom.
   */
  isCustom(): boolean {
    return (
      this.getEffectiveType() === ReactionType.CUSTOM ||
      this.getEffectiveType() === ReactionType.ANIMATED
    );
  }

  /**
   * Check if the reaction is animated.
   */
  isAnimated(): boolean {
    return this.getEffectiveType() === ReactionType.ANIMATED;
  }

  /**
   * Check if the reaction is a group reaction.
   */
  isGroupReaction(): boolean {
    return this.getEffectiveType() === ReactionType.GROUP;
  }

  /**
   * Get the reaction category.
   */
  getCategory(): string {
    const group = this.getEffectiveGroup();
    if (group) return group;
    return "other";
  }

  /**
   * Check if the reaction should notify the author.
   */
  shouldNotifyAuthor(): boolean {
    return this.notifyAuthor !== false;
  }

  /**
   * Check if the reaction is private.
   */
  isPrivate(): boolean {
    return this.private === true;
  }

  /**
   * Get the context (defaults to 'message').
   */
  getContext(): string {
    return this.context || "message";
  }

  /**
   * Check if the reaction is valid for the context.
   */
  isValidForContext(): boolean {
    const validContexts = ["message", "story", "status", "comment"];
    return validContexts.includes(this.getContext());
  }

  /**
   * Get the effective timestamp (reactedAt or now).
   */
  getEffectiveTimestamp(): Date {
    if (this.reactedAt) {
      const date = new Date(this.reactedAt);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  }

  /**
   * Get the sanitized metadata.
   */
  getSanitizedMetadata(): ReactionMetadataDto | null {
    if (!this.metadata) return null;
    const metadata = { ...this.metadata };
    // Sanitize IP address (only IPv4/IPv6)
    if (metadata.ipAddress) {
      const ipRegex =
        /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (!ipRegex.test(metadata.ipAddress)) {
        delete metadata.ipAddress;
      }
    }
    // Sanitize user agent (basic)
    if (metadata.userAgent) {
      metadata.userAgent = SanitizeUtil.sanitizeInput(metadata.userAgent, {
        trim: true,
        maxLength: 500,
      });
    }
    return metadata;
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for service layer.
   */
  toServicePayload(): {
    reaction: string;
    type: ReactionType;
    group?: ReactionGroup;
    action: ReactionAction;
    customEmoji?: CustomEmojiDto;
    metadata?: ReactionMetadataDto;
    skinTone?: string;
    messageId?: string;
    chatId?: string;
    reactedAt: Date;
    notifyAuthor: boolean;
    private: boolean;
    context: string;
  } {
    return {
      reaction: this.getSanitizedReaction(),
      type: this.getEffectiveType(),
      group: this.getEffectiveGroup() || undefined,
      action: this.getEffectiveAction(),
      customEmoji: this.customEmoji || undefined,
      metadata: this.getSanitizedMetadata() || undefined,
      skinTone: this.skinTone || undefined,
      messageId: this.messageId || undefined,
      chatId: this.chatId || undefined,
      reactedAt: this.getEffectiveTimestamp(),
      notifyAuthor: this.shouldNotifyAuthor(),
      private: this.isPrivate(),
      context: this.getContext(),
    };
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<ReactionDto> {
    return {
      reaction: this.getSanitizedReaction(),
      type: this.type,
      group: this.group,
      action: this.action,
      customEmoji: this.customEmoji,
      metadata: this.metadata,
      skinTone: this.skinTone,
      messageId: this.messageId,
      chatId: this.chatId,
      reactedAt: this.reactedAt,
      notifyAuthor: this.notifyAuthor,
      private: this.private,
      context: this.context,
    };
  }

  /**
   * Convert to a WebSocket payload.
   */
  toSocketPayload(): {
    reaction: string;
    type: ReactionType;
    group?: string;
    action: ReactionAction;
    messageId?: string;
    userId?: string;
    timestamp: string;
  } {
    return {
      reaction: this.getSanitizedReaction(),
      type: this.getEffectiveType(),
      group: this.getEffectiveGroup() || undefined,
      action: this.getEffectiveAction(),
      messageId: this.messageId || undefined,
      timestamp: this.getEffectiveTimestamp().toISOString(),
    };
  }

  // -------- FACTORY METHODS --------

  /**
   * Create a standard like reaction.
   */
  static like(messageId: string, userId?: string): ReactionDto {
    return new ReactionDto({
      reaction: "👍",
      type: ReactionType.EMOJI,
      group: ReactionGroup.LIKE,
      action: ReactionAction.ADD,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create a love reaction.
   */
  static love(messageId: string, userId?: string): ReactionDto {
    return new ReactionDto({
      reaction: "❤️",
      type: ReactionType.EMOJI,
      group: ReactionGroup.LOVE,
      action: ReactionAction.ADD,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create a laugh reaction.
   */
  static laugh(messageId: string, userId?: string): ReactionDto {
    return new ReactionDto({
      reaction: "😂",
      type: ReactionType.EMOJI,
      group: ReactionGroup.LAUGH,
      action: ReactionAction.ADD,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create a wow reaction.
   */
  static wow(messageId: string, userId?: string): ReactionDto {
    return new ReactionDto({
      reaction: "😮",
      type: ReactionType.EMOJI,
      group: ReactionGroup.WOW,
      action: ReactionAction.ADD,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create a sad reaction.
   */
  static sad(messageId: string, userId?: string): ReactionDto {
    return new ReactionDto({
      reaction: "😢",
      type: ReactionType.EMOJI,
      group: ReactionGroup.SAD,
      action: ReactionAction.ADD,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create an angry reaction.
   */
  static angry(messageId: string, userId?: string): ReactionDto {
    return new ReactionDto({
      reaction: "😡",
      type: ReactionType.EMOJI,
      group: ReactionGroup.ANGRY,
      action: ReactionAction.ADD,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create a toggle reaction (add if not present, remove if present).
   */
  static toggle(reaction: string, messageId: string): ReactionDto {
    return new ReactionDto({
      reaction,
      type: ReactionType.EMOJI,
      action: ReactionAction.TOGGLE,
      messageId,
      notifyAuthor: true,
    });
  }

  /**
   * Create a remove reaction DTO.
   */
  static remove(reaction: string, messageId: string): ReactionDto {
    return new ReactionDto({
      reaction,
      type: ReactionType.EMOJI,
      action: ReactionAction.REMOVE,
      messageId,
      notifyAuthor: false,
    });
  }

  /**
   * Create a clear all reactions DTO.
   */
  static clear(messageId: string): ReactionDto {
    return new ReactionDto({
      reaction: "",
      type: ReactionType.EMOJI,
      action: ReactionAction.CLEAR,
      messageId,
      notifyAuthor: false,
    });
  }

  /**
   * Create a custom reaction DTO.
   */
  static custom(
    emojiId: string,
    messageId: string,
    emojiData: CustomEmojiDto,
  ): ReactionDto {
    return new ReactionDto({
      reaction: emojiId,
      type: ReactionType.CUSTOM,
      action: ReactionAction.ADD,
      messageId,
      customEmoji: emojiData,
      notifyAuthor: true,
    });
  }

  /**
   * Create a test reaction DTO.
   */
  static createTestReaction(overrides: Partial<ReactionDto> = {}): ReactionDto {
    return new ReactionDto({
      reaction: "👍",
      type: ReactionType.EMOJI,
      group: ReactionGroup.LIKE,
      action: ReactionAction.ADD,
      messageId: "test_message_123",
      notifyAuthor: true,
      private: false,
      context: "message",
      ...overrides,
    });
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): ReactionDto {
    return plainToClass(ReactionDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
