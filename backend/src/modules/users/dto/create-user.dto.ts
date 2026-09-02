// backend/src/modules/users/dto/create-user.dto.ts
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
import { IsStrongPassword } from "class-validator";
import { sanitize } from "class-sanitizer";

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

// -------- NESTED DTOs --------

/**
 * Profile data for user creation.
 */
export class CreateProfileDto {
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
    description: "User birthday",
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
 * Social links for user profile.
 */
export class CreateSocialLinksDto {
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
 * Device information for user registration.
 */
export class DeviceInfoDto {
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
    example: "web",
    enum: ["web", "mobile", "desktop"],
  })
  @IsOptional()
  @IsString()
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
    description: "Screen resolution",
    example: "1920x1080",
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim() || null)
  screenResolution?: string | null;

  @ApiPropertyOptional({
    description: "Device language",
    example: "en-US",
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim() || null)
  language?: string | null;

  @ApiPropertyOptional({
    description: "Device timezone",
    example: "America/New_York",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  timezone?: string | null;

  @ApiPropertyOptional({
    description: "Push notification token (FCM/APNs/Web Push)",
    example: "fcm_token_abc123def456",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim() || null)
  pushToken?: string | null;
}

/**
 * User metadata for registration.
 */
export class CreateUserMetadataDto {
  @ApiPropertyOptional({
    description: "User IP address",
    example: "192.168.1.1",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  ipAddress?: string | null;

  @ApiPropertyOptional({
    description: "User agent string",
    example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  userAgent?: string | null;

  @ApiPropertyOptional({
    description: "Referrer URL",
    example: "https://google.com/search?q=whatsapp+clone",
  })
  @IsOptional()
  @IsUrl({}, { message: "Invalid referrer URL format" })
  @Transform(({ value }) => value?.trim() || null)
  referrer?: string | null;

  @ApiPropertyOptional({
    description: "UTM campaign tracking",
    example: "google_ads_campaign_123",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  utmCampaign?: string | null;

  @ApiPropertyOptional({
    description: "UTM source",
    example: "google",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  utmSource?: string | null;

  @ApiPropertyOptional({
    description: "UTM medium",
    example: "cpc",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  utmMedium?: string | null;

  @ApiPropertyOptional({
    description: "UTM term",
    example: "whatsapp+clone",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  utmTerm?: string | null;

  @ApiPropertyOptional({
    description: "UTM content",
    example: "ad_variant_1",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  utmContent?: string | null;

  @ApiPropertyOptional({
    description: "Invite code used for registration",
    example: "INVITE_ABC123",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim().toUpperCase() || null)
  inviteCode?: string | null;

  @ApiPropertyOptional({
    description: "Registration source",
    example: "web",
    enum: ["web", "mobile", "desktop", "email", "invite", "organic"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["web", "mobile", "desktop", "email", "invite", "organic"])
  registrationSource?:
    | "web"
    | "mobile"
    | "desktop"
    | "email"
    | "invite"
    | "organic"
    | null;

  @ApiPropertyOptional({
    description: "Registration channel",
    example: "direct",
    enum: ["direct", "organic", "paid", "social", "referral", "email"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["direct", "organic", "paid", "social", "referral", "email"])
  registrationChannel?:
    | "direct"
    | "organic"
    | "paid"
    | "social"
    | "referral"
    | "email"
    | null;
}

// -------- MAIN DTO --------

/**
 * DTO for creating a new user.
 * Supports both email and phone number as primary identifiers.
 */
export class CreateUserDto {
  // -------- PRIMARY IDENTIFIERS --------
  @ApiProperty({
    description: "User email address (must be unique)",
    example: "john.doe@example.com",
    required: true,
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  @Transform(({ value }) => value?.toLowerCase().trim() || "")
  email: string;

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

  // -------- AUTHENTICATION --------
  @ApiProperty({
    description:
      "User password (minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character)",
    example: "SecureP@ssw0rd",
    minLength: 8,
    maxLength: 128,
    required: true,
  })
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
  @IsNotEmpty({ message: "Password is required" })
  password: string;

  @ApiPropertyOptional({
    description: "Password confirmation (must match password)",
    example: "SecureP@ssw0rd",
    required: false,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.password)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message: "Password confirmation must match the password",
    },
  )
  @Transform(({ value }) => value?.trim() || null)
  passwordConfirmation?: string | null;

  // -------- PROFILE --------
  @ApiProperty({
    description: "Full display name (will appear in chat)",
    example: "John Doe",
    minLength: 2,
    maxLength: 50,
    required: true,
  })
  @IsString()
  @MinLength(2, { message: "Display name must be at least 2 characters" })
  @MaxLength(50, { message: "Display name must be at most 50 characters" })
  @Transform(({ value }) => value?.trim() || "")
  @IsNotEmpty({ message: "Display name is required" })
  displayName: string;

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

  // -------- PROFILE DATA (NESTED) --------
  @ApiPropertyOptional({
    description: "Extended profile data",
    type: CreateProfileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProfileDto)
  profile?: CreateProfileDto;

  @ApiPropertyOptional({
    description: "Social media links",
    type: CreateSocialLinksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSocialLinksDto)
  socialLinks?: CreateSocialLinksDto;

  // -------- DEVICE INFORMATION --------
  @ApiPropertyOptional({
    description: "Device information for session tracking",
    type: DeviceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo?: DeviceInfoDto;

  // -------- METADATA --------
  @ApiPropertyOptional({
    description: "Additional metadata for analytics and tracking",
    type: CreateUserMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateUserMetadataDto)
  metadata?: CreateUserMetadataDto;

  // -------- SETTINGS --------
  @ApiPropertyOptional({
    description: "User settings (JSON object)",
    example: {
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
    },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any> | null;

  // -------- ACCOUNT OPTIONS --------
  @ApiPropertyOptional({
    description: "Initial user role (default is USER)",
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: "Invalid role" })
  initialRole?: UserRole;

  @ApiPropertyOptional({
    description: "Whether to auto-verify the email (skip email verification)",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoVerify?: boolean = false;

  @ApiPropertyOptional({
    description: "Whether to skip sending welcome email",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipWelcomeEmail?: boolean = false;

  @ApiPropertyOptional({
    description: "Whether to enable 2FA immediately",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enable2fa?: boolean = false;

  // -------- FLAGS & VALIDATION --------
  @Exclude({ toPlainOnly: true })
  _skipPhoneValidation: boolean = false;

  @Exclude({ toPlainOnly: true })
  _isTestUser: boolean = false;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<CreateUserDto> = {}) {
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
      // Remove multiple spaces
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
   * Check if the DTO has a password confirmation.
   */
  hasPasswordConfirmation(): boolean {
    return !!this.passwordConfirmation;
  }

  /**
   * Validate that password and password confirmation match.
   */
  validatePasswordConfirmation(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (
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
   * Check if the user provided an email.
   */
  hasEmail(): boolean {
    return !!this.email && this.email.trim().length > 0;
  }

  /**
   * Check if the user provided a phone number.
   */
  hasPhone(): boolean {
    return !!this.phone && this.phone.trim().length > 0;
  }

  /**
   * Check if the user provided a display name.
   */
  hasDisplayName(): boolean {
    return !!this.displayName && this.displayName.trim().length > 0;
  }

  /**
   * Get the display name or fallback to email.
   */
  getDisplayName(fallback: string = "User"): string {
    if (this.hasDisplayName()) {
      return this.displayName;
    }
    if (this.hasEmail()) {
      return this.email.split("@")[0];
    }
    return fallback;
  }

  /**
   * Get the primary identifier (email or phone).
   */
  getPrimaryIdentifier(): string {
    return this.email || this.phone || "";
  }

  /**
   * Check if the DTO has all required fields.
   */
  isComplete(): { complete: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!this.hasEmail() && !this.hasPhone()) {
      missing.push("Either email or phone is required");
    }

    if (!this.hasDisplayName()) {
      missing.push("Display name is required");
    }

    if (!this.password) {
      missing.push("Password is required");
    }

    return {
      complete: missing.length === 0,
      missing,
    };
  }

  /**
   * Get the validation groups for the DTO.
   */
  getValidationGroups(): string[] {
    const groups = ["create"];

    if (this.passwordConfirmation) {
      groups.push("withConfirmation");
    }

    if (this.profile) {
      groups.push("withProfile");
    }

    if (this.socialLinks) {
      groups.push("withSocialLinks");
    }

    if (this.deviceInfo) {
      groups.push("withDeviceInfo");
    }

    if (this.metadata) {
      groups.push("withMetadata");
    }

    return groups;
  }

  /**
   * Get password strength score (0-4).
   */
  getPasswordStrength(): {
    score: number;
    label: "weak" | "medium" | "strong" | "very_strong";
    feedback: string[];
  } {
    if (!this.password) {
      return { score: 0, label: "weak", feedback: ["Password not provided"] };
    }

    let score = 0;
    const feedback: string[] = [];

    // Length
    if (this.password.length >= 8) {
      score++;
    } else {
      feedback.push("Use at least 8 characters");
    }

    // Uppercase
    if (/[A-Z]/.test(this.password)) {
      score++;
    } else {
      feedback.push("Add at least one uppercase letter");
    }

    // Lowercase
    if (/[a-z]/.test(this.password)) {
      score++;
    } else {
      feedback.push("Add at least one lowercase letter");
    }

    // Numbers
    if (/\d/.test(this.password)) {
      score++;
    } else {
      feedback.push("Add at least one number");
    }

    // Special characters
    if (/[@$!%*?&]/.test(this.password)) {
      score++;
    } else {
      feedback.push("Add at least one special character (@$!%*?&)");
    }

    // Additional checks for extra strength
    if (this.password.length >= 12) {
      score++;
    }

    // Check for common patterns
    if (/(password|123456|qwerty)/i.test(this.password)) {
      score = Math.max(0, score - 2);
      feedback.push("Avoid common passwords (password, 123456, qwerty)");
    }

    // Check for repeated characters
    if (/(.)\1{3,}/.test(this.password)) {
      score = Math.max(0, score - 1);
      feedback.push("Avoid repeated characters");
    }

    // Normalize score to 0-4
    score = Math.min(4, Math.floor(score / 2));

    let label: "weak" | "medium" | "strong" | "very_strong";
    if (score <= 1) label = "weak";
    else if (score <= 2) label = "medium";
    else if (score <= 3) label = "strong";
    else label = "very_strong";

    return { score, label, feedback };
  }

  // -------- TRANSFORMATION HELPERS --------

  /**
   * Convert the DTO to a plain object for database insertion.
   */
  toPrismaCreate(): {
    email: string;
    phone: string | null;
    displayName: string;
    passwordHash?: string;
    isActive: boolean;
    isVerified: boolean;
    isAdmin: boolean;
    roles: string[];
    permissions: string[];
    accountStatus: string;
    verificationStatus: string;
    lastSeen: Date;
    lastActive: Date;
    profile: {
      create: any;
    };
  } {
    const base = {
      email: this.email,
      phone: this.phone || null,
      displayName: this.getDisplayName(),
      isActive: true,
      isVerified: this.autoVerify || false,
      isAdmin: false,
      roles: this.initialRole ? [this.initialRole] : [UserRole.USER],
      permissions: [],
      accountStatus: AccountStatus.ACTIVE,
      verificationStatus: this.autoVerify ? "verified" : "pending",
      lastSeen: new Date(),
      lastActive: new Date(),
    };

    // Profile creation
    const profileCreate: any = {
      create: {},
    };

    if (this.profile) {
      if (this.profile.bio) profileCreate.create.bio = this.profile.bio;
      if (this.profile.status)
        profileCreate.create.status = this.profile.status;
      if (this.profile.avatarUrl)
        profileCreate.create.avatarUrl = this.profile.avatarUrl;
      if (this.profile.location)
        profileCreate.create.location = this.profile.location;
      if (this.profile.website)
        profileCreate.create.website = this.profile.website;
      if (this.profile.businessEmail)
        profileCreate.create.businessEmail = this.profile.businessEmail;
      if (this.profile.birthday)
        profileCreate.create.birthday = new Date(this.profile.birthday);
      if (this.profile.gender)
        profileCreate.create.gender = this.profile.gender;
      if (this.profile.relationshipStatus)
        profileCreate.create.relationshipStatus =
          this.profile.relationshipStatus;
      if (this.profile.language)
        profileCreate.create.language = this.profile.language;
      if (this.profile.timezone)
        profileCreate.create.timezone = this.profile.timezone;
      if (this.profile.countryCode)
        profileCreate.create.countryCode = this.profile.countryCode;
      if (this.profile.region)
        profileCreate.create.region = this.profile.region;
    }

    // Social links
    if (this.socialLinks) {
      profileCreate.create.socialLinks = {
        ...(this.socialLinks.facebook && {
          facebook: this.socialLinks.facebook,
        }),
        ...(this.socialLinks.twitter && { twitter: this.socialLinks.twitter }),
        ...(this.socialLinks.instagram && {
          instagram: this.socialLinks.instagram,
        }),
        ...(this.socialLinks.linkedin && {
          linkedin: this.socialLinks.linkedin,
        }),
        ...(this.socialLinks.github && { github: this.socialLinks.github }),
        ...(this.socialLinks.youtube && { youtube: this.socialLinks.youtube }),
        ...(this.socialLinks.tiktok && { tiktok: this.socialLinks.tiktok }),
        ...(this.socialLinks.discord && { discord: this.socialLinks.discord }),
        ...(this.socialLinks.telegram && {
          telegram: this.socialLinks.telegram,
        }),
        ...(this.socialLinks.whatsapp && {
          whatsapp: this.socialLinks.whatsapp,
        }),
      };
    }

    // Settings
    if (this.settings) {
      (base as any).settings = this.settings;
    }

    // Metadata
    if (this.metadata) {
      (base as any).metadata = {};
      if (this.metadata.ipAddress)
        (base as any).metadata.ipAddress = this.metadata.ipAddress;
      if (this.metadata.userAgent)
        (base as any).metadata.userAgent = this.metadata.userAgent;
      if (this.metadata.referrer)
        (base as any).metadata.referrer = this.metadata.referrer;
      if (this.metadata.utmCampaign)
        (base as any).metadata.utmCampaign = this.metadata.utmCampaign;
      if (this.metadata.utmSource)
        (base as any).metadata.utmSource = this.metadata.utmSource;
      if (this.metadata.utmMedium)
        (base as any).metadata.utmMedium = this.metadata.utmMedium;
      if (this.metadata.utmTerm)
        (base as any).metadata.utmTerm = this.metadata.utmTerm;
      if (this.metadata.utmContent)
        (base as any).metadata.utmContent = this.metadata.utmContent;
      if (this.metadata.inviteCode)
        (base as any).metadata.inviteCode = this.metadata.inviteCode;
      if (this.metadata.registrationSource)
        (base as any).metadata.registrationSource =
          this.metadata.registrationSource;
      if (this.metadata.registrationChannel)
        (base as any).metadata.registrationChannel =
          this.metadata.registrationChannel;
    }

    return {
      ...base,
      profile: profileCreate,
    };
  }

  /**
   * Convert the DTO to a plain object for API response.
   */
  toResponse(): Partial<CreateUserDto> {
    return {
      email: this.email,
      phone: this.phone,
      displayName: this.getDisplayName(),
      bio: this.bio,
      status: this.status,
      profile: this.profile,
      socialLinks: this.socialLinks,
      settings: this.settings,
      initialRole: this.initialRole,
      autoVerify: this.autoVerify,
      skipWelcomeEmail: this.skipWelcomeEmail,
    };
  }

  /**
   * Create a test user DTO with default values.
   */
  static createTestUser(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    const timestamp = Date.now();
    const dto = new CreateUserDto({
      email: `test.${timestamp}@example.com`,
      phone: `+1555${String(timestamp).slice(-7)}`,
      displayName: `Test User ${timestamp}`,
      password: "TestP@ssw0rd123!",
      passwordConfirmation: "TestP@ssw0rd123!",
      bio: "This is a test user account",
      status: "Testing",
      profile: {
        bio: "Test bio",
        status: "Testing",
        location: "Test Location",
        language: "en",
        timezone: "UTC",
        countryCode: "US",
      },
      socialLinks: {
        github: "https://github.com/testuser",
        twitter: "https://twitter.com/testuser",
      },
      deviceInfo: {
        deviceName: "Test Device",
        deviceType: "web",
        os: "Windows 10",
        browser: "Chrome",
      },
      metadata: {
        ipAddress: "127.0.0.1",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        registrationSource: "web",
        registrationChannel: "direct",
        inviteCode: "TEST_INVITE_123",
      },
      settings: {
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
      },
      initialRole: UserRole.USER,
      autoVerify: true,
      skipWelcomeEmail: true,
      ...overrides,
    });

    // Mark as test user
    dto._isTestUser = true;

    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): CreateUserDto {
    return plainToClass(CreateUserDto, obj, {
      enableImplicitConversion: true,
    });
  }

  // -------- END --------
}
