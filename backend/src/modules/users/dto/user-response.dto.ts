// backend/src/modules/users/dto/user-response.dto.ts
import {
  IsUUID,
  IsEmail,
  IsPhoneNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsDate,
  IsEnum,
  IsArray,
  IsObject,
  IsNumber,
  IsInt,
  ValidateNested,
  IsUrl,
  IsNotEmpty,
  IsIn,
} from "class-validator";
import {
  Expose,
  Exclude,
  Transform,
  Type,
  plainToClass,
} from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../common/constants/roles";

// -------- ENUMS --------

export enum UserStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  AWAY = "away",
  BUSY = "busy",
  TYPING = "typing",
}

export enum AccountStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  BANNED = "banned",
  INACTIVE = "inactive",
  DELETED = "deleted",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  NON_BINARY = "non_binary",
  OTHER = "other",
  PREFER_NOT_TO_SAY = "prefer_not_to_say",
}

export enum RelationshipStatus {
  SINGLE = "single",
  IN_A_RELATIONSHIP = "in_a_relationship",
  ENGAGED = "engaged",
  MARRIED = "married",
  IN_A_OPEN_RELATIONSHIP = "in_an_open_relationship",
  COMPLICATED = "complicated",
  SEPARATED = "separated",
  DIVORCED = "divorced",
  WIDOWED = "widowed",
}

export enum ProfileCompletenessLevel {
  INCOMPLETE = "incomplete",
  PARTIAL = "partial",
  COMPLETE = "complete",
  FULL = "full",
}

// -------- NESTED RESPONSE DTOs --------

/**
 * Profile response DTO.
 */
