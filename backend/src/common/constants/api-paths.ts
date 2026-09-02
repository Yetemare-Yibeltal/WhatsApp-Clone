// backend/src/common/constants/api-paths.ts
/**
 * 📄 API Paths Constants
 *
 * This file defines all API route paths, versions, and utilities
 * used throughout the Real WhatsApp Clone application.
 *
 * @category Constants
 * @module ApiPaths
 */

// -------- API VERSION --------

/**
 * API version constants.
 */
export const API_VERSION = {
  V1: "v1",
  V2: "v2",
  LATEST: "v1",
  PREFIX: "/api",
} as const;

/**
 * Build the base API path with version.
 */
export function getApiBasePath(version: string = API_VERSION.LATEST): string {
  return `${API_VERSION.PREFIX}/${version}`;
}

/**
 * Build a full API path with version and endpoint.
 */
export function buildApiPath(
  endpoint: string,
  version: string = API_VERSION.LATEST,
): string {
  const base = getApiBasePath(version);
  return `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

// -------- AUTHENTICATION PATHS --------

/**
 * Authentication module routes.
 */
export const AUTH_PATHS = {
  BASE: "/auth",

  // Public routes
  REGISTER: "/register",
  LOGIN: "/login",
  LOGOUT: "/logout",
  REFRESH: "/refresh",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // 2FA
  TWO_FACTOR_SETUP: "/2fa/setup",
  TWO_FACTOR_VERIFY: "/2fa/verify",
  TWO_FACTOR_DISABLE: "/2fa/disable",

  // Profile
  ME: "/me",
  UPDATE_PROFILE: "/me",

  // Session management
  SESSIONS: "/sessions",
  SESSION_DETAIL: "/sessions/:sessionId",
  SESSION_REVOKE: "/sessions/:sessionId/revoke",
  SESSIONS_REVOKE_ALL: "/sessions/revoke-all",

  // Helpers
  buildRegister: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.REGISTER}`,
  buildLogin: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.LOGIN}`,
  buildLogout: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.LOGOUT}`,
  buildRefresh: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.REFRESH}`,
  buildVerifyEmail: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.VERIFY_EMAIL}`,
  buildForgotPassword: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.FORGOT_PASSWORD}`,
  buildResetPassword: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.RESET_PASSWORD}`,
  buildTwoFactorSetup: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.TWO_FACTOR_SETUP}`,
  buildTwoFactorVerify: () =>
    `${AUTH_PATHS.BASE}${AUTH_PATHS.TWO_FACTOR_VERIFY}`,
  buildTwoFactorDisable: () =>
    `${AUTH_PATHS.BASE}${AUTH_PATHS.TWO_FACTOR_DISABLE}`,
  buildMe: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.ME}`,
  buildUpdateProfile: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.UPDATE_PROFILE}`,
  buildSessions: () => `${AUTH_PATHS.BASE}${AUTH_PATHS.SESSIONS}`,
  buildSessionDetail: (sessionId: string) =>
    `${AUTH_PATHS.BASE}${AUTH_PATHS.SESSION_DETAIL.replace(":sessionId", sessionId)}`,
  buildSessionRevoke: (sessionId: string) =>
    `${AUTH_PATHS.BASE}${AUTH_PATHS.SESSION_REVOKE.replace(":sessionId", sessionId)}`,
  buildSessionsRevokeAll: () =>
    `${AUTH_PATHS.BASE}${AUTH_PATHS.SESSIONS_REVOKE_ALL}`,
} as const;

// -------- USER PATHS --------

/**
 * User module routes.
 */
export const USER_PATHS = {
  BASE: "/users",

  // CRUD
  LIST: "/",
  CREATE: "/",
  DETAIL: "/:userId",
  UPDATE: "/:userId",
  DELETE: "/:userId",

  // Profile
  PROFILE: "/:userId/profile",
  UPDATE_PROFILE: "/:userId/profile",
  AVATAR: "/:userId/avatar",
  UPDATE_AVATAR: "/:userId/avatar",
  REMOVE_AVATAR: "/:userId/avatar/remove",

  // Status
  STATUS: "/:userId/status",
  UPDATE_STATUS: "/:userId/status",

  // Presence
  PRESENCE: "/:userId/presence",
  PRESENCE_ONLINE: "/:userId/presence/online",

  // Search
  SEARCH: "/search",

  // Contacts
  CONTACTS: "/:userId/contacts",
  CONTACTS_ADD: "/:userId/contacts",
  CONTACTS_REMOVE: "/:userId/contacts/:contactId",
  CONTACTS_BLOCK: "/:userId/contacts/:contactId/block",
  CONTACTS_UNBLOCK: "/:userId/contacts/:contactId/unblock",

  // Bulk
  BULK_CREATE: "/bulk",
  BULK_UPDATE: "/bulk",
  BULK_DELETE: "/bulk",

  // Admin
  ADMIN_LIST: "/admin/list",
  ADMIN_SUSPEND: "/admin/:userId/suspend",
  ADMIN_UNSUSPEND: "/admin/:userId/unsuspend",
  ADMIN_DELETE: "/admin/:userId/delete",

  // Helpers
  buildList: () => `${USER_PATHS.BASE}${USER_PATHS.LIST}`,
  buildCreate: () => `${USER_PATHS.BASE}${USER_PATHS.CREATE}`,
  buildDetail: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.DETAIL.replace(":userId", userId)}`,
  buildUpdate: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.UPDATE.replace(":userId", userId)}`,
  buildDelete: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.DELETE.replace(":userId", userId)}`,
  buildProfile: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.PROFILE.replace(":userId", userId)}`,
  buildUpdateProfile: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.UPDATE_PROFILE.replace(":userId", userId)}`,
  buildAvatar: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.AVATAR.replace(":userId", userId)}`,
  buildUpdateAvatar: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.UPDATE_AVATAR.replace(":userId", userId)}`,
  buildRemoveAvatar: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.REMOVE_AVATAR.replace(":userId", userId)}`,
  buildStatus: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.STATUS.replace(":userId", userId)}`,
  buildUpdateStatus: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.UPDATE_STATUS.replace(":userId", userId)}`,
  buildPresence: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.PRESENCE.replace(":userId", userId)}`,
  buildPresenceOnline: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.PRESENCE_ONLINE.replace(":userId", userId)}`,
  buildSearch: () => `${USER_PATHS.BASE}${USER_PATHS.SEARCH}`,
  buildContacts: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.CONTACTS.replace(":userId", userId)}`,
  buildContactsAdd: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.CONTACTS_ADD.replace(":userId", userId)}`,
  buildContactsRemove: (userId: string, contactId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.CONTACTS_REMOVE.replace(":userId", userId).replace(":contactId", contactId)}`,
  buildContactsBlock: (userId: string, contactId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.CONTACTS_BLOCK.replace(":userId", userId).replace(":contactId", contactId)}`,
  buildContactsUnblock: (userId: string, contactId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.CONTACTS_UNBLOCK.replace(":userId", userId).replace(":contactId", contactId)}`,
  buildBulkCreate: () => `${USER_PATHS.BASE}${USER_PATHS.BULK_CREATE}`,
  buildBulkUpdate: () => `${USER_PATHS.BASE}${USER_PATHS.BULK_UPDATE}`,
  buildBulkDelete: () => `${USER_PATHS.BASE}${USER_PATHS.BULK_DELETE}`,
  buildAdminList: () => `${USER_PATHS.BASE}${USER_PATHS.ADMIN_LIST}`,
  buildAdminSuspend: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.ADMIN_SUSPEND.replace(":userId", userId)}`,
  buildAdminUnsuspend: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.ADMIN_UNSUSPEND.replace(":userId", userId)}`,
  buildAdminDelete: (userId: string) =>
    `${USER_PATHS.BASE}${USER_PATHS.ADMIN_DELETE.replace(":userId", userId)}`,
} as const;

