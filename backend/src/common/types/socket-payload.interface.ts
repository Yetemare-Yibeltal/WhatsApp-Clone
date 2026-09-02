// backend/src/common/types/socket-payload.interface.ts
/**
 * 📄 Socket Payload Interfaces
 *
 * This file defines all WebSocket payload types used in the Real WhatsApp Clone.
 * These types are shared between the backend (NestJS gateways) and the frontend
 * (React Socket.IO client) to ensure type safety and consistency.
 *
 * @category Types
 * @module SocketPayload
 */

import { AuthUser } from "../decorators/current-user.decorator";

// -------- ENUMS --------

/**
 * WebSocket event types.
 */
export enum WsEvent {
  // Connection events
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  RECONNECT = "reconnect",

  // Message events
  MESSAGE_SEND = "message:send",
  MESSAGE_RECEIVE = "message:receive",
  MESSAGE_EDIT = "message:edit",
  MESSAGE_DELETE = "message:delete",
  MESSAGE_STATUS = "message:status",
  MESSAGE_REACTION = "message:reaction",
  MESSAGE_RECALL = "message:recall",
  MESSAGE_PIN = "message:pin",

  // Typing events
  TYPING_START = "typing:start",
  TYPING_STOP = "typing:stop",

  // Read receipt events
  READ_RECEIPT = "read:receipt",
  READ_RECEIPT_BULK = "read:receipt:bulk",
  READ_RECEIPT_GROUP = "read:receipt:group",

  // Presence events
  PRESENCE_ONLINE = "presence:online",
  PRESENCE_OFFLINE = "presence:offline",
  PRESENCE_TYPING = "presence:typing",
  PRESENCE_STOP_TYPING = "presence:stop:typing",

  // Group events
  GROUP_CREATE = "group:create",
  GROUP_UPDATE = "group:update",
  GROUP_DELETE = "group:delete",
  GROUP_JOIN = "group:join",
  GROUP_LEAVE = "group:leave",
  GROUP_ADD_MEMBER = "group:add:member",
  GROUP_REMOVE_MEMBER = "group:remove:member",
  GROUP_PROMOTE_ADMIN = "group:promote:admin",
  GROUP_DEMOTE_ADMIN = "group:demote:admin",
  GROUP_UPDATE_AVATAR = "group:update:avatar",
  GROUP_INVITE = "group:invite",
  GROUP_ACCEPT_INVITE = "group:accept:invite",
  GROUP_REJECT_INVITE = "group:reject:invite",
  GROUP_MENTION = "group:mention",

  // Call events
  CALL_INITIATE = "call:initiate",
  CALL_ANSWER = "call:answer",
  CALL_REJECT = "call:reject",
  CALL_END = "call:end",
  CALL_CANDIDATE = "call:candidate",
  CALL_OFFER = "call:offer",
  CALL_RESPONSE = "call:response",
  CALL_RINGING = "call:ringing",
  CALL_BUSY = "call:busy",
  CALL_MUTE = "call:mute",
  CALL_UNMUTE = "call:unmute",
  CALL_VIDEO_TOGGLE = "call:video:toggle",
  CALL_SCREEN_SHARE = "call:screen:share",
  CALL_SCREEN_STOP = "call:screen:stop",
  CALL_RECORD_START = "call:record:start",
  CALL_RECORD_STOP = "call:record:stop",

  // Notification events
  NOTIFICATION_NEW = "notification:new",
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_DISMISS = "notification:dismiss",
  NOTIFICATION_CLEAR = "notification:clear",

  // Error events
  ERROR = "error",
  WS_ERROR = "ws:error",

  // Admin events
  ADMIN_USER_SUSPEND = "admin:user:suspend",
  ADMIN_USER_UNSUSPEND = "admin:user:unsuspend",
  ADMIN_USER_DELETE = "admin:user:delete",
  ADMIN_GROUP_DELETE = "admin:group:delete",
  ADMIN_SYSTEM_BROADCAST = "admin:system:broadcast",

