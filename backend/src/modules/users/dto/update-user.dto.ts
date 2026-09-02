// backend/src/modules/users/dto/update-user.dto.ts
import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNotEmpty,
  ValidateIf,
  IsUrl,
  IsUUID,
  IsArray,
  IsEnum,
  IsDate,
  ValidateNested,
  IsIn,
  IsNumber,
  IsInt,
  IsPositive,
  IsDateString,
  IsDefined,
} from "class-validator";
import {
  Transform,
  Type,
  Expose,
  Exclude,
  plainToClass,
} from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../common/constants/roles";
import {
  Gender,
  RelationshipStatus,
  AccountStatus,
  UserStatus,
} from "./create-user.dto";

// -------- NESTED DTOs (reused from create, but with optional fields) --------

/**
 * Profile data for user update.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: "User bio (up to 500 characters)",
    example: "Hello! I am using Real WhatsApp Clone.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Bio cannot exceed 500 characters" })
  @Transform(({ value }) => value?.trim() || null)
  bio?: string | null;

  @ApiPropertyOptional({
    description: "User status message (up to 100 characters)",
    example: "Available",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Status cannot exceed 100 characters" })
  @Transform(({ value }) => value?.trim() || null)
  status?: string | null;

  @ApiPropertyOptional({
    description: "Avatar image URL",
    example: "https://storage.example.com/avatars/user123.jpg",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid avatar URL format" })
  @Transform(({ value }) => value?.trim() || null)
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    description: "Avatar thumbnail URL",
    example: "https://storage.example.com/avatars/user123_thumb.jpg",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid thumbnail URL format" })
  @Transform(({ value }) => value?.trim() || null)
  avatarThumb?: string | null;

  @ApiPropertyOptional({
    description: "Cover photo URL",
    example: "https://storage.example.com/covers/user123.jpg",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid cover photo URL format" })
  @Transform(({ value }) => value?.trim() || null)
  coverPhoto?: string | null;

  @ApiPropertyOptional({
    description: "Location of the user",
    example: "New York, USA",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  location?: string | null;

  @ApiPropertyOptional({
    description: "Latitude coordinate",
    example: 40.7128,
  })
  @IsOptional()
  @IsNumber({}, { message: "Latitude must be a number" })
  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : null,
  )
  latitude?: number | null;

  @ApiPropertyOptional({
    description: "Longitude coordinate",
    example: -74.006,
  })
  @IsOptional()
  @IsNumber({}, { message: "Longitude must be a number" })
  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : null,
  )
  longitude?: number | null;

  @ApiPropertyOptional({
    description: "User website URL",
    example: "https://example.com",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid website URL format" })
  @Transform(({ value }) => value?.trim() || null)
  website?: string | null;

  @ApiPropertyOptional({
    description: "Business email address",
    example: "business@example.com",
  })
  @IsOptional()
  @IsEmail({}, { message: "Invalid business email format" })
  @Transform(({ value }) => value?.toLowerCase().trim() || null)
  businessEmail?: string | null;

  @ApiPropertyOptional({
    description: "User birthday (ISO 8601 date)",
    example: "1990-01-01",
  })
  @IsOptional()
  @IsDateString({}, { message: "Invalid date format (use ISO 8601)" })
  birthday?: string | null;

  @ApiPropertyOptional({
    description: "User gender",
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({
    description: "Relationship status",
    enum: RelationshipStatus,
  })
  @IsOptional()
  @IsEnum(RelationshipStatus)
  relationshipStatus?: RelationshipStatus | null;

  @ApiPropertyOptional({
    description: "User language preference (ISO 639-1 code)",
    example: "en",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim().toLowerCase() || null)
  language?: string | null;

  @ApiPropertyOptional({
    description: "User timezone",
    example: "America/New_York",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  timezone?: string | null;

  @ApiPropertyOptional({
    description: "Country code (ISO 3166-1 alpha-2)",
    example: "US",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim().toUpperCase() || null)
  countryCode?: string | null;

  @ApiPropertyOptional({
    description: "Region or state",
    example: "New York",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  region?: string | null;
}

/**
 * Social links for user profile update.
 */
export class UpdateSocialLinksDto {
  @ApiPropertyOptional({ example: "https://facebook.com/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid Facebook URL format" })
  @Transform(({ value }) => value?.trim() || null)
  facebook?: string | null;

