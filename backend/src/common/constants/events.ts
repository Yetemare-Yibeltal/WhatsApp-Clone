// backend/src/common/constants/events.ts
/**
 * 📄 Events Constants
 *
 * This file defines all event constants used throughout the Real WhatsApp Clone application.
 * Events are used for internal communication between modules, WebSocket notifications,
 * and system monitoring.
 *
 * @category Constants
 * @module Events
 */

// -------- WEBSOCKET EVENTS --------

/**
 * WebSocket event types for client-server communication.
 */
export const WS_EVENTS = {
  // Connection events
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  RECONNECT: "reconnect",
  CONNECT_ERROR: "connect_error",
  RECONNECT_ATTEMPT: "reconnect_attempt",

  // Message events
  MESSAGE_SEND: "message:send",
  MESSAGE_RECEIVE: "message:receive",
  MESSAGE_EDIT: "message:edit",
  MESSAGE_DELETE: "message:delete",
  MESSAGE_STATUS: "message:status",
  MESSAGE_REACTION: "message:reaction",
  MESSAGE_RECALL: "message:recall",
  MESSAGE_PIN: "message:pin",
  MESSAGE_UNPIN: "message:unpin",
  MESSAGE_FORWARD: "message:forward",
  MESSAGE_REPLY: "message:reply",

  // Typing events
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",

  // Read receipt events
  READ_RECEIPT: "read:receipt",
  READ_RECEIPT_BULK: "read:receipt:bulk",
  READ_RECEIPT_GROUP: "read:receipt:group",

  // Presence events
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  PRESENCE_AWAY: "presence:away",
  PRESENCE_BUSY: "presence:busy",
  PRESENCE_TYPING: "presence:typing",
  PRESENCE_STOP_TYPING: "presence:stop:typing",
  PRESENCE_UPDATE: "presence:update",

  // Group events
  GROUP_CREATE: "group:create",
  GROUP_UPDATE: "group:update",
  GROUP_DELETE: "group:delete",
  GROUP_JOIN: "group:join",
  GROUP_LEAVE: "group:leave",
  GROUP_ADD_MEMBER: "group:add:member",
  GROUP_REMOVE_MEMBER: "group:remove:member",
  GROUP_PROMOTE_ADMIN: "group:promote:admin",
  GROUP_DEMOTE_ADMIN: "group:demote:admin",
  GROUP_UPDATE_AVATAR: "group:update:avatar",
  GROUP_INVITE: "group:invite",
  GROUP_ACCEPT_INVITE: "group:accept:invite",
  GROUP_REJECT_INVITE: "group:reject:invite",
  GROUP_MENTION: "group:mention",
  GROUP_SETTINGS_UPDATE: "group:settings:update",

  // Call events
  CALL_INITIATE: "call:initiate",
  CALL_ANSWER: "call:answer",
  CALL_REJECT: "call:reject",
  CALL_END: "call:end",
  CALL_CANDIDATE: "call:candidate",
  CALL_OFFER: "call:offer",
  CALL_RESPONSE: "call:response",
  CALL_RINGING: "call:ringing",
  CALL_BUSY: "call:busy",
  CALL_MUTE: "call:mute",
  CALL_UNMUTE: "call:unmute",
  CALL_VIDEO_TOGGLE: "call:video:toggle",
  CALL_SCREEN_SHARE: "call:screen:share",
  CALL_SCREEN_STOP: "call:screen:stop",
  CALL_RECORD_START: "call:record:start",
  CALL_RECORD_STOP: "call:record:stop",
  CALL_TRANSFER: "call:transfer",

  // Notification events
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_READ: "notification:read",
  NOTIFICATION_DISMISS: "notification:dismiss",
  NOTIFICATION_CLEAR: "notification:clear",
  NOTIFICATION_UPDATE: "notification:update",

  // Admin events
  ADMIN_USER_SUSPEND: "admin:user:suspend",
  ADMIN_USER_UNSUSPEND: "admin:user:unsuspend",
  ADMIN_USER_DELETE: "admin:user:delete",
  ADMIN_GROUP_DELETE: "admin:group:delete",
  ADMIN_SYSTEM_BROADCAST: "admin:system:broadcast",
  ADMIN_SYSTEM_ANNOUNCEMENT: "admin:system:announcement",

  // Error events
  ERROR: "error",
  WS_ERROR: "ws:error",

  // System events
  PONG: "pong",
  HEARTBEAT: "heartbeat",
  SYSTEM_MAINTENANCE: "system:maintenance",
  SYSTEM_UPDATE: "system:update",
  SYSTEM_RESTART: "system:restart",
  SYSTEM_SHUTDOWN: "system:shutdown",
} as const;