  // System events
  PONG = "pong",
  HEARTBEAT = "heartbeat",
  SYSTEM_MAINTENANCE = "system:maintenance",
  SYSTEM_UPDATE = "system:update",
}

/**
 * Message types for content classification.
 */
export enum MessageType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  AUDIO = "AUDIO",
  DOCUMENT = "DOCUMENT",
  VOICE_NOTE = "VOICE_NOTE",
  LOCATION = "LOCATION",
  CONTACT = "CONTACT",
  STICKER = "STICKER",
  GIF = "GIF",
  POLL = "POLL",
  EVENT = "EVENT",
  SYSTEM = "SYSTEM",
}

/**
 * Message status types.
 */
export enum MessageStatus {
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
  PENDING = "PENDING",
}

/**
 * Call types.
 */
export enum CallType {
  VOICE = "VOICE",
  VIDEO = "VIDEO",
  GROUP_VOICE = "GROUP_VOICE",
  GROUP_VIDEO = "GROUP_VIDEO",
}

/**
 * Call status types.
 */
export enum CallStatus {
  INITIATED = "INITIATED",
  RINGING = "RINGING",
  ANSWERED = "ANSWERED",
  REJECTED = "REJECTED",
  ENDED = "ENDED",
  MISSED = "MISSED",
  BUSY = "BUSY",
  FAILED = "FAILED",
}

/**
 * User presence status.
 */
export enum PresenceStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  AWAY = "AWAY",
  BUSY = "BUSY",
  TYPING = "TYPING",
}

/**
 * Group roles.
 */
export enum GroupRole {
  MEMBER = "MEMBER",
  ADMIN = "ADMIN",
  OWNER = "OWNER",
}

/**
 * Notification types.
 */
export enum NotificationType {
  MESSAGE = "MESSAGE",
  GROUP = "GROUP",
  CALL = "CALL",
  SYSTEM = "SYSTEM",
  ADMIN = "ADMIN",
  MENTION = "MENTION",
  REACTION = "REACTION",
}

// -------- BASE INTERFACES --------

/**
 * Base payload interface with common fields.
 */
export interface BasePayload {
  /** Unique request ID for tracking */
  requestId?: string;
  /** Timestamp of the event */
  timestamp?: string;
  /** User ID of the sender */
  userId?: string;
  /** Client ID (for multi‑device) */
  clientId?: string;
}

/**
 * Base response payload interface.
 */
export interface BaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

// -------- MESSAGE PAYLOADS --------

/**
 * Send a new message.
 */
export interface SendMessagePayload extends BasePayload {
  chatId: string;
  messageType: MessageType;
  content: string;
  media?: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  };
  replyToId?: string;
  mentions?: string[]; // user IDs mentioned
  metadata?: Record<string, any>;
}

/**
 * Receive a message (server to client).
 */
export interface ReceiveMessagePayload extends BasePayload {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageType: MessageType;
  content: string;
  media?: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  };
  replyToId?: string;
  replyToContent?: string;
  mentions?: string[];
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  isDeleted: boolean;
  metadata?: Record<string, any>;
}

/**
 * Edit a message.
 */