  @ApiPropertyOptional({ example: "https://twitter.com/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid Twitter URL format" })
  @Transform(({ value }) => value?.trim() || null)
  twitter?: string | null;

  @ApiPropertyOptional({ example: "https://instagram.com/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid Instagram URL format" })
  @Transform(({ value }) => value?.trim() || null)
  instagram?: string | null;

  @ApiPropertyOptional({ example: "https://linkedin.com/in/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid LinkedIn URL format" })
  @Transform(({ value }) => value?.trim() || null)
  linkedin?: string | null;

  @ApiPropertyOptional({ example: "https://github.com/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid GitHub URL format" })
  @Transform(({ value }) => value?.trim() || null)
  github?: string | null;

  @ApiPropertyOptional({ example: "https://youtube.com/@user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid YouTube URL format" })
  @Transform(({ value }) => value?.trim() || null)
  youtube?: string | null;

  @ApiPropertyOptional({ example: "https://tiktok.com/@user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid TikTok URL format" })
  @Transform(({ value }) => value?.trim() || null)
  tiktok?: string | null;

  @ApiPropertyOptional({ example: "https://discord.com/users/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid Discord URL format" })
  @Transform(({ value }) => value?.trim() || null)
  discord?: string | null;

  @ApiPropertyOptional({ example: "https://t.me/user" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid Telegram URL format" })
  @Transform(({ value }) => value?.trim() || null)
  telegram?: string | null;

  @ApiPropertyOptional({ example: "https://wa.me/1234567890" })
  @IsOptional()
  @IsUrl({}, { message: "Invalid WhatsApp URL format" })
  @Transform(({ value }) => value?.trim() || null)
  whatsapp?: string | null;
}

/**
 * Privacy settings update.
 */
export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({
    description: "Last seen visibility",
    enum: ["everyone", "contacts", "none"],
  })
  @IsOptional()
  @IsIn(["everyone", "contacts", "none"])
  lastSeen?: "everyone" | "contacts" | "none";

  @ApiPropertyOptional({
    description: "Profile photo visibility",
    enum: ["everyone", "contacts", "none"],
  })
  @IsOptional()
  @IsIn(["everyone", "contacts", "none"])
  profilePhoto?: "everyone" | "contacts" | "none";

  @ApiPropertyOptional({
    description: "Status visibility",
    enum: ["everyone", "contacts", "none"],
  })
  @IsOptional()
  @IsIn(["everyone", "contacts", "none"])
  status?: "everyone" | "contacts" | "none";

  @ApiPropertyOptional({
    description: "Enable read receipts",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  readReceipts?: boolean;

  @ApiPropertyOptional({
    description: "Enable typing indicators",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  typingIndicators?: boolean;

  @ApiPropertyOptional({
    description: "Show online status",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  onlineStatus?: boolean;
}

/**
 * Notification settings update.
 */
export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description: "Enable message notifications",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  messages?: boolean;

  @ApiPropertyOptional({
    description: "Enable group notifications",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  groups?: boolean;

  @ApiPropertyOptional({
    description: "Enable call notifications",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  calls?: boolean;

  @ApiPropertyOptional({
    description: "Enable mention notifications",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mentions?: boolean;

  @ApiPropertyOptional({
    description: "Enable reaction notifications",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  reactions?: boolean;

  @ApiPropertyOptional({
    description: "Enable notification sounds",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sounds?: boolean;

  @ApiPropertyOptional({ description: "Enable vibrations", example: true })
  @IsOptional()
  @IsBoolean()
  vibrations?: boolean;

  @ApiPropertyOptional({
    description: "Enable push notifications",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}

/**
 * Settings update.
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: "Notification settings",
    type: UpdateNotificationSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificationSettingsDto)
  notifications?: UpdateNotificationSettingsDto;

  @ApiPropertyOptional({
    description: "Privacy settings",
    type: UpdatePrivacySettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePrivacySettingsDto)
  privacy?: UpdatePrivacySettingsDto;

  @ApiPropertyOptional({
    description: "Theme preference",
    enum: ["light", "dark", "system"],
  })
  @IsOptional()
  @IsIn(["light", "dark", "system"])
  theme?: "light" | "dark" | "system";

  @ApiPropertyOptional({
    description: "Language preference (ISO 639-1 code)",
    example: "en",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim() || null)
  language?: string | null;

  @ApiPropertyOptional({
    description: "Timezone",
    example: "America/New_York",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  timezone?: string | null;

  @ApiPropertyOptional({
    description: "Font size preference",
    enum: ["small", "medium", "large"],
  })
  @IsOptional()
  @IsIn(["small", "medium", "large"])
  fontSize?: "small" | "medium" | "large";

  @ApiPropertyOptional({
    description: "Chat background image URL",
    example: "https://example.com/chat-bg.jpg",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid background image URL format" })
  @Transform(({ value }) => value?.trim() || null)
  chatBackground?: string | null;
}

/**
 * Device information update.
 */
export class UpdateDeviceInfoDto {
  @ApiPropertyOptional({
    description: "Device name",
    example: "Chrome Browser on Windows 10",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  deviceName?: string | null;

  @ApiPropertyOptional({
    description: "Unique device identifier",
    example: "device_abc123def456",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  deviceId?: string | null;

  @ApiPropertyOptional({
    description: "Device type",
    enum: ["web", "mobile", "desktop"],
  })
  @IsOptional()
  @IsIn(["web", "mobile", "desktop"])
  deviceType?: "web" | "mobile" | "desktop" | null;

  @ApiPropertyOptional({
    description: "Operating system",
    example: "Windows 10",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  os?: string | null;

  @ApiPropertyOptional({
    description: "Browser name",
    example: "Chrome",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  browser?: string | null;

  @ApiPropertyOptional({
    description: "Browser version",
    example: "120.0.0.0",
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim() || null)
  browserVersion?: string | null;

  @ApiPropertyOptional({
    description: "Push notification token",
    example: "fcm_token_abc123def456",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  pushToken?: string | null;
}

// -------- MAIN DTO --------

/**
 * DTO for updating an existing user.
 * All fields are optional; only provided fields will be updated.
 */
export class UpdateUserDto {
  // -------- PRIMARY IDENTIFIERS (read-only, but can be updated by admin) --------
  @ApiPropertyOptional({
    description: "User email address (must be unique)",
    example: "john.doe@example.com",
  })
  @IsOptional()
  @IsEmail({}, { message: "Please provide a valid email address" })
  @Transform(({ value }) => value?.toLowerCase().trim() || "")
  email?: string | null;

  @ApiPropertyOptional({
    description: "Phone number in international format (E.164)",
    example: "+15551234567",
  })
  @IsOptional()
  @IsPhoneNumber(null, {
    message: "Please provide a valid phone number (E.164 format)",
  })
  @Transform(({ value }) => value?.trim() || null)
  phone?: string | null;

  // -------- PROFILE --------
  @ApiPropertyOptional({
    description: "Full display name",
    example: "John Doe",
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Display name must be at least 2 characters" })
  @MaxLength(50, { message: "Display name must be at most 50 characters" })
  @Transform(({ value }) => value?.trim() || "")
  displayName?: string | null;

  @ApiPropertyOptional({
    description: "User bio",
    example: "Hello! I am using Real WhatsApp Clone.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Bio cannot exceed 500 characters" })
  @Transform(({ value }) => value?.trim() || null)
  bio?: string | null;

  @ApiPropertyOptional({
    description: "User status message",
    example: "Available",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Status cannot exceed 100 characters" })
  @Transform(({ value }) => value?.trim() || null)
  status?: string | null;

  // -------- PASSWORD --------
  @ApiPropertyOptional({
    description:
      "New password (minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character)",
    example: "NewSecureP@ssw0rd",
    minLength: 8,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password is too long" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        "Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character (@$!%*?&)",
    },
  )
  password?: string | null;

  @ApiPropertyOptional({
    description: "Password confirmation (must match new password)",
    example: "NewSecureP@ssw0rd",
  })
  @ValidateIf((o) => o.password)
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password confirmation must match the password" })
  @Transform(({ value }) => value?.trim() || null)
  passwordConfirmation?: string | null;

  // -------- ACCOUNT STATUS (admin only) --------
  @ApiPropertyOptional({
    description: "Account status",
    enum: AccountStatus,
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  accountStatus?: AccountStatus;

  @ApiPropertyOptional({
    description: "Whether the account is active",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Whether the email is verified",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: "Whether the user has admin privileges",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  // -------- ROLES & PERMISSIONS (admin only) --------
  @ApiPropertyOptional({
    description: "User roles",
    enum: UserRole,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({
    description: "User permissions",
    example: ["user:read", "message:send"],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  // -------- PROFILE DATA (NESTED) --------
  @ApiPropertyOptional({
    description: "Extended profile data",
    type: UpdateProfileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProfileDto)
  profile?: UpdateProfileDto;

  @ApiPropertyOptional({
    description: "Social media links",
    type: UpdateSocialLinksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSocialLinksDto)
  socialLinks?: UpdateSocialLinksDto;

  // -------- SETTINGS --------
  @ApiPropertyOptional({
    description: "User settings",
    type: UpdateSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSettingsDto)
  settings?: UpdateSettingsDto;

  // -------- DEVICE INFORMATION --------
  @ApiPropertyOptional({
    description: "Device information for session tracking",
    type: UpdateDeviceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDeviceInfoDto)
  deviceInfo?: UpdateDeviceInfoDto;

  // -------- 2FA --------
  @ApiPropertyOptional({
    description: "Enable two-factor authentication",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enable2fa?: boolean;

  @ApiPropertyOptional({
    description: "Disable two-factor authentication",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  disable2fa?: boolean;

  @ApiPropertyOptional({
    description: "2FA verification code for enabling/disabling",
    example: "123456",
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  twoFactorCode?: string | null;

  // -------- METADATA (admin only) --------
  @ApiPropertyOptional({
    description: "User metadata (JSON object)",
    example: { source: "web", campaign: "summer_2024" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;

  // -------- FLAGS --------
  @Exclude({ toPlainOnly: true })
  _skipPhoneValidation: boolean = false;

  @Exclude({ toPlainOnly: true })
  _isTestUser: boolean = false;

  @Exclude({ toPlainOnly: true })
  _isAdminUpdate: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<UpdateUserDto> = {}) {
    Object.assign(this, partial);
    this.sanitize();
  }

  // -------- SANITIZATION --------
  private sanitize(): void {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    if (this.displayName) {
      this.displayName = this.displayName.trim();
      this.displayName = this.displayName.replace(/\s+/g, " ");
    }
    if (this.bio) {
      this.bio = this.bio.trim();
    }
    if (this.status) {
      this.status = this.status.trim();
    }
    if (this.phone) {
      this.phone = this.phone.trim();
    }
  }

  // -------- VALIDATION HELPERS --------

  /**
   * Check if any fields are provided for update.
   */
  hasUpdates(): boolean {
    const hasFields = [
      this.email,
      this.phone,
      this.displayName,
      this.bio,
      this.status,
      this.password,
      this.passwordConfirmation,
      this.accountStatus,
      this.isActive,
      this.isVerified,
      this.isAdmin,
      this.roles,
      this.permissions,
      this.profile,
      this.socialLinks,
      this.settings,
      this.deviceInfo,
      this.enable2fa,
      this.disable2fa,
      this.twoFactorCode,
      this.metadata,
    ].some((field) => field !== undefined && field !== null);

    // Check if any nested objects have properties
    const hasNestedUpdates =
      (this.profile &&
        Object.keys(this.profile).some(
          (k) => (this.profile as any)[k] !== undefined,
        )) ||
      (this.socialLinks &&
        Object.keys(this.socialLinks).some(
          (k) => (this.socialLinks as any)[k] !== undefined,
        )) ||
      (this.settings &&
        Object.keys(this.settings).some(
          (k) => (this.settings as any)[k] !== undefined,
        )) ||
      (this.deviceInfo &&
        Object.keys(this.deviceInfo).some(
          (k) => (this.deviceInfo as any)[k] !== undefined,
        ));

    return hasFields || hasNestedUpdates;
  }

  /**
   * Validate that password and password confirmation match.
   */
  validatePasswordConfirmation(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (
      this.password &&
      this.passwordConfirmation &&
      this.password !== this.passwordConfirmation
    ) {
      errors.push("Password confirmation does not match password");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if the user is updating their password.
   */
  isUpdatingPassword(): boolean {
    return !!this.password;
  }

  /**
   * Check if the user is updating 2FA.
   */
  isUpdating2fa(): boolean {
    return (
      this.enable2fa !== undefined ||
      this.disable2fa !== undefined ||
      !!this.twoFactorCode
    );
  }

  /**
   * Check if the user is updating roles/permissions (admin only).
   */
  isUpdatingRolesPermissions(): boolean {
    return !!this.roles || !!this.permissions;
  }

  /**
   * Check if the user is updating account status (admin only).
   */
  isUpdatingAccountStatus(): boolean {
    return this.accountStatus !== undefined || this.isActive !== undefined;
  }

  /**
   * Get the password strength score.
   */
  getPasswordStrength(): {
    score: number;
    label: "weak" | "medium" | "strong" | "very_strong";
    feedback: string[];
  } | null {
    if (!this.password) return null;

    let score = 0;
    const feedback: string[] = [];

    if (this.password.length >= 8) score++;
    else feedback.push("Use at least 8 characters");

    if (/[A-Z]/.test(this.password)) score++;
    else feedback.push("Add at least one uppercase letter");

    if (/[a-z]/.test(this.password)) score++;
    else feedback.push("Add at least one lowercase letter");

    if (/\d/.test(this.password)) score++;
    else feedback.push("Add at least one number");

    if (/[@$!%*?&]/.test(this.password)) score++;
    else feedback.push("Add at least one special character (@$!%*?&)");

    if (this.password.length >= 12) score++;

    if (/(password|123456|qwerty)/i.test(this.password)) {
      score = Math.max(0, score - 2);
      feedback.push("Avoid common passwords");
    }

    if (/(.)\1{3,}/.test(this.password)) {
      score = Math.max(0, score - 1);
      feedback.push("Avoid repeated characters");
    }

    score = Math.min(4, Math.floor(score / 2));

    let label: "weak" | "medium" | "strong" | "very_strong";
    if (score <= 1) label = "weak";
    else if (score <= 2) label = "medium";
    else if (score <= 3) label = "strong";
    else label = "very_strong";

    return { score, label, feedback };
  }

  /**
   * Get the fields that are being updated.
   */
  getUpdatedFields(): string[] {
    const fields: string[] = [];
    const check = (obj: any, prefix: string = "") => {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value !== undefined && value !== null) {
          fields.push(prefix ? `${prefix}.${key}` : key);
        }
        if (value && typeof value === "object" && !Array.isArray(value)) {
          check(value, prefix ? `${prefix}.${key}` : key);
        }
      }
    };
    check(this);
    return fields;
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for database update.
   */
  toPrismaUpdate(): Record<string, any> {
    const updateData: Record<string, any> = {};

    // Direct fields
    if (this.email !== undefined) updateData.email = this.email;
    if (this.phone !== undefined) updateData.phone = this.phone;
    if (this.displayName !== undefined)
      updateData.displayName = this.displayName;
    if (this.bio !== undefined) updateData.bio = this.bio;
    if (this.status !== undefined) updateData.status = this.status;
    if (this.accountStatus !== undefined)
      updateData.accountStatus = this.accountStatus;
    if (this.isActive !== undefined) updateData.isActive = this.isActive;
    if (this.isVerified !== undefined) updateData.isVerified = this.isVerified;
    if (this.isAdmin !== undefined) updateData.isAdmin = this.isAdmin;
    if (this.roles !== undefined) updateData.roles = this.roles;
    if (this.permissions !== undefined)
      updateData.permissions = this.permissions;
    if (this.metadata !== undefined) updateData.metadata = this.metadata;

    // Password
    if (this.password) {
      // Password will be hashed by the service, but we store the raw password
      updateData.password = this.password;
    }

    // 2FA
    if (this.enable2fa !== undefined) {
      updateData.enable2fa = this.enable2fa;
    }
    if (this.disable2fa !== undefined) {
      updateData.disable2fa = this.disable2fa;
    }
    if (this.twoFactorCode !== undefined) {
      updateData.twoFactorCode = this.twoFactorCode;
    }

    // Profile (nested)
    if (this.profile) {
      const profileUpdate: any = {};
      if (this.profile.bio !== undefined) profileUpdate.bio = this.profile.bio;
      if (this.profile.status !== undefined)
        profileUpdate.status = this.profile.status;
      if (this.profile.avatarUrl !== undefined)
        profileUpdate.avatarUrl = this.profile.avatarUrl;
      if (this.profile.avatarThumb !== undefined)
        profileUpdate.avatarThumb = this.profile.avatarThumb;
      if (this.profile.coverPhoto !== undefined)
        profileUpdate.coverPhoto = this.profile.coverPhoto;
      if (this.profile.location !== undefined)
        profileUpdate.location = this.profile.location;
      if (this.profile.latitude !== undefined)
        profileUpdate.latitude = this.profile.latitude;
      if (this.profile.longitude !== undefined)
        profileUpdate.longitude = this.profile.longitude;
      if (this.profile.website !== undefined)
        profileUpdate.website = this.profile.website;
      if (this.profile.businessEmail !== undefined)
        profileUpdate.businessEmail = this.profile.businessEmail;
      if (this.profile.birthday !== undefined)
        profileUpdate.birthday = this.profile.birthday
          ? new Date(this.profile.birthday)
          : null;
      if (this.profile.gender !== undefined)
        profileUpdate.gender = this.profile.gender;
      if (this.profile.relationshipStatus !== undefined)
        profileUpdate.relationshipStatus = this.profile.relationshipStatus;
      if (this.profile.language !== undefined)
        profileUpdate.language = this.profile.language;
      if (this.profile.timezone !== undefined)
        profileUpdate.timezone = this.profile.timezone;
      if (this.profile.countryCode !== undefined)
        profileUpdate.countryCode = this.profile.countryCode;
      if (this.profile.region !== undefined)
        profileUpdate.region = this.profile.region;

      if (Object.keys(profileUpdate).length > 0) {
        updateData.profile = { update: profileUpdate };
      }
    }

    // Social links (nested)
    if (this.socialLinks) {
      const socialUpdate: any = {};
      if (this.socialLinks.facebook !== undefined)
        socialUpdate.facebook = this.socialLinks.facebook;
      if (this.socialLinks.twitter !== undefined)
        socialUpdate.twitter = this.socialLinks.twitter;
      if (this.socialLinks.instagram !== undefined)
        socialUpdate.instagram = this.socialLinks.instagram;
      if (this.socialLinks.linkedin !== undefined)
        socialUpdate.linkedin = this.socialLinks.linkedin;
      if (this.socialLinks.github !== undefined)
        socialUpdate.github = this.socialLinks.github;
      if (this.socialLinks.youtube !== undefined)
        socialUpdate.youtube = this.socialLinks.youtube;
      if (this.socialLinks.tiktok !== undefined)
        socialUpdate.tiktok = this.socialLinks.tiktok;
      if (this.socialLinks.discord !== undefined)
        socialUpdate.discord = this.socialLinks.discord;
      if (this.socialLinks.telegram !== undefined)
        socialUpdate.telegram = this.socialLinks.telegram;
      if (this.socialLinks.whatsapp !== undefined)
        socialUpdate.whatsapp = this.socialLinks.whatsapp;

      if (Object.keys(socialUpdate).length > 0) {
        updateData.socialLinks = socialUpdate;
      }
    }

    // Settings (nested)
    if (this.settings) {
      const settingsUpdate: any = {};

      // Notifications
      if (this.settings.notifications) {
        const notifUpdate: any = {};
        if (this.settings.notifications.messages !== undefined)
          notifUpdate.messages = this.settings.notifications.messages;
        if (this.settings.notifications.groups !== undefined)
          notifUpdate.groups = this.settings.notifications.groups;
        if (this.settings.notifications.calls !== undefined)
          notifUpdate.calls = this.settings.notifications.calls;
        if (this.settings.notifications.mentions !== undefined)
          notifUpdate.mentions = this.settings.notifications.mentions;
        if (this.settings.notifications.reactions !== undefined)
          notifUpdate.reactions = this.settings.notifications.reactions;
        if (this.settings.notifications.sounds !== undefined)
          notifUpdate.sounds = this.settings.notifications.sounds;
        if (this.settings.notifications.vibrations !== undefined)
          notifUpdate.vibrations = this.settings.notifications.vibrations;
        if (this.settings.notifications.pushEnabled !== undefined)
          notifUpdate.pushEnabled = this.settings.notifications.pushEnabled;
        if (Object.keys(notifUpdate).length > 0) {
          settingsUpdate.notifications = notifUpdate;
        }
      }

      // Privacy
      if (this.settings.privacy) {
        const privacyUpdate: any = {};
        if (this.settings.privacy.lastSeen !== undefined)
          privacyUpdate.lastSeen = this.settings.privacy.lastSeen;
        if (this.settings.privacy.profilePhoto !== undefined)
          privacyUpdate.profilePhoto = this.settings.privacy.profilePhoto;
        if (this.settings.privacy.status !== undefined)
          privacyUpdate.status = this.settings.privacy.status;
        if (this.settings.privacy.readReceipts !== undefined)
          privacyUpdate.readReceipts = this.settings.privacy.readReceipts;
        if (this.settings.privacy.typingIndicators !== undefined)
          privacyUpdate.typingIndicators =
            this.settings.privacy.typingIndicators;
        if (this.settings.privacy.onlineStatus !== undefined)
          privacyUpdate.onlineStatus = this.settings.privacy.onlineStatus;
        if (Object.keys(privacyUpdate).length > 0) {
          settingsUpdate.privacy = privacyUpdate;
        }
      }

      // Direct settings
      if (this.settings.theme !== undefined)
        settingsUpdate.theme = this.settings.theme;
      if (this.settings.language !== undefined)
        settingsUpdate.language = this.settings.language;
      if (this.settings.timezone !== undefined)
        settingsUpdate.timezone = this.settings.timezone;
      if (this.settings.fontSize !== undefined)
        settingsUpdate.fontSize = this.settings.fontSize;
      if (this.settings.chatBackground !== undefined)
        settingsUpdate.chatBackground = this.settings.chatBackground;

      if (Object.keys(settingsUpdate).length > 0) {
        updateData.settings = settingsUpdate;
      }
    }

    // Device info (nested)
    if (this.deviceInfo) {
      const deviceUpdate: any = {};
      if (this.deviceInfo.deviceName !== undefined)
        deviceUpdate.deviceName = this.deviceInfo.deviceName;
      if (this.deviceInfo.deviceId !== undefined)
        deviceUpdate.deviceId = this.deviceInfo.deviceId;
      if (this.deviceInfo.deviceType !== undefined)
        deviceUpdate.deviceType = this.deviceInfo.deviceType;
      if (this.deviceInfo.os !== undefined)
        deviceUpdate.os = this.deviceInfo.os;
      if (this.deviceInfo.browser !== undefined)
        deviceUpdate.browser = this.deviceInfo.browser;
      if (this.deviceInfo.browserVersion !== undefined)
        deviceUpdate.browserVersion = this.deviceInfo.browserVersion;
      if (this.deviceInfo.pushToken !== undefined)
        deviceUpdate.pushToken = this.deviceInfo.pushToken;

      if (Object.keys(deviceUpdate).length > 0) {
        updateData.deviceInfo = deviceUpdate;
      }
    }

    return updateData;
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<UpdateUserDto> {
    return {
      email: this.email,
      phone: this.phone,
      displayName: this.displayName,
      bio: this.bio,
      status: this.status,
      profile: this.profile,
      socialLinks: this.socialLinks,
      settings: this.settings,
      deviceInfo: this.deviceInfo,
    };
  }

  /**
   * Create a test update DTO with default values.
   */
  static createTestUpdate(
    overrides: Partial<UpdateUserDto> = {},
  ): UpdateUserDto {
    return new UpdateUserDto({
      displayName: `Updated Test User ${Date.now()}`,
      bio: "Updated test bio",
      status: "Updated status",
      profile: {
        bio: "Updated test bio from profile",
        status: "Testing update",
        location: "Updated Location",
        language: "fr",
        timezone: "Europe/Paris",
      },
      socialLinks: {
        github: "https://github.com/updated-testuser",
        twitter: "https://twitter.com/updated-testuser",
      },
      settings: {
        notifications: {
          messages: false,
          groups: false,
          calls: true,
        },
        privacy: {
          lastSeen: "none",
          readReceipts: false,
        },
        theme: "dark",
        language: "fr",
        fontSize: "large",
      },
      ...overrides,
    });
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): UpdateUserDto {
    return plainToClass(UpdateUserDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