// -------- MESSAGE PATHS --------

/**
 * Message module routes.
 */
export const MESSAGE_PATHS = {
  BASE: "/messages",

  // CRUD
  LIST: "/",
  CREATE: "/",
  DETAIL: "/:messageId",
  UPDATE: "/:messageId",
  DELETE: "/:messageId",

  // Chat specific
  CHAT_MESSAGES: "/chat/:chatId",
  CHAT_SEND: "/chat/:chatId/send",
  CHAT_MESSAGE: "/chat/:chatId/messages/:messageId",

  // Status
  STATUS: "/:messageId/status",
  STATUS_UPDATE: "/:messageId/status",

  // Reactions
  REACTIONS: "/:messageId/reactions",
  REACTION_ADD: "/:messageId/reactions",
  REACTION_REMOVE: "/:messageId/reactions/:reactionType",

  // Pin
  PIN: "/:messageId/pin",
  UNPIN: "/:messageId/unpin",

  // Forward
  FORWARD: "/:messageId/forward",

  // Reply
  REPLY: "/:messageId/reply",

  // Search
  SEARCH: "/search",
  SEARCH_CHAT: "/search/chat/:chatId",

  // Bulk
  BULK_DELETE: "/bulk/delete",
  BULK_STATUS: "/bulk/status",

  // Attachments
  ATTACHMENT: "/:messageId/attachments",
  ATTACHMENT_DOWNLOAD: "/attachments/:attachmentId/download",
  ATTACHMENT_DELETE: "/attachments/:attachmentId/delete",

  // Helpers
  buildList: () => `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.LIST}`,
  buildCreate: () => `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.CREATE}`,
  buildDetail: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.DETAIL.replace(":messageId", messageId)}`,
  buildUpdate: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.UPDATE.replace(":messageId", messageId)}`,
  buildDelete: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.DELETE.replace(":messageId", messageId)}`,
  buildChatMessages: (chatId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.CHAT_MESSAGES.replace(":chatId", chatId)}`,
  buildChatSend: (chatId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.CHAT_SEND.replace(":chatId", chatId)}`,
  buildChatMessage: (chatId: string, messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.CHAT_MESSAGE.replace(":chatId", chatId).replace(":messageId", messageId)}`,
  buildStatus: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.STATUS.replace(":messageId", messageId)}`,
  buildStatusUpdate: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.STATUS_UPDATE.replace(":messageId", messageId)}`,
  buildReactions: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.REACTIONS.replace(":messageId", messageId)}`,
  buildReactionAdd: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.REACTION_ADD.replace(":messageId", messageId)}`,
  buildReactionRemove: (messageId: string, reactionType: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.REACTION_REMOVE.replace(":messageId", messageId).replace(":reactionType", reactionType)}`,
  buildPin: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.PIN.replace(":messageId", messageId)}`,
  buildUnpin: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.UNPIN.replace(":messageId", messageId)}`,
  buildForward: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.FORWARD.replace(":messageId", messageId)}`,
  buildReply: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.REPLY.replace(":messageId", messageId)}`,
  buildSearch: () => `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.SEARCH}`,
  buildSearchChat: (chatId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.SEARCH_CHAT.replace(":chatId", chatId)}`,
  buildBulkDelete: () => `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.BULK_DELETE}`,
  buildBulkStatus: () => `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.BULK_STATUS}`,
  buildAttachment: (messageId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.ATTACHMENT.replace(":messageId", messageId)}`,
  buildAttachmentDownload: (attachmentId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.ATTACHMENT_DOWNLOAD.replace(":attachmentId", attachmentId)}`,
  buildAttachmentDelete: (attachmentId: string) =>
    `${MESSAGE_PATHS.BASE}${MESSAGE_PATHS.ATTACHMENT_DELETE.replace(":attachmentId", attachmentId)}`,
} as const;