export interface EditMessagePayload extends BasePayload {
  messageId: string;
  chatId: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Delete a message.
 */
export interface DeleteMessagePayload extends BasePayload {
  messageId: string;
  chatId: string;
  forEveryone: boolean;
  reason?: string;
}

/**
 * Update message status.
 */
export interface MessageStatusPayload extends BasePayload {
  messageId: string;
  chatId: string;
  status: MessageStatus;
  userId?: string;
  timestamp: string;
}

/**
 * Add a reaction to a message.
 */
export interface MessageReactionPayload extends BasePayload {
  messageId: string;
  chatId: string;
  reaction: string; // emoji
  remove: boolean;
}

/**
 * Recall a message (for everyone).
 */
export interface RecallMessagePayload extends BasePayload {
  messageId: string;
  chatId: string;
  reason?: string;
}

/**
 * Pin a message.
 */
export interface PinMessagePayload extends BasePayload {
  messageId: string;
  chatId: string;
  pin: boolean;
}

// -------- TYPING PAYLOADS --------

/**
 * Start typing.
 */
export interface TypingStartPayload extends BasePayload {
  chatId: string;
  userId?: string;
  userName?: string;
}

/**
 * Stop typing.
 */
export interface TypingStopPayload extends BasePayload {
  chatId: string;
  userId?: string;
}

// -------- READ RECEIPT PAYLOADS --------

/**
 * Mark messages as read.
 */
export interface ReadReceiptPayload extends BasePayload {
  chatId: string;
  messageIds: string[];
  userId?: string;
  userName?: string;
}

/**
 * Bulk read receipt for multiple chats.
 */
export interface BulkReadReceiptPayload extends BasePayload {
  receipts: {
    chatId: string;
    messageIds: string[];
    readAt: string;
  }[];
}

/**
 * Group read receipt (sent to all members).
 */
export interface GroupReadReceiptPayload extends BasePayload {
  chatId: string;
  messageId: string;
  readBy: {
    userId: string;
    userName: string;
    readAt: string;
  }[];
}

// -------- PRESENCE PAYLOADS --------

/**
 * User online status.
 */
export interface PresenceOnlinePayload extends BasePayload {
  userId: string;
  userName: string;
  status: PresenceStatus;
  lastSeen?: string;
  deviceId?: string;
  deviceType?: "web" | "mobile" | "desktop";
}

/**
 * User offline status.
 */
export interface PresenceOfflinePayload extends BasePayload {
  userId: string;
  userName: string;
  lastSeen: string;
  deviceId?: string;
}

/**
 * User is typing (presence).
 */
export interface PresenceTypingPayload extends BasePayload {
  userId: string;
  userName: string;
  chatId: string;
  isTyping: boolean;
}

// -------- GROUP PAYLOADS --------

/**
 * Create a group.
 */
export interface CreateGroupPayload extends BasePayload {
  name: string;
  description?: string;
  avatarUrl?: string;
  members: string[]; // user IDs
  isPrivate?: boolean;
}

/**
 * Group created response.
 */
export interface GroupCreatedPayload extends BasePayload {
  groupId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  members: {
    userId: string;
    userName: string;
    role: GroupRole;
    joinedAt: string;
  }[];
  inviteLink?: string;
  createdAt: string;
}

/**
 * Update group details.
 */
export interface UpdateGroupPayload extends BasePayload {
  groupId: string;
  name?: string;
  description?: string;
  avatarUrl?: string;
  isPrivate?: boolean;
}

/**
 * Delete group.
 */
export interface DeleteGroupPayload extends BasePayload {
  groupId: string;
  reason?: string;
}

/**
 * Join group.
 */
export interface JoinGroupPayload extends BasePayload {
  groupId: string;
  inviteCode?: string;
}

/**
 * Leave group.
 */
export interface LeaveGroupPayload extends BasePayload {
  groupId: string;
  reason?: string;
}

/**
 * Add member to group.
 */
export interface AddGroupMemberPayload extends BasePayload {
  groupId: string;
  userId: string;
  role?: GroupRole;
}

/**
 * Remove member from group.
 */
export interface RemoveGroupMemberPayload extends BasePayload {
  groupId: string;
  userId: string;
  reason?: string;
}

/**
 * Promote member to admin.
 */
export interface PromoteAdminPayload extends BasePayload {
  groupId: string;
  userId: string;
}

/**
 * Demote admin to member.
 */
export interface DemoteAdminPayload extends BasePayload {
  groupId: string;
  userId: string;
}

/**
 * Generate group invite link.
 */
export interface GroupInvitePayload extends BasePayload {
  groupId: string;
  expiresIn?: number; // seconds
  maxUses?: number;
}

/**
 * Group invite response.
 */
export interface GroupInviteResponsePayload extends BasePayload {
  groupId: string;
  inviteCode: string;
  inviteLink: string;
  expiresAt: string;
  maxUses: number;
}

/**
 * Accept group invite.
 */
export interface AcceptGroupInvitePayload extends BasePayload {
  inviteCode: string;
}

/**
 * Reject group invite.
 */
export interface RejectGroupInvitePayload extends BasePayload {
  inviteCode: string;
}

/**
 * Group mention event.
 */
export interface GroupMentionPayload extends BasePayload {
  groupId: string;
  messageId: string;
  mentionedBy: string;
  mentionedByUserName: string;
  mentionedUsers: string[];
  content: string;
  chatName: string;
}

// -------- CALL PAYLOADS --------

/**
 * Initiate a call.
 */
export interface InitiateCallPayload extends BasePayload {
  callType: CallType;
  targetUserId?: string;
  groupId?: string;
  participants?: string[];
  isVideo: boolean;
  metadata?: Record<string, any>;
}

/**
 * Call initiated response.
 */
export interface CallInitiatedPayload extends BasePayload {
  callId: string;
  callType: CallType;
  initiatorId: string;
  initiatorName: string;
  targetUserId?: string;
  groupId?: string;
  participants: string[];
  isVideo: boolean;
  status: CallStatus;
  startedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Answer a call.
 */
export interface AnswerCallPayload extends BasePayload {
  callId: string;
  accept: boolean;
}

/**
 * Reject a call.
 */
export interface RejectCallPayload extends BasePayload {
  callId: string;
  reason?: string;
}

/**
 * End a call.
 */
export interface EndCallPayload extends BasePayload {
  callId: string;
  reason?: string;
}

/**
 * ICE candidate exchange.
 */
export interface IceCandidatePayload extends BasePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
  targetUserId?: string;
}

/**
 * SDP offer/answer.
 */
export interface SdpPayload extends BasePayload {
  callId: string;
  sdp: RTCSessionDescriptionInit;
  targetUserId?: string;
}

/**
 * Call ringing event.
 */
export interface CallRingingPayload extends BasePayload {
  callId: string;
  userId: string;
  userName: string;
}

/**
 * Call busy event.
 */
export interface CallBusyPayload extends BasePayload {
  callId: string;
  userId: string;
  userName: string;
}

/**
 * Mute/unmute call.
 */
export interface CallMutePayload extends BasePayload {
  callId: string;
  muted: boolean;
  userId?: string;
}

/**
 * Video toggle.
 */
export interface CallVideoTogglePayload extends BasePayload {
  callId: string;
  enabled: boolean;
  userId?: string;
}

/**
 * Screen share.
 */
export interface ScreenSharePayload extends BasePayload {
  callId: string;
  enabled: boolean;
  userId?: string;
}

/**
 * Call recording.
 */
export interface CallRecordPayload extends BasePayload {
  callId: string;
  recording: boolean;
  userId?: string;
}

// -------- NOTIFICATION PAYLOADS --------

/**
 * New notification.
 */
export interface NotificationPayload extends BasePayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: {
    chatId?: string;
    messageId?: string;
    userId?: string;
    groupId?: string;
    callId?: string;
    [key: string]: any;
  };
  read: boolean;
  createdAt: string;
  priority: "low" | "normal" | "high";
  actionUrl?: string;
  icon?: string;
  image?: string;
}