export class UserProfileResponseDto {
  @ApiProperty({ description: "Profile ID", example: "prof_abc123" })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({ description: "User ID", example: "user_abc123" })
  @Expose()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: "User bio",
    example: "Hello! I am using Real WhatsApp Clone.",
  })
  @Expose()
  @IsOptional()
  @IsString()
  bio: string | null;

  @ApiPropertyOptional({
    description: "User status message",
    example: "Available",
  })
  @Expose()
  @IsOptional()
  @IsString()
  status: string | null;

  @ApiPropertyOptional({
    description: "Avatar URL",
    example: "https://storage.example.com/avatars/user123.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarUrl: string | null;

  @ApiPropertyOptional({
    description: "Avatar thumbnail URL",
    example: "https://storage.example.com/avatars/user123_thumb.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarThumb: string | null;

  @ApiPropertyOptional({
    description: "Cover photo URL",
    example: "https://storage.example.com/covers/user123.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  coverPhoto: string | null;

  @ApiPropertyOptional({
    description: "Cover photo thumbnail URL",
    example: "https://storage.example.com/covers/user123_thumb.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  coverPhotoThumb: string | null;

  @ApiPropertyOptional({
    description: "User location",
    example: "New York, USA",
  })
  @Expose()
  @IsOptional()
  @IsString()
  location: string | null;

  @ApiPropertyOptional({ description: "Latitude", example: 40.7128 })
  @Expose()
  @IsOptional()
  @IsNumber()
  latitude: number | null;

  @ApiPropertyOptional({ description: "Longitude", example: -74.006 })
  @Expose()
  @IsOptional()
  @IsNumber()
  longitude: number | null;

  @ApiPropertyOptional({
    description: "Website URL",
    example: "https://example.com",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  website: string | null;

  @ApiPropertyOptional({
    description: "Business email",
    example: "business@example.com",
  })
  @Expose()
  @IsOptional()
  @IsEmail()
  businessEmail: string | null;

  @ApiPropertyOptional({ description: "Birthday", example: "1990-01-01" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  birthday: Date | null;

  @ApiPropertyOptional({ description: "Gender", enum: Gender })
  @Expose()
  @IsOptional()
  @IsEnum(Gender)
  gender: Gender | null;

  @ApiPropertyOptional({
    description: "Relationship status",
    enum: RelationshipStatus,
  })
  @Expose()
  @IsOptional()
  @IsEnum(RelationshipStatus)
  relationshipStatus: RelationshipStatus | null;

  @ApiPropertyOptional({ description: "Language preference", example: "en" })
  @Expose()
  @IsOptional()
  @IsString()
  language: string | null;

  @ApiPropertyOptional({ description: "Timezone", example: "America/New_York" })
  @Expose()
  @IsOptional()
  @IsString()
  timezone: string | null;

  @ApiPropertyOptional({ description: "Country code", example: "US" })
  @Expose()
  @IsOptional()
  @IsString()
  countryCode: string | null;

  @ApiPropertyOptional({ description: "Region/State", example: "New York" })
  @Expose()
  @IsOptional()
  @IsString()
  region: string | null;

  @ApiPropertyOptional({ description: "Social links", type: "object" })
  @Expose()
  @IsOptional()
  @IsObject()
  socialLinks: Record<string, any> | null;

  @ApiPropertyOptional({ description: "Work information", type: "object" })
  @Expose()
  @IsOptional()
  @IsObject()
  workInfo: Record<string, any> | null;

  @ApiPropertyOptional({ description: "Interests", type: "object" })
  @Expose()
  @IsOptional()
  @IsObject()
  interests: Record<string, any> | null;

  @ApiPropertyOptional({
    description: "Profile completeness score",
    example: 75,
  })
  @Expose()
  @IsOptional()
  @IsInt()
  completenessScore: number;

  @ApiPropertyOptional({
    description: "Profile completeness level",
    enum: ProfileCompletenessLevel,
  })
  @Expose()
  @IsOptional()
  @IsEnum(ProfileCompletenessLevel)
  completenessLevel: ProfileCompletenessLevel;

  @ApiProperty({ description: "Created at timestamp" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Avatar updated at timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  avatarUpdatedAt: Date | null;

  @ApiPropertyOptional({ description: "Cover photo updated at timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  coverPhotoUpdatedAt: Date | null;
}

/**
 * Notification settings response DTO.
 */
export class NotificationSettingsResponseDto {
  @ApiProperty({ description: "Message notifications enabled", example: true })
  @Expose()
  @IsBoolean()
  messages: boolean;

  @ApiProperty({ description: "Group notifications enabled", example: true })
  @Expose()
  @IsBoolean()
  groups: boolean;

  @ApiProperty({ description: "Call notifications enabled", example: true })
  @Expose()
  @IsBoolean()
  calls: boolean;

  @ApiProperty({ description: "Mention notifications enabled", example: true })
  @Expose()
  @IsBoolean()
  mentions: boolean;

  @ApiProperty({ description: "Reaction notifications enabled", example: true })
  @Expose()
  @IsBoolean()
  reactions: boolean;

  @ApiProperty({ description: "Notification sounds enabled", example: true })
  @Expose()
  @IsBoolean()
  sounds: boolean;

  @ApiProperty({ description: "Vibrations enabled", example: true })
  @Expose()
  @IsBoolean()
  vibrations: boolean;

  @ApiProperty({ description: "Push notifications enabled", example: true })
  @Expose()
  @IsBoolean()
  pushEnabled: boolean;
}

/**
 * Privacy settings response DTO.
 */
export class PrivacySettingsResponseDto {
  @ApiProperty({
    description: "Last seen visibility",
    enum: ["everyone", "contacts", "none"],
  })
  @Expose()
  @IsIn(["everyone", "contacts", "none"])
  lastSeen: "everyone" | "contacts" | "none";

  @ApiProperty({
    description: "Profile photo visibility",
    enum: ["everyone", "contacts", "none"],
  })
  @Expose()
  @IsIn(["everyone", "contacts", "none"])
  profilePhoto: "everyone" | "contacts" | "none";

  @ApiProperty({
    description: "Status visibility",
    enum: ["everyone", "contacts", "none"],
  })
  @Expose()
  @IsIn(["everyone", "contacts", "none"])
  status: "everyone" | "contacts" | "none";

  @ApiProperty({ description: "Read receipts enabled", example: true })
  @Expose()
  @IsBoolean()
  readReceipts: boolean;

  @ApiProperty({ description: "Typing indicators enabled", example: true })
  @Expose()
  @IsBoolean()
  typingIndicators: boolean;

  @ApiProperty({ description: "Online status visible", example: true })
  @Expose()
  @IsBoolean()
  onlineStatus: boolean;
}

/**
 * Settings response DTO.
 */
export class UserSettingsResponseDto {
  @ApiProperty({
    description: "Notification settings",
    type: NotificationSettingsResponseDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => NotificationSettingsResponseDto)
  notifications: NotificationSettingsResponseDto;

  @ApiProperty({
    description: "Privacy settings",
    type: PrivacySettingsResponseDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => PrivacySettingsResponseDto)
  privacy: PrivacySettingsResponseDto;

  @ApiProperty({
    description: "Theme preference",
    enum: ["light", "dark", "system"],
  })
  @Expose()
  @IsIn(["light", "dark", "system"])
  theme: "light" | "dark" | "system";

  @ApiProperty({ description: "Language preference", example: "en" })
  @Expose()
  @IsString()
  language: string;

  @ApiProperty({ description: "Timezone", example: "America/New_York" })
  @Expose()
  @IsString()
  timezone: string;

  @ApiProperty({
    description: "Font size preference",
    enum: ["small", "medium", "large"],
  })
  @Expose()
  @IsIn(["small", "medium", "large"])
  fontSize: "small" | "medium" | "large";

  @ApiPropertyOptional({ description: "Chat background image URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  chatBackground: string | null;
}

/**
 * User statistics response DTO.
 */
export class UserStatsResponseDto {
  @ApiProperty({ description: "Total messages sent", example: 1250 })
  @Expose()
  @IsInt()
  totalMessages: number;

  @ApiProperty({ description: "Total messages received", example: 980 })
  @Expose()
  @IsInt()
  totalMessagesReceived: number;

  @ApiProperty({ description: "Total groups joined", example: 15 })
  @Expose()
  @IsInt()
  totalGroups: number;

  @ApiProperty({ description: "Total contacts", example: 42 })
  @Expose()
  @IsInt()
  totalContacts: number;

  @ApiProperty({ description: "Total files uploaded", example: 87 })
  @Expose()
  @IsInt()
  totalFiles: number;

  @ApiProperty({ description: "Total calls made", example: 56 })
  @Expose()
  @IsInt()
  totalCalls: number;

  @ApiProperty({ description: "Total calls received", example: 63 })
  @Expose()
  @IsInt()
  totalCallsReceived: number;

  @ApiProperty({ description: "Total calls missed", example: 12 })
  @Expose()
  @IsInt()
  totalCallsMissed: number;

  @ApiProperty({ description: "Account age in days", example: 365 })
  @Expose()
  @IsInt()
  accountAgeDays: number;

  @ApiPropertyOptional({
    description: "Last active timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastActive: Date | null;

  @ApiPropertyOptional({
    description: "Average messages per day",
    example: 3.42,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  avgMessagesPerDay: number | null;

  @ApiPropertyOptional({
    description: "Message streak (consecutive days)",
    example: 45,
  })
  @Expose()
  @IsOptional()
  @IsInt()
  messageStreak: number | null;
}

// -------- MAIN RESPONSE DTO --------

/**
 * User response DTO for API responses.
 * Supports different serialization groups for different contexts.
 */
export class UserResponseDto {
  // -------- PRIMARY IDENTIFIERS --------
  @ApiProperty({ description: "User ID", example: "user_abc123" })
  @Expose()
  @IsUUID()
  id: string;

  // -------- AUTHENTICATION --------
  @ApiProperty({
    description: "User email address",
    example: "john.doe@example.com",
  })
  @Expose()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: "User phone number",
    example: "+15551234567",
  })
  @Expose()
  @IsOptional()
  @IsPhoneNumber()
  phone: string | null;

  // -------- PROFILE --------
  @ApiProperty({ description: "Display name", example: "John Doe" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({
    description: "User bio",
    example: "Hello! I am using Real WhatsApp Clone.",
  })
  @Expose()
  @IsOptional()
  @IsString()
  bio: string | null;

  @ApiPropertyOptional({
    description: "User status message",
    example: "Available",
  })
  @Expose()
  @IsOptional()
  @IsString()
  status: string | null;

  @ApiPropertyOptional({
    description: "Avatar URL",
    example: "https://storage.example.com/avatars/user123.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarUrl: string | null;

  @ApiPropertyOptional({
    description: "Avatar thumbnail URL",
    example: "https://storage.example.com/avatars/user123_thumb.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarThumb: string | null;

  @ApiPropertyOptional({
    description: "Cover photo URL",
    example: "https://storage.example.com/covers/user123.jpg",
  })
  @Expose()
  @IsOptional()
  @IsUrl()
  coverPhoto: string | null;

  // -------- ACCOUNT STATUS --------
  @ApiProperty({ description: "Account is active", example: true })
  @Expose()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ description: "Email is verified", example: true })
  @Expose()
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty({ description: "User has admin privileges", example: false })
  @Expose()
  @IsBoolean()
  isAdmin: boolean;

  @ApiProperty({ description: "Account status", enum: AccountStatus })
  @Expose()
  @IsEnum(AccountStatus)
  accountStatus: AccountStatus;

  @ApiPropertyOptional({
    description: "Suspension reason",
    example: "Terms of service violation",
  })
  @Expose()
  @IsOptional()
  @IsString()
  suspendedReason: string | null;

  @ApiPropertyOptional({
    description: "Suspended at timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  suspendedAt: Date | null;

  // -------- ROLES & PERMISSIONS --------
  @ApiProperty({ description: "User roles", enum: UserRole, isArray: true })
  @Expose()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];

  @ApiProperty({
    description: "User permissions",
    example: ["user:read", "message:send"],
    isArray: true,
  })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  // -------- TIMESTAMPS --------
  @ApiProperty({
    description: "Account created at timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: "Account updated at timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  @Expose()
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Last seen timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastSeen: Date | null;

  @ApiPropertyOptional({
    description: "Last active timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastActive: Date | null;

  // -------- 2FA --------
  @ApiProperty({
    description: "Two-factor authentication enabled",
    example: false,
  })
  @Expose()
  @IsBoolean()
  is2faEnabled: boolean;

  // -------- CALCULATED FIELDS --------
  @ApiProperty({ description: "User is currently online", example: true })
  @Expose()
  @IsBoolean()
  isOnline: boolean;

  @ApiPropertyOptional({
    description: "Last seen formatted",
    example: "2 minutes ago",
  })
  @Expose()
  @IsOptional()
  @IsString()
  lastSeenFormatted: string | null;

  @ApiPropertyOptional({ description: "User age in years", example: 34 })
  @Expose()
  @IsOptional()
  @IsNumber()
  age: number | null;

  @ApiPropertyOptional({
    description: "User age formatted",
    example: "34 years 6 months",
  })
  @Expose()
  @IsOptional()
  @IsString()
  ageFormatted: string | null;

  @ApiPropertyOptional({
    description: "User initials for avatar fallback",
    example: "JD",
  })
  @Expose()
  @IsOptional()
  @IsString()
  initials: string | null;

  // -------- NESTED OBJECTS --------
  @ApiPropertyOptional({
    description: "User profile",
    type: UserProfileResponseDto,
  })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UserProfileResponseDto)
  profile: UserProfileResponseDto | null;

  @ApiPropertyOptional({
    description: "User settings",
    type: UserSettingsResponseDto,
  })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UserSettingsResponseDto)
  settings: UserSettingsResponseDto | null;

  @ApiPropertyOptional({
    description: "User statistics",
    type: UserStatsResponseDto,
  })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UserStatsResponseDto)
  stats: UserStatsResponseDto | null;

  // -------- EXCLUDED FIELDS (not exposed) --------
  @Exclude()
  passwordHash: string;

  @Exclude()
  twoFactorSecret: string;

  @Exclude()
  deletedAt: Date | null;

  @Exclude()
  metadata: Record<string, any> | null;

  @Exclude()
  userAgent: string | null;

  @Exclude()
  ipAddress: string | null;

  @Exclude()
  deviceId: string | null;

  @Exclude()
  sessionId: string | null;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<UserResponseDto> = {}) {
    Object.assign(this, partial);
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Create a UserResponseDto from a User entity.
   * @param user - User entity object
   * @param options - Serialization options
   * @returns UserResponseDto
   */
  static fromEntity(
    user: any,
    options: {
      includeProfile?: boolean;
      includeSettings?: boolean;
      includeStats?: boolean;
      includeSensitive?: boolean;
      includeDeleted?: boolean;
    } = {},
  ): UserResponseDto {
    const {
      includeProfile = true,
      includeSettings = true,
      includeStats = false,
      includeSensitive = false,
      includeDeleted = false,
    } = options;

    const dto = new UserResponseDto();

    // Basic fields
    dto.id = user.id;
    dto.email = user.email;
    dto.phone = user.phone || null;
    dto.displayName = user.displayName;
    dto.bio = user.bio || null;
    dto.status = user.status || null;
    dto.avatarUrl = user.avatarUrl || null;
    dto.avatarThumb = user.avatarThumb || null;
    dto.coverPhoto = user.coverPhoto || null;
    dto.isActive = user.isActive;
    dto.isVerified = user.isVerified;
    dto.isAdmin = user.isAdmin;
    dto.accountStatus = user.accountStatus || AccountStatus.ACTIVE;
    dto.suspendedReason = user.suspendedReason || null;
    dto.suspendedAt = user.suspendedAt || null;
    dto.roles = user.roles || [UserRole.USER];
    dto.permissions = user.permissions || [];
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.lastSeen = user.lastSeen || null;
    dto.lastActive = user.lastActive || null;
    dto.is2faEnabled = user.is2faEnabled || false;

    // Deleted fields (only if requested)
    if (includeDeleted) {
      dto.deletedAt = user.deletedAt || null;
    }

    // Sensitive fields (only if requested and allowed)
    if (includeSensitive) {
      (dto as any).metadata = user.metadata || null;
      (dto as any).userAgent = user.userAgent || null;
      (dto as any).ipAddress = user.ipAddress || null;
      (dto as any).deviceId = user.deviceId || null;
      (dto as any).sessionId = user.sessionId || null;
    }

    // Calculated fields
    dto.isOnline = UserResponseDto.calculateIsOnline(user.lastSeen);
    dto.lastSeenFormatted = UserResponseDto.formatLastSeen(user.lastSeen);
    dto.age = UserResponseDto.calculateAge(user.birthday);
    dto.ageFormatted = UserResponseDto.formatAge(user.birthday);
    dto.initials = UserResponseDto.getInitials(user.displayName);

    // Profile (nested)
    if (includeProfile && user.profile) {
      dto.profile = new UserProfileResponseDto();
      const profile = user.profile;
      dto.profile.id = profile.id;
      dto.profile.userId = profile.userId;
      dto.profile.bio = profile.bio || null;
      dto.profile.status = profile.status || null;
      dto.profile.avatarUrl = profile.avatarUrl || null;
      dto.profile.avatarThumb = profile.avatarThumb || null;
      dto.profile.coverPhoto = profile.coverPhoto || null;
      dto.profile.coverPhotoThumb = profile.coverPhotoThumb || null;
      dto.profile.location = profile.location || null;
      dto.profile.latitude = profile.latitude || null;
      dto.profile.longitude = profile.longitude || null;
      dto.profile.website = profile.website || null;
      dto.profile.businessEmail = profile.businessEmail || null;
      dto.profile.birthday = profile.birthday || null;
      dto.profile.gender = profile.gender || null;
      dto.profile.relationshipStatus = profile.relationshipStatus || null;
      dto.profile.language = profile.language || null;
      dto.profile.timezone = profile.timezone || null;
      dto.profile.countryCode = profile.countryCode || null;
      dto.profile.region = profile.region || null;
      dto.profile.socialLinks = profile.socialLinks || null;
      dto.profile.workInfo = profile.workInfo || null;
      dto.profile.interests = profile.interests || null;
      dto.profile.completenessScore = profile.completenessScore || 0;
      dto.profile.completenessLevel =
        profile.completenessLevel || ProfileCompletenessLevel.INCOMPLETE;
      dto.profile.createdAt = profile.createdAt;
      dto.profile.updatedAt = profile.updatedAt;
      dto.profile.avatarUpdatedAt = profile.avatarUpdatedAt || null;
      dto.profile.coverPhotoUpdatedAt = profile.coverPhotoUpdatedAt || null;
    }

    // Settings (nested)
    if (includeSettings && user.settings) {
      dto.settings = new UserSettingsResponseDto();
      const settings = user.settings;

      // Notifications
      dto.settings.notifications = {
        messages: settings.notifications?.messages ?? true,
        groups: settings.notifications?.groups ?? true,
        calls: settings.notifications?.calls ?? true,
        mentions: settings.notifications?.mentions ?? true,
        reactions: settings.notifications?.reactions ?? true,
        sounds: settings.notifications?.sounds ?? true,
        vibrations: settings.notifications?.vibrations ?? true,
        pushEnabled: settings.notifications?.pushEnabled ?? true,
      };

      // Privacy
      dto.settings.privacy = {
        lastSeen: settings.privacy?.lastSeen || "everyone",
        profilePhoto: settings.privacy?.profilePhoto || "everyone",
        status: settings.privacy?.status || "everyone",
        readReceipts: settings.privacy?.readReceipts ?? true,
        typingIndicators: settings.privacy?.typingIndicators ?? true,
        onlineStatus: settings.privacy?.onlineStatus ?? true,
      };

      dto.settings.theme = settings.theme || "system";
      dto.settings.language = settings.language || "en";
      dto.settings.timezone = settings.timezone || "UTC";
      dto.settings.fontSize = settings.fontSize || "medium";
      dto.settings.chatBackground = settings.chatBackground || null;
    }

    // Stats (if requested)
    if (includeStats) {
      dto.stats = new UserStatsResponseDto();
      dto.stats.totalMessages = user._totalMessages || 0;
      dto.stats.totalMessagesReceived = user._totalMessagesReceived || 0;
      dto.stats.totalGroups = user._totalGroups || 0;
      dto.stats.totalContacts = user._totalContacts || 0;
      dto.stats.totalFiles = user._totalFiles || 0;
      dto.stats.totalCalls = user._totalCalls || 0;
      dto.stats.totalCallsReceived = user._totalCallsReceived || 0;
      dto.stats.totalCallsMissed = user._totalCallsMissed || 0;
      dto.stats.accountAgeDays = Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      dto.stats.lastActive = user.lastActive || null;

      // Calculate average messages per day
      if (dto.stats.accountAgeDays > 0 && dto.stats.totalMessages > 0) {
        dto.stats.avgMessagesPerDay =
          dto.stats.totalMessages / dto.stats.accountAgeDays;
      } else {
        dto.stats.avgMessagesPerDay = null;
      }

      // Message streak (would need more data)
      dto.stats.messageStreak = null;
    }

    return dto;
  }

  /**
   * Create a UserResponseDto from a Prisma user object.
   */
  static fromPrisma(
    user: any,
    options: {
      includeProfile?: boolean;
      includeSettings?: boolean;
      includeStats?: boolean;
      includeSensitive?: boolean;
    } = {},
  ): UserResponseDto {
    return this.fromEntity(user, options);
  }

  /**
   * Create a public user response (limited fields).
   */
  static toPublic(user: any): UserResponseDto {
    const dto = this.fromEntity(user, {
      includeProfile: true,
      includeSettings: false,
      includeStats: false,
      includeSensitive: false,
    });

    // Hide sensitive fields
    dto.email = "";
    dto.phone = null;
    dto.isAdmin = false;
    dto.roles = [];
    dto.permissions = [];
    dto.is2faEnabled = false;
    dto.suspendedReason = null;
    dto.suspendedAt = null;

    return dto;
  }

  /**
   * Create a contact user response (for contact lists).
   */
  static toContact(user: any): UserResponseDto {
    const dto = this.fromEntity(user, {
      includeProfile: true,
      includeSettings: false,
      includeStats: false,
      includeSensitive: false,
    });

    // Hide sensitive fields for contacts
    dto.email = "";
    dto.phone = null;
    dto.isAdmin = false;
    dto.roles = [];
    dto.permissions = [];
    dto.is2faEnabled = false;
    dto.suspendedReason = null;
    dto.suspendedAt = null;
    dto.createdAt = undefined as any;
    dto.updatedAt = undefined as any;

    return dto;
  }

  /**
   * Create an admin user response (full detail with sensitive data).
   */
  static toAdmin(user: any): UserResponseDto {
    return this.fromEntity(user, {
      includeProfile: true,
      includeSettings: true,
      includeStats: true,
      includeSensitive: true,
      includeDeleted: true,
    });
  }

  // -------- STATIC HELPERS --------

  /**
   * Check if a user is online based on lastSeen.
   */
  static calculateIsOnline(lastSeen: Date | null): boolean {
    if (!lastSeen) return false;
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Format lastSeen as a human-readable string.
   */
  static formatLastSeen(lastSeen: Date | null): string | null {
    if (!lastSeen) return null;

    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();

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
    return lastSeen.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Calculate user age from birthday.
   */
  static calculateAge(birthday: Date | null): number | null {
    if (!birthday) return null;
    const now = new Date();
    const diff = now.getTime() - birthday.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  /**
   * Format age as years and months.
   */
  static formatAge(birthday: Date | null): string | null {
    if (!birthday) return null;

    const now = new Date();
    const months =
      (now.getFullYear() - birthday.getFullYear()) * 12 +
      (now.getMonth() - birthday.getMonth());

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
      return `${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`;
    }

    const yearStr = `${years} year${years !== 1 ? "s" : ""}`;
    if (remainingMonths === 0) {
      return yearStr;
    }
    return `${yearStr} ${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`;
  }

  /**
   * Get user initials from display name.
   */
  static getInitials(displayName: string): string {
    if (!displayName) return "U";
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  // -------- TRANSFORMATION METHODS --------

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<UserResponseDto> {
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
      accountStatus: this.accountStatus,
      suspendedReason: this.suspendedReason,
      suspendedAt: this.suspendedAt,
      roles: this.roles,
      permissions: this.permissions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSeen: this.lastSeen,
      lastActive: this.lastActive,
      is2faEnabled: this.is2faEnabled,
      isOnline: this.isOnline,
      lastSeenFormatted: this.lastSeenFormatted,
      age: this.age,
      ageFormatted: this.ageFormatted,
      initials: this.initials,
      profile: this.profile,
      settings: this.settings,
      stats: this.stats,
    };
  }

  /**
   * Convert to a WebSocket-friendly payload.
   */
  toSocketPayload(): {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    status: string | null;
    isOnline: boolean;
    lastSeen: Date | null;
    initials: string;
  } {
    return {
      id: this.id,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl,
      status: this.status,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      initials: this.initials || this.getInitials(this.displayName),
    };
  }

  /**
   * Create a test user response with default values.
   */
  static createTestResponse(
    overrides: Partial<UserResponseDto> = {},
  ): UserResponseDto {
    const base = new UserResponseDto({
      id: "test_user_123",
      email: "test@example.com",
      phone: "+15551234567",
      displayName: "Test User",
      bio: "This is a test user",
      status: "Testing",
      avatarUrl: "https://example.com/avatar.jpg",
      avatarThumb: "https://example.com/avatar_thumb.jpg",
      isActive: true,
      isVerified: true,
      isAdmin: false,
      accountStatus: AccountStatus.ACTIVE,
      roles: [UserRole.USER],
      permissions: ["user:read", "message:send"],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeen: new Date(),
      lastActive: new Date(),
      is2faEnabled: false,
      isOnline: true,
      lastSeenFormatted: "Just now",
      age: 30,
      ageFormatted: "30 years",
      initials: "TU",
      profile: new UserProfileResponseDto(),
      settings: new UserSettingsResponseDto(),
      stats: new UserStatsResponseDto(),
      ...overrides,
    });

    // Add test profile
    if (!overrides.profile) {
      base.profile = new UserProfileResponseDto();
      base.profile.id = "test_profile_123";
      base.profile.userId = "test_user_123";
      base.profile.bio = "Test bio";
      base.profile.status = "Testing";
      base.profile.avatarUrl = "https://example.com/avatar.jpg";
      base.profile.createdAt = new Date();
      base.profile.updatedAt = new Date();
      base.profile.completenessScore = 75;
      base.profile.completenessLevel = ProfileCompletenessLevel.COMPLETE;
    }

    return base;
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Validate that the response DTO is complete.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.id) {
      errors.push("User ID is required");
    }

    if (!this.email) {
      errors.push("Email is required");
    }

    if (!this.displayName) {
      errors.push("Display name is required");
    }

    if (this.roles && this.roles.length === 0) {
      errors.push("At least one role is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if the response is for a valid user.
   */
  isValid(): boolean {
    return this.validate().valid;
  }

  // -------- END --------
}