// -------- GROUP PATHS --------

/**
 * Group module routes.
 */
export const GROUP_PATHS = {
  BASE: "/groups",

  // CRUD
  LIST: "/",
  CREATE: "/",
  DETAIL: "/:groupId",
  UPDATE: "/:groupId",
  DELETE: "/:groupId",

  // Members
  MEMBERS: "/:groupId/members",
  MEMBER_ADD: "/:groupId/members",
  MEMBER_REMOVE: "/:groupId/members/:userId",
  MEMBER_PROMOTE: "/:groupId/members/:userId/promote",
  MEMBER_DEMOTE: "/:groupId/members/:userId/demote",

  // Invites
  INVITE: "/:groupId/invite",
  INVITE_GENERATE: "/:groupId/invite/generate",
  INVITE_ACCEPT: "/:groupId/invite/accept",
  INVITE_REJECT: "/:groupId/invite/reject",

  // Join/Leave
  JOIN: "/:groupId/join",
  LEAVE: "/:groupId/leave",

  // Avatar
  AVATAR: "/:groupId/avatar",
  UPDATE_AVATAR: "/:groupId/avatar",
  REMOVE_AVATAR: "/:groupId/avatar/remove",

  // Settings
  SETTINGS: "/:groupId/settings",
  UPDATE_SETTINGS: "/:groupId/settings",

  // Search
  SEARCH: "/search",

  // Admin
  ADMIN_DELETE: "/admin/:groupId/delete",

  // Helpers
  buildList: () => `${GROUP_PATHS.BASE}${GROUP_PATHS.LIST}`,
  buildCreate: () => `${GROUP_PATHS.BASE}${GROUP_PATHS.CREATE}`,
  buildDetail: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.DETAIL.replace(":groupId", groupId)}`,
  buildUpdate: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.UPDATE.replace(":groupId", groupId)}`,
  buildDelete: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.DELETE.replace(":groupId", groupId)}`,
  buildMembers: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.MEMBERS.replace(":groupId", groupId)}`,
  buildMemberAdd: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.MEMBER_ADD.replace(":groupId", groupId)}`,
  buildMemberRemove: (groupId: string, userId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.MEMBER_REMOVE.replace(":groupId", groupId).replace(":userId", userId)}`,
  buildMemberPromote: (groupId: string, userId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.MEMBER_PROMOTE.replace(":groupId", groupId).replace(":userId", userId)}`,
  buildMemberDemote: (groupId: string, userId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.MEMBER_DEMOTE.replace(":groupId", groupId).replace(":userId", userId)}`,
  buildInvite: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.INVITE.replace(":groupId", groupId)}`,
  buildInviteGenerate: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.INVITE_GENERATE.replace(":groupId", groupId)}`,
  buildInviteAccept: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.INVITE_ACCEPT.replace(":groupId", groupId)}`,
  buildInviteReject: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.INVITE_REJECT.replace(":groupId", groupId)}`,
  buildJoin: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.JOIN.replace(":groupId", groupId)}`,
  buildLeave: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.LEAVE.replace(":groupId", groupId)}`,
  buildAvatar: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.AVATAR.replace(":groupId", groupId)}`,
  buildUpdateAvatar: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.UPDATE_AVATAR.replace(":groupId", groupId)}`,
  buildRemoveAvatar: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.REMOVE_AVATAR.replace(":groupId", groupId)}`,
  buildSettings: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.SETTINGS.replace(":groupId", groupId)}`,
  buildUpdateSettings: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.UPDATE_SETTINGS.replace(":groupId", groupId)}`,
  buildSearch: () => `${GROUP_PATHS.BASE}${GROUP_PATHS.SEARCH}`,
  buildAdminDelete: (groupId: string) =>
    `${GROUP_PATHS.BASE}${GROUP_PATHS.ADMIN_DELETE.replace(":groupId", groupId)}`,
} as const;

// -------- CALL PATHS --------

/**
 * Call module routes.
 */
export const CALL_PATHS = {
  BASE: "/calls",

  // CRUD
  LIST: "/",
  CREATE: "/",
  DETAIL: "/:callId",
  END: "/:callId/end",

  // WebRTC signaling
  OFFER: "/:callId/offer",
  ANSWER: "/:callId/answer",
  CANDIDATE: "/:callId/candidate",

  // Actions
  RINGING: "/:callId/ringing",
  REJECT: "/:callId/reject",
  BUSY: "/:callId/busy",

  // Mute/Video
  MUTE: "/:callId/mute",
  UNMUTE: "/:callId/unmute",
  VIDEO_TOGGLE: "/:callId/video",
  SCREEN_SHARE: "/:callId/screen",
  SCREEN_STOP: "/:callId/screen/stop",

  // Recording
  RECORD_START: "/:callId/record/start",
  RECORD_STOP: "/:callId/record/stop",

  // History
  HISTORY: "/history",
  HISTORY_DETAIL: "/history/:callId",

  // Helpers
  buildList: () => `${CALL_PATHS.BASE}${CALL_PATHS.LIST}`,
  buildCreate: () => `${CALL_PATHS.BASE}${CALL_PATHS.CREATE}`,
  buildDetail: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.DETAIL.replace(":callId", callId)}`,
  buildEnd: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.END.replace(":callId", callId)}`,
  buildOffer: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.OFFER.replace(":callId", callId)}`,
  buildAnswer: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.ANSWER.replace(":callId", callId)}`,
  buildCandidate: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.CANDIDATE.replace(":callId", callId)}`,
  buildRinging: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.RINGING.replace(":callId", callId)}`,
  buildReject: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.REJECT.replace(":callId", callId)}`,
  buildBusy: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.BUSY.replace(":callId", callId)}`,
  buildMute: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.MUTE.replace(":callId", callId)}`,
  buildUnmute: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.UNMUTE.replace(":callId", callId)}`,
  buildVideoToggle: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.VIDEO_TOGGLE.replace(":callId", callId)}`,
  buildScreenShare: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.SCREEN_SHARE.replace(":callId", callId)}`,
  buildScreenStop: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.SCREEN_STOP.replace(":callId", callId)}`,
  buildRecordStart: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.RECORD_START.replace(":callId", callId)}`,
  buildRecordStop: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.RECORD_STOP.replace(":callId", callId)}`,
  buildHistory: () => `${CALL_PATHS.BASE}${CALL_PATHS.HISTORY}`,
  buildHistoryDetail: (callId: string) =>
    `${CALL_PATHS.BASE}${CALL_PATHS.HISTORY_DETAIL.replace(":callId", callId)}`,
} as const;