/**
 * Mark notification as read.
 */
export interface NotificationReadPayload extends BasePayload {
  notificationId: string;
}

/**
 * Dismiss notification.
 */
export interface NotificationDismissPayload extends BasePayload {
  notificationId: string;
}

/**
 * Clear all notifications.
 */
export interface NotificationClearPayload extends BasePayload {
  type?: NotificationType;
}

// -------- ADMIN PAYLOADS --------

/**
 * Suspend a user.
 */
export interface AdminSuspendUserPayload extends BasePayload {
  userId: string;
  reason: string;
  duration?: number; // seconds, null for permanent
}

/**
 * Unsuspend a user.
 */
export interface AdminUnsuspendUserPayload extends BasePayload {
  userId: string;
  reason?: string;
}

/**
 * Delete a user (admin).
 */
export interface AdminDeleteUserPayload extends BasePayload {
  userId: string;
  reason: string;
}

/**
 * Delete a group (admin).
 */
export interface AdminDeleteGroupPayload extends BasePayload {
  groupId: string;
  reason: string;
}

/**
 * System broadcast message.
 */
export interface AdminSystemBroadcastPayload extends BasePayload {
  message: string;
  targetUsers?: string[];
  targetRoles?: string[];
  priority: "low" | "normal" | "high";
  expiresAt?: string;
}

