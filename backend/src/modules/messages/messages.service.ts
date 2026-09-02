// backend/src/modules/messages/messages.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { GroupsService } from "../groups/groups.service";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SYSTEM_EVENTS, BUSINESS_EVENTS } from "../../common/constants/events";
import {
  MessageStatus,
  MessageType,
} from "../../common/types/socket-payload.interface";
import { UserEntity } from "../users/entities/user.entity";
import { SendMessageDto, EditMessageDto, DeleteMessageDto } from "./dto";

// -------- INTERFACES --------
export interface SendMessageOptions {
  chatId: string;
  senderId: string;
  content: string;
  messageType?: MessageType;
  replyToId?: string;
  mentions?: string[];
  attachments?: any[];
  metadata?: Record<string, any>;
  encryptedContent?: string;
  encryptionKey?: string;
}

export interface MessageFilterOptions {
  chatId?: string;
  senderId?: string;
  messageType?: MessageType;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  isDeleted?: boolean;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "updatedAt";
  orderDirection?: "asc" | "desc";
}

export interface MessageStatusUpdate {
  messageId: string;
  userId: string;
  status: MessageStatus;
}

// -------- MAIN SERVICE --------

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly cachePrefix = "message:";
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    private readonly usersService: UsersService,
    @Optional()
    private readonly groupsService: GroupsService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.cacheTtl = this.configService.get<number>("MESSAGE_CACHE_TTL") || 300; // 5 minutes default
    this.logger.log("MessagesService initialized");
  }

  // -------- SEND MESSAGE --------

  /**
   * Send a new message.
   */
  async sendMessage(options: SendMessageOptions): Promise<any> {
    this.logger.debug(
      `Sending message in chat: ${options.chatId} from user: ${options.senderId}`,
    );

    // Validate chat exists and sender is a member
    await this.validateChatAccess(options.chatId, options.senderId);

    // Validate reply if provided
    let replyToMessage = null;
    if (options.replyToId) {
      replyToMessage = await this.getMessageById(
        options.replyToId,
        options.senderId,
      );
      if (!replyToMessage) {
        throw new NotFoundException("Reply target message not found");
      }
    }

    // Sanitize content
    const sanitizedContent = SanitizeUtil.sanitizeInput(options.content, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 10000,
    });

    // Prepare message data
    const messageType = options.messageType || MessageType.TEXT;
    const isEncrypted = !!options.encryptedContent;

    // Create message in transaction
    const message = await this.prisma.$transaction(async (tx) => {
      // Create the message
      const newMessage = await tx.message.create({
        data: {
          chatId: options.chatId,
          senderId: options.senderId,
          content: isEncrypted ? null : sanitizedContent,
          encryptedContent: options.encryptedContent || null,
          messageType: messageType,
          replyToId: options.replyToId || null,
          isDeleted: false,
          metadata: options.metadata || null,
        },
        include: {
          sender: {
            include: { profile: true },
          },
        },
      });

      // Create attachments if any
      if (options.attachments && options.attachments.length > 0) {
        for (const file of options.attachments) {
          await tx.attachment.create({
            data: {
              messageId: newMessage.id,
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              storagePath: file.path || "",
              thumbnailPath: file.thumbnailPath || null,
              width: file.width || null,
              height: file.height || null,
              duration: file.duration || null,
            },
          });
        }
      }

      // Create message statuses for all chat participants (except sender)
      const participants = await this.getChatParticipants(options.chatId);
      const recipientIds = participants
        .filter((id) => id !== options.senderId)
        .map((id) => ({
          messageId: newMessage.id,
          userId: id,
          status: MessageStatus.SENT,
        }));

      if (recipientIds.length > 0) {
        await tx.messageStatus.createMany({
          data: recipientIds,
        });
      }

      // Update last message timestamp in chat
      await tx.chat.update({
        where: { id: options.chatId },
        data: { updatedAt: new Date() },
      });

      return newMessage;
    });

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.MESSAGE_CREATE, {
      messageId: message.id,
      chatId: options.chatId,
      senderId: options.senderId,
      messageType: messageType,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.MESSAGE_SENT, {
      messageId: message.id,
      chatId: options.chatId,
      senderId: options.senderId,
      messageType: messageType,
      timestamp: new Date(),
    });

    // Clear cache
    await this.clearMessageCache(options.chatId);

    this.logger.log(`Message sent: ${message.id} in chat: ${options.chatId}`);

    // Return full message with attachments and statuses
    return this.getMessageWithDetails(message.id, options.senderId);
  }

  // -------- GET MESSAGES --------

  /**
   * Get messages from a chat with pagination and filtering.
   */
  async getMessages(
    chatId: string,
    userId: string,
    options: MessageFilterOptions = {},
  ): Promise<{
    messages: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.debug(
      `Getting messages for chat: ${chatId} from user: ${userId}`,
    );

    await this.validateChatAccess(chatId, userId);

    const {
      page = 1,
      limit = 20,
      search,
      senderId,
      messageType,
      startDate,
      endDate,
      isDeleted = false,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: any = {
      chatId,
      isDeleted: isDeleted ? true : false,
    };

    if (senderId) {
      where.senderId = senderId;
    }

    if (messageType) {
      where.messageType = messageType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        { content: { contains: search, mode: "insensitive" } },
        { encryptedContent: { contains: search, mode: "insensitive" } },
      ];
    }

    // Execute query
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: {
          sender: {
            include: { profile: true },
          },
          attachments: true,
          statuses: {
            where: { userId },
          },
          replyTo: {
            include: {
              sender: {
                include: { profile: true },
              },
            },
          },
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    // Format messages with user-specific status
    const formattedMessages = messages.map((msg) => {
      const userStatus = msg.statuses.find((s) => s.userId === userId);
      return {
        ...msg,
        userStatus: userStatus ? userStatus.status : MessageStatus.SENT,
        deliveredAt: userStatus?.deliveredAt || null,
        readAt: userStatus?.readAt || null,
      };
    });

    return {
      messages: formattedMessages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single message by ID.
   */
  async getMessageById(messageId: string, userId: string): Promise<any> {
    this.logger.debug(`Getting message: ${messageId} for user: ${userId}`);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          include: { profile: true },
        },
        attachments: true,
        statuses: {
          where: { userId },
        },
        replyTo: {
          include: {
            sender: {
              include: { profile: true },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    // Check if user has access to the chat
    await this.validateChatAccess(message.chatId, userId);

    const userStatus = message.statuses.find((s) => s.userId === userId);
    return {
      ...message,
      userStatus: userStatus ? userStatus.status : MessageStatus.SENT,
      deliveredAt: userStatus?.deliveredAt || null,
      readAt: userStatus?.readAt || null,
    };
  }

  /**
   * Get message with all details.
   */
  async getMessageWithDetails(messageId: string, userId: string): Promise<any> {
    const message = await this.getMessageById(messageId, userId);

    // Get all statuses for this message
    const allStatuses = await this.prisma.messageStatus.findMany({
      where: { messageId },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    // Get reactions
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    return {
      ...message,
      allStatuses,
      reactions,
    };
  }

  // -------- EDIT MESSAGE --------

  /**
   * Edit a message.
   */
  async editMessage(
    messageId: string,
    userId: string,
    editDto: EditMessageDto,
  ): Promise<any> {
    this.logger.debug(`Editing message: ${messageId} by user: ${userId}`);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    // Only sender can edit their own message
    if (message.senderId !== userId) {
      throw new ForbiddenException("You can only edit your own messages");
    }

    // Check if message can be edited (within time limit, etc.)
    const editWindow =
      this.configService.get<number>("MESSAGE_EDIT_WINDOW") || 300; // 5 minutes
    const now = new Date();
    const elapsed = (now.getTime() - message.createdAt.getTime()) / 1000;
    if (elapsed > editWindow) {
      throw new BadRequestException(
        `Cannot edit message after ${editWindow} seconds`,
      );
    }

    // Sanitize new content
    const sanitizedContent = SanitizeUtil.sanitizeInput(editDto.content, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 10000,
    });

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: sanitizedContent,
        editedAt: new Date(),
        metadata: editDto.metadata || message.metadata,
      },
      include: {
        sender: {
          include: { profile: true },
        },
        attachments: true,
      },
    });

    // Emit event
    this.eventEmitter.emit(SYSTEM_EVENTS.MESSAGE_UPDATE, {
      messageId,
      userId,
      chatId: message.chatId,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.MESSAGE_EDITED, {
      messageId,
      userId,
      chatId: message.chatId,
      timestamp: new Date(),
    });

    // Clear cache
    await this.clearMessageCache(message.chatId);

    this.logger.log(`Message edited: ${messageId} by user: ${userId}`);

    return updatedMessage;
  }

  // -------- DELETE MESSAGE --------

  /**
   * Delete a message (soft delete).
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    deleteDto: DeleteMessageDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Deleting message: ${messageId} by user: ${userId}`);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    const isSender = message.senderId === userId;
    const isAdmin = await this.isUserAdmin(userId);
    const isGroupAdmin = await this.isGroupAdmin(message.chatId, userId);

    // Check permission: sender, admin, or group admin can delete
    if (!isSender && !isAdmin && !isGroupAdmin) {
      throw new ForbiddenException(
        "You do not have permission to delete this message",
      );
    }

    // Check if deleting for everyone or just for self
    const forEveryone = deleteDto.forEveryone && (isSender || isAdmin);

    if (forEveryone) {
      // Delete for everyone (soft delete)
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // Remove all statuses (optional)
      // await this.prisma.messageStatus.deleteMany({ where: { messageId } });

      this.eventEmitter.emit(SYSTEM_EVENTS.MESSAGE_DELETE, {
        messageId,
        userId,
        chatId: message.chatId,
        forEveryone: true,
        timestamp: new Date(),
      });

      this.eventEmitter.emit(BUSINESS_EVENTS.MESSAGE_DELETED, {
        messageId,
        userId,
        chatId: message.chatId,
        forEveryone: true,
        timestamp: new Date(),
      });
    } else {
      // Delete for self only: mark as deleted for this user
      // We don't have a per-user delete flag in our schema yet.
      // For now, we'll soft delete but keep for others.
      // In a real implementation, we'd have a MessageDeletion table.
      // We'll implement as: soft delete for everyone (since we don't have per-user yet)
      // But we can add a flag to mark as deleted for self.
      // We'll use metadata for this.
      const metadata = {
        ...message.metadata,
        deletedFor: [...(message.metadata?.deletedFor || []), userId],
      };
      await this.prisma.message.update({
        where: { id: messageId },
        data: { metadata },
      });

      this.eventEmitter.emit(SYSTEM_EVENTS.MESSAGE_DELETE, {
        messageId,
        userId,
        chatId: message.chatId,
        forEveryone: false,
        timestamp: new Date(),
      });
    }

    // Clear cache
    await this.clearMessageCache(message.chatId);

    this.logger.log(`Message deleted: ${messageId} by user: ${userId}`);

    return {
      success: true,
      message: `Message ${messageId} deleted successfully`,
    };
  }

  // -------- MESSAGE STATUS --------

  /**
   * Update message status (delivered/read).
   */
  async updateMessageStatus(update: MessageStatusUpdate): Promise<void> {
    this.logger.debug(
      `Updating status for message: ${update.messageId} to ${update.status}`,
    );

    const { messageId, userId, status } = update;

    const messageStatus = await this.prisma.messageStatus.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    const data: any = {
      status,
    };

    if (status === MessageStatus.DELIVERED) {
      data.deliveredAt = new Date();
    }

    if (status === MessageStatus.READ) {
      data.readAt = new Date();
      data.deliveredAt = data.deliveredAt || new Date();
    }

    if (messageStatus) {
      await this.prisma.messageStatus.update({
        where: { id: messageStatus.id },
        data,
      });
    } else {
      // Create if not exists
      await this.prisma.messageStatus.create({
        data: {
          messageId,
          userId,
          status,
          deliveredAt:
            status === MessageStatus.DELIVERED || status === MessageStatus.READ
              ? new Date()
              : null,
          readAt: status === MessageStatus.READ ? new Date() : null,
        },
      });
    }

    // Emit event for real-time updates
    this.eventEmitter.emit("message.status.updated", {
      messageId,
      userId,
      status,
      timestamp: new Date(),
    });

    // Clear cache
    await this.clearMessageCache(undefined, messageId);
  }

  // -------- REACTIONS --------

  /**
   * Add a reaction to a message.
   */
  async addReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    this.logger.debug(
      `Adding reaction ${reaction} to message: ${messageId} by user: ${userId}`,
    );

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    // Check if reaction already exists
    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_reaction: {
          messageId,
          userId,
          reaction,
        },
      },
    });

    if (existing) {
      throw new BadRequestException("Reaction already exists");
    }

    await this.prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        reaction,
      },
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.MESSAGE_REACTED, {
      messageId,
      userId,
      reaction,
      timestamp: new Date(),
    });

    // Clear cache
    await this.clearMessageCache(undefined, messageId);
  }

  /**
   * Remove a reaction from a message.
   */
  async removeReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    this.logger.debug(
      `Removing reaction ${reaction} from message: ${messageId} by user: ${userId}`,
    );

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_reaction: {
          messageId,
          userId,
          reaction,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Reaction not found");
    }

    await this.prisma.messageReaction.delete({
      where: { id: existing.id },
    });

    // Clear cache
    await this.clearMessageCache(undefined, messageId);
  }

  // -------- PIN MESSAGE --------

  /**
   * Pin a message in a chat.
   */
  async pinMessage(messageId: string, userId: string): Promise<void> {
    this.logger.debug(`Pinning message: ${messageId} by user: ${userId}`);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    // Check if user has permission (admin or group admin)
    const isAdmin = await this.isUserAdmin(userId);
    const isGroupAdmin = await this.isGroupAdmin(message.chatId, userId);

    if (!isAdmin && !isGroupAdmin) {
      throw new ForbiddenException(
        "You do not have permission to pin messages",
      );
    }

    // Unpin previous pinned message (if any)
    await this.prisma.message.updateMany({
      where: {
        chatId: message.chatId,
        isPinned: true,
      },
      data: {
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
      },
    });

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: true,
        pinnedAt: new Date(),
        pinnedBy: userId,
      },
    });

    this.eventEmitter.emit(SYSTEM_EVENTS.MESSAGE_UPDATE, {
      messageId,
      userId,
      chatId: message.chatId,
      action: "pin",
      timestamp: new Date(),
    });

    // Clear cache
    await this.clearMessageCache(message.chatId);
  }

  /**
   * Unpin a message.
   */
  async unpinMessage(messageId: string, userId: string): Promise<void> {
    this.logger.debug(`Unpinning message: ${messageId} by user: ${userId}`);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    const isAdmin = await this.isUserAdmin(userId);
    const isGroupAdmin = await this.isGroupAdmin(message.chatId, userId);

    if (!isAdmin && !isGroupAdmin) {
      throw new ForbiddenException(
        "You do not have permission to unpin messages",
      );
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
      },
    });

    // Clear cache
    await this.clearMessageCache(message.chatId);
  }

  // -------- SEARCH --------

  /**
   * Search messages across chats.
   */
  async searchMessages(
    userId: string,
    query: string,
    options: {
      chatId?: string;
      limit?: number;
      page?: number;
      fromDate?: Date;
      toDate?: Date;
      messageType?: MessageType;
    } = {},
  ): Promise<{
    messages: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.debug(
      `Searching messages for user: ${userId} with query: ${query}`,
    );

    const {
      chatId,
      limit = 20,
      page = 1,
      fromDate,
      toDate,
      messageType,
    } = options;

    // Get all chat IDs the user is part of
    const chatIds = await this.getUserChatIds(userId);

    // If chatId provided, restrict to that chat
    const targetChatIds = chatId ? [chatId] : chatIds;

    if (targetChatIds.length === 0) {
      return {
        messages: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      chatId: { in: targetChatIds },
      isDeleted: false,
      OR: [
        { content: { contains: query, mode: "insensitive" } },
        { encryptedContent: { contains: query, mode: "insensitive" } },
      ],
    };

    if (fromDate) {
      where.createdAt = { ...where.createdAt, gte: fromDate };
    }
    if (toDate) {
      where.createdAt = { ...where.createdAt, lte: toDate };
    }
    if (messageType) {
      where.messageType = messageType;
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            include: { profile: true },
          },
          attachments: true,
          chat: true,
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // -------- FORWARD MESSAGE --------

  /**
   * Forward a message to another chat.
   */
  async forwardMessage(
    messageId: string,
    userId: string,
    targetChatId: string,
  ): Promise<any> {
    this.logger.debug(
      `Forwarding message: ${messageId} to chat: ${targetChatId} by user: ${userId}`,
    );

    const originalMessage = await this.getMessageById(messageId, userId);

    // Check if user has access to target chat
    await this.validateChatAccess(targetChatId, userId);

    // Create new message with same content
    const forwardOptions: SendMessageOptions = {
      chatId: targetChatId,
      senderId: userId,
      content: originalMessage.content,
      messageType: originalMessage.messageType,
      metadata: {
        forwardedFrom: {
          messageId: originalMessage.id,
          chatId: originalMessage.chatId,
          senderId: originalMessage.senderId,
          senderName: originalMessage.sender.displayName,
        },
      },
    };

    // If attachments, copy them
    if (originalMessage.attachments && originalMessage.attachments.length > 0) {
      // In a real app, we'd copy the files or reference them.
      // For simplicity, we'll just reference.
      forwardOptions.attachments = originalMessage.attachments.map((att) => ({
        originalname: att.fileName,
        size: att.fileSize,
        mimetype: att.mimeType,
        path: att.storagePath,
        thumbnailPath: att.thumbnailPath,
        width: att.width,
        height: att.height,
        duration: att.duration,
      }));
    }

    const newMessage = await this.sendMessage(forwardOptions);

    this.eventEmitter.emit(BUSINESS_EVENTS.MESSAGE_FORWARDED, {
      originalMessageId: messageId,
      newMessageId: newMessage.id,
      userId,
      targetChatId,
      timestamp: new Date(),
    });

    return newMessage;
  }

  // -------- MENTIONS --------

  /**
   * Process mentions in a message.
   */
  async processMentions(
    messageId: string,
    mentionedUserIds: string[],
  ): Promise<void> {
    if (!mentionedUserIds || mentionedUserIds.length === 0) return;

    // Send notifications to mentioned users
    for (const userId of mentionedUserIds) {
      this.eventEmitter.emit("notification.mention", {
        userId,
        messageId,
        timestamp: new Date(),
      });
    }
  }

  // -------- ATTACHMENTS --------

  /**
   * Get attachments for a message.
   */
  async getAttachments(messageId: string, userId: string): Promise<any[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    await this.validateChatAccess(message.chatId, userId);

    return message.attachments;
  }

  /**
   * Delete an attachment.
   */
  async deleteAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(
      `Deleting attachment: ${attachmentId} by user: ${userId}`,
    );

    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { message: true },
    });

    if (!attachment) {
      throw new NotFoundException(
        `Attachment with ID "${attachmentId}" not found`,
      );
    }

    const message = attachment.message;
    const isSender = message.senderId === userId;
    const isAdmin = await this.isUserAdmin(userId);
    const isGroupAdmin = await this.isGroupAdmin(message.chatId, userId);

    if (!isSender && !isAdmin && !isGroupAdmin) {
      throw new ForbiddenException(
        "You do not have permission to delete this attachment",
      );
    }

    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Delete file from storage (placeholder)
    // await this.fileService.deleteFile(attachment.storagePath);

    this.logger.log(`Attachment deleted: ${attachmentId}`);

    return {
      success: true,
      message: `Attachment ${attachmentId} deleted successfully`,
    };
  }

  // -------- HELPERS --------

  /**
   * Validate chat access for a user.
   */
  private async validateChatAccess(
    chatId: string,
    userId: string,
  ): Promise<void> {
    // Check if user is a member of the chat
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [
          { isGroup: false, messages: { some: { senderId: userId } } },
          { isGroup: true, members: { some: { userId } } },
        ],
      },
    });

    if (!chat) {
      throw new ForbiddenException("User does not have access to this chat");
    }
  }

  /**
   * Get all participants of a chat.
   */
  private async getChatParticipants(chatId: string): Promise<string[]> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          distinct: ["senderId"],
          select: { senderId: true },
        },
        members: {
          select: { userId: true },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID "${chatId}" not found`);
    }

    let participants: string[] = [];

    if (chat.isGroup) {
      participants = chat.members.map((m) => m.userId);
    } else {
      // For direct chat, get all unique sender IDs from messages
      participants = chat.messages.map((m) => m.senderId);
    }

    return participants;
  }

  /**
   * Get all chat IDs a user is part of.
   */
  private async getUserChatIds(userId: string): Promise<string[]> {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [
          { messages: { some: { senderId: userId } } },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });

    return chats.map((c) => c.id);
  }

  /**
   * Check if user is a system admin.
   */
  private async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    return user?.isAdmin || false;
  }

  /**
   * Check if user is an admin of a group chat.
   */
  private async isGroupAdmin(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { members: true },
    });

    if (!chat || !chat.isGroup) {
      return false;
    }

    const member = chat.members.find((m) => m.userId === userId);
    return member?.role === "ADMIN" || member?.role === "OWNER";
  }

  // -------- CACHE HELPERS --------

  private async clearMessageCache(
    chatId?: string,
    messageId?: string,
  ): Promise<void> {
    if (!this.cacheManager) return;

    try {
      if (chatId) {
        await this.cacheManager.del(`chat:${chatId}:messages`);
        await this.cacheManager.del(`chat:${chatId}:pinned`);
      }
      if (messageId) {
        await this.cacheManager.del(`message:${messageId}`);
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  // -------- END --------
}
