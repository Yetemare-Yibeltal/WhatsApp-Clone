// backend/src/modules/notifications/notifications.service.ts
/**
 * 📄 Notifications Service
 *
 * Handles all notification-related business logic including creation,
 * retrieval, read status management, push notifications, and preferences.
 *
 * @module NotificationsService
 * @category Services
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SYSTEM_EVENTS, BUSINESS_EVENTS } from "../../common/constants/events";
import { NotificationType } from "../../common/types/socket-payload.interface";

// -------- INTERFACES --------

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  image?: string;
  actionUrl?: string;
  priority?: "low" | "normal" | "high";
  channel?: "in_app" | "push" | "email";
  senderId?: string;
  groupId?: string;
  messageId?: string;
  callId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationFilterOptions {
  type?: NotificationType;
  read?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "updatedAt" | "priority";
  orderDirection?: "asc" | "desc";
}

export interface NotificationPreferences {
  channels: {
    in_app: boolean;
    push: boolean;
    email: boolean;
  };
  types: {
    message: boolean;
    group: boolean;
    call: boolean;
    mention: boolean;
    reaction: boolean;
    system: boolean;
    admin: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
    timezone: string;
  };
  sound: boolean;
  vibration: boolean;
  badges: boolean;
  grouping: boolean;
}

export interface PushNotificationPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  image?: string;
  sound?: string;
  priority?: "low" | "normal" | "high";
  ttl?: number;
  collapseKey?: string;
}

// -------- MAIN SERVICE --------

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly cachePrefix = "notifications:";
  private readonly prefsCachePrefix = "prefs:";
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    private readonly usersService: UsersService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.cacheTtl =
      this.configService.get<number>("NOTIFICATION_CACHE_TTL") || 300; // 5 minutes default
    this.logger.log("NotificationsService initialized");
  }

  // -------- CREATE NOTIFICATION --------

  /**
   * Create a new notification.
   */
  async createNotification(options: CreateNotificationOptions): Promise<any> {
    this.logger.debug(
      `Creating notification for user ${options.userId}: ${options.title}`,
    );

    // Validate user exists
    const user = await this.usersService.findUserById(options.userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${options.userId}" not found`);
    }

    // Check user preferences for this notification type
    const prefs = await this.getUserPreferences(options.userId);
    if (!prefs.types[options.type.toLowerCase() as keyof typeof prefs.types]) {
      this.logger.debug(
        `Notification type ${options.type} is disabled for user ${options.userId}`,
      );
      return null;
    }

    // Check quiet hours
    if (this.isInQuietHours(prefs)) {
      this.logger.debug(
        `User ${options.userId} is in quiet hours, notification suppressed`,
      );
      return null;
    }

    // Sanitize title and body
    const sanitizedTitle = SanitizeUtil.sanitizeInput(options.title, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 100,
    });
    const sanitizedBody = SanitizeUtil.sanitizeInput(options.body, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 500,
    });

    // Create notification in database
    const notification = await this.prisma.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: sanitizedTitle,
        body: sanitizedBody,
        data: options.data || null,
        icon: options.icon || null,
        image: options.image || null,
        actionUrl: options.actionUrl || null,
        priority: options.priority || "normal",
        channel: options.channel || "in_app",
        senderId: options.senderId || null,
        groupId: options.groupId || null,
        messageId: options.messageId || null,
        callId: options.callId || null,
        metadata: options.metadata || null,
        read: false,
        delivered: false,
      },
    });

    // Clear cache for user notifications
    await this.clearUserNotificationCache(options.userId);

    // Emit event for real-time delivery
    this.eventEmitter.emit("notification.created", {
      notification,
      userId: options.userId,
      timestamp: new Date(),
    });

    // Send push notification if enabled
    if (prefs.channels.push) {
      await this.sendPushNotification({
        userIds: [options.userId],
        title: sanitizedTitle,
        body: sanitizedBody,
        data: options.data,
        icon: options.icon,
        image: options.image,
        priority: options.priority === "high" ? "high" : "normal",
      });
    }

    // Emit business event
    this.eventEmitter.emit(BUSINESS_EVENTS.NOTIFICATION_SENT, {
      notificationId: notification.id,
      userId: options.userId,
      type: options.type,
      timestamp: new Date(),
    });

    this.logger.log(
      `Notification ${notification.id} created for user ${options.userId}`,
    );

    return notification;
  }

  /**
   * Create notification for a specific event (listener).
   */
  @OnEvent("notification.request")
  async handleNotificationRequest(payload: CreateNotificationOptions) {
    try {
      await this.createNotification(payload);
    } catch (error) {
      this.logger.error(
        `Failed to handle notification request: ${error.message}`,
      );
    }
  }

  // -------- GET NOTIFICATIONS --------

  /**
   * Get notifications for a user with filtering and pagination.
   */
  async getUserNotifications(
    userId: string,
    options: NotificationFilterOptions = {},
  ): Promise<{
    notifications: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  }> {
    this.logger.debug(`Getting notifications for user ${userId}`);

    const {
      type,
      read,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: any = { userId };

    if (type) {
      where.type = type;
    }

    if (read !== undefined) {
      where.read = read;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Execute query
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  /**
   * Get a single notification by ID.
   */
  async getNotificationById(
    notificationId: string,
    userId: string,
  ): Promise<any> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" not found`,
      );
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return notification;
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    // Check cache first
    const cached = await this.getCachedUnreadCount(userId);
    if (cached !== null) {
      return cached;
    }

    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });

    // Cache the count
    await this.cacheUnreadCount(userId, count);

    return count;
  }

  // -------- MARK AS READ/UNREAD --------

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<any> {
    this.logger.debug(
      `Marking notification ${notificationId} as read for user ${userId}`,
    );

    const notification = await this.getNotificationById(notificationId, userId);

    if (notification.read) {
      return notification;
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    // Clear cache
    await this.clearUserNotificationCache(userId);
    await this.clearUnreadCountCache(userId);

    this.eventEmitter.emit(BUSINESS_EVENTS.NOTIFICATION_READ, {
      notificationId,
      userId,
      timestamp: new Date(),
    });

    return updated;
  }

  /**
   * Mark a notification as unread.
   */
  async markAsUnread(notificationId: string, userId: string): Promise<any> {
    this.logger.debug(
      `Marking notification ${notificationId} as unread for user ${userId}`,
    );

    const notification = await this.getNotificationById(notificationId, userId);

    if (!notification.read) {
      return notification;
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: false },
    });

    // Clear cache
    await this.clearUserNotificationCache(userId);
    await this.clearUnreadCountCache(userId);

    return updated;
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    this.logger.debug(`Marking all notifications as read for user ${userId}`);

    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    // Clear cache
    await this.clearUserNotificationCache(userId);
    await this.clearUnreadCountCache(userId);

    return { count: result.count };
  }

  // -------- DISMISS / CLEAR --------

  /**
   * Dismiss a notification (delete it).
   */
  async dismissNotification(
    notificationId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    this.logger.debug(
      `Dismissing notification ${notificationId} for user ${userId}`,
    );

    await this.getNotificationById(notificationId, userId);

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    // Clear cache
    await this.clearUserNotificationCache(userId);
    await this.clearUnreadCountCache(userId);

    this.eventEmitter.emit(BUSINESS_EVENTS.NOTIFICATION_DISMISSED, {
      notificationId,
      userId,
      timestamp: new Date(),
    });

    return { success: true };
  }

  /**
   * Clear all notifications for a user.
   */
  async clearAllNotifications(
    userId: string,
    type?: NotificationType,
  ): Promise<{ count: number }> {
    this.logger.debug(`Clearing all notifications for user ${userId}`);

    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const result = await this.prisma.notification.deleteMany({
      where,
    });

    // Clear cache
    await this.clearUserNotificationCache(userId);
    await this.clearUnreadCountCache(userId);

    this.eventEmitter.emit(BUSINESS_EVENTS.NOTIFICATION_CLEARED, {
      userId,
      type,
      count: result.count,
      timestamp: new Date(),
    });

    return { count: result.count };
  }

  // -------- PUSH NOTIFICATIONS --------

  /**
   * Send a push notification to a user.
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<void> {
    this.logger.debug(
      `Sending push notification to ${payload.userIds.length} users`,
    );

    // In a real implementation, we'd call FCM, APNs, or Web Push API.
    // For now, we'll log and emit an event.
    // We'll also store the notification in the database if needed.

    // Get push tokens for users
    const tokens = await this.getUserPushTokens(payload.userIds);

    if (tokens.length === 0) {
      this.logger.debug("No push tokens found for users");
      return;
    }

    // Group tokens by platform (web, ios, android)
    const groupedTokens = this.groupTokensByPlatform(tokens);

    // Send to each platform
    for (const [platform, platformTokens] of groupedTokens) {
      try {
        switch (platform) {
          case "web":
            await this.sendWebPush(platformTokens, payload);
            break;
          case "ios":
            await this.sendApnsPush(platformTokens, payload);
            break;
          case "android":
            await this.sendFcmPush(platformTokens, payload);
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to send push to ${platform}: ${error.message}`,
        );
      }
    }

    // Emit event
    this.eventEmitter.emit("push.sent", {
      userIds: payload.userIds,
      title: payload.title,
      body: payload.body,
      timestamp: new Date(),
    });
  }

  /**
   * Get push tokens for a list of users.
   */
  private async getUserPushTokens(
    userIds: string[],
  ): Promise<Array<{ userId: string; token: string; platform: string }>> {
    const tokens = [];

    for (const userId of userIds) {
      // Get from cache or database
      // For now, we'll return a dummy token
      // In production, we'd query the NotificationToken table
      // tokens.push({ userId, token: 'dummy_token', platform: 'web' });
    }

    return tokens;
  }

  /**
   * Group tokens by platform.
   */
  private groupTokensByPlatform(
    tokens: Array<{ userId: string; token: string; platform: string }>,
  ): Map<string, Array<{ userId: string; token: string }>> {
    const groups = new Map<string, Array<{ userId: string; token: string }>>();

    for (const token of tokens) {
      if (!groups.has(token.platform)) {
        groups.set(token.platform, []);
      }
      groups
        .get(token.platform)!
        .push({ userId: token.userId, token: token.token });
    }

    return groups;
  }

  /**
   * Send Web Push notification.
   */
  private async sendWebPush(
    tokens: Array<{ userId: string; token: string }>,
    payload: PushNotificationPayload,
  ): Promise<void> {
    // In production, we'd use web-push library with VAPID keys.
    this.logger.debug(`Sending Web Push to ${tokens.length} clients`);
    // Placeholder: just log
  }

  /**
   * Send APNs notification (iOS).
   */
  private async sendApnsPush(
    tokens: Array<{ userId: string; token: string }>,
    payload: PushNotificationPayload,
  ): Promise<void> {
    // In production, we'd use apn library.
    this.logger.debug(`Sending APNs push to ${tokens.length} devices`);
    // Placeholder: just log
  }

  /**
   * Send FCM notification (Android).
   */
  private async sendFcmPush(
    tokens: Array<{ userId: string; token: string }>,
    payload: PushNotificationPayload,
  ): Promise<void> {
    // In production, we'd use firebase-admin SDK.
    this.logger.debug(`Sending FCM push to ${tokens.length} devices`);
    // Placeholder: just log
  }

  // -------- PREFERENCES --------

  /**
   * Get user notification preferences.
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    // Check cache first
    const cached = await this.getCachedPreferences(userId);
    if (cached) {
      return cached;
    }

    // Get from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const prefs = user?.settings?.notifications || this.getDefaultPreferences();

    // Cache the preferences
    await this.cachePreferences(userId, prefs);

    return prefs;
  }

  /**
   * Update user notification preferences.
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    this.logger.debug(`Updating notification preferences for user ${userId}`);

    const currentPrefs = await this.getUserPreferences(userId);
    const newPrefs = this.mergePreferences(currentPrefs, updates);

    // Save to database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: {
          ...(
            await this.prisma.user.findUnique({
              where: { id: userId },
              select: { settings: true },
            })
          ).settings,
          notifications: newPrefs,
        },
      },
    });

    // Clear cache
    await this.clearPreferencesCache(userId);

    this.logger.log(`Updated notification preferences for user ${userId}`);

    return newPrefs;
  }

  /**
   * Update specific preference fields.
   */
  async updatePreferenceField(
    userId: string,
    category: keyof NotificationPreferences,
    field: string,
    value: any,
  ): Promise<NotificationPreferences> {
    this.logger.debug(
      `Updating preference ${category}.${field} for user ${userId}`,
    );

    const currentPrefs = await this.getUserPreferences(userId);
    const updates: any = {};

    if (category === "channels" || category === "types") {
      updates[category] = {
        ...currentPrefs[category],
        [field]: value,
      };
    } else if (category === "quietHours") {
      updates[category] = {
        ...currentPrefs[category],
        [field]: value,
      };
    } else {
      // Direct field
      updates[field] = value;
    }

    return this.updateUserPreferences(userId, updates);
  }

  /**
   * Reset preferences to default.
   */
  async resetPreferences(userId: string): Promise<NotificationPreferences> {
    this.logger.debug(`Resetting notification preferences for user ${userId}`);

    const defaults = this.getDefaultPreferences();
    await this.updateUserPreferences(userId, defaults);

    return defaults;
  }

  // -------- PRIVATE HELPERS --------

  /**
   * Get default notification preferences.
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
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
    };
  }

  /**
   * Merge preferences with updates.
   */
  private mergePreferences(
    current: NotificationPreferences,
    updates: Partial<NotificationPreferences>,
  ): NotificationPreferences {
    const result = { ...current };

    if (updates.channels) {
      result.channels = { ...result.channels, ...updates.channels };
    }
    if (updates.types) {
      result.types = { ...result.types, ...updates.types };
    }
    if (updates.quietHours) {
      result.quietHours = { ...result.quietHours, ...updates.quietHours };
    }
    if (updates.sound !== undefined) result.sound = updates.sound;
    if (updates.vibration !== undefined) result.vibration = updates.vibration;
    if (updates.badges !== undefined) result.badges = updates.badges;
    if (updates.grouping !== undefined) result.grouping = updates.grouping;

    return result;
  }

  /**
   * Check if current time is within quiet hours.
   */
  private isInQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const timezone = prefs.quietHours.timezone || "UTC";

    // Get current time in user's timezone
    const userTime = new Date(
      now.toLocaleString("en-US", { timeZone: timezone }),
    );
    const hours = userTime.getHours();
    const minutes = userTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const [startHours, startMinutes] = prefs.quietHours.start
      .split(":")
      .map(Number);
    const [endHours, endMinutes] = prefs.quietHours.end.split(":").map(Number);
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;

    if (startTotal <= endTotal) {
      return currentMinutes >= startTotal && currentMinutes < endTotal;
    } else {
      // Overnight quiet hours
      return currentMinutes >= startTotal || currentMinutes < endTotal;
    }
  }

  // -------- CACHE HELPERS --------

  private async getCachedPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    if (!this.cacheManager) return null;

    try {
      const key = `${this.prefsCachePrefix}${userId}`;
      return await this.cacheManager.get<NotificationPreferences>(key);
    } catch (_) {
      return null;
    }
  }

  private async cachePreferences(
    userId: string,
    prefs: NotificationPreferences,
  ): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.prefsCachePrefix}${userId}`;
      await this.cacheManager.set(key, prefs, this.cacheTtl);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async clearPreferencesCache(userId: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.prefsCachePrefix}${userId}`;
      await this.cacheManager.del(key);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async getCachedUnreadCount(userId: string): Promise<number | null> {
    if (!this.cacheManager) return null;

    try {
      const key = `${this.cachePrefix}unread:${userId}`;
      return await this.cacheManager.get<number>(key);
    } catch (_) {
      return null;
    }
  }

  private async cacheUnreadCount(userId: string, count: number): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}unread:${userId}`;
      await this.cacheManager.set(key, count, 60); // 1 minute
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async clearUnreadCountCache(userId: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}unread:${userId}`;
      await this.cacheManager.del(key);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async clearUserNotificationCache(userId: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      // We can't delete all patterns easily, so we'll just invalidate unread count
      await this.clearUnreadCountCache(userId);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  // -------- EVENT LISTENERS --------

  /**
   * Listen for message events to create notifications.
   */
  @OnEvent(BUSINESS_EVENTS.MESSAGE_SENT)
  async handleMessageSent(payload: any) {
    try {
      // Create notification for recipients
      // This would be implemented based on chat participants
      // For now, we'll just log
      this.logger.debug(`Message sent event received: ${payload.messageId}`);
    } catch (error) {
      this.logger.error(`Error handling message sent event: ${error.message}`);
    }
  }

  /**
   * Listen for call events.
   */
  @OnEvent(BUSINESS_EVENTS.CALL_INITIATED)
  async handleCallInitiated(payload: any) {
    try {
      // Create notification for call participants
      this.logger.debug(`Call initiated event received: ${payload.callId}`);
    } catch (error) {
      this.logger.error(
        `Error handling call initiated event: ${error.message}`,
      );
    }
  }

  /**
   * Listen for mention events.
   */
  @OnEvent("notification.mention")
  async handleMention(payload: any) {
    try {
      // Create mention notification
      this.logger.debug(`Mention event received for user ${payload.userId}`);
    } catch (error) {
      this.logger.error(`Error handling mention event: ${error.message}`);
    }
  }

  // -------- STATISTICS --------

  /**
   * Get notification statistics for a user.
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    lastWeek: number;
    today: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, unread, byType, lastWeekCount, todayCount] =
      await Promise.all([
        this.prisma.notification.count({ where: { userId } }),
        this.prisma.notification.count({ where: { userId, read: false } }),
        this.prisma.notification.groupBy({
          by: ["type"],
          where: { userId },
          _count: { type: true },
        }),
        this.prisma.notification.count({
          where: { userId, createdAt: { gte: lastWeek } },
        }),
        this.prisma.notification.count({
          where: { userId, createdAt: { gte: today } },
        }),
      ]);

    const byTypeMap: Record<NotificationType, number> = {} as any;
    for (const item of byType) {
      byTypeMap[item.type as NotificationType] = item._count.type;
    }

    return {
      total,
      unread,
      byType: byTypeMap,
      lastWeek: lastWeekCount,
      today: todayCount,
    };
  }

  // -------- END --------
}