// -------- SYSTEM PAYLOADS --------

/**
 * Heartbeat / ping.
 */
export interface HeartbeatPayload extends BasePayload {
  timestamp: string;
  clientTime: number;
}

/**
 * Pong response.
 */
export interface PongPayload extends BasePayload {
  timestamp: string;
  serverTime: number;
  clientTime: number;
  latency: number;
}

/**
 * System maintenance.
 */
export interface SystemMaintenancePayload extends BasePayload {
  message: string;
  scheduledAt: string;
  duration: number; // seconds
  affectedServices: string[];
}

/**
 * System update notification.
 */
export interface SystemUpdatePayload extends BasePayload {
  version: string;
  changes: string[];
  updateType: "minor" | "major" | "patch";
  scheduledAt: string;
}

// -------- ERROR PAYLOADS --------

/**
 * WebSocket error response.
 */
export interface WsErrorPayload extends BasePayload {
  code: string;
  message: string;
  details?: any;
  recovery: {
    reconnect: boolean;
    delay?: number;
    reason?: string;
  };
}

// -------- UTILITY TYPES --------

/**
 * Generic payload wrapper for all events.
 */
export interface WsPayload<T = any> {
  event: WsEvent | string;
  payload: T;
  requestId?: string;
  timestamp?: string;
}

/**
 * Type mapping for all events and their payloads.
 */
export interface WsEventMap {
  [WsEvent.MESSAGE_SEND]: SendMessagePayload;
  [WsEvent.MESSAGE_RECEIVE]: ReceiveMessagePayload;
  [WsEvent.MESSAGE_EDIT]: EditMessagePayload;
  [WsEvent.MESSAGE_DELETE]: DeleteMessagePayload;
  [WsEvent.MESSAGE_STATUS]: MessageStatusPayload;
  [WsEvent.MESSAGE_REACTION]: MessageReactionPayload;
  [WsEvent.MESSAGE_RECALL]: RecallMessagePayload;
  [WsEvent.MESSAGE_PIN]: PinMessagePayload;

  [WsEvent.TYPING_START]: TypingStartPayload;
  [WsEvent.TYPING_STOP]: TypingStopPayload;

  [WsEvent.READ_RECEIPT]: ReadReceiptPayload;
  [WsEvent.READ_RECEIPT_BULK]: BulkReadReceiptPayload;
  [WsEvent.READ_RECEIPT_GROUP]: GroupReadReceiptPayload;

  [WsEvent.PRESENCE_ONLINE]: PresenceOnlinePayload;
  [WsEvent.PRESENCE_OFFLINE]: PresenceOfflinePayload;
  [WsEvent.PRESENCE_TYPING]: PresenceTypingPayload;
  [WsEvent.PRESENCE_STOP_TYPING]: PresenceTypingPayload;

  [WsEvent.GROUP_CREATE]: CreateGroupPayload;
  [WsEvent.GROUP_UPDATE]: UpdateGroupPayload;
  [WsEvent.GROUP_DELETE]: DeleteGroupPayload;
  [WsEvent.GROUP_JOIN]: JoinGroupPayload;
  [WsEvent.GROUP_LEAVE]: LeaveGroupPayload;
  [WsEvent.GROUP_ADD_MEMBER]: AddGroupMemberPayload;
  [WsEvent.GROUP_REMOVE_MEMBER]: RemoveGroupMemberPayload;
  [WsEvent.GROUP_PROMOTE_ADMIN]: PromoteAdminPayload;
  [WsEvent.GROUP_DEMOTE_ADMIN]: DemoteAdminPayload;
  [WsEvent.GROUP_INVITE]: GroupInvitePayload;
  [WsEvent.GROUP_ACCEPT_INVITE]: AcceptGroupInvitePayload;
  [WsEvent.GROUP_REJECT_INVITE]: RejectGroupInvitePayload;
  [WsEvent.GROUP_MENTION]: GroupMentionPayload;