// -------- FILE PATHS --------

/**
 * File module routes.
 */
export const FILE_PATHS = {
  BASE: "/files",

  // Upload/Download
  UPLOAD: "/upload",
  UPLOAD_CHUNK: "/upload/chunk",
  DOWNLOAD: "/:fileId/download",
  STREAM: "/:fileId/stream",

  // Metadata
  DETAIL: "/:fileId",
  UPDATE: "/:fileId",
  DELETE: "/:fileId",

  // Thumbnails
  THUMBNAIL: "/:fileId/thumbnail",

  // Bulk
  BULK_UPLOAD: "/bulk/upload",
  BULK_DELETE: "/bulk/delete",

  // Helpers
  buildUpload: () => `${FILE_PATHS.BASE}${FILE_PATHS.UPLOAD}`,
  buildUploadChunk: () => `${FILE_PATHS.BASE}${FILE_PATHS.UPLOAD_CHUNK}`,
  buildDownload: (fileId: string) =>
    `${FILE_PATHS.BASE}${FILE_PATHS.DOWNLOAD.replace(":fileId", fileId)}`,
  buildStream: (fileId: string) =>
    `${FILE_PATHS.BASE}${FILE_PATHS.STREAM.replace(":fileId", fileId)}`,
  buildDetail: (fileId: string) =>
    `${FILE_PATHS.BASE}${FILE_PATHS.DETAIL.replace(":fileId", fileId)}`,
  buildUpdate: (fileId: string) =>
    `${FILE_PATHS.BASE}${FILE_PATHS.UPDATE.replace(":fileId", fileId)}`,
  buildDelete: (fileId: string) =>
    `${FILE_PATHS.BASE}${FILE_PATHS.DELETE.replace(":fileId", fileId)}`,
  buildThumbnail: (fileId: string) =>
    `${FILE_PATHS.BASE}${FILE_PATHS.THUMBNAIL.replace(":fileId", fileId)}`,
  buildBulkUpload: () => `${FILE_PATHS.BASE}${FILE_PATHS.BULK_UPLOAD}`,
  buildBulkDelete: () => `${FILE_PATHS.BASE}${FILE_PATHS.BULK_DELETE}`,
} as const;

// -------- ADMIN PATHS --------

/**
 * Admin module routes.
 */
