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
import { Expose, Type, plainToClass } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../common/constants/roles";

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

export class UserProfileResponseDto {
  @ApiProperty({ description: "Profile ID" })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({ description: "User ID" })
  @Expose()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: "User bio" })
  @Expose()
  @IsOptional()
  @IsString()
  bio: string | null;

  @ApiPropertyOptional({ description: "User status message" })
  @Expose()
  @IsOptional()
  @IsString()
  status: string | null;

  @ApiPropertyOptional({ description: "Avatar URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarUrl: string | null;

  @ApiPropertyOptional({ description: "Avatar thumbnail URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarThumb: string | null;

  @ApiPropertyOptional({ description: "Cover photo URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  coverPhoto: string | null;

  @ApiPropertyOptional({ description: "Cover photo thumbnail URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  coverPhotoThumb: string | null;

  @ApiPropertyOptional({ description: "User location" })
  @Expose()
  @IsOptional()
  @IsString()
  location: string | null;

  @ApiPropertyOptional({ description: "Latitude" })
  @Expose()
  @IsOptional()
  @IsNumber()
  latitude: number | null;

  @ApiPropertyOptional({ description: "Longitude" })
  @Expose()
  @IsOptional()
  @IsNumber()
  longitude: number | null;

  @ApiPropertyOptional({ description: "Website URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  website: string | null;

  @ApiPropertyOptional({ description: "Business email" })
  @Expose()
  @IsOptional()
  @IsEmail()
  businessEmail: string | null;

  @ApiPropertyOptional({ description: "Birthday" })
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

  @ApiPropertyOptional({ description: "Language preference" })
  @Expose()
  @IsOptional()
  @IsString()
  language: string | null;

  @ApiPropertyOptional({ description: "Timezone" })
  @Expose()
  @IsOptional()
  @IsString()
  timezone: string | null;

  @ApiPropertyOptional({ description: "Country code" })
  @Expose()
  @IsOptional()
  @IsString()
  countryCode: string | null;

  @ApiPropertyOptional({ description: "Region/State" })
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

  @ApiPropertyOptional({ description: "Profile completeness score" })
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

  @ApiProperty({ description: "Created at" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: "Updated at" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Avatar updated at" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  avatarUpdatedAt: Date | null;

  @ApiPropertyOptional({ description: "Cover photo updated at" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  coverPhotoUpdatedAt: Date | null;
}

export class NotificationSettingsResponseDto {
  @ApiProperty({ description: "Message notifications enabled" })
  @Expose()
  @IsBoolean()
  messages: boolean;

  @ApiProperty({ description: "Group notifications enabled" })
  @Expose()
  @IsBoolean()
  groups: boolean;

  @ApiProperty({ description: "Call notifications enabled" })
  @Expose()
  @IsBoolean()
  calls: boolean;

  @ApiProperty({ description: "Mention notifications enabled" })
  @Expose()
  @IsBoolean()
  mentions: boolean;

  @ApiProperty({ description: "Reaction notifications enabled" })
  @Expose()
  @IsBoolean()
  reactions: boolean;

  @ApiProperty({ description: "Notification sounds enabled" })
  @Expose()
  @IsBoolean()
  sounds: boolean;

  @ApiProperty({ description: "Vibrations enabled" })
  @Expose()
  @IsBoolean()
  vibrations: boolean;

  @ApiProperty({ description: "Push notifications enabled" })
  @Expose()
  @IsBoolean()
  pushEnabled: boolean;
}

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

  @ApiProperty({ description: "Read receipts enabled" })
  @Expose()
  @IsBoolean()
  readReceipts: boolean;

  @ApiProperty({ description: "Typing indicators enabled" })
  @Expose()
  @IsBoolean()
  typingIndicators: boolean;

  @ApiProperty({ description: "Online status visible" })
  @Expose()
  @IsBoolean()
  onlineStatus: boolean;
}

export class UserSettingsResponseDto {
  @ApiProperty({ type: NotificationSettingsResponseDto })
  @Expose()
  @ValidateNested()
  @Type(() => NotificationSettingsResponseDto)
  notifications: NotificationSettingsResponseDto;

  @ApiProperty({ type: PrivacySettingsResponseDto })
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

  @ApiProperty({ description: "Language preference" })
  @Expose()
  @IsString()
  language: string;

  @ApiProperty({ description: "Timezone" })
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

export class UserStatsResponseDto {
  @ApiProperty({ description: "Total messages sent" })
  @Expose()
  @IsInt()
  totalMessages: number;

  @ApiProperty({ description: "Total messages received" })
  @Expose()
  @IsInt()
  totalMessagesReceived: number;

  @ApiProperty({ description: "Total groups joined" })
  @Expose()
  @IsInt()
  totalGroups: number;

  @ApiProperty({ description: "Total contacts" })
  @Expose()
  @IsInt()
  totalContacts: number;

  @ApiProperty({ description: "Total files uploaded" })
  @Expose()
  @IsInt()
  totalFiles: number;

  @ApiProperty({ description: "Total calls made" })
  @Expose()
  @IsInt()
  totalCalls: number;

  @ApiProperty({ description: "Total calls received" })
  @Expose()
  @IsInt()
  totalCallsReceived: number;

  @ApiProperty({ description: "Total calls missed" })
  @Expose()
  @IsInt()
  totalCallsMissed: number;

  @ApiProperty({ description: "Account age in days" })
  @Expose()
  @IsInt()
  accountAgeDays: number;

  @ApiPropertyOptional({ description: "Last active timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastActive: Date | null;

  @ApiPropertyOptional({ description: "Average messages per day" })
  @Expose()
  @IsOptional()
  @IsNumber()
  avgMessagesPerDay: number | null;

  @ApiPropertyOptional({ description: "Message streak (consecutive days)" })
  @Expose()
  @IsOptional()
  @IsInt()
  messageStreak: number | null;
}

export class UserResponseDto {
  @ApiProperty({ description: "User ID" })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({ description: "User email address" })
  @Expose()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: "User phone number" })
  @Expose()
  @IsOptional()
  @IsPhoneNumber()
  phone: string | null;

  @ApiProperty({ description: "Display name" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ description: "User bio" })
  @Expose()
  @IsOptional()
  @IsString()
  bio: string | null;

  @ApiPropertyOptional({ description: "User status message" })
  @Expose()
  @IsOptional()
  @IsString()
  status: string | null;

  @ApiPropertyOptional({ description: "Avatar URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarUrl: string | null;

  @ApiPropertyOptional({ description: "Avatar thumbnail URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  avatarThumb: string | null;

  @ApiPropertyOptional({ description: "Cover photo URL" })
  @Expose()
  @IsOptional()
  @IsUrl()
  coverPhoto: string | null;

  @ApiProperty({ description: "Account is active" })
  @Expose()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ description: "Email is verified" })
  @Expose()
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty({ description: "User has admin privileges" })
  @Expose()
  @IsBoolean()
  isAdmin: boolean;

  @ApiProperty({ description: "Account status", enum: AccountStatus })
  @Expose()
  @IsEnum(AccountStatus)
  accountStatus: AccountStatus;

  @ApiPropertyOptional({ description: "Suspension reason" })
  @Expose()
  @IsOptional()
  @IsString()
  suspendedReason: string | null;

  @ApiPropertyOptional({ description: "Suspended at timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  suspendedAt: Date | null;

  @ApiProperty({ description: "User roles", enum: UserRole, isArray: true })
  @Expose()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];

  @ApiProperty({ description: "User permissions", isArray: true })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({ description: "Account created at" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: "Account updated at" })
  @Expose()
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Last seen timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastSeen: Date | null;

  @ApiPropertyOptional({ description: "Last active timestamp" })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastActive: Date | null;

  @ApiProperty({ description: "Two-factor authentication enabled" })
  @Expose()
  @IsBoolean()
  is2faEnabled: boolean;

  @ApiProperty({ description: "User is currently online" })
  @Expose()
  @IsBoolean()
  isOnline: boolean;

  @ApiPropertyOptional({ description: "Last seen formatted" })
  @Expose()
  @IsOptional()
  @IsString()
  lastSeenFormatted: string | null;

  @ApiPropertyOptional({ description: "User age in years" })
  @Expose()
  @IsOptional()
  @IsNumber()
  age: number | null;

  @ApiPropertyOptional({ description: "User age formatted" })
  @Expose()
  @IsOptional()
  @IsString()
  ageFormatted: string | null;

  @ApiPropertyOptional({ description: "User initials for avatar fallback" })
  @Expose()
  @IsOptional()
  @IsString()
  initials: string | null;

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

  constructor(partial: Partial<UserResponseDto> = {}) {
    Object.assign(this, partial);
  }

  static calculateIsOnline(lastSeen: Date | null): boolean {
    if (!lastSeen) return false;
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    return diff < 5 * 60 * 1000;
  }

  static formatLastSeen(lastSeen: Date | null): string | null {
    if (!lastSeen) return null;
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    if (diff < 60 * 1000) return "Just now";
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
    return lastSeen.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  static calculateAge(birthday: Date | null): number | null {
    if (!birthday) return null;
    const now = new Date();
    const diff = now.getTime() - birthday.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

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

    if (includeDeleted) {
      dto.deletedAt = user.deletedAt || null;
    }

    if (includeSensitive) {
      (dto as any).metadata = user.metadata || null;
      (dto as any).userAgent = user.userAgent || null;
      (dto as any).ipAddress = user.ipAddress || null;
      (dto as any).deviceId = user.deviceId || null;
      (dto as any).sessionId = user.sessionId || null;
    }

    dto.isOnline = UserResponseDto.calculateIsOnline(user.lastSeen);
    dto.lastSeenFormatted = UserResponseDto.formatLastSeen(user.lastSeen);
    dto.age = UserResponseDto.calculateAge(user.birthday);
    dto.ageFormatted = UserResponseDto.formatAge(user.birthday);
    dto.initials = UserResponseDto.getInitials(user.displayName);

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

    if (includeSettings && user.settings) {
      dto.settings = new UserSettingsResponseDto();
      const settings = user.settings;
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
      if (dto.stats.accountAgeDays > 0 && dto.stats.totalMessages > 0) {
        dto.stats.avgMessagesPerDay =
          dto.stats.totalMessages / dto.stats.accountAgeDays;
      } else {
        dto.stats.avgMessagesPerDay = null;
      }
      dto.stats.messageStreak = null;
    }

    return dto;
  }

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

  static toPublic(user: any): UserResponseDto {
    const dto = this.fromEntity(user, {
      includeProfile: true,
      includeSettings: false,
      includeStats: false,
      includeSensitive: false,
    });
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

  static toContact(user: any): UserResponseDto {
    const dto = this.fromEntity(user, {
      includeProfile: true,
      includeSettings: false,
      includeStats: false,
      includeSensitive: false,
    });
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

  static toAdmin(user: any): UserResponseDto {
    return this.fromEntity(user, {
      includeProfile: true,
      includeSettings: true,
      includeStats: true,
      includeSensitive: true,
      includeDeleted: true,
    });
  }

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

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.id) errors.push("User ID is required");
    if (!this.email) errors.push("Email is required");
    if (!this.displayName) errors.push("Display name is required");
    if (this.roles && this.roles.length === 0)
      errors.push("At least one role is required");
    return { valid: errors.length === 0, errors };
  }

  isValid(): boolean {
    return this.validate().valid;
  }
}