  [WsEvent.CALL_INITIATE]: InitiateCallPayload;
  [WsEvent.CALL_ANSWER]: AnswerCallPayload;
  [WsEvent.CALL_REJECT]: RejectCallPayload;
  [WsEvent.CALL_END]: EndCallPayload;
  [WsEvent.CALL_CANDIDATE]: IceCandidatePayload;
  [WsEvent.CALL_OFFER]: SdpPayload;
  [WsEvent.CALL_RESPONSE]: SdpPayload;
  [WsEvent.CALL_RINGING]: CallRingingPayload;
  [WsEvent.CALL_BUSY]: CallBusyPayload;
  [WsEvent.CALL_MUTE]: CallMutePayload;
  [WsEvent.CALL_UNMUTE]: CallMutePayload;
  [WsEvent.CALL_VIDEO_TOGGLE]: CallVideoTogglePayload;
  [WsEvent.CALL_SCREEN_SHARE]: ScreenSharePayload;
  [WsEvent.CALL_SCREEN_STOP]: ScreenSharePayload;
  [WsEvent.CALL_RECORD_START]: CallRecordPayload;
  [WsEvent.CALL_RECORD_STOP]: CallRecordPayload;

  [WsEvent.NOTIFICATION_NEW]: NotificationPayload;
  [WsEvent.NOTIFICATION_READ]: NotificationReadPayload;
  [WsEvent.NOTIFICATION_DISMISS]: NotificationDismissPayload;
  [WsEvent.NOTIFICATION_CLEAR]: NotificationClearPayload;

  [WsEvent.ERROR]: WsErrorPayload;
  [WsEvent.WS_ERROR]: WsErrorPayload;

  [WsEvent.ADMIN_USER_SUSPEND]: AdminSuspendUserPayload;
  [WsEvent.ADMIN_USER_UNSUSPEND]: AdminUnsuspendUserPayload;
  [WsEvent.ADMIN_USER_DELETE]: AdminDeleteUserPayload;
  [WsEvent.ADMIN_GROUP_DELETE]: AdminDeleteGroupPayload;
  [WsEvent.ADMIN_SYSTEM_BROADCAST]: AdminSystemBroadcastPayload;

  [WsEvent.PONG]: PongPayload;
  [WsEvent.HEARTBEAT]: HeartbeatPayload;
  [WsEvent.SYSTEM_MAINTENANCE]: SystemMaintenancePayload;
  [WsEvent.SYSTEM_UPDATE]: SystemUpdatePayload;
}

// -------- GUARD & UTILITY TYPES --------

/**
 * Type-safe event emitter for WebSocket connections.
 */
export type WsEventHandler<T extends WsEvent> = (
  payload: WsEventMap[T],
  client: any,
) => Promise<void> | void;

/**
 * Type-safe event listener for client-side.
 */
export type WsEventListener<T extends WsEvent> = (
  payload: WsEventMap[T],
) => void;

/**
 * Connection context for WebSocket sessions.
 */
export interface WsConnectionContext {
  clientId: string;
  userId: string;
  user: AuthUser;
  rooms: string[];
  connectedAt: string;
  lastActivityAt: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  subscriptions: Set<string>;
}

/**
 * Room subscription data.
 */
export interface WsRoomSubscription {
  roomId: string;
  roomType: "private" | "group" | "broadcast";
  joinedAt: string;
  lastReadAt: string;
  unreadCount: number;
}

/**
 * WebSocket connection statistics.
 */
export interface WsConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsPerUser: Map<string, number>;
  messagesPerMinute: number;
  averageLatency: number;
  activeRooms: number;
}

// -------- END --------