// -------- SYSTEM EVENTS --------

/**
 * Internal system events (for module-to-module communication).
 */
export const SYSTEM_EVENTS = {
  // Application lifecycle
  APP_START: "app.start",
  APP_READY: "app.ready",
  APP_SHUTDOWN: "app.shutdown",
  APP_ERROR: "app.error",

  // Database events
  DB_CONNECT: "db.connect",
  DB_DISCONNECT: "db.disconnect",
  DB_ERROR: "db.error",
  DB_QUERY: "db.query",
  DB_SLOW_QUERY: "db.slow_query",

  // Cache events
  CACHE_SET: "cache.set",
  CACHE_GET: "cache.get",
  CACHE_DELETE: "cache.delete",
  CACHE_CLEAR: "cache.clear",
  CACHE_ERROR: "cache.error",
  CACHE_MISS: "cache.miss",
  CACHE_HIT: "cache.hit",

  // Queue events
  QUEUE_JOB_ADD: "queue.job.add",
  QUEUE_JOB_START: "queue.job.start",
  QUEUE_JOB_COMPLETE: "queue.job.complete",
  QUEUE_JOB_FAILED: "queue.job.failed",
  QUEUE_JOB_RETRY: "queue.job.retry",

  // Authentication events
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_REGISTER: "auth.register",
  AUTH_VERIFY_EMAIL: "auth.verify.email",
  AUTH_RESET_PASSWORD: "auth.reset.password",
  AUTH_2FA_ENABLE: "auth.2fa.enable",
  AUTH_2FA_DISABLE: "auth.2fa.disable",
  AUTH_SESSION_CREATE: "auth.session.create",
  AUTH_SESSION_DESTROY: "auth.session.destroy",
  AUTH_TOKEN_REFRESH: "auth.token.refresh",
  AUTH_FAILED_ATTEMPT: "auth.failed.attempt",

  // User events
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  USER_SUSPEND: "user.suspend",
  USER_UNSUSPEND: "user.unsuspend",
  USER_ONLINE: "user.online",
  USER_OFFLINE: "user.offline",

  // Message events
  MESSAGE_CREATE: "message.create",
  MESSAGE_UPDATE: "message.update",
  MESSAGE_DELETE: "message.delete",
  MESSAGE_READ: "message.read",
  MESSAGE_DELIVERED: "message.delivered",

  // Group events
  GROUP_CREATE: "group.create",
  GROUP_UPDATE: "group.update",
  GROUP_DELETE: "group.delete",
  GROUP_JOIN: "group.join",
  GROUP_LEAVE: "group.leave",
  GROUP_MEMBER_ADD: "group.member.add",
  GROUP_MEMBER_REMOVE: "group.member.remove",

  // Call events
  CALL_START: "call.start",
  CALL_END: "call.end",
  CALL_MISSED: "call.missed",
  CALL_REJECTED: "call.rejected",

  // File events
  FILE_UPLOAD: "file.upload",
  FILE_DOWNLOAD: "file.download",
  FILE_DELETE: "file.delete",
  FILE_SCAN: "file.scan",
  FILE_VIRUS_DETECTED: "file.virus.detected",

  // Security events
  SECURITY_VIOLATION: "security.violation",
  SECURITY_BREACH: "security.breach",
  SECURITY_AUDIT: "security.audit",
  RATE_LIMIT_EXCEEDED: "rate.limit.exceeded",

  // Monitoring events
  METRICS_REPORT: "metrics.report",
  HEALTH_CHECK: "health.check",
  HEALTH_FAIL: "health.fail",
  PERFORMANCE_WARNING: "performance.warning",

  // Error events
  ERROR_UNHANDLED: "error.unhandled",
  ERROR_CRITICAL: "error.critical",
  ERROR_RECOVERABLE: "error.recoverable",
} as const;