export const ADMIN_PATHS = {
  BASE: "/admin",

  // Dashboard
  DASHBOARD: "/dashboard",
  METRICS: "/metrics",

  // User management
  USERS: "/users",
  USER_DETAIL: "/users/:userId",
  USER_SUSPEND: "/users/:userId/suspend",
  USER_UNSUSPEND: "/users/:userId/unsuspend",
  USER_DELETE: "/users/:userId/delete",

  // Group management
  GROUPS: "/groups",
  GROUP_DETAIL: "/groups/:groupId",
  GROUP_DELETE: "/groups/:groupId/delete",

  // Reports
  REPORTS: "/reports",
  REPORT_GENERATE: "/reports/generate",
  REPORT_DOWNLOAD: "/reports/:reportId/download",

  // Audit logs
  AUDIT: "/audit",
  AUDIT_EXPORT: "/audit/export",

  // System config
  CONFIG: "/config",
  CONFIG_UPDATE: "/config",
  CONFIG_RELOAD: "/config/reload",

  // Health
  HEALTH: "/health",
  HEALTH_CHECK: "/health/check",

  // Announcements
  ANNOUNCEMENTS: "/announcements",
  ANNOUNCEMENT_CREATE: "/announcements",
  ANNOUNCEMENT_DELETE: "/announcements/:id",

  // Helpers
  buildDashboard: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.DASHBOARD}`,
  buildMetrics: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.METRICS}`,
  buildUsers: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.USERS}`,
  buildUserDetail: (userId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.USER_DETAIL.replace(":userId", userId)}`,
  buildUserSuspend: (userId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.USER_SUSPEND.replace(":userId", userId)}`,
  buildUserUnsuspend: (userId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.USER_UNSUSPEND.replace(":userId", userId)}`,
  buildUserDelete: (userId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.USER_DELETE.replace(":userId", userId)}`,
  buildGroups: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.GROUPS}`,
  buildGroupDetail: (groupId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.GROUP_DETAIL.replace(":groupId", groupId)}`,
  buildGroupDelete: (groupId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.GROUP_DELETE.replace(":groupId", groupId)}`,
  buildReports: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.REPORTS}`,
  buildReportGenerate: () =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.REPORT_GENERATE}`,
  buildReportDownload: (reportId: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.REPORT_DOWNLOAD.replace(":reportId", reportId)}`,
  buildAudit: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.AUDIT}`,
  buildAuditExport: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.AUDIT_EXPORT}`,
  buildConfig: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.CONFIG}`,
  buildConfigUpdate: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.CONFIG_UPDATE}`,
  buildConfigReload: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.CONFIG_RELOAD}`,
  buildHealth: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.HEALTH}`,
  buildHealthCheck: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.HEALTH_CHECK}`,
  buildAnnouncements: () => `${ADMIN_PATHS.BASE}${ADMIN_PATHS.ANNOUNCEMENTS}`,
  buildAnnouncementCreate: () =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.ANNOUNCEMENT_CREATE}`,
  buildAnnouncementDelete: (id: string) =>
    `${ADMIN_PATHS.BASE}${ADMIN_PATHS.ANNOUNCEMENT_DELETE.replace(":id", id)}`,
} as const;

// -------- NOTIFICATION PATHS --------

/**
 * Notification module routes.
 */
export const NOTIFICATION_PATHS = {
  BASE: "/notifications",

  LIST: "/",
  DETAIL: "/:notificationId",
  READ: "/:notificationId/read",
  UNREAD: "/:notificationId/unread",
  DISMISS: "/:notificationId/dismiss",
  CLEAR: "/clear",
  MARK_ALL_READ: "/mark-all-read",
  PREFERENCES: "/preferences",
  UPDATE_PREFERENCES: "/preferences",

  // Helpers
  buildList: () => `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.LIST}`,
  buildDetail: (notificationId: string) =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.DETAIL.replace(":notificationId", notificationId)}`,
  buildRead: (notificationId: string) =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.READ.replace(":notificationId", notificationId)}`,
  buildUnread: (notificationId: string) =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.UNREAD.replace(":notificationId", notificationId)}`,
  buildDismiss: (notificationId: string) =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.DISMISS.replace(":notificationId", notificationId)}`,
  buildClear: () => `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.CLEAR}`,
  buildMarkAllRead: () =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.MARK_ALL_READ}`,
  buildPreferences: () =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.PREFERENCES}`,
  buildUpdatePreferences: () =>
    `${NOTIFICATION_PATHS.BASE}${NOTIFICATION_PATHS.UPDATE_PREFERENCES}`,
} as const;

// -------- SEARCH PATHS --------

/**
 * Search module routes.
 */
export const SEARCH_PATHS = {
  BASE: "/search",

  GLOBAL: "/global",
  MESSAGES: "/messages",
  USERS: "/users",
  GROUPS: "/groups",
  FILES: "/files",

  // Advanced
  ADVANCED: "/advanced",
  FILTERED: "/filtered",

  // Suggestions
  SUGGESTIONS: "/suggestions",
  AUTOCOMPLETE: "/autocomplete",

  // Helpers
  buildGlobal: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.GLOBAL}`,
  buildMessages: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.MESSAGES}`,
  buildUsers: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.USERS}`,
  buildGroups: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.GROUPS}`,
  buildFiles: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.FILES}`,
  buildAdvanced: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.ADVANCED}`,
  buildFiltered: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.FILTERED}`,
  buildSuggestions: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.SUGGESTIONS}`,
  buildAutocomplete: () => `${SEARCH_PATHS.BASE}${SEARCH_PATHS.AUTOCOMPLETE}`,
} as const;

// -------- HEALTH PATHS --------

/**
 * Health check routes.
 */
export const HEALTH_PATHS = {
  BASE: "/health",

  CHECK: "/",
  READY: "/ready",
  LIVE: "/live",
  METRICS: "/metrics",
  DETAILED: "/detailed",
  DEPENDENCIES: "/dependencies",

  // Helpers
  buildCheck: () => `${HEALTH_PATHS.BASE}${HEALTH_PATHS.CHECK}`,
  buildReady: () => `${HEALTH_PATHS.BASE}${HEALTH_PATHS.READY}`,
  buildLive: () => `${HEALTH_PATHS.BASE}${HEALTH_PATHS.LIVE}`,
  buildMetrics: () => `${HEALTH_PATHS.BASE}${HEALTH_PATHS.METRICS}`,
  buildDetailed: () => `${HEALTH_PATHS.BASE}${HEALTH_PATHS.DETAILED}`,
  buildDependencies: () => `${HEALTH_PATHS.BASE}${HEALTH_PATHS.DEPENDENCIES}`,
} as const;

// -------- UTILITY FUNCTIONS --------

/**
 * Route parameter extraction.
 */
export function extractRouteParams(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      const key = patternParts[i].slice(1);
      params[key] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

/**
 * Check if a path matches a pattern.
 */
export function pathMatchesPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) continue;
    if (patternParts[i] !== pathParts[i]) return false;
  }

  return true;
}

/**
 * Get all route patterns from a paths object.
 */
export function getAllRoutePatterns(paths: Record<string, any>): string[] {
  const patterns: string[] = [];

  for (const value of Object.values(paths)) {
    if (typeof value === "string" && value.startsWith("/")) {
      patterns.push(value);
    } else if (typeof value === "object" && value !== null) {
      patterns.push(...getAllRoutePatterns(value));
    }
  }

  return patterns;
}

/**
 * Get all route patterns from all modules.
 */
export function getAllModuleRoutePatterns(): string[] {
  const allPaths = [
    AUTH_PATHS,
    USER_PATHS,
    MESSAGE_PATHS,
    GROUP_PATHS,
    CALL_PATHS,
    FILE_PATHS,
    ADMIN_PATHS,
    NOTIFICATION_PATHS,
    SEARCH_PATHS,
    HEALTH_PATHS,
  ];

  const patterns: string[] = [];
  for (const paths of allPaths) {
    patterns.push(...getAllRoutePatterns(paths));
  }

  return patterns;
}

/**
 * Build a full URL with API prefix and version.
 */
export function buildFullUrl(
  path: string,
  version: string = API_VERSION.LATEST,
): string {
  return buildApiPath(path, version);
}

// -------- ROUTE DEFINITIONS FOR SWAGGER/OPENAPI --------

/**
 * Route definitions for OpenAPI documentation.
 */
export const ROUTE_DEFINITIONS = {
  AUTH: {
    register: { path: AUTH_PATHS.buildRegister(), method: "POST" },
    login: { path: AUTH_PATHS.buildLogin(), method: "POST" },
    logout: { path: AUTH_PATHS.buildLogout(), method: "POST" },
    refresh: { path: AUTH_PATHS.buildRefresh(), method: "POST" },
    verifyEmail: { path: AUTH_PATHS.buildVerifyEmail(), method: "GET" },
    forgotPassword: { path: AUTH_PATHS.buildForgotPassword(), method: "POST" },
    resetPassword: { path: AUTH_PATHS.buildResetPassword(), method: "POST" },
    me: { path: AUTH_PATHS.buildMe(), method: "GET" },
    updateProfile: { path: AUTH_PATHS.buildUpdateProfile(), method: "PATCH" },
    sessions: { path: AUTH_PATHS.buildSessions(), method: "GET" },
    revokeSession: {
      path: AUTH_PATHS.buildSessionRevoke(":sessionId"),
      method: "DELETE",
    },
  },
  USERS: {
    list: { path: USER_PATHS.buildList(), method: "GET" },
    create: { path: USER_PATHS.buildCreate(), method: "POST" },
    detail: { path: USER_PATHS.buildDetail(":userId"), method: "GET" },
    update: { path: USER_PATHS.buildUpdate(":userId"), method: "PATCH" },
    delete: { path: USER_PATHS.buildDelete(":userId"), method: "DELETE" },
    profile: { path: USER_PATHS.buildProfile(":userId"), method: "GET" },
    updateProfile: {
      path: USER_PATHS.buildUpdateProfile(":userId"),
      method: "PATCH",
    },
    avatar: { path: USER_PATHS.buildAvatar(":userId"), method: "GET" },
    updateAvatar: {
      path: USER_PATHS.buildUpdateAvatar(":userId"),
      method: "POST",
    },
    removeAvatar: {
      path: USER_PATHS.buildRemoveAvatar(":userId"),
      method: "DELETE",
    },
    status: { path: USER_PATHS.buildStatus(":userId"), method: "GET" },
    updateStatus: {
      path: USER_PATHS.buildUpdateStatus(":userId"),
      method: "PATCH",
    },
    presence: { path: USER_PATHS.buildPresence(":userId"), method: "GET" },
    search: { path: USER_PATHS.buildSearch(), method: "GET" },
    contacts: { path: USER_PATHS.buildContacts(":userId"), method: "GET" },
    addContact: {
      path: USER_PATHS.buildContactsAdd(":userId"),
      method: "POST",
    },
    removeContact: {
      path: USER_PATHS.buildContactsRemove(":userId", ":contactId"),
      method: "DELETE",
    },
    blockContact: {
      path: USER_PATHS.buildContactsBlock(":userId", ":contactId"),
      method: "POST",
    },
    unblockContact: {
      path: USER_PATHS.buildContactsUnblock(":userId", ":contactId"),
      method: "POST",
    },
  },
  MESSAGES: {
    list: { path: MESSAGE_PATHS.buildList(), method: "GET" },
    create: { path: MESSAGE_PATHS.buildCreate(), method: "POST" },
    detail: { path: MESSAGE_PATHS.buildDetail(":messageId"), method: "GET" },
    update: { path: MESSAGE_PATHS.buildUpdate(":messageId"), method: "PATCH" },
    delete: { path: MESSAGE_PATHS.buildDelete(":messageId"), method: "DELETE" },
    chatMessages: {
      path: MESSAGE_PATHS.buildChatMessages(":chatId"),
      method: "GET",
    },
    chatSend: { path: MESSAGE_PATHS.buildChatSend(":chatId"), method: "POST" },
    status: { path: MESSAGE_PATHS.buildStatus(":messageId"), method: "GET" },
    updateStatus: {
      path: MESSAGE_PATHS.buildStatusUpdate(":messageId"),
      method: "PATCH",
    },
    reactions: {
      path: MESSAGE_PATHS.buildReactions(":messageId"),
      method: "GET",
    },
    addReaction: {
      path: MESSAGE_PATHS.buildReactionAdd(":messageId"),
      method: "POST",
    },
    removeReaction: {
      path: MESSAGE_PATHS.buildReactionRemove(":messageId", ":reactionType"),
      method: "DELETE",
    },
    pin: { path: MESSAGE_PATHS.buildPin(":messageId"), method: "POST" },
    unpin: { path: MESSAGE_PATHS.buildUnpin(":messageId"), method: "DELETE" },
    forward: { path: MESSAGE_PATHS.buildForward(":messageId"), method: "POST" },
    reply: { path: MESSAGE_PATHS.buildReply(":messageId"), method: "POST" },
    search: { path: MESSAGE_PATHS.buildSearch(), method: "GET" },
    searchChat: {
      path: MESSAGE_PATHS.buildSearchChat(":chatId"),
      method: "GET",
    },
    attachment: {
      path: MESSAGE_PATHS.buildAttachment(":messageId"),
      method: "GET",
    },
    downloadAttachment: {
      path: MESSAGE_PATHS.buildAttachmentDownload(":attachmentId"),
      method: "GET",
    },
    deleteAttachment: {
      path: MESSAGE_PATHS.buildAttachmentDelete(":attachmentId"),
      method: "DELETE",
    },
  },
  GROUPS: {
    list: { path: GROUP_PATHS.buildList(), method: "GET" },
    create: { path: GROUP_PATHS.buildCreate(), method: "POST" },
    detail: { path: GROUP_PATHS.buildDetail(":groupId"), method: "GET" },
    update: { path: GROUP_PATHS.buildUpdate(":groupId"), method: "PATCH" },
    delete: { path: GROUP_PATHS.buildDelete(":groupId"), method: "DELETE" },
    members: { path: GROUP_PATHS.buildMembers(":groupId"), method: "GET" },
    addMember: { path: GROUP_PATHS.buildMemberAdd(":groupId"), method: "POST" },
    removeMember: {
      path: GROUP_PATHS.buildMemberRemove(":groupId", ":userId"),
      method: "DELETE",
    },
    promoteMember: {
      path: GROUP_PATHS.buildMemberPromote(":groupId", ":userId"),
      method: "POST",
    },
    demoteMember: {
      path: GROUP_PATHS.buildMemberDemote(":groupId", ":userId"),
      method: "POST",
    },
    invite: { path: GROUP_PATHS.buildInvite(":groupId"), method: "POST" },
    generateInvite: {
      path: GROUP_PATHS.buildInviteGenerate(":groupId"),
      method: "POST",
    },
    acceptInvite: {
      path: GROUP_PATHS.buildInviteAccept(":groupId"),
      method: "POST",
    },
    rejectInvite: {
      path: GROUP_PATHS.buildInviteReject(":groupId"),
      method: "POST",
    },
    join: { path: GROUP_PATHS.buildJoin(":groupId"), method: "POST" },
    leave: { path: GROUP_PATHS.buildLeave(":groupId"), method: "POST" },
    avatar: { path: GROUP_PATHS.buildAvatar(":groupId"), method: "GET" },
    updateAvatar: {
      path: GROUP_PATHS.buildUpdateAvatar(":groupId"),
      method: "POST",
    },
    removeAvatar: {
      path: GROUP_PATHS.buildRemoveAvatar(":groupId"),
      method: "DELETE",
    },
    settings: { path: GROUP_PATHS.buildSettings(":groupId"), method: "GET" },
    updateSettings: {
      path: GROUP_PATHS.buildUpdateSettings(":groupId"),
      method: "PATCH",
    },
    search: { path: GROUP_PATHS.buildSearch(), method: "GET" },
  },
  CALLS: {
    list: { path: CALL_PATHS.buildList(), method: "GET" },
    create: { path: CALL_PATHS.buildCreate(), method: "POST" },
    detail: { path: CALL_PATHS.buildDetail(":callId"), method: "GET" },
    end: { path: CALL_PATHS.buildEnd(":callId"), method: "POST" },
    offer: { path: CALL_PATHS.buildOffer(":callId"), method: "POST" },
    answer: { path: CALL_PATHS.buildAnswer(":callId"), method: "POST" },
    candidate: { path: CALL_PATHS.buildCandidate(":callId"), method: "POST" },
    ringing: { path: CALL_PATHS.buildRinging(":callId"), method: "POST" },
    reject: { path: CALL_PATHS.buildReject(":callId"), method: "POST" },
    busy: { path: CALL_PATHS.buildBusy(":callId"), method: "POST" },
    mute: { path: CALL_PATHS.buildMute(":callId"), method: "POST" },
    unmute: { path: CALL_PATHS.buildUnmute(":callId"), method: "POST" },
    videoToggle: {
      path: CALL_PATHS.buildVideoToggle(":callId"),
      method: "POST",
    },
    screenShare: {
      path: CALL_PATHS.buildScreenShare(":callId"),
      method: "POST",
    },
    screenStop: { path: CALL_PATHS.buildScreenStop(":callId"), method: "POST" },
    recordStart: {
      path: CALL_PATHS.buildRecordStart(":callId"),
      method: "POST",
    },
    recordStop: { path: CALL_PATHS.buildRecordStop(":callId"), method: "POST" },
    history: { path: CALL_PATHS.buildHistory(), method: "GET" },
    historyDetail: {
      path: CALL_PATHS.buildHistoryDetail(":callId"),
      method: "GET",
    },
  },
  FILES: {
    upload: { path: FILE_PATHS.buildUpload(), method: "POST" },
    uploadChunk: { path: FILE_PATHS.buildUploadChunk(), method: "POST" },
    download: { path: FILE_PATHS.buildDownload(":fileId"), method: "GET" },
    stream: { path: FILE_PATHS.buildStream(":fileId"), method: "GET" },
    detail: { path: FILE_PATHS.buildDetail(":fileId"), method: "GET" },
    update: { path: FILE_PATHS.buildUpdate(":fileId"), method: "PATCH" },
    delete: { path: FILE_PATHS.buildDelete(":fileId"), method: "DELETE" },
    thumbnail: { path: FILE_PATHS.buildThumbnail(":fileId"), method: "GET" },
    bulkUpload: { path: FILE_PATHS.buildBulkUpload(), method: "POST" },
    bulkDelete: { path: FILE_PATHS.buildBulkDelete(), method: "POST" },
  },
  ADMIN: {
    dashboard: { path: ADMIN_PATHS.buildDashboard(), method: "GET" },
    metrics: { path: ADMIN_PATHS.buildMetrics(), method: "GET" },
    users: { path: ADMIN_PATHS.buildUsers(), method: "GET" },
    userDetail: { path: ADMIN_PATHS.buildUserDetail(":userId"), method: "GET" },
    userSuspend: {
      path: ADMIN_PATHS.buildUserSuspend(":userId"),
      method: "POST",
    },
    userUnsuspend: {
      path: ADMIN_PATHS.buildUserUnsuspend(":userId"),
      method: "POST",
    },
    userDelete: {
      path: ADMIN_PATHS.buildUserDelete(":userId"),
      method: "DELETE",
    },
    groups: { path: ADMIN_PATHS.buildGroups(), method: "GET" },
    groupDetail: {
      path: ADMIN_PATHS.buildGroupDetail(":groupId"),
      method: "GET",
    },
    groupDelete: {
      path: ADMIN_PATHS.buildGroupDelete(":groupId"),
      method: "DELETE",
    },
    reports: { path: ADMIN_PATHS.buildReports(), method: "GET" },
    reportGenerate: { path: ADMIN_PATHS.buildReportGenerate(), method: "POST" },
    reportDownload: {
      path: ADMIN_PATHS.buildReportDownload(":reportId"),
      method: "GET",
    },
    audit: { path: ADMIN_PATHS.buildAudit(), method: "GET" },
    auditExport: { path: ADMIN_PATHS.buildAuditExport(), method: "GET" },
    config: { path: ADMIN_PATHS.buildConfig(), method: "GET" },
    configUpdate: { path: ADMIN_PATHS.buildConfigUpdate(), method: "PATCH" },
    configReload: { path: ADMIN_PATHS.buildConfigReload(), method: "POST" },
    health: { path: ADMIN_PATHS.buildHealth(), method: "GET" },
    healthCheck: { path: ADMIN_PATHS.buildHealthCheck(), method: "GET" },
    announcements: { path: ADMIN_PATHS.buildAnnouncements(), method: "GET" },
    announcementCreate: {
      path: ADMIN_PATHS.buildAnnouncementCreate(),
      method: "POST",
    },
    announcementDelete: {
      path: ADMIN_PATHS.buildAnnouncementDelete(":id"),
      method: "DELETE",
    },
  },
  NOTIFICATIONS: {
    list: { path: NOTIFICATION_PATHS.buildList(), method: "GET" },
    detail: {
      path: NOTIFICATION_PATHS.buildDetail(":notificationId"),
      method: "GET",
    },
    read: {
      path: NOTIFICATION_PATHS.buildRead(":notificationId"),
      method: "POST",
    },
    unread: {
      path: NOTIFICATION_PATHS.buildUnread(":notificationId"),
      method: "POST",
    },
    dismiss: {
      path: NOTIFICATION_PATHS.buildDismiss(":notificationId"),
      method: "POST",
    },
    clear: { path: NOTIFICATION_PATHS.buildClear(), method: "DELETE" },
    markAllRead: {
      path: NOTIFICATION_PATHS.buildMarkAllRead(),
      method: "POST",
    },
    preferences: { path: NOTIFICATION_PATHS.buildPreferences(), method: "GET" },
    updatePreferences: {
      path: NOTIFICATION_PATHS.buildUpdatePreferences(),
      method: "PATCH",
    },
  },
  SEARCH: {
    global: { path: SEARCH_PATHS.buildGlobal(), method: "GET" },
    messages: { path: SEARCH_PATHS.buildMessages(), method: "GET" },
    users: { path: SEARCH_PATHS.buildUsers(), method: "GET" },
    groups: { path: SEARCH_PATHS.buildGroups(), method: "GET" },
    files: { path: SEARCH_PATHS.buildFiles(), method: "GET" },
    advanced: { path: SEARCH_PATHS.buildAdvanced(), method: "GET" },
    filtered: { path: SEARCH_PATHS.buildFiltered(), method: "GET" },
    suggestions: { path: SEARCH_PATHS.buildSuggestions(), method: "GET" },
    autocomplete: { path: SEARCH_PATHS.buildAutocomplete(), method: "GET" },
  },
  HEALTH: {
    check: { path: HEALTH_PATHS.buildCheck(), method: "GET" },
    ready: { path: HEALTH_PATHS.buildReady(), method: "GET" },
    live: { path: HEALTH_PATHS.buildLive(), method: "GET" },
    metrics: { path: HEALTH_PATHS.buildMetrics(), method: "GET" },
    detailed: { path: HEALTH_PATHS.buildDetailed(), method: "GET" },
    dependencies: { path: HEALTH_PATHS.buildDependencies(), method: "GET" },
  },
} as const;

// -------- END --------
