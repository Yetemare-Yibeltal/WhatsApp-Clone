// backend/src/modules/users/entities/user.entity.ts
import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsDate,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";
import { UserRole } from "../../../common/constants/roles";
import { Exclude, Expose } from "class-transformer";
import { randomBytes, createHash } from "crypto";

// -------- ENUMS --------

export enum UserStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  AWAY = "away",
  BUSY = "busy",
  TYPING = "typing",
}

export enum UserVerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  FAILED = "failed",
  EXPIRED = "expired",
}

export enum AccountStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  BANNED = "banned",
  INACTIVE = "inactive",
  DELETED = "deleted",
}

// -------- INTERFACES --------

export interface UserProfileData {
  bio?: string;
  status?: string;
  avatarUrl?: string;
  avatarThumb?: string;
  coverPhoto?: string;
  location?: string;
  website?: string;
  birthday?: Date;
  gender?: string;
  language?: string;
  timezone?: string;
}

export interface UserSettingsData {
  notifications: {
    messages: boolean;
    groups: boolean;
    calls: boolean;
    mentions: boolean;
    reactions: boolean;
    sounds: boolean;
    vibrations: boolean;
    pushEnabled: boolean;
  };
  privacy: {
    lastSeen: "everyone" | "contacts" | "none";
    profilePhoto: "everyone" | "contacts" | "none";
    status: "everyone" | "contacts" | "none";
    readReceipts: boolean;
    typingIndicators: boolean;
    onlineStatus: boolean;
  };
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
  fontSize: "small" | "medium" | "large";
  chatBackground?: string;
}

// -------- MAIN ENTITY --------

/**
 * User Entity representing a user in the system.
 * This is the core domain entity for all user-related operations.
 */
export class UserEntity {
  // -------- PRIMARY IDENTIFIERS --------
  @IsUUID()
  @Expose()
  id: string;

  // -------- AUTHENTICATION --------
  @IsEmail({}, { message: "Invalid email format" })
  @Expose()
  email: string;

  @IsOptional()
  @IsPhoneNumber(null, { message: "Invalid phone number format" })
  @Expose()
  phone: string | null;

  @Exclude({ toPlainOnly: true })
  passwordHash: string;

  @IsOptional()
  @IsString()
  @Expose()
  twoFactorSecret: string | null;

  @IsOptional()
  @IsBoolean()
  @Expose()
  is2faEnabled: boolean;

  // -------- PROFILE --------
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Expose()
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Expose()
  bio: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  status: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  avatarUrl: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  avatarThumb: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  coverPhoto: string | null;

  // -------- ACCOUNT STATUS --------
  @IsBoolean()
  @Expose()
  isActive: boolean;

  @IsBoolean()
  @Expose()
  isVerified: boolean;

  @IsBoolean()
  @Expose()
  isAdmin: boolean;

  @IsEnum(UserRole)
  @IsArray()
  @Expose()
  roles: UserRole[];

  @IsArray()
  @IsString({ each: true })
  @Expose()
  permissions: string[];

  @IsEnum(AccountStatus)
  @Expose()
  accountStatus: AccountStatus;

  @IsEnum(UserVerificationStatus)
  @Expose()
  verificationStatus: UserVerificationStatus;

  // -------- TIMESTAMPS --------
  @IsDate()
  @Expose()
  createdAt: Date;

  @IsDate()
  @Expose()
  updatedAt: Date;

  @IsOptional()
  @IsDate()
  @Expose()
  lastSeen: Date | null;

  @IsOptional()
  @IsDate()
  @Expose()
  lastActive: Date | null;

  @IsOptional()
  @IsDate()
  @Expose()
  suspendedAt: Date | null;

  @IsOptional()
  @IsString()
  @Expose()
  suspendedReason: string | null;

  @IsOptional()
  @IsDate()
  @Expose()
  deletedAt: Date | null;

  // -------- USER METADATA --------
  @IsOptional()
  @IsObject()
  @Expose()
  metadata: Record<string, any> | null;

  @IsOptional()
  @IsString()
  @Expose()
  userAgent: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  ipAddress: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  deviceId: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  sessionId: string | null;