// -------- BUSINESS EVENTS --------

/**
 * Business domain events for event-driven architecture.
 */
export const BUSINESS_EVENTS = {
  // User domain
  USER_REGISTERED: "user.registered",
  USER_VERIFIED: "user.verified",
  USER_PROFILE_UPDATED: "user.profile.updated",
  USER_AVATAR_UPDATED: "user.avatar.updated",
  USER_STATUS_UPDATED: "user.status.updated",
  USER_PREFERENCE_UPDATED: "user.preference.updated",

  // Contact domain
  CONTACT_ADDED: "contact.added",
  CONTACT_REMOVED: "contact.removed",
  CONTACT_BLOCKED: "contact.blocked",
  CONTACT_UNBLOCKED: "contact.unblocked",
  CONTACT_REQUEST_SENT: "contact.request.sent",
  CONTACT_REQUEST_ACCEPTED: "contact.request.accepted",
  CONTACT_REQUEST_REJECTED: "contact.request.rejected",

  // Message domain
  MESSAGE_SENT: "message.sent",
  MESSAGE_RECEIVED: "message.received",
  MESSAGE_READ: "message.read",
  MESSAGE_DELIVERED: "message.delivered",
  MESSAGE_EDITED: "message.edited",
  MESSAGE_DELETED: "message.deleted",
  MESSAGE_REACTED: "message.reacted",
  MESSAGE_FORWARDED: "message.forwarded",

  // Group domain
  GROUP_CREATED: "group.created",
  GROUP_UPDATED: "group.updated",
  GROUP_DELETED: "group.deleted",
  GROUP_MEMBER_JOINED: "group.member.joined",
  GROUP_MEMBER_LEFT: "group.member.left",
  GROUP_MEMBER_ADDED: "group.member.added",
  GROUP_MEMBER_REMOVED: "group.member.removed",
  GROUP_ADMIN_PROMOTED: "group.admin.promoted",
  GROUP_ADMIN_DEMOTED: "group.admin.demoted",
  GROUP_INVITE_CREATED: "group.invite.created",
  GROUP_INVITE_ACCEPTED: "group.invite.accepted",

  // Call domain
  CALL_INITIATED: "call.initiated",
  CALL_ANSWERED: "call.answered",
  CALL_ENDED: "call.ended",
  CALL_MISSED: "call.missed",
  CALL_REJECTED: "call.rejected",
  CALL_RECORDED: "call.recorded",

  // Notification domain
  NOTIFICATION_SENT: "notification.sent",
  NOTIFICATION_READ: "notification.read",
  NOTIFICATION_DISMISSED: "notification.dismissed",
  NOTIFICATION_CLEARED: "notification.cleared",

  // Payment domain (future)
  PAYMENT_CREATED: "payment.created",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",

  // Subscription domain (future)
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_UPDATED: "subscription.updated",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SUBSCRIPTION_EXPIRED: "subscription.expired",
} as const;

// -------- EVENT PAYLOAD TYPES --------

/**
 * Base event payload interface.
 */
