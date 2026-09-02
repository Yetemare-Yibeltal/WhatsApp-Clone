// backend/src/modules/notifications/notifications.controller.ts
/**
 * 📄 Notifications Controller
 *
 * Exposes REST endpoints for notification management including retrieval,
 * read status management, preferences, and statistics.
 *
 * @module NotificationsController
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
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  Roles,
  Permissions,
  Admin,
  UserRole,
} from "../../common/constants/roles";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { ApiResponseBuilder } from "../../common/types/api-response.interface";
import { NotificationType } from "../../common/types/socket-payload.interface";
import {
  UpdateNotificationPreferencesDto,
  MarkAllReadDto,
  ClearAllDto,
} from "./dto";

// -------- CONTROLLER --------

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // -------- GET NOTIFICATIONS --------

  /**
   * Get notifications for the current user.
   */
  @Get()
  @ApiOperation({
    summary: "Get user notifications",
    description:
      "Get paginated notifications for the current user with filtering.",
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
    name: "type",
    description: "Filter by notification type",
    enum: NotificationType,
    required: false,
  })
  @ApiQuery({
    name: "read",
    description: "Filter by read status",
    type: Boolean,
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
    enum: ["createdAt", "updatedAt", "priority"],
    required: false,
  })
  @ApiQuery({
    name: "orderDirection",
    description: "Sort direction",
    enum: ["asc", "desc"],
    required: false,
  })
  @ApiOkResponse({
    description: "Notifications retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Notifications retrieved successfully",
        data: {
          notifications: [
            {
              id: "notif_abc123",
              type: "MESSAGE",
              title: "New message from John",
              body: "Hello! How are you?",
              read: false,
              createdAt: "2024-01-15T10:30:00Z",
              data: {
                messageId: "msg_abc123",
                chatId: "chat_abc123",
              },
            },
          ],
          total: 0,
          unreadCount: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getNotifications(
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Query("type") type?: NotificationType,
    @Query("read") read?: boolean,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("orderBy") orderBy?: string,
    @Query("orderDirection") orderDirection?: "asc" | "desc",
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting notifications for user: ${currentUser.id}`);

    try {
      const result = await this.notificationsService.getUserNotifications(
        currentUser.id,
        {
          page,
          limit,
          type,
          read: read !== undefined ? read : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          orderBy: orderBy as any,
          orderDirection: orderDirection || "desc",
        },
      );

      return ApiResponseBuilder.success(
        result,
        "Notifications retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error.message}`);
      throw error;
    }
  }

  // -------- GET UNREAD COUNT --------

  /**
   * Get unread notification count.
   */
  @Get("unread/count")
  @ApiOperation({
    summary: "Get unread notification count",
    description: "Get the number of unread notifications for the current user.",
  })
  @ApiOkResponse({
    description: "Unread count retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Unread count retrieved successfully",
        data: {
          unreadCount: 5,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getUnreadCount(@CurrentUser() currentUser: AuthUser) {
    this.logger.debug(`Getting unread count for user: ${currentUser.id}`);

    try {
      const count = await this.notificationsService.getUnreadCount(
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        { unreadCount: count },
        "Unread count retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`);
      throw error;
    }
  }

  // -------- GET NOTIFICATION BY ID --------

  /**
   * Get a notification by ID.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Get notification by ID",
    description: "Get a specific notification by its ID.",
  })
  @ApiParam({
    name: "id",
    description: "Notification ID",
    example: "notif_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Notification retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Notification retrieved successfully",
        data: {
          id: "notif_abc123",
          type: "MESSAGE",
          title: "New message from John",
          body: "Hello! How are you?",
          read: false,
          createdAt: "2024-01-15T10:30:00Z",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Notification not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Notification does not belong to user",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getNotification(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting notification ${id} for user: ${currentUser.id}`);

    try {
      const result = await this.notificationsService.getNotificationById(
        id,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Notification retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get notification: ${error.message}`);
      throw error;
    }
  }

  // -------- MARK AS READ --------

  /**
   * Mark a notification as read.
   */
  @Post(":id/read")
  @ApiOperation({
    summary: "Mark notification as read",
    description: "Mark a specific notification as read.",
  })
  @ApiParam({
    name: "id",
    description: "Notification ID",
    example: "notif_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Notification marked as read",
    schema: {
      example: {
        statusCode: 200,
        message: "Notification marked as read",
        data: {
          id: "notif_abc123",
          read: true,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Notification not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Notification does not belong to user",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async markAsRead(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Marking notification ${id} as read for user: ${currentUser.id}`,
    );

    try {
      const result = await this.notificationsService.markAsRead(
        id,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Notification marked as read",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as read: ${error.message}`,
      );
      throw error;
    }
  }

  // -------- MARK AS UNREAD --------

  /**
   * Mark a notification as unread.
   */
  @Post(":id/unread")
  @ApiOperation({
    summary: "Mark notification as unread",
    description: "Mark a specific notification as unread.",
  })
  @ApiParam({
    name: "id",
    description: "Notification ID",
    example: "notif_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Notification marked as unread",
    schema: {
      example: {
        statusCode: 200,
        message: "Notification marked as unread",
        data: {
          id: "notif_abc123",
          read: false,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Notification not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Notification does not belong to user",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async markAsUnread(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Marking notification ${id} as unread for user: ${currentUser.id}`,
    );

    try {
      const result = await this.notificationsService.markAsUnread(
        id,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Notification marked as unread",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as unread: ${error.message}`,
      );
      throw error;
    }
  }

  // -------- MARK ALL AS READ --------

  /**
   * Mark all notifications as read.
   */
  @Post("read/all")
  @ApiOperation({
    summary: "Mark all notifications as read",
    description: "Mark all unread notifications as read for the current user.",
  })
  @ApiBody({
    type: MarkAllReadDto,
    description: "Options for marking all as read",
  })
  @ApiOkResponse({
    description: "All notifications marked as read",
    schema: {
      example: {
        statusCode: 200,
        message: "All notifications marked as read",
        data: {
          count: 5,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async markAllAsRead(
    @Body() markDto: MarkAllReadDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Marking all notifications as read for user: ${currentUser.id}`,
    );

    try {
      const result = await this.notificationsService.markAllAsRead(
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "All notifications marked as read",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read: ${error.message}`,
      );
      throw error;
    }
  }

  // -------- DISMISS NOTIFICATION --------

  /**
   * Dismiss a notification.
   */
  @Delete(":id")
  @ApiOperation({
    summary: "Dismiss notification",
    description: "Delete a specific notification (dismiss it).",
  })
  @ApiParam({
    name: "id",
    description: "Notification ID",
    example: "notif_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Notification dismissed",
    schema: {
      example: {
        statusCode: 200,
        message: "Notification dismissed",
        data: {
          success: true,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Notification not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Notification does not belong to user",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async dismissNotification(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Dismissing notification ${id} for user: ${currentUser.id}`,
    );

    try {
      const result = await this.notificationsService.dismissNotification(
        id,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Notification dismissed",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to dismiss notification: ${error.message}`);
      throw error;
    }
  }

  // -------- CLEAR ALL --------

  /**
   * Clear all notifications.
   */
  @Delete()
  @ApiOperation({
    summary: "Clear all notifications",
    description:
      "Delete all notifications for the current user (optionally by type).",
  })
  @ApiBody({
    type: ClearAllDto,
    description: "Clear options",
  })
  @ApiOkResponse({
    description: "All notifications cleared",
    schema: {
      example: {
        statusCode: 200,
        message: "All notifications cleared",
        data: {
          count: 10,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async clearAllNotifications(
    @Body() clearDto: ClearAllDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Clearing all notifications for user: ${currentUser.id}`);

    try {
      const result = await this.notificationsService.clearAllNotifications(
        currentUser.id,
        clearDto.type,
      );

      return ApiResponseBuilder.success(
        result,
        "All notifications cleared",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to clear notifications: ${error.message}`);
      throw error;
    }
  }

  // -------- GET PREFERENCES --------

  /**
   * Get notification preferences.
   */
  @Get("preferences")
  @ApiOperation({
    summary: "Get notification preferences",
    description: "Get notification preferences for the current user.",
  })
  @ApiOkResponse({
    description: "Preferences retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Preferences retrieved successfully",
        data: {
          channels: {
            in_app: true,
            push: true,
            email: false,
          },
          types: {
            message: true,
            group: true,
            call: true,
            mention: true,
            reaction: true,
            system: true,
            admin: true,
          },
          quietHours: {
            enabled: false,
            start: "22:00",
            end: "07:00",
            timezone: "UTC",
          },
          sound: true,
          vibration: true,
          badges: true,
          grouping: true,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getPreferences(@CurrentUser() currentUser: AuthUser) {
    this.logger.debug(
      `Getting notification preferences for user: ${currentUser.id}`,
    );

    try {
      const result = await this.notificationsService.getUserPreferences(
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Preferences retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get preferences: ${error.message}`);
      throw error;
    }
  }

  // -------- UPDATE PREFERENCES --------

  /**
   * Update notification preferences.
   */
  @Put("preferences")
  @ApiOperation({
    summary: "Update notification preferences",
    description: "Update notification preferences for the current user.",
  })
  @ApiBody({
    type: UpdateNotificationPreferencesDto,
    description: "Preference updates",
  })
  @ApiOkResponse({
    description: "Preferences updated successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Preferences updated successfully",
        data: {
          channels: {
            in_app: true,
            push: true,
            email: false,
          },
          types: {
            message: true,
            group: true,
            call: true,
            mention: true,
            reaction: true,
            system: true,
            admin: true,
          },
          quietHours: {
            enabled: false,
            start: "22:00",
            end: "07:00",
            timezone: "UTC",
          },
          sound: true,
          vibration: true,
          badges: true,
          grouping: true,
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
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updatePreferences(
    @Body() updateDto: UpdateNotificationPreferencesDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Updating notification preferences for user: ${currentUser.id}`,
    );

    try {
      // Build updates object
      const updates: any = {};

      if (updateDto.channels) {
        updates.channels = updateDto.channels;
      }

      if (updateDto.types) {
        updates.types = updateDto.types;
      }

      if (updateDto.quietHours) {
        updates.quietHours = updateDto.quietHours;
      }

      if (updateDto.sound !== undefined) {
        updates.sound = updateDto.sound;
      }

      if (updateDto.vibration !== undefined) {
        updates.vibration = updateDto.vibration;
      }

      if (updateDto.badges !== undefined) {
        updates.badges = updateDto.badges;
      }

      if (updateDto.grouping !== undefined) {
        updates.grouping = updateDto.grouping;
      }

      const result = await this.notificationsService.updateUserPreferences(
        currentUser.id,
        updates,
      );

      return ApiResponseBuilder.success(
        result,
        "Preferences updated successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to update preferences: ${error.message}`);
      throw error;
    }
  }

  // -------- RESET PREFERENCES --------

  /**
   * Reset notification preferences to default.
   */
  @Delete("preferences")
  @ApiOperation({
    summary: "Reset notification preferences",
    description: "Reset notification preferences to default values.",
  })
  @ApiOkResponse({
    description: "Preferences reset successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Preferences reset successfully",
        data: {
          channels: {
            in_app: true,
            push: true,
            email: false,
          },
          types: {
            message: true,
            group: true,
            call: true,
            mention: true,
            reaction: true,
            system: true,
            admin: true,
          },
          quietHours: {
            enabled: false,
            start: "22:00",
            end: "07:00",
            timezone: "UTC",
          },
          sound: true,
          vibration: true,
          badges: true,
          grouping: true,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async resetPreferences(@CurrentUser() currentUser: AuthUser) {
    this.logger.debug(
      `Resetting notification preferences for user: ${currentUser.id}`,
    );

    try {
      const result = await this.notificationsService.resetPreferences(
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Preferences reset successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to reset preferences: ${error.message}`);
      throw error;
    }
  }

  // -------- GET STATISTICS --------

  /**
   * Get notification statistics.
   */
  @Get("stats")
  @ApiOperation({
    summary: "Get notification statistics",
    description: "Get notification statistics for the current user.",
  })
  @ApiOkResponse({
    description: "Statistics retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Statistics retrieved successfully",
        data: {
          total: 150,
          unread: 5,
          byType: {
            MESSAGE: 80,
            GROUP: 30,
            CALL: 20,
            MENTION: 10,
            REACTION: 10,
          },
          lastWeek: 25,
          today: 3,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getStats(@CurrentUser() currentUser: AuthUser) {
    this.logger.debug(`Getting notification stats for user: ${currentUser.id}`);

    try {
      const result = await this.notificationsService.getNotificationStats(
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Statistics retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw error;
    }
  }

  // -------- END --------
}
