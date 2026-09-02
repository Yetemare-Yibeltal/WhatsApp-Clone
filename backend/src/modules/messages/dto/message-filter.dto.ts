// backend/src/modules/messages/dto/message-filter.dto.ts
/**
 * 📄 Message Filter DTO
 *
 * Defines the data transfer object for filtering and searching messages.
 * Includes validation, Swagger documentation, and helper methods.
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
  IsBoolean,
  IsNumber,
  IsDate,
  IsInt,
  IsPositive,
  MinLength,
  MaxLength,
  ValidateIf,
  IsIn,
  IsUrl,
  IsNotEmpty,
  IsMongoId,
  IsObject,
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
import {
  MessageType,
  MessageStatus,
} from "../../../common/types/socket-payload.interface";
import { SanitizeUtil } from "../../../common/utils/sanitize.util";

// -------- ENUMS --------

export enum MatchMode {
  /** Contains the search text (default) */
  CONTAINS = "contains",
  /** Starts with the search text */
  STARTS_WITH = "startsWith",
  /** Ends with the search text */
  ENDS_WITH = "endsWith",
  /** Exact match (case-sensitive) */
  EXACT = "exact",
  /** Fuzzy match (approximate) */
  FUZZY = "fuzzy",
  /** Regex pattern matching */
  REGEX = "regex",
}

export enum DateField {
  /** Filter by createdAt */
  CREATED_AT = "createdAt",
  /** Filter by updatedAt */
  UPDATED_AT = "updatedAt",
  /** Filter by deliveredAt (status) */
  DELIVERED_AT = "deliveredAt",
  /** Filter by readAt (status) */
  READ_AT = "readAt",
  /** Filter by editedAt */
  EDITED_AT = "editedAt",
  /** Filter by scheduledAt */
  SCHEDULED_AT = "scheduledAt",
}

export enum OrderField {
  /** Order by createdAt */
  CREATED_AT = "createdAt",
  /** Order by updatedAt */
  UPDATED_AT = "updatedAt",
  /** Order by deliveredAt */
  DELIVERED_AT = "deliveredAt",
  /** Order by readAt */
  READ_AT = "readAt",
  /** Order by messageType */
  MESSAGE_TYPE = "messageType",
  /** Order by senderId */
  SENDER_ID = "senderId",
  /** Order by content length */
  CONTENT_LENGTH = "contentLength",
}

export enum OrderDirection {
  /** Ascending order */
  ASC = "asc",
  /** Descending order */
  DESC = "desc",
}

// -------- NESTED DTOs --------

/**
 * Advanced search options for full-text search.
 */