export interface BaseEventPayload {
  /** Event ID (unique) */
  eventId?: string;
  /** Timestamp of the event */
  timestamp?: string;
  /** User who triggered the event */
  userId?: string;
  /** Request ID (for tracing) */
  requestId?: string;
  /** Correlation ID (for distributed tracing) */
  correlationId?: string;
  /** IP address of the source */
  sourceIp?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * User events payload.
 */
export interface UserEventPayload extends BaseEventPayload {
  userId: string;
  email?: string;
  displayName?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  reason?: string;
}

/**
 * Message event payload.
 */
export interface MessageEventPayload extends BaseEventPayload {
  messageId: string;
  chatId: string;
  senderId: string;
  recipientId?: string;
  messageType: string;
  content?: string;
  previousContent?: string;
  status?: string;
  metadata?: Record<string, any>;
}

/**
 * Group event payload.
 */
export interface GroupEventPayload extends BaseEventPayload {
  groupId: string;
  groupName?: string;
  memberId?: string;
  action?: string;
  role?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Call event payload.
 */
export interface CallEventPayload extends BaseEventPayload {
  callId: string;
  callType: string;
  initiatorId: string;
  participantIds: string[];
  status: string;
  duration?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Notification event payload.
 */
export interface NotificationEventPayload extends BaseEventPayload {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  read?: boolean;
  delivered?: boolean;
}

/**
 * Security event payload.
 */
export interface SecurityEventPayload extends BaseEventPayload {
  eventType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  actor: string;
  target?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

/**
 * Error event payload.
 */
export interface ErrorEventPayload extends BaseEventPayload {
  errorId: string;
  errorType: string;
  errorCode: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
  severity: "low" | "medium" | "high" | "critical";
}

// -------- EVENT EMITTER UTILITIES --------

/**
 * Event emitter utility functions for consistent event emission.
 */
export class EventEmitterUtils {
  /**
   * Create a standard event payload.
   */
  static createPayload<T extends BaseEventPayload>(
    data: Partial<T>,
    requestId?: string,
    userId?: string,
  ): T {
    const payload: any = {
      ...data,
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      requestId: requestId || data.requestId,
      userId: userId || data.userId,
      correlationId: data.correlationId,
    };
    return payload as T;
  }

  /**
   * Generate a unique event ID.
   */
  static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Extract request context for event payload.
   */
  static extractRequestContext(request: any): Partial<BaseEventPayload> {
    if (!request) return {};
    return {
      requestId: request.requestId || request.id,
      correlationId: request.correlationId,
      sourceIp: request.ip || request.ipAddress,
      userId: request.user?.id || request.userId,
    };
  }

  /**
   * Log an event emission.
   */
  static logEvent(eventName: string, payload: any, logger: any): void {
    const level = this.getEventLogLevel(eventName);
    const logMessage = `Event: ${eventName} | Payload: ${JSON.stringify(payload)}`;

    switch (level) {
      case "debug":
        logger.debug?.(logMessage);
        break;
      case "info":
        logger.log?.(logMessage);
        break;
      case "warn":
        logger.warn?.(logMessage);
        break;
      case "error":
        logger.error?.(logMessage);
        break;
      default:
        logger.log?.(logMessage);
    }
  }

  /**
   * Get log level for an event.
   */
  static getEventLogLevel(
    eventName: string,
  ): "debug" | "info" | "warn" | "error" {
    if (eventName.includes("error") || eventName.includes("failed"))
      return "error";
    if (eventName.includes("warn") || eventName.includes("violation"))
      return "warn";
    if (eventName.includes("debug")) return "debug";
    return "info";
  }

  /**
   * Check if an event should be logged.
   */
  static shouldLogEvent(eventName: string): boolean {
    // Skip logging for high-frequency events
    const skipEvents = [
      "presence:update",
      "presence:online",
      "presence:offline",
      "heartbeat",
      "pong",
      "metrics.report",
      "cache.hit",
      "cache.miss",
    ];
    return !skipEvents.includes(eventName);
  }
}

// -------- EVENT BUS INTERFACE --------

/**
 * Event bus interface for internal event communication.
 */
export interface IEventBus {
  /**
   * Subscribe to an event.
   */
  subscribe<T = any>(
    event: string,
    handler: (payload: T) => void | Promise<void>,
  ): () => void;