  // -------- SETTINGS --------
  @IsOptional()
  @IsObject()
  @Expose()
  settings: UserSettingsData | null;

  // -------- RELATIONSHIPS (not persisted in this entity, but defined for relations) --------
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileEntity)
  @Expose()
  profile?: ProfileEntity;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactEntity)
  @Expose()
  contacts?: ContactEntity[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageEntity)
  @Expose()
  messages?: MessageEntity[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupMemberEntity)
  @Expose()
  groups?: GroupMemberEntity[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionEntity)
  @Expose()
  sessions?: SessionEntity[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationEntity)
  @Expose()
  notifications?: NotificationEntity[];

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<UserEntity> = {}) {
    Object.assign(this, partial);
  }

  // -------- DOMAIN LOGIC --------

  /**
   * Check if the user is active.
   */
  isActiveUser(): boolean {
    return this.isActive && this.accountStatus === AccountStatus.ACTIVE;
  }

  /**
   * Check if the user is suspended.
   */
  isSuspended(): boolean {
    return (
      this.accountStatus === AccountStatus.SUSPENDED ||
      this.accountStatus === AccountStatus.BANNED
    );
  }

  /**
   * Check if the user is banned.
   */
  isBanned(): boolean {
    return this.accountStatus === AccountStatus.BANNED;
  }

  /**
   * Check if the user is deleted.
   */
  isDeleted(): boolean {
    return this.accountStatus === AccountStatus.DELETED || !!this.deletedAt;
  }

  /**
   * Check if the user is verified.
   */
  isEmailVerified(): boolean {
    return (
      this.isVerified &&
      this.verificationStatus === UserVerificationStatus.VERIFIED
    );
  }

  /**
   * Check if the user has 2FA enabled.
   */
  hasTwoFactorEnabled(): boolean {
    return this.is2faEnabled && !!this.twoFactorSecret;
  }

  /**
   * Check if the user has a specific role.
   */
  hasRole(role: UserRole | string): boolean {
    return this.roles.includes(role as UserRole) || this.isAdmin;
  }

  /**
   * Check if the user has all specified roles.
   */
  hasAllRoles(roles: (UserRole | string)[]): boolean {
    return roles.every((role) => this.hasRole(role));
  }

  /**
   * Check if the user has any of the specified roles.
   */
  hasAnyRole(roles: (UserRole | string)[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  /**
   * Check if the user has a specific permission.
   */
  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission) || this.isAdmin;
  }

  /**
   * Check if the user has all specified permissions.
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((perm) => this.hasPermission(perm));
  }

  /**
   * Check if the user has any of the specified permissions.
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((perm) => this.hasPermission(perm));
  }

  /**
   * Get the user's display name or fallback.
   */
  getDisplayName(fallback: string = "User"): string {
    return this.displayName || this.email?.split("@")[0] || fallback;
  }

  /**
   * Get the user's initials (for avatar).
   */
  getInitials(): string {
    const name = this.getDisplayName("");
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  /**
   * Get the user's avatar URL or fallback.
   */
  getAvatarUrl(fallback: string = ""): string {
    return this.avatarUrl || fallback;
  }

  /**
   * Get the user's avatar thumbnail URL or fallback.
   */
  getAvatarThumb(fallback: string = ""): string {
    return this.avatarThumb || this.avatarUrl || fallback;
  }

  /**
   * Get the user's status message or fallback.
   */
  getStatus(fallback: string = ""): string {
    return this.status || fallback;
  }

  /**
   * Get the user's bio or fallback.
   */
  getBio(fallback: string = ""): string {
    return this.bio || fallback;
  }

  /**
   * Check if the user is online (based on lastSeen).
   * User is considered online if lastSeen is within the last 5 minutes.
   */
  isOnline(): boolean {
    if (!this.lastSeen) return false;
    const now = new Date();
    const diff = now.getTime() - this.lastSeen.getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get the user's online status as a string.
   */
  getOnlineStatus(): UserStatus | string {
    if (!this.isActiveUser()) return "offline";
    if (this.isOnline()) return "online";
    return "offline";
  }

  /**
   * Get the user's last seen in a human-readable format.
   */
  getLastSeenFormatted(): string {
    if (!this.lastSeen) return "Never";
    const now = new Date();
    const diff = now.getTime() - this.lastSeen.getTime();

    // Less than a minute
    if (diff < 60 * 1000) return "Just now";
    // Less than an hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    }
    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    // Less than a week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
    // More than a week
    return this.lastSeen.toLocaleDateString();
  }

  /**
   * Get the user's time since creation.
   */
  getCreatedAtFormatted(): string {
    if (!this.createdAt) return "Unknown";
    const now = new Date();
    const diff = now.getTime() - this.createdAt.getTime();

    // Less than a minute
    if (diff < 60 * 1000) return "Just now";
    // Less than an hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    }
    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    // Less than a week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
    // More than a week
    return this.createdAt.toLocaleDateString();
  }

  /**
   * Generate a reset token for the user.
   */
  generateResetToken(): string {
    const hash = createHash("sha256");
    const token = randomBytes(32).toString("hex");
    hash.update(`${this.id}:${token}:${Date.now()}`);
    return hash.digest("hex");
  }

  /**
   * Generate a verification token for the user.
   */
  generateVerificationToken(): string {
    const hash = createHash("sha256");
    const token = randomBytes(32).toString("hex");
    hash.update(`${this.email}:${token}:${Date.now()}`);
    return hash.digest("hex");
  }

  /**
   * Check if a given token matches the user's reset token.
   */
  verifyResetToken(token: string, storedToken: string): boolean {
    return token === storedToken;
  }

  /**
   * Update the user's last seen timestamp.
   */
  updateLastSeen(): void {
    this.lastSeen = new Date();
  }

  /**
   * Suspend the user.
   */
  suspend(reason: string): void {
    this.accountStatus = AccountStatus.SUSPENDED;
    this.suspendedAt = new Date();
    this.suspendedReason = reason;
    this.isActive = false;
  }

  /**
   * Unsuspend the user.
   */
  unsuspend(): void {
    this.accountStatus = AccountStatus.ACTIVE;
    this.suspendedAt = null;
    this.suspendedReason = null;
    this.isActive = true;
  }

  /**
   * Ban the user.
   */
  ban(reason: string): void {
    this.accountStatus = AccountStatus.BANNED;
    this.suspendedAt = new Date();
    this.suspendedReason = reason;
    this.isActive = false;
  }

  /**
   * Unban the user.
   */
  unban(): void {
    this.accountStatus = AccountStatus.ACTIVE;
    this.suspendedAt = null;
    this.suspendedReason = null;
    this.isActive = true;
  }

  /**
   * Soft delete the user.
   */
  softDelete(): void {
    this.accountStatus = AccountStatus.DELETED;
    this.deletedAt = new Date();
    this.isActive = false;
  }

  /**
   * Restore a soft-deleted user.
   */
  restore(): void {
    this.accountStatus = AccountStatus.ACTIVE;
    this.deletedAt = null;
    this.isActive = true;
  }

  /**
   * Verify the user's email.
   */
  verifyEmail(): void {
    this.isVerified = true;
    this.verificationStatus = UserVerificationStatus.VERIFIED;
  }

  /**
   * Mark email verification as failed.
   */
  markVerificationFailed(): void {
    this.verificationStatus = UserVerificationStatus.FAILED;
  }

  /**
   * Get the user's notification settings.
   */
  getNotificationSettings(): UserSettingsData["notifications"] {
    return (
      this.settings?.notifications || {
        messages: true,
        groups: true,
        calls: true,
        mentions: true,
        reactions: true,
        sounds: true,
        vibrations: true,
        pushEnabled: true,
      }
    );
  }

  /**
   * Get the user's privacy settings.
   */
  getPrivacySettings(): UserSettingsData["privacy"] {
    return (
      this.settings?.privacy || {
        lastSeen: "everyone",
        profilePhoto: "everyone",
        status: "everyone",
        readReceipts: true,
        typingIndicators: true,
        onlineStatus: true,
      }
    );
  }

  /**
   * Check if the user allows read receipts.
   */
  allowsReadReceipts(): boolean {
    return this.getPrivacySettings().readReceipts !== false;
  }

  /**
   * Check if the user allows typing indicators.
   */
  allowsTypingIndicators(): boolean {
    return this.getPrivacySettings().typingIndicators !== false;
  }

  /**
   * Check if the user allows online status visibility.
   */
  allowsOnlineStatus(): boolean {
    return this.getPrivacySettings().onlineStatus !== false;
  }

  /**
   * Get the user's theme preference.
   */
  getTheme(): "light" | "dark" | "system" {
    return this.settings?.theme || "system";
  }

  /**
   * Get the user's language preference.
   */
  getLanguage(): string {
    return this.settings?.language || "en";
  }

  /**
   * Get the user's timezone.
   */
  getTimezone(): string {
    return this.settings?.timezone || "UTC";
  }

  /**
   * Get the user's preferred font size.
   */
  getFontSize(): "small" | "medium" | "large" {
    return this.settings?.fontSize || "medium";
  }

  // -------- SERIALIZATION --------

  /**
   * Serialize the user for API responses (sanitized).
   */
  toResponse(): Partial<UserEntity> {
    return {
      id: this.id,
      email: this.email,
      phone: this.phone,
      displayName: this.displayName,
      bio: this.bio,
      status: this.status,
      avatarUrl: this.avatarUrl,
      avatarThumb: this.avatarThumb,
      coverPhoto: this.coverPhoto,
      isActive: this.isActive,
      isVerified: this.isVerified,
      isAdmin: this.isAdmin,
      roles: this.roles,
      accountStatus: this.accountStatus,
      verificationStatus: this.verificationStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSeen: this.lastSeen,
      lastActive: this.lastActive,
      settings: this.settings,
    };
  }

  /**
   * Serialize the user for admin responses (more details).
   */
  toAdminResponse(): Partial<UserEntity> {
    return {
      ...this.toResponse(),
      suspendedAt: this.suspendedAt,
      suspendedReason: this.suspendedReason,
      deletedAt: this.deletedAt,
      metadata: this.metadata,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      is2faEnabled: this.is2faEnabled,
    };
  }

  /**
   * Serialize the user for WebSocket connections.
   */
  toSocketPayload(): {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    status?: string | null;
    isOnline: boolean;
    lastSeen?: Date | null;
  } {
    return {
      id: this.id,
      displayName: this.getDisplayName(),
      avatarUrl: this.avatarUrl,
      status: this.status,
      isOnline: this.isOnline(),
      lastSeen: this.lastSeen,
    };
  }

  /**
   * Serialize the user for contact lists.
   */
  toContactResponse(): {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    status?: string | null;
    isOnline: boolean;
    isActive: boolean;
    lastSeen?: Date | null;
  } {
    return {
      id: this.id,
      displayName: this.getDisplayName(),
      avatarUrl: this.avatarUrl,
      status: this.status,
      isOnline: this.isOnline(),
      isActive: this.isActive,
      lastSeen: this.lastSeen,
    };
  }

  /**
   * Create a safe copy of the user without sensitive data.
   */
  toSafeCopy(): UserEntity {
    const safe = new UserEntity({ ...this });
    safe.passwordHash = "";
    safe.twoFactorSecret = "";
    return safe;
  }

  // -------- STATIC HELPERS --------

  /**
   * Create a new user with default values.
   */
  static createNew(
    email: string,
    displayName: string,
    passwordHash: string,
    phone?: string,
  ): UserEntity {
    const user = new UserEntity();
    user.id = randomBytes(16).toString("hex");
    user.email = email.toLowerCase();
    user.phone = phone || null;
    user.displayName = displayName;
    user.passwordHash = passwordHash;
    user.isActive = true;
    user.isVerified = false;
    user.isAdmin = false;
    user.roles = [UserRole.USER];
    user.permissions = [];
    user.accountStatus = AccountStatus.ACTIVE;
    user.verificationStatus = UserVerificationStatus.PENDING;
    user.createdAt = new Date();
    user.updatedAt = new Date();
    user.lastSeen = new Date();
    user.lastActive = new Date();
    user.settings = {
      notifications: {
        messages: true,
        groups: true,
        calls: true,
        mentions: true,
        reactions: true,
        sounds: true,
        vibrations: true,
        pushEnabled: true,
      },
      privacy: {
        lastSeen: "everyone",
        profilePhoto: "everyone",
        status: "everyone",
        readReceipts: true,
        typingIndicators: true,
        onlineStatus: true,
      },
      theme: "system",
      language: "en",
      timezone: "UTC",
      fontSize: "medium",
    };
    user.metadata = {};
    return user;
  }

  /**
   * Validate that the user entity is valid.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.email || !this.email.includes("@")) {
      errors.push("Valid email is required");
    }

    if (!this.displayName || this.displayName.length < 2) {
      errors.push("Display name must be at least 2 characters");
    }

    if (this.displayName && this.displayName.length > 50) {
      errors.push("Display name cannot exceed 50 characters");
    }

    if (this.bio && this.bio.length > 500) {
      errors.push("Bio cannot exceed 500 characters");
    }

    if (this.phone && !/^\+?[0-9]{10,15}$/.test(this.phone)) {
      errors.push("Phone number must be in E.164 format");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a user from a Prisma user object.
   */
  static fromPrisma(prismaUser: any): UserEntity {
    return new UserEntity({
      id: prismaUser.id,
      email: prismaUser.email,
      phone: prismaUser.phone,
      displayName: prismaUser.displayName,
      passwordHash: prismaUser.passwordHash,
      twoFactorSecret: prismaUser.twoFactorSecret,
      is2faEnabled: prismaUser.is2faEnabled,
      bio: prismaUser.bio || null,
      status: prismaUser.status || null,
      avatarUrl: prismaUser.avatarUrl || null,
      avatarThumb: prismaUser.avatarThumb || null,
      coverPhoto: prismaUser.coverPhoto || null,
      isActive: prismaUser.isActive,
      isVerified: prismaUser.isVerified,
      isAdmin: prismaUser.isAdmin,
      roles: prismaUser.roles || [UserRole.USER],
      permissions: prismaUser.permissions || [],
      accountStatus: prismaUser.accountStatus || AccountStatus.ACTIVE,
      verificationStatus:
        prismaUser.verificationStatus || UserVerificationStatus.PENDING,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      lastSeen: prismaUser.lastSeen || null,
      lastActive: prismaUser.lastActive || null,
      suspendedAt: prismaUser.suspendedAt || null,
      suspendedReason: prismaUser.suspendedReason || null,
      deletedAt: prismaUser.deletedAt || null,
      metadata: prismaUser.metadata || null,
      userAgent: prismaUser.userAgent || null,
      ipAddress: prismaUser.ipAddress || null,
      deviceId: prismaUser.deviceId || null,
      sessionId: prismaUser.sessionId || null,
      settings: prismaUser.settings || null,
    });
  }

  // -------- END --------
}

// -------- RELATED ENTITY PLACEHOLDERS --------
// These are defined here for type safety but will be imported from their respective modules.

export class ProfileEntity {
  id: string;
  userId: string;
  bio?: string;
  status?: string;
  avatarUrl?: string;
  avatarThumb?: string;
  coverPhoto?: string;
  location?: string;
  website?: string;
  birthday?: Date;
  gender?: string;
  language?: string;
  timezone?: string;
  updatedAt: Date;
  user?: UserEntity;
}

export class ContactEntity {
  id: string;
  userId: string;
  contactId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserEntity;
  contact?: UserEntity;
}

export class MessageEntity {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  messageType: string;
  isDeleted: boolean;
  deletedAt?: Date;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sender?: UserEntity;
}

export class GroupMemberEntity {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user?: UserEntity;
}

export class SessionEntity {
  id: string;
  userId: string;
  refreshToken: string;
  deviceName?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: UserEntity;
}

export class NotificationEntity {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: UserEntity;
}

// -------- END --------
