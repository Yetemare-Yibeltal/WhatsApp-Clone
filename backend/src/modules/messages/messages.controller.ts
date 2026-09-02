// backend/src/modules/messages/messages.controller.ts
/**
 * 📄 Messages Controller
 *
 * Exposes REST endpoints for message management including CRUD operations,
 * reactions, pinning, search, and attachments.
 *
 * @module MessagesController
 * @category Controllers
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  HttpException,
  Logger,
  ValidationPipe,
  UsePipes,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiProduces,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
} from "@nestjs/swagger";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { createReadStream } from "fs";
import { join } from "path";
import { MessagesService } from "./messages.service";
import {
  SendMessageDto,
  EditMessageDto,
  DeleteMessageDto,
  MessageFilterDto,
  ReactionDto,
} from "./dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  Roles,
  Permissions,
  Public,
  Admin,
  Moderator,
  UserRole,
} from "../../common/constants/roles";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { ApiResponseBuilder } from "../../common/types/api-response.interface";
import {
  MessageType,
  MessageStatus,
} from "../../common/types/socket-payload.interface";

// -------- CONTROLLER --------

@ApiTags("Messages")
@ApiBearerAuth()
@Controller("messages")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  // -------- GET CHAT MESSAGES --------

  /**
   * Get messages from a chat.
   */
  @Get("chat/:chatId")
  @ApiOperation({
    summary: "Get chat messages",
    description:
      "Get paginated messages from a specific chat with optional filtering.",
  })
  @ApiParam({
    name: "chatId",
    description: "Chat ID",
    example: "chat_abc123",
    type: "string",
  })
  @ApiQuery({
    name: "page",
    description: "Page number (1-indexed)",
    type: Number,
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    description: "Number of items per page",
    type: Number,
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: "search",
    description: "Search by message content",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "messageType",
    description: "Filter by message type",
    enum: MessageType,
    required: false,
  })
  @ApiQuery({
    name: "senderId",
    description: "Filter by sender user ID",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "startDate",
    description: "Filter by start date (ISO 8601)",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "endDate",
    description: "Filter by end date (ISO 8601)",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "orderBy",
    description: "Sort field",
    enum: ["createdAt", "updatedAt"],
    required: false,
  })
  @ApiQuery({
    name: "orderDirection",
    description: "Sort direction",
    enum: ["asc", "desc"],
    required: false,
  })
  @ApiOkResponse({
    description: "Messages retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Messages retrieved successfully",
        data: {
          messages: [
            {
              id: "msg_abc123",
              chatId: "chat_abc123",
              senderId: "user_abc123",
              content: "Hello World!",
              messageType: "TEXT",
              isDeleted: false,
              isEdited: false,
              createdAt: "2024-01-15T10:30:00Z",
              userStatus: "READ",
              sender: {
                id: "user_abc123",
                displayName: "John Doe",
                avatarUrl: "https://example.com/avatar.jpg",
              },
              attachments: [],
            },
          ],
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - User not in chat",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getChatMessages(
    @Param("chatId", new ParseUUIDPipe()) chatId: string,
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Query("search") search?: string,
    @Query("messageType") messageType?: MessageType,
    @Query("senderId") senderId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("orderBy") orderBy?: string,
    @Query("orderDirection") orderDirection?: "asc" | "desc",
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting messages for chat: ${chatId}`);

    try {
      const result = await this.messagesService.getMessages(
        chatId,
        currentUser.id,
        {
          page,
          limit,
          search,
          messageType,
          senderId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          orderBy: orderBy as any,
          orderDirection: orderDirection || "desc",
        },
      );

      return ApiResponseBuilder.success(
        result,
        "Messages retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get messages: ${error.message}`);
      throw error;
    }
  }

  // -------- GET MESSAGE BY ID --------

  /**
   * Get a specific message by ID.
   */
  @Get(":messageId")
  @ApiOperation({
    summary: "Get message by ID",
    description:
      "Get a specific message with all details including statuses and reactions.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Message retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Message retrieved successfully",
        data: {
          id: "msg_abc123",
          chatId: "chat_abc123",
          senderId: "user_abc123",
          content: "Hello World!",
          messageType: "TEXT",
          isDeleted: false,
          isEdited: false,
          createdAt: "2024-01-15T10:30:00Z",
          userStatus: "READ",
          sender: {
            id: "user_abc123",
            displayName: "John Doe",
          },
          attachments: [],
          reactions: [],
          statuses: [],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - User not in chat",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getMessage(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting message: ${messageId}`);

    try {
      const result = await this.messagesService.getMessageWithDetails(
        messageId,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Message retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get message: ${error.message}`);
      throw error;
    }
  }

  // -------- SEND MESSAGE --------

  /**
   * Send a new message (REST fallback).
   * Primary method is WebSocket, but this is available as a fallback.
   */
  @Post()
  @ApiOperation({
    summary: "Send a new message",
    description: "Send a new message to a chat. For real-time, use WebSocket.",
  })
  @ApiBody({
    type: SendMessageDto,
    description: "Message data",
  })
  @ApiCreatedResponse({
    description: "Message sent successfully",
    schema: {
      example: {
        statusCode: 201,
        message: "Message sent successfully",
        data: {
          id: "msg_abc123",
          chatId: "chat_abc123",
          senderId: "user_abc123",
          content: "Hello World!",
          messageType: "TEXT",
          createdAt: "2024-01-15T10:30:00Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - User not in chat",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendMessage(
    @Body() sendDto: SendMessageDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Sending message to chat: ${sendDto.chatId}`);

    try {
      const result = await this.messagesService.sendMessage({
        chatId: sendDto.chatId,
        senderId: currentUser.id,
        content: sendDto.content,
        messageType: sendDto.messageType || MessageType.TEXT,
        replyToId: sendDto.replyToId,
        mentions: sendDto.mentions,
        metadata: sendDto.metadata,
      });

      return ApiResponseBuilder.success(
        result,
        "Message sent successfully",
        HttpStatus.CREATED,
      );
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  // -------- EDIT MESSAGE --------

  /**
   * Edit a message.
   */
  @Patch(":messageId")
  @ApiOperation({
    summary: "Edit a message",
    description: "Edit the content of an existing message.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiBody({
    type: EditMessageDto,
    description: "Updated message content",
  })
  @ApiOkResponse({
    description: "Message edited successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Message edited successfully",
        data: {
          id: "msg_abc123",
          content: "Updated content",
          editedAt: "2024-01-15T10:31:00Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed or edit window expired",
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Not the message sender",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async editMessage(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() editDto: EditMessageDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Editing message: ${messageId}`);

    try {
      const result = await this.messagesService.editMessage(
        messageId,
        currentUser.id,
        editDto,
      );

      return ApiResponseBuilder.success(
        result,
        "Message edited successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to edit message: ${error.message}`);
      throw error;
    }
  }

  // -------- DELETE MESSAGE --------

  /**
   * Delete a message.
   */
  @Delete(":messageId")
  @ApiOperation({
    summary: "Delete a message",
    description:
      "Delete a message (soft delete). Can be deleted by sender, admin, or group admin.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiBody({
    type: DeleteMessageDto,
    description: "Delete options",
  })
  @ApiOkResponse({
    description: "Message deleted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Message deleted successfully",
        data: {
          success: true,
          message: "Message abc123 deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Cannot delete this message",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async deleteMessage(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() deleteDto: DeleteMessageDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Deleting message: ${messageId}`);

    try {
      const result = await this.messagesService.deleteMessage(
        messageId,
        currentUser.id,
        deleteDto,
      );

      return ApiResponseBuilder.success(
        result,
        "Message deleted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to delete message: ${error.message}`);
      throw error;
    }
  }

  // -------- REACTIONS --------

  /**
   * Add a reaction to a message.
   */
  @Post(":messageId/reactions")
  @ApiOperation({
    summary: "Add reaction to a message",
    description: "Add an emoji reaction to a message.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiBody({
    type: ReactionDto,
    description: "Reaction data",
  })
  @ApiOkResponse({
    description: "Reaction added successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Reaction added successfully",
        data: {
          success: true,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Reaction already exists",
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - User not in chat",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async addReaction(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() reactionDto: ReactionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Adding reaction to message: ${messageId}`);

    try {
      await this.messagesService.addReaction(
        messageId,
        currentUser.id,
        reactionDto.reaction,
      );

      return ApiResponseBuilder.success(
        { success: true },
        "Reaction added successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to add reaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a reaction from a message.
   */
  @Delete(":messageId/reactions/:reaction")
  @ApiOperation({
    summary: "Remove reaction from a message",
    description: "Remove an emoji reaction from a message.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiParam({
    name: "reaction",
    description: "Reaction emoji",
    example: "👍",
    type: "string",
  })
  @ApiOkResponse({
    description: "Reaction removed successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Reaction removed successfully",
        data: {
          success: true,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Reaction not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - User not in chat",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async removeReaction(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Param("reaction") reaction: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Removing reaction from message: ${messageId}`);

    try {
      await this.messagesService.removeReaction(
        messageId,
        currentUser.id,
        reaction,
      );

      return ApiResponseBuilder.success(
        { success: true },
        "Reaction removed successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to remove reaction: ${error.message}`);
      throw error;
    }
  }

  // -------- PIN MESSAGE --------

  /**
   * Pin a message.
   */
  @Post(":messageId/pin")
  @ApiOperation({
    summary: "Pin a message",
    description:
      "Pin a message in the chat. Requires admin or group admin permissions.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Message pinned successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Message pinned successfully",
        data: {
          success: true,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Insufficient permissions",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async pinMessage(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Pinning message: ${messageId}`);

    try {
      await this.messagesService.pinMessage(messageId, currentUser.id);

      return ApiResponseBuilder.success(
        { success: true },
        "Message pinned successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to pin message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unpin a message.
   */
  @Delete(":messageId/pin")
  @ApiOperation({
    summary: "Unpin a message",
    description: "Unpin a pinned message in the chat.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Message unpinned successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Message unpinned successfully",
        data: {
          success: true,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Insufficient permissions",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async unpinMessage(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Unpinning message: ${messageId}`);

    try {
      await this.messagesService.unpinMessage(messageId, currentUser.id);

      return ApiResponseBuilder.success(
        { success: true },
        "Message unpinned successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to unpin message: ${error.message}`);
      throw error;
    }
  }

  // -------- SEARCH MESSAGES --------

  /**
   * Search messages across chats.
   */
  @Get("search")
  @ApiOperation({
    summary: "Search messages",
    description: "Search messages across all chats the user is a member of.",
  })
  @ApiQuery({
    name: "query",
    description: "Search query",
    type: String,
    required: true,
    example: "hello world",
  })
  @ApiQuery({
    name: "chatId",
    description: "Filter by specific chat ID",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "page",
    description: "Page number (1-indexed)",
    type: Number,
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    description: "Number of items per page",
    type: Number,
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: "messageType",
    description: "Filter by message type",
    enum: MessageType,
    required: false,
  })
  @ApiOkResponse({
    description: "Search results retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Search results retrieved successfully",
        data: {
          messages: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Query parameter is required",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async searchMessages(
    @Query("query") query: string,
    @Query("chatId") chatId?: string,
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe())
    page: number = 1,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe())
    limit: number = 20,
    @Query("messageType") messageType?: MessageType,
    @CurrentUser() currentUser: AuthUser,
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException(
        "Search query is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Searching messages with query: ${query}`);

    try {
      const result = await this.messagesService.searchMessages(
        currentUser.id,
        query.trim(),
        {
          chatId,
          limit,
          page,
          messageType,
        },
      );

      return ApiResponseBuilder.success(
        result,
        "Search results retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to search messages: ${error.message}`);
      throw error;
    }
  }

  // -------- FORWARD MESSAGE --------

  /**
   * Forward a message to another chat.
   */
  @Post(":messageId/forward")
  @ApiOperation({
    summary: "Forward a message",
    description: "Forward a message to another chat.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        targetChatId: { type: "string", example: "chat_def456" },
      },
      required: ["targetChatId"],
    },
  })
  @ApiOkResponse({
    description: "Message forwarded successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Message forwarded successfully",
        data: {
          id: "msg_new123",
          chatId: "chat_def456",
          content: "Forwarded message content",
          createdAt: "2024-01-15T10:30:00Z",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Message or target chat not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Cannot forward to this chat",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async forwardMessage(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body("targetChatId") targetChatId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    if (!targetChatId) {
      throw new HttpException(
        "targetChatId is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(
      `Forwarding message: ${messageId} to chat: ${targetChatId}`,
    );

    try {
      const result = await this.messagesService.forwardMessage(
        messageId,
        currentUser.id,
        targetChatId,
      );

      return ApiResponseBuilder.success(
        result,
        "Message forwarded successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to forward message: ${error.message}`);
      throw error;
    }
  }

  // -------- ATTACHMENTS --------

  /**
   * Get message attachments.
   */
  @Get(":messageId/attachments")
  @ApiOperation({
    summary: "Get message attachments",
    description: "Get all attachments for a message.",
  })
  @ApiParam({
    name: "messageId",
    description: "Message ID",
    example: "msg_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Attachments retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Attachments retrieved successfully",
        data: [
          {
            id: "att_abc123",
            fileName: "document.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
            storagePath: "uploads/document.pdf",
            createdAt: "2024-01-15T10:30:00Z",
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Message not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - User not in chat",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getAttachments(
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting attachments for message: ${messageId}`);

    try {
      const result = await this.messagesService.getAttachments(
        messageId,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Attachments retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get attachments: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete an attachment.
   */
  @Delete("attachments/:attachmentId")
  @ApiOperation({
    summary: "Delete an attachment",
    description: "Delete a specific attachment from a message.",
  })
  @ApiParam({
    name: "attachmentId",
    description: "Attachment ID",
    example: "att_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Attachment deleted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Attachment deleted successfully",
        data: {
          success: true,
          message: "Attachment att_abc123 deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Attachment not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Cannot delete this attachment",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async deleteAttachment(
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Deleting attachment: ${attachmentId}`);

    try {
      const result = await this.messagesService.deleteAttachment(
        attachmentId,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Attachment deleted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to delete attachment: ${error.message}`);
      throw error;
    }
  }

  // -------- END --------
}