  /**
   * Subscribe to an event with priority (higher = earlier execution).
   */
  subscribeWithPriority<T = any>(
    event: string,
    priority: number,
    handler: (payload: T) => void | Promise<void>,
  ): () => void;

  /**
   * Subscribe once to an event.
   */
  subscribeOnce<T = any>(
    event: string,
    handler: (payload: T) => void | Promise<void>,
  ): () => void;

  /**
   * Emit an event (synchronous).
   */
  emit<T = any>(event: string, payload: T): void;

  /**
   * Emit an event (asynchronous).
   */
  emitAsync<T = any>(event: string, payload: T): Promise<void>;

  /**
   * Emit an event and wait for all handlers to complete.
   */
  emitAndWait<T = any>(event: string, payload: T): Promise<void>;

  /**
   * Remove all listeners for an event.
   */
  clear(event: string): void;

  /**
   * Get all listeners for an event.
   */
  getListeners(event: string): Function[];

  /**
   * Get all registered events.
   */
  getEvents(): string[];
}

// -------- EVENT BUS IMPLEMENTATION --------

/**
 * Lightweight event bus implementation.
 */
export class EventBus implements IEventBus {
  private listeners = new Map<
    string,
    Array<{ handler: Function; priority: number; once: boolean }>
  >();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger || console;
  }

  /**
   * Subscribe to an event.
   */
  subscribe<T = any>(
    event: string,
    handler: (payload: T) => void | Promise<void>,
  ): () => void {
    return this.subscribeWithPriority(event, 0, handler);
  }

  /**
   * Subscribe to an event with priority.
   */
  subscribeWithPriority<T = any>(
    event: string,
    priority: number,
    handler: (payload: T) => void | Promise<void>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event)!;
    listeners.push({ handler, priority, once: false });

    // Sort by priority (higher first)
    listeners.sort((a, b) => b.priority - a.priority);

    return () => {
      const idx = listeners.findIndex((l) => l.handler === handler);
      if (idx > -1) {
        listeners.splice(idx, 1);
      }
      if (listeners.length === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Subscribe once to an event.
   */
  subscribeOnce<T = any>(
    event: string,
    handler: (payload: T) => void | Promise<void>,
  ): () => void {
    const wrappedHandler = (payload: T) => {
      // Remove self first
      const idx = this.listeners
        .get(event)
        ?.findIndex((l) => l.handler === wrappedHandler);
      if (idx !== undefined && idx > -1) {
        this.listeners.get(event)?.splice(idx, 1);
      }
      return handler(payload);
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners
      .get(event)!
      .push({ handler: wrappedHandler, priority: 0, once: true });

    return () => {
      const idx = this.listeners
        .get(event)
        ?.findIndex((l) => l.handler === wrappedHandler);
      if (idx !== undefined && idx > -1) {
        this.listeners.get(event)?.splice(idx, 1);
      }
    };
  }

  /**
   * Emit an event (synchronous).
   */
  emit<T = any>(event: string, payload: T): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) return;

    // Filter out once listeners that have already been executed
    const validListeners = listeners.filter((l) => !l.once);

    for (const listener of validListeners) {
      try {
        listener.handler(payload);
      } catch (error) {
        this.logger?.error?.(
          `Error in event handler for ${event}: ${error.message}`,
        );
      }
    }

    // Update the listeners list with valid listeners
    this.listeners.set(event, validListeners);
    if (validListeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event (asynchronous).
   */
  async emitAsync<T = any>(event: string, payload: T): Promise<void> {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) return;

    const validListeners = listeners.filter((l) => !l.once);
    const promises = validListeners.map((listener) => {
      try {
        const result = listener.handler(payload);
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.logger?.error?.(
              `Error in async event handler for ${event}: ${error.message}`,
            );
          });
        }
        return Promise.resolve();
      } catch (error) {
        this.logger?.error?.(
          `Error in event handler for ${event}: ${error.message}`,
        );
        return Promise.resolve();
      }
    });