export class AdvancedSearchDto {
  @ApiPropertyOptional({
    description: "Search query text",
    example: "hello world",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  query?: string | null;

  @ApiPropertyOptional({
    description: "Search fields to include",
    example: ["content", "sender.displayName"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @ApiPropertyOptional({
    description: "Match mode",
    enum: MatchMode,
    default: MatchMode.CONTAINS,
  })
  @IsOptional()
  @IsEnum(MatchMode)
  matchMode?: MatchMode;

  @ApiPropertyOptional({
    description: "Case sensitive search",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  @ApiPropertyOptional({
    description: "Search within specific chats only",
    example: ["chat_abc123", "chat_def456"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  chatIds?: string[];
}

/**
 * Attachment filter options.
 */
export class AttachmentFilterDto {
  @ApiPropertyOptional({
    description: "Filter messages with attachments",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasAttachments?: boolean;

  @ApiPropertyOptional({
    description: "Filter by attachment MIME types",
    example: ["image/jpeg", "image/png"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mimeTypes?: string[];

  @ApiPropertyOptional({
    description: "Filter by file types (extensions)",
    example: [".pdf", ".docx"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileExtensions?: string[];

  @ApiPropertyOptional({
    description: "Minimum file size in bytes",
    example: 1024,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  minFileSize?: number;

  @ApiPropertyOptional({
    description: "Maximum file size in bytes",
    example: 10485760,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxFileSize?: number;
}

/**
 * Reaction filter options.
 */
export class ReactionFilterDto {
  @ApiPropertyOptional({
    description: "Filter messages with reactions",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasReactions?: boolean;

  @ApiPropertyOptional({
    description: "Filter by specific emoji reactions",
    example: ["👍", "❤️"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emojis?: string[];

  @ApiPropertyOptional({
    description: "Filter by user who reacted",
    example: "user_abc123",
  })
  @IsOptional()
  @IsUUID()
  reactedBy?: string;

  @ApiPropertyOptional({
    description: "Minimum number of reactions",
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  minReactions?: number;
}

/**
 * Mention filter options.
 */
export class MentionFilterDto {
  @ApiPropertyOptional({
    description: "Filter messages with mentions",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasMentions?: boolean;

  @ApiPropertyOptional({
    description: "Filter by mentioned user IDs",
    example: ["user_abc123", "user_def456"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[];
}

// -------- MAIN DTO --------

/**
 * DTO for filtering and searching messages.
 */
export class MessageFilterDto {
  // -------- PAGINATION --------
  @ApiPropertyOptional({
    description: "Page number (1-indexed)",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  page?: number;

  @ApiPropertyOptional({
    description: "Number of items per page",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  limit?: number;

  // -------- SORTING --------
  @ApiPropertyOptional({
    description: "Sort field",
    enum: OrderField,
    default: OrderField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(OrderField)
  orderBy?: OrderField;

  @ApiPropertyOptional({
    description: "Sort direction",
    enum: OrderDirection,
    default: OrderDirection.DESC,
  })
  @IsOptional()
  @IsEnum(OrderDirection)
  orderDirection?: OrderDirection;

  // -------- CHAT FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by specific chat ID",
    example: "chat_abc123",
  })
  @IsOptional()
  @IsUUID()
  chatId?: string;

  @ApiPropertyOptional({
    description: "Filter by multiple chat IDs",
    example: ["chat_abc123", "chat_def456"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(100)
  chatIds?: string[];

  // -------- SENDER FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by sender user ID",
    example: "user_abc123",
  })
  @IsOptional()
  @IsUUID()
  senderId?: string;

  @ApiPropertyOptional({
    description: "Filter by multiple sender IDs",
    example: ["user_abc123", "user_def456"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  senderIds?: string[];

  // -------- MESSAGE TYPE FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by message type",
    enum: MessageType,
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({
    description: "Filter by multiple message types",
    enum: MessageType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(MessageType, { each: true })
  messageTypes?: MessageType[];

  // -------- STATUS FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by message status (for the current user)",
    enum: MessageStatus,
  })
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  // -------- DATE RANGE FILTERS --------
  @ApiPropertyOptional({
    description: "Start date for filtering (ISO 8601)",
    example: "2024-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date for filtering (ISO 8601)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Date field to apply range filters on",
    enum: DateField,
    default: DateField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(DateField)
  dateField?: DateField;

  // -------- TIME-BASED FILTERS --------
  @ApiPropertyOptional({
    description: "Messages from the last N minutes",
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  lastNMinutes?: number;

  @ApiPropertyOptional({
    description: "Messages from the last N days",
    example: 7,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  lastNDays?: number;

  // -------- SEARCH FILTERS --------
  @ApiPropertyOptional({
    description: "Search query (simple text search)",
    example: "hello world",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  search?: string;

  @ApiPropertyOptional({
    description: "Advanced search options",
    type: AdvancedSearchDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedSearchDto)
  advancedSearch?: AdvancedSearchDto;

  // -------- DELETION FILTERS --------
  @ApiPropertyOptional({
    description: "Include deleted messages",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;

  // -------- PIN FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by pinned status",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  // -------- REPLY FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by reply status (messages that are replies)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isReply?: boolean;

  @ApiPropertyOptional({
    description: "Filter by reply to specific message ID",
    example: "msg_abc123",
  })
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  // -------- ENCRYPTION FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by encryption status",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  // -------- VISIBILITY FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by visibility",
    enum: ["public", "private", "encrypted"],
  })
  @IsOptional()
  @IsIn(["public", "private", "encrypted"])
  visibility?: string;

  // -------- ATTACHMENT FILTERS --------
  @ApiPropertyOptional({
    description: "Attachment filter options",
    type: AttachmentFilterDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentFilterDto)
  attachmentFilter?: AttachmentFilterDto;

  // -------- REACTION FILTERS --------
  @ApiPropertyOptional({
    description: "Reaction filter options",
    type: ReactionFilterDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReactionFilterDto)
  reactionFilter?: ReactionFilterDto;

  // -------- MENTION FILTERS --------
  @ApiPropertyOptional({
    description: "Mention filter options",
    type: MentionFilterDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MentionFilterDto)
  mentionFilter?: MentionFilterDto;

  // -------- METADATA FILTERS --------
  @ApiPropertyOptional({
    description: "Filter by metadata key-value pairs",
    example: { category: "work", importance: "high" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  // -------- INCLUDES --------
  @ApiPropertyOptional({
    description: "Include sender details in response",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeSender?: boolean;

  @ApiPropertyOptional({
    description: "Include attachments in response",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeAttachments?: boolean;

  @ApiPropertyOptional({
    description: "Include reactions in response",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeReactions?: boolean;

  @ApiPropertyOptional({
    description: "Include reply-to message in response",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeReplyTo?: boolean;

  @ApiPropertyOptional({
    description: "Include statuses in response",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeStatuses?: boolean;

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _isTest: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<MessageFilterDto> = {}) {
    Object.assign(this, partial);
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Validate filter options.
   */
  validateFilters(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Page and limit validation
    if (this.page && this.page < 1) {
      errors.push("Page must be at least 1");
    }
    if (this.limit && (this.limit < 1 || this.limit > 500)) {
      errors.push("Limit must be between 1 and 500");
    }

    // Date validation
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (start > end) {
        errors.push("startDate must be before endDate");
      }
    }

    // Time-based filters
    if (this.lastNMinutes && this.lastNDays) {
      errors.push("Cannot specify both lastNMinutes and lastNDays");
    }

    // Chat filters
    if (this.chatId && this.chatIds && this.chatIds.length > 0) {
      errors.push("Cannot specify both chatId and chatIds");
    }

    // Sender filters
    if (this.senderId && this.senderIds && this.senderIds.length > 0) {
      errors.push("Cannot specify both senderId and senderIds");
    }

    // Message type filters
    if (this.messageType && this.messageTypes && this.messageTypes.length > 0) {
      errors.push("Cannot specify both messageType and messageTypes");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get effective page number.
   */
  getEffectivePage(): number {
    return this.page || 1;
  }

  /**
   * Get effective limit.
   */
  getEffectiveLimit(): number {
    return Math.min(this.limit || 20, 500);
  }

  /**
   * Get effective order field.
   */
  getEffectiveOrderBy(): OrderField {
    return this.orderBy || OrderField.CREATED_AT;
  }

  /**
   * Get effective order direction.
   */
  getEffectiveOrderDirection(): OrderDirection {
    return this.orderDirection || OrderDirection.DESC;
  }

  /**
   * Get effective date field.
   */
  getEffectiveDateField(): DateField {
    return this.dateField || DateField.CREATED_AT;
  }

  /**
   * Get effective chat IDs.
   */
  getEffectiveChatIds(): string[] {
    if (this.chatId) return [this.chatId];
    if (this.chatIds && this.chatIds.length > 0) return this.chatIds;
    return [];
  }

  /**
   * Get effective sender IDs.
   */
  getEffectiveSenderIds(): string[] {
    if (this.senderId) return [this.senderId];
    if (this.senderIds && this.senderIds.length > 0) return this.senderIds;
    return [];
  }

  /**
   * Get effective message types.
   */
  getEffectiveMessageTypes(): MessageType[] {
    if (this.messageType) return [this.messageType];
    if (this.messageTypes && this.messageTypes.length > 0)
      return this.messageTypes;
    return [];
  }

  /**
   * Get effective start date.
   */
  getEffectiveStartDate(): Date | null {
    if (this.startDate) return new Date(this.startDate);
    if (this.lastNMinutes) {
      const date = new Date();
      date.setMinutes(date.getMinutes() - this.lastNMinutes);
      return date;
    }
    if (this.lastNDays) {
      const date = new Date();
      date.setDate(date.getDate() - this.lastNDays);
      return date;
    }
    return null;
  }

  /**
   * Get effective end date.
   */
  getEffectiveEndDate(): Date | null {
    if (this.endDate) return new Date(this.endDate);
    return null;
  }

  /**
   * Check if attachments should be included.
   */
  shouldIncludeAttachments(): boolean {
    return this.includeAttachments !== false;
  }

  /**
   * Check if reactions should be included.
   */
  shouldIncludeReactions(): boolean {
    return this.includeReactions !== false;
  }

  /**
   * Check if sender should be included.
   */
  shouldIncludeSender(): boolean {
    return this.includeSender !== false;
  }

  /**
   * Check if statuses should be included.
   */
  shouldIncludeStatuses(): boolean {
    return this.includeStatuses !== false;
  }

  /**
   * Check if deleted messages should be included.
   */
  shouldIncludeDeleted(): boolean {
    return this.includeDeleted === true;
  }

  /**
   * Check if only pinned messages should be returned.
   */
  onlyPinned(): boolean {
    return this.isPinned === true;
  }

  /**
   * Check if only replied messages should be returned.
   */
  onlyReplies(): boolean {
    return this.isReply === true;
  }

  /**
   * Check if only encrypted messages should be returned.
   */
  onlyEncrypted(): boolean {
    return this.isEncrypted === true;
  }

  /**
   * Get the search query.
   */
  getSearchQuery(): string | null {
    if (this.search)
      return SanitizeUtil.sanitizeInput(this.search, {
        trim: true,
        maxLength: 500,
      });
    return null;
  }

  /**
   * Get the advanced search options.
   */
  getAdvancedSearch(): AdvancedSearchDto | null {
    if (this.advancedSearch && this.advancedSearch.query) {
      return this.advancedSearch;
    }
    return null;
  }

  /**
   * Check if any filters are set (to avoid unnecessary queries).
   */
  hasFilters(): boolean {
    return !!(
      this.chatId ||
      (this.chatIds && this.chatIds.length > 0) ||
      this.senderId ||
      (this.senderIds && this.senderIds.length > 0) ||
      this.messageType ||
      (this.messageTypes && this.messageTypes.length > 0) ||
      this.status ||
      this.startDate ||
      this.endDate ||
      this.lastNMinutes ||
      this.lastNDays ||
      this.search ||
      this.advancedSearch ||
      this.includeDeleted ||
      this.isPinned !== undefined ||
      this.isReply !== undefined ||
      this.isEncrypted !== undefined ||
      this.visibility ||
      this.metadata ||
      this.attachmentFilter ||
      this.reactionFilter ||
      this.mentionFilter
    );
  }

  /**
   * Build Prisma compatible where clause from filters.
   */
  buildWhereClause(): Record<string, any> {
    const where: Record<string, any> = {};

    // Chat filters
    const chatIds = this.getEffectiveChatIds();
    if (chatIds.length > 0) {
      where.chatId = { in: chatIds };
    }

    // Sender filters
    const senderIds = this.getEffectiveSenderIds();
    if (senderIds.length > 0) {
      where.senderId = { in: senderIds };
    }

    // Message type filters
    const messageTypes = this.getEffectiveMessageTypes();
    if (messageTypes.length > 0) {
      where.messageType = { in: messageTypes };
    }

    // Status filter (note: status is per-user, so needs special handling)
    if (this.status) {
      // We'll handle this in the service layer
      where._status = this.status;
    }

    // Date range
    const startDate = this.getEffectiveStartDate();
    const endDate = this.getEffectiveEndDate();
    if (startDate || endDate) {
      const dateField = this.getEffectiveDateField();
      where[dateField] = {};
      if (startDate) where[dateField].gte = startDate;
      if (endDate) where[dateField].lte = endDate;
    }

    // Deleted
    if (!this.shouldIncludeDeleted()) {
      where.isDeleted = false;
    } else {
      // If includeDeleted is true, we may want to include both
      // But we handle in service
    }

    // Pinned
    if (this.isPinned !== undefined) {
      where.isPinned = this.isPinned;
    }

    // Reply
    if (this.isReply === true) {
      where.replyToId = { not: null };
    }
    if (this.replyToId) {
      where.replyToId = this.replyToId;
    }

    // Encryption
    if (this.isEncrypted !== undefined) {
      where.encryptedContent = this.isEncrypted ? { not: null } : null;
    }

    // Visibility
    if (this.visibility) {
      where.visibility = this.visibility;
    }

    // Metadata filters
    if (this.metadata) {
      for (const [key, value] of Object.entries(this.metadata)) {
        where[`metadata.${key}`] = value;
      }
    }

    // Attachment filter
    if (this.attachmentFilter) {
      if (this.attachmentFilter.hasAttachments !== undefined) {
        where.attachments = this.attachmentFilter.hasAttachments
          ? { some: {} }
          : { none: {} };
      }
      if (
        this.attachmentFilter.mimeTypes &&
        this.attachmentFilter.mimeTypes.length > 0
      ) {
        where.attachments = {
          some: { mimeType: { in: this.attachmentFilter.mimeTypes } },
        };
      }
      // Note: minFileSize/maxFileSize can be added if needed
    }

    // Reaction filter
    if (this.reactionFilter) {
      if (this.reactionFilter.hasReactions !== undefined) {
        // Requires reactions relation
      }
      if (this.reactionFilter.emojis && this.reactionFilter.emojis.length > 0) {
        // Requires reactions relation
      }
    }

    // Mention filter
    if (this.mentionFilter) {
      if (this.mentionFilter.hasMentions !== undefined) {
        where.mentions = this.mentionFilter.hasMentions ? { not: null } : null;
      }
      if (
        this.mentionFilter.mentionedUserIds &&
        this.mentionFilter.mentionedUserIds.length > 0
      ) {
        // Requires mentions array intersection
      }
    }

    return where;
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for service layer.
   */
  toServicePayload(): {
    page: number;
    limit: number;
    orderBy: OrderField;
    orderDirection: OrderDirection;
    chatIds: string[];
    senderIds: string[];
    messageTypes: MessageType[];
    status?: MessageStatus;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    includeDeleted: boolean;
    isPinned?: boolean;
    isReply?: boolean;
    isEncrypted?: boolean;
    metadata?: Record<string, any>;
    includeSender: boolean;
    includeAttachments: boolean;
    includeReactions: boolean;
    includeReplyTo: boolean;
    includeStatuses: boolean;
  } {
    return {
      page: this.getEffectivePage(),
      limit: this.getEffectiveLimit(),
      orderBy: this.getEffectiveOrderBy(),
      orderDirection: this.getEffectiveOrderDirection(),
      chatIds: this.getEffectiveChatIds(),
      senderIds: this.getEffectiveSenderIds(),
      messageTypes: this.getEffectiveMessageTypes(),
      status: this.status,
      startDate: this.getEffectiveStartDate() || undefined,
      endDate: this.getEffectiveEndDate() || undefined,
      search: this.getSearchQuery() || undefined,
      includeDeleted: this.shouldIncludeDeleted(),
      isPinned: this.isPinned,
      isReply: this.isReply,
      isEncrypted: this.isEncrypted,
      metadata: this.metadata,
      includeSender: this.shouldIncludeSender(),
      includeAttachments: this.shouldIncludeAttachments(),
      includeReactions: this.shouldIncludeReactions(),
      includeReplyTo: this.includeReplyTo !== false,
      includeStatuses: this.shouldIncludeStatuses(),
    };
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<MessageFilterDto> {
    return {
      page: this.page,
      limit: this.limit,
      orderBy: this.orderBy,
      orderDirection: this.orderDirection,
      chatId: this.chatId,
      chatIds: this.chatIds,
      senderId: this.senderId,
      senderIds: this.senderIds,
      messageType: this.messageType,
      messageTypes: this.messageTypes,
      status: this.status,
      startDate: this.startDate,
      endDate: this.endDate,
      lastNMinutes: this.lastNMinutes,
      lastNDays: this.lastNDays,
      search: this.search,
      includeDeleted: this.includeDeleted,
      isPinned: this.isPinned,
      isReply: this.isReply,
      isEncrypted: this.isEncrypted,
      visibility: this.visibility,
      metadata: this.metadata,
      includeSender: this.includeSender,
      includeAttachments: this.includeAttachments,
      includeReactions: this.includeReactions,
      includeReplyTo: this.includeReplyTo,
      includeStatuses: this.includeStatuses,
    };
  }

  // -------- FACTORY METHODS --------

  /**
   * Create a filter DTO for a chat.
   */
  static forChat(
    chatId: string,
    options: Partial<MessageFilterDto> = {},
  ): MessageFilterDto {
    return new MessageFilterDto({
      chatId,
      orderBy: OrderField.CREATED_AT,
      orderDirection: OrderDirection.DESC,
      includeAttachments: true,
      includeSender: true,
      includeReactions: true,
      ...options,
    });
  }

  /**
   * Create a filter DTO for searching.
   */
  static forSearch(
    search: string,
    options: Partial<MessageFilterDto> = {},
  ): MessageFilterDto {
    return new MessageFilterDto({
      search,
      orderBy: OrderField.CREATED_AT,
      orderDirection: OrderDirection.DESC,
      includeAttachments: true,
      includeSender: true,
      includeReactions: true,
      ...options,
    });
  }

  /**
   * Create a filter DTO for messages from a sender.
   */
  static forSender(
    senderId: string,
    options: Partial<MessageFilterDto> = {},
  ): MessageFilterDto {
    return new MessageFilterDto({
      senderId,
      orderBy: OrderField.CREATED_AT,
      orderDirection: OrderDirection.DESC,
      includeAttachments: true,
      includeSender: true,
      includeReactions: true,
      ...options,
    });
  }

  /**
   * Create a filter DTO for recent messages.
   */
  static forRecent(
    lastNMinutes: number = 60,
    options: Partial<MessageFilterDto> = {},
  ): MessageFilterDto {
    return new MessageFilterDto({
      lastNMinutes,
      orderBy: OrderField.CREATED_AT,
      orderDirection: OrderDirection.DESC,
      includeAttachments: true,
      includeSender: true,
      includeReactions: true,
      ...options,
    });
  }

  /**
   * Create a filter DTO for pinned messages.
   */
  static forPinned(options: Partial<MessageFilterDto> = {}): MessageFilterDto {
    return new MessageFilterDto({
      isPinned: true,
      orderBy: OrderField.CREATED_AT,
      orderDirection: OrderDirection.DESC,
      includeAttachments: true,
      includeSender: true,
      includeReactions: true,
      ...options,
    });
  }

  /**
   * Create a test filter DTO.
   */
  static createTestFilter(
    overrides: Partial<MessageFilterDto> = {},
  ): MessageFilterDto {
    return new MessageFilterDto({
      page: 1,
      limit: 20,
      orderBy: OrderField.CREATED_AT,
      orderDirection: OrderDirection.DESC,
      chatId: "test_chat_123",
      includeAttachments: true,
      includeSender: true,
      includeReactions: true,
      ...overrides,
    });
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): MessageFilterDto {
    return plainToClass(MessageFilterDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