    await Promise.all(promises);

    this.listeners.set(event, validListeners);
    if (validListeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event and wait for all handlers to complete.
   */
  async emitAndWait<T = any>(event: string, payload: T): Promise<void> {
    return this.emitAsync(event, payload);
  }

  /**
   * Remove all listeners for an event.
   */
  clear(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Get all listeners for an event.
   */
  getListeners(event: string): Function[] {
    const listeners = this.listeners.get(event);
    if (!listeners) return [];
    return listeners.map((l) => l.handler);
  }

  /**
   * Get all registered events.
   */
  getEvents(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get the count of listeners for an event.
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Get total listener count across all events.
   */
  getTotalListenerCount(): number {
    let total = 0;
    for (const [, listeners] of this.listeners) {
      total += listeners.length;
    }
    return total;
  }
}

// -------- EVENT METRICS --------

/**
 * Event metrics tracking.
 */
export class EventMetrics {
  private eventCounts = new Map<string, number>();
  private eventTimings = new Map<string, number[]>();
  private maxSamples = 100;

  /**
   * Track an event emission.
   */
  trackEvent(event: string, duration?: number): void {
    // Increment count
    const count = this.eventCounts.get(event) || 0;
    this.eventCounts.set(event, count + 1);

    // Track timing
    if (duration !== undefined) {
      const timings = this.eventTimings.get(event) || [];
      timings.push(duration);
      if (timings.length > this.maxSamples) {
        timings.shift();
      }
      this.eventTimings.set(event, timings);
    }
  }

  /**
   * Get event statistics.
   */
  getStats(event: string): {
    count: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
    p95Duration: number;
  } | null {
    const count = this.eventCounts.get(event) || 0;
    const timings = this.eventTimings.get(event) || [];

    if (count === 0 && timings.length === 0) return null;

    const sorted = [...timings].sort((a, b) => a - b);

    return {
      count,
      averageDuration:
        timings.length > 0
          ? timings.reduce((a, b) => a + b, 0) / timings.length
          : 0,
      maxDuration: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      minDuration: sorted.length > 0 ? sorted[0] : 0,
      p95Duration:
        sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0,
    };
  }

  /**
   * Get all event statistics.
   */
  getAllStats(): Record<
    string,
    {
      count: number;
      averageDuration: number;
      maxDuration: number;
      minDuration: number;
      p95Duration: number;
    }
  > {
    const stats: Record<string, any> = {};
    for (const event of this.eventCounts.keys()) {
      const stat = this.getStats(event);
      if (stat) {
        stats[event] = stat;
      }
    }
    return stats;
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.eventCounts.clear();
    this.eventTimings.clear();
  }

  /**
   * Get the most frequent events.
   */
  getTopEvents(limit: number = 10): Array<{ event: string; count: number }> {
    const events = Array.from(this.eventCounts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
    return events.slice(0, limit);
  }

  /**
   * Get event count for a specific event.
   */
  getEventCount(event: string): number {
    return this.eventCounts.get(event) || 0;
  }

  /**
   * Get total events emitted.
   */
  getTotalEvents(): number {
    let total = 0;
    for (const count of this.eventCounts.values()) {
      total += count;
    }
    return total;
  }
}

// -------- EVENT CONSTANTS GROUPING --------

/**
 * All event constants in one object for easy import.
 */
export const ALL_EVENTS = {
  WS: WS_EVENTS,
  SYSTEM: SYSTEM_EVENTS,
  BUSINESS: BUSINESS_EVENTS,
} as const;

// -------- EVENT HANDLER TYPES --------

/**
 * Type for event handler functions.
 */
export type EventHandler<T = any> = (payload: T) => void | Promise<void>;

/**
 * Type for event handler with priority.
 */
export interface PrioritizedEventHandler<T = any> {
  priority: number;
  handler: EventHandler<T>;
}

// -------- END --------
