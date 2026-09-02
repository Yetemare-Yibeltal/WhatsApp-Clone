// backend/src/modules/users/entities/user-profile.entity.ts
import {
  IsString,
  IsOptional,
  IsDate,
  IsUrl,
  IsEmail,
  IsEnum,
  IsBoolean,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
  IsInt,
  IsNumber,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { Exclude, Expose } from "class-transformer";

// -------- ENUMS --------

export enum ProfileVisibility {
  PUBLIC = "public",
  CONTACTS = "contacts",
  PRIVATE = "private",
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

// -------- INTERFACES --------

export interface ProfilePrivacySettings {
  bio: ProfileVisibility;
  status: ProfileVisibility;
  avatar: ProfileVisibility;
  coverPhoto: ProfileVisibility;
  location: ProfileVisibility;
  website: ProfileVisibility;
  birthday: ProfileVisibility;
  gender: ProfileVisibility;
  relationshipStatus: ProfileVisibility;
  phoneNumber: ProfileVisibility;
  email: ProfileVisibility;
  lastSeen: ProfileVisibility;
  onlineStatus: ProfileVisibility;
}

export interface ProfileSocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  snapchat?: string;
  github?: string;
  discord?: string;
  telegram?: string;
  whatsapp?: string;
  signal?: string;
  website?: string;
  blog?: string;
  portfolio?: string;
}

export interface ProfileWorkInfo {
  title?: string;
  company?: string;
  industry?: string;
  experience?: string;
  skills?: string[];
  education?: {
    school: string;
    degree: string;
    field?: string;
    startDate?: Date;
    endDate?: Date;
    current?: boolean;
  }[];
  certifications?: {
    name: string;
    issuer: string;
    date?: Date;
    expiry?: Date;
    credentialId?: string;
    url?: string;
  }[];
  languages?: {
    language: string;
    proficiency: "basic" | "intermediate" | "fluent" | "native";
  }[];
}

export interface ProfileInterests {
  hobbies?: string[];
  sports?: string[];
  music?: string[];
  movies?: string[];
  books?: string[];
  travel?: string[];
  food?: string[];
  pets?: string[];
  gaming?: string[];
  art?: string[];
  photography?: string[];
  fitness?: string[];
  fashion?: string[];
  tech?: string[];
  nature?: string[];
  spirituality?: string[];
  volunteering?: string[];
  learning?: string[];
  other?: string[];
}

export interface ProfileCustomFields {
  [key: string]: any;
}

// -------- MAIN ENTITY --------

/**
 * User Profile Entity representing extended user information.
 * This is a domain entity that extends the base User entity.
 */
export class UserProfileEntity {
  // -------- PRIMARY IDENTIFIERS --------
  @IsUUID()
  @Expose()
  id: string;

  @IsUUID()
  @Expose()
  userId: string;

  // -------- BASIC PROFILE --------
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Bio cannot exceed 500 characters" })
  @Expose()
  bio: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Status cannot exceed 100 characters" })
  @Expose()
  status: string | null;

  // -------- AVATAR --------
  @IsOptional()
  @IsUrl({}, { message: "Invalid avatar URL format" })
  @Expose()
  avatarUrl: string | null;

  @IsOptional()
  @IsUrl({}, { message: "Invalid thumbnail URL format" })
  @Expose()
  avatarThumb: string | null;

  @IsOptional()
  @IsUrl({}, { message: "Invalid cover photo URL format" })
  @Expose()
  coverPhoto: string | null;

  @IsOptional()
  @IsUrl({}, { message: "Invalid cover photo thumbnail URL format" })
  @Expose()
  coverPhotoThumb: string | null;

  // -------- LOCATION --------
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Location cannot exceed 100 characters" })
  @Expose()
  location: string | null;

  @IsOptional()
  @IsNumber()
  @Expose()
  latitude: number | null;

  @IsOptional()
  @IsNumber()
  @Expose()
  longitude: number | null;

  // -------- CONTACT --------
  @IsOptional()
  @IsUrl({}, { message: "Invalid website URL format" })
  @Expose()
  website: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  businessEmail: string | null;

  // -------- PERSONAL --------
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  birthday: Date | null;

  @IsOptional()
  @IsEnum(Gender)
  @Expose()
  gender: Gender | null;

  @IsOptional()
  @IsEnum(RelationshipStatus)
  @Expose()
  relationshipStatus: RelationshipStatus | null;

  // -------- LANGUAGE & REGION --------
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: "Language code cannot exceed 10 characters" })
  @Expose()
  language: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Timezone cannot exceed 50 characters" })
  @Expose()
  timezone: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: "Country code cannot exceed 10 characters" })
  @Expose()
  countryCode: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Region cannot exceed 100 characters" })
  @Expose()
  region: string | null;

  // -------- SOCIAL LINKS --------
  @IsOptional()
  @IsObject()
  @Expose()
  socialLinks: ProfileSocialLinks | null;

  // -------- WORK & EDUCATION --------
  @IsOptional()
  @IsObject()
  @Expose()
  workInfo: ProfileWorkInfo | null;

  // -------- INTERESTS --------
  @IsOptional()
  @IsObject()
  @Expose()
  interests: ProfileInterests | null;

  // -------- PRIVACY SETTINGS --------
  @IsOptional()
  @IsObject()
  @Expose()
  privacySettings: ProfilePrivacySettings | null;

  // -------- CUSTOM FIELDS --------
  @IsOptional()
  @IsObject()
  @Expose()
  customFields: ProfileCustomFields | null;

  // -------- METADATA --------
  @IsOptional()
  @IsObject()
  @Expose()
  metadata: Record<string, any> | null;

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
  lastUpdated: Date | null;

  @IsOptional()
  @IsDate()
  @Expose()
  avatarUpdatedAt: Date | null;

  @IsOptional()
  @IsDate()
  @Expose()
  coverPhotoUpdatedAt: Date | null;

  // -------- COMPLETENESS --------
  @IsOptional()
  @IsInt()
  @Expose()
  completenessScore: number;

  @IsOptional()
  @IsEnum(ProfileCompletenessLevel)
  @Expose()
  completenessLevel: ProfileCompletenessLevel;

  // -------- CONSTRUCTOR --------
  constructor(partial: Partial<UserProfileEntity> = {}) {
    Object.assign(this, partial);
    // Initialize default values
    if (!this.privacySettings) {
      this.privacySettings = this.getDefaultPrivacySettings();
    }
    if (!this.metadata) {
      this.metadata = {};
    }
    if (this.completenessScore === undefined) {
      this.completenessScore = 0;
    }
    if (!this.completenessLevel) {
      this.completenessLevel = ProfileCompletenessLevel.INCOMPLETE;
    }
  }

  // -------- DOMAIN LOGIC --------

  /**
   * Check if the profile has a bio.
   */
  hasBio(): boolean {
    return !!this.bio && this.bio.trim().length > 0;
  }

  /**
   * Check if the profile has a status.
   */
  hasStatus(): boolean {
    return !!this.status && this.status.trim().length > 0;
  }

  /**
   * Check if the profile has an avatar.
   */
  hasAvatar(): boolean {
    return !!this.avatarUrl;
  }

  /**
   * Check if the profile has a cover photo.
   */
  hasCoverPhoto(): boolean {
    return !!this.coverPhoto;
  }

  /**
   * Check if the profile has a location.
   */
  hasLocation(): boolean {
    return !!this.location || (!!this.latitude && !!this.longitude);
  }

  /**
   * Check if the profile has social links.
   */
  hasSocialLinks(): boolean {
    if (!this.socialLinks) return false;
    return Object.values(this.socialLinks).some((value) => !!value);
  }

  /**
   * Check if the profile has work information.
   */
  hasWorkInfo(): boolean {
    return (
      !!this.workInfo &&
      (!!this.workInfo.title ||
        !!this.workInfo.company ||
        !!this.workInfo.skills ||
        (this.workInfo.education && this.workInfo.education.length > 0))
    );
  }

  /**
   * Check if the profile has interests.
   */
  hasInterests(): boolean {
    if (!this.interests) return false;
    return Object.values(this.interests).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }

  /**
   * Get the user's full profile as a formatted string.
   */
  getFormattedProfile(): string {
    const parts: string[] = [];

    if (this.bio) parts.push(`📝 Bio: ${this.bio}`);
    if (this.status) parts.push(`📌 Status: ${this.status}`);
    if (this.location) parts.push(`📍 Location: ${this.location}`);
    if (this.website) parts.push(`🌐 Website: ${this.website}`);
    if (this.businessEmail)
      parts.push(`📧 Business Email: ${this.businessEmail}`);
    if (this.birthday)
      parts.push(`🎂 Birthday: ${this.birthday.toLocaleDateString()}`);
    if (this.gender) parts.push(`⚥ Gender: ${this.gender}`);
    if (this.relationshipStatus)
      parts.push(`💕 Status: ${this.relationshipStatus}`);
    if (this.language) parts.push(`🌍 Language: ${this.language}`);
    if (this.timezone) parts.push(`🕐 Timezone: ${this.timezone}`);
    if (this.countryCode) parts.push(`🏳️ Country: ${this.countryCode}`);
    if (this.region) parts.push(`🏘️ Region: ${this.region}`);

    // Social links
    if (this.socialLinks) {
      const activeLinks = Object.entries(this.socialLinks)
        .filter(([_, url]) => url)
        .map(([platform, url]) => `🔗 ${platform}: ${url}`);
      if (activeLinks.length > 0) {
        parts.push(...activeLinks);
      }
    }

    // Work info
    if (this.workInfo) {
      if (this.workInfo.title && this.workInfo.company) {
        parts.push(`💼 ${this.workInfo.title} at ${this.workInfo.company}`);
      } else if (this.workInfo.title) {
        parts.push(`💼 ${this.workInfo.title}`);
      } else if (this.workInfo.company) {
        parts.push(`💼 Works at ${this.workInfo.company}`);
      }
      if (this.workInfo.skills && this.workInfo.skills.length > 0) {
        parts.push(`🛠️ Skills: ${this.workInfo.skills.join(", ")}`);
      }
      if (this.workInfo.education && this.workInfo.education.length > 0) {
        const edu = this.workInfo.education[0];
        if (edu.school && edu.degree) {
          parts.push(`🎓 ${edu.degree} at ${edu.school}`);
        }
      }
      if (this.workInfo.languages && this.workInfo.languages.length > 0) {
        const langs = this.workInfo.languages
          .map((l) => `${l.language} (${l.proficiency})`)
          .join(", ");
        parts.push(`🗣️ Languages: ${langs}`);
      }
    }

    // Interests
    if (this.interests) {
      const interestLabels: Record<string, string> = {
        hobbies: "🎯 Hobbies",
        sports: "⚽ Sports",
        music: "🎵 Music",
        movies: "🎬 Movies",
        books: "📚 Books",
        travel: "✈️ Travel",
        food: "🍜 Food",
        pets: "🐾 Pets",
        gaming: "🎮 Gaming",
        art: "🎨 Art",
        photography: "📸 Photography",
        fitness: "💪 Fitness",
        fashion: "👗 Fashion",
        tech: "💻 Tech",
        nature: "🌿 Nature",
        spirituality: "🧘 Spirituality",
        volunteering: "🤝 Volunteering",
        learning: "📖 Learning",
        other: "📌 Other",
      };

      for (const [key, label] of Object.entries(interestLabels)) {
        const value = (this.interests as any)[key];
        if (Array.isArray(value) && value.length > 0) {
          parts.push(`${label}: ${value.join(", ")}`);
        }
      }
    }

    return parts.join("\n");
  }

  /**
   * Get the user's avatar URL with a fallback.
   */
  getAvatarUrl(fallback: string = ""): string {
    return this.avatarUrl || fallback;
  }

  /**
   * Get the user's avatar thumbnail URL with a fallback.
   */
  getAvatarThumb(fallback: string = ""): string {
    return this.avatarThumb || this.avatarUrl || fallback;
  }

  /**
   * Get the user's cover photo URL with a fallback.
   */
  getCoverPhoto(fallback: string = ""): string {
    return this.coverPhoto || fallback;
  }

  /**
   * Get the user's cover photo thumbnail URL with a fallback.
   */
  getCoverPhotoThumb(fallback: string = ""): string {
    return this.coverPhotoThumb || this.coverPhoto || fallback;
  }

  /**
   * Get the user's full name or display name from the profile.
   * If not available, returns the username or email.
   */
  getDisplayName(): string {
    // If the profile has a name field, return it
    // We'll use the user's display name from the user entity
    // This should be set by the user entity
    return this.metadata?.displayName || "User";
  }

  /**
   * Get the user's initials (for avatar fallback).
   */
  getInitials(): string {
    const name = this.getDisplayName();
    if (!name || name === "User") return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  /**
   * Get the user's age based on birthday.
   */
  getAge(): number | null {
    if (!this.birthday) return null;
    const now = new Date();
    const diff = now.getTime() - this.birthday.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  /**
   * Get the user's age in years and months.
   */
  getAgeFormatted(): string | null {
    const age = this.getAge();
    if (!age) return null;

    const now = new Date();
    const months =
      (now.getFullYear() - this.birthday!.getFullYear()) * 12 +
      (now.getMonth() - this.birthday!.getMonth());

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
   * Check if the profile is public.
   */
  isPublic(): boolean {
    return (
      !!this.privacySettings &&
      Object.values(this.privacySettings).every(
        (v) => v === ProfileVisibility.PUBLIC,
      )
    );
  }

  /**
   * Check if a specific field is visible to the viewer.
   */
  isFieldVisible(
    field: keyof ProfilePrivacySettings,
    viewerRelation: "self" | "contact" | "public",
  ): boolean {
    if (!this.privacySettings) return true;
    const visibility = this.privacySettings[field] || ProfileVisibility.PUBLIC;

    if (viewerRelation === "self") return true;
    if (visibility === ProfileVisibility.PUBLIC) return true;
    if (
      visibility === ProfileVisibility.CONTACTS &&
      viewerRelation === "contact"
    )
      return true;
    return false;
  }

  /**
   * Get visible fields for a given viewer.
   */
  getVisibleFields(
    viewerRelation: "self" | "contact" | "public",
  ): Partial<UserProfileEntity> {
    const visible: Partial<UserProfileEntity> = {};

    const fields: (keyof ProfilePrivacySettings)[] = [
      "bio",
      "status",
      "avatar",
      "coverPhoto",
      "location",
      "website",
      "birthday",
      "gender",
      "relationshipStatus",
      "phoneNumber",
      "email",
      "lastSeen",
      "onlineStatus",
    ];

    // Map privacy fields to entity properties
    const fieldMap: Record<
      keyof ProfilePrivacySettings,
      keyof UserProfileEntity
    > = {
      bio: "bio",
      status: "status",
      avatar: "avatarUrl",
      coverPhoto: "coverPhoto",
      location: "location",
      website: "website",
      birthday: "birthday",
      gender: "gender",
      relationshipStatus: "relationshipStatus",
      phoneNumber: "phoneNumber",
      email: "businessEmail",
      lastSeen: "lastSeen",
      onlineStatus: "onlineStatus",
    };

    for (const field of fields) {
      const entityField = fieldMap[field];
      if (this.isFieldVisible(field, viewerRelation)) {
        (visible as any)[entityField] = (this as any)[entityField];
      }
    }

    // Always include public fields
    visible.id = this.id;
    visible.userId = this.userId;
    visible.createdAt = this.createdAt;
    visible.updatedAt = this.updatedAt;

    return visible;
  }

  /**
   * Get the default privacy settings.
   */
  getDefaultPrivacySettings(): ProfilePrivacySettings {
    return {
      bio: ProfileVisibility.PUBLIC,
      status: ProfileVisibility.PUBLIC,
      avatar: ProfileVisibility.PUBLIC,
      coverPhoto: ProfileVisibility.PUBLIC,
      location: ProfileVisibility.CONTACTS,
      website: ProfileVisibility.PUBLIC,
      birthday: ProfileVisibility.CONTACTS,
      gender: ProfileVisibility.CONTACTS,
      relationshipStatus: ProfileVisibility.CONTACTS,
      phoneNumber: ProfileVisibility.CONTACTS,
      email: ProfileVisibility.CONTACTS,
      lastSeen: ProfileVisibility.CONTACTS,
      onlineStatus: ProfileVisibility.CONTACTS,
    };
  }

  /**
   * Update the privacy settings.
   */
  updatePrivacySettings(settings: Partial<ProfilePrivacySettings>): void {
    this.privacySettings = {
      ...this.privacySettings,
      ...settings,
    };
    this.updatedAt = new Date();
  }

  /**
   * Calculate the profile completeness score (0-100).
   */
  calculateCompleteness(): {
    score: number;
    level: ProfileCompletenessLevel;
    missing: string[];
  } {
    const fields: { name: string; weight: number; hasValue: () => boolean }[] =
      [
        { name: "bio", weight: 10, hasValue: () => this.hasBio() },
        { name: "status", weight: 5, hasValue: () => this.hasStatus() },
        { name: "avatar", weight: 15, hasValue: () => this.hasAvatar() },
        { name: "coverPhoto", weight: 5, hasValue: () => this.hasCoverPhoto() },
        { name: "location", weight: 5, hasValue: () => this.hasLocation() },
        { name: "website", weight: 5, hasValue: () => !!this.website },
        {
          name: "businessEmail",
          weight: 5,
          hasValue: () => !!this.businessEmail,
        },
        { name: "birthday", weight: 5, hasValue: () => !!this.birthday },
        { name: "gender", weight: 5, hasValue: () => !!this.gender },
        {
          name: "relationshipStatus",
          weight: 5,
          hasValue: () => !!this.relationshipStatus,
        },
        { name: "language", weight: 5, hasValue: () => !!this.language },
        { name: "timezone", weight: 5, hasValue: () => !!this.timezone },
        {
          name: "socialLinks",
          weight: 10,
          hasValue: () => this.hasSocialLinks(),
        },
        { name: "workInfo", weight: 10, hasValue: () => this.hasWorkInfo() },
        { name: "interests", weight: 10, hasValue: () => this.hasInterests() },
      ];

    let totalWeight = 0;
    let earnedWeight = 0;
    const missing: string[] = [];

    for (const field of fields) {
      totalWeight += field.weight;
      if (field.hasValue()) {
        earnedWeight += field.weight;
      } else {
        missing.push(field.name);
      }
    }

    const score = Math.round((earnedWeight / totalWeight) * 100);
    let level: ProfileCompletenessLevel;

    if (score >= 90) level = ProfileCompletenessLevel.FULL;
    else if (score >= 70) level = ProfileCompletenessLevel.COMPLETE;
    else if (score >= 40) level = ProfileCompletenessLevel.PARTIAL;
    else level = ProfileCompletenessLevel.INCOMPLETE;

    return { score, level, missing };
  }

  /**
   * Update the completeness score and level.
   */
  updateCompleteness(): void {
    const { score, level } = this.calculateCompleteness();
    this.completenessScore = score;
    this.completenessLevel = level;
    this.updatedAt = new Date();
  }

  /**
   * Get the next fields to fill for better completeness.
   */
  getNextFieldsToFill(): string[] {
    const { missing } = this.calculateCompleteness();
    return missing;
  }

  /**
   * Update the bio.
   */
  updateBio(bio: string): void {
    this.bio = bio.trim();
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Update the status.
   */
  updateStatus(status: string): void {
    this.status = status.trim();
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Update the avatar.
   */
  updateAvatar(url: string, thumb?: string): void {
    this.avatarUrl = url;
    this.avatarThumb = thumb || url;
    this.avatarUpdatedAt = new Date();
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Remove the avatar.
   */
  removeAvatar(): void {
    this.avatarUrl = null;
    this.avatarThumb = null;
    this.avatarUpdatedAt = new Date();
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Update the cover photo.
   */
  updateCoverPhoto(url: string, thumb?: string): void {
    this.coverPhoto = url;
    this.coverPhotoThumb = thumb || url;
    this.coverPhotoUpdatedAt = new Date();
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Remove the cover photo.
   */
  removeCoverPhoto(): void {
    this.coverPhoto = null;
    this.coverPhotoThumb = null;
    this.coverPhotoUpdatedAt = new Date();
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Update social links.
   */
  updateSocialLinks(links: Partial<ProfileSocialLinks>): void {
    this.socialLinks = {
      ...this.socialLinks,
      ...links,
    };
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Update work information.
   */
  updateWorkInfo(workInfo: Partial<ProfileWorkInfo>): void {
    this.workInfo = {
      ...this.workInfo,
      ...workInfo,
    };
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Update interests.
   */
  updateInterests(interests: Partial<ProfileInterests>): void {
    this.interests = {
      ...this.interests,
      ...interests,
    };
    this.updatedAt = new Date();
    this.updateCompleteness();
  }

  /**
   * Add a custom field.
   */
  addCustomField(key: string, value: any): void {
    if (!this.customFields) this.customFields = {};
    this.customFields[key] = value;
    this.updatedAt = new Date();
  }

  /**
   * Remove a custom field.
   */
  removeCustomField(key: string): void {
    if (this.customFields) {
      delete this.customFields[key];
    }
    this.updatedAt = new Date();
  }

  /**
   * Get a custom field.
   */
  getCustomField<T = any>(key: string): T | undefined {
    if (!this.customFields) return undefined;
    return this.customFields[key] as T;
  }

  // -------- SERIALIZATION --------

  /**
   * Serialize the profile for API responses.
   */
  toResponse(): Partial<UserProfileEntity> {
    return {
      id: this.id,
      userId: this.userId,
      bio: this.bio,
      status: this.status,
      avatarUrl: this.avatarUrl,
      avatarThumb: this.avatarThumb,
      coverPhoto: this.coverPhoto,
      coverPhotoThumb: this.coverPhotoThumb,
      location: this.location,
      latitude: this.latitude,
      longitude: this.longitude,
      website: this.website,
      businessEmail: this.businessEmail,
      birthday: this.birthday,
      gender: this.gender,
      relationshipStatus: this.relationshipStatus,
      language: this.language,
      timezone: this.timezone,
      countryCode: this.countryCode,
      region: this.region,
      socialLinks: this.socialLinks,
      workInfo: this.workInfo,
      interests: this.interests,
      privacySettings: this.privacySettings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastUpdated: this.lastUpdated,
      avatarUpdatedAt: this.avatarUpdatedAt,
      coverPhotoUpdatedAt: this.coverPhotoUpdatedAt,
      completenessScore: this.completenessScore,
      completenessLevel: this.completenessLevel,
    };
  }

  /**
   * Serialize the profile for public viewing (limited fields).
   */
  toPublicResponse(): Partial<UserProfileEntity> {
    return {
      id: this.id,
      userId: this.userId,
      bio: this.bio,
      status: this.status,
      avatarUrl: this.avatarUrl,
      avatarThumb: this.avatarThumb,
      coverPhoto: this.coverPhoto,
      coverPhotoThumb: this.coverPhotoThumb,
      location: this.location,
      website: this.website,
      language: this.language,
      countryCode: this.countryCode,
      region: this.region,
      createdAt: this.createdAt,
    };
  }

  /**
   * Serialize the profile for contacts (medium detail).
   */
  toContactResponse(): Partial<UserProfileEntity> {
    return {
      id: this.id,
      userId: this.userId,
      bio: this.bio,
      status: this.status,
      avatarUrl: this.avatarUrl,
      avatarThumb: this.avatarThumb,
      coverPhoto: this.coverPhoto,
      location: this.location,
      website: this.website,
      language: this.language,
      countryCode: this.countryCode,
      region: this.region,
      socialLinks: this.socialLinks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completenessScore: this.completenessScore,
      completenessLevel: this.completenessLevel,
    };
  }

  /**
   * Serialize the profile for admin (full detail).
   */
  toAdminResponse(): Partial<UserProfileEntity> {
    return {
      ...this.toResponse(),
      metadata: this.metadata,
      customFields: this.customFields,
    };
  }

  /**
   * Create a safe copy of the profile without sensitive data.
   */
  toSafeCopy(): UserProfileEntity {
    const safe = new UserProfileEntity({ ...this });
    // Remove any sensitive data if needed
    return safe;
  }

  // -------- STATIC HELPERS --------

  /**
   * Create a new profile with default values.
   */
  static createNew(userId: string): UserProfileEntity {
    const profile = new UserProfileEntity();
    profile.id = crypto.randomUUID
      ? crypto.randomUUID()
      : `prof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    profile.userId = userId;
    profile.bio = null;
    profile.status = null;
    profile.avatarUrl = null;
    profile.avatarThumb = null;
    profile.coverPhoto = null;
    profile.coverPhotoThumb = null;
    profile.location = null;
    profile.latitude = null;
    profile.longitude = null;
    profile.website = null;
    profile.businessEmail = null;
    profile.birthday = null;
    profile.gender = null;
    profile.relationshipStatus = null;
    profile.language = "en";
    profile.timezone = "UTC";
    profile.countryCode = null;
    profile.region = null;
    profile.socialLinks = {};
    profile.workInfo = {};
    profile.interests = {};
    profile.privacySettings = profile.getDefaultPrivacySettings();
    profile.customFields = {};
    profile.metadata = {};
    profile.createdAt = new Date();
    profile.updatedAt = new Date();
    profile.lastUpdated = new Date();
    profile.avatarUpdatedAt = null;
    profile.coverPhotoUpdatedAt = null;
    profile.completenessScore = 0;
    profile.completenessLevel = ProfileCompletenessLevel.INCOMPLETE;
    return profile;
  }

  /**
   * Validate that the profile entity is valid.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.userId) {
      errors.push("User ID is required");
    }

    if (this.bio && this.bio.length > 500) {
      errors.push("Bio cannot exceed 500 characters");
    }

    if (this.status && this.status.length > 100) {
      errors.push("Status cannot exceed 100 characters");
    }

    if (this.avatarUrl && !this.isValidUrl(this.avatarUrl)) {
      errors.push("Avatar URL is invalid");
    }

    if (this.coverPhoto && !this.isValidUrl(this.coverPhoto)) {
      errors.push("Cover photo URL is invalid");
    }

    if (this.website && !this.isValidUrl(this.website)) {
      errors.push("Website URL is invalid");
    }

    if (this.businessEmail && !this.isValidEmail(this.businessEmail)) {
      errors.push("Business email is invalid");
    }

    if (
      this.latitude !== null &&
      this.latitude !== undefined &&
      (this.latitude < -90 || this.latitude > 90)
    ) {
      errors.push("Latitude must be between -90 and 90");
    }

    if (
      this.longitude !== null &&
      this.longitude !== undefined &&
      (this.longitude < -180 || this.longitude > 180)
    ) {
      errors.push("Longitude must be between -180 and 180");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a profile from a Prisma user profile object.
   */
  static fromPrisma(prismaProfile: any): UserProfileEntity {
    return new UserProfileEntity({
      id: prismaProfile.id,
      userId: prismaProfile.userId,
      bio: prismaProfile.bio || null,
      status: prismaProfile.status || null,
      avatarUrl: prismaProfile.avatarUrl || null,
      avatarThumb: prismaProfile.avatarThumb || null,
      coverPhoto: prismaProfile.coverPhoto || null,
      coverPhotoThumb: prismaProfile.coverPhotoThumb || null,
      location: prismaProfile.location || null,
      latitude: prismaProfile.latitude || null,
      longitude: prismaProfile.longitude || null,
      website: prismaProfile.website || null,
      businessEmail: prismaProfile.businessEmail || null,
      birthday: prismaProfile.birthday || null,
      gender: prismaProfile.gender || null,
      relationshipStatus: prismaProfile.relationshipStatus || null,
      language: prismaProfile.language || "en",
      timezone: prismaProfile.timezone || "UTC",
      countryCode: prismaProfile.countryCode || null,
      region: prismaProfile.region || null,
      socialLinks: prismaProfile.socialLinks || {},
      workInfo: prismaProfile.workInfo || {},
      interests: prismaProfile.interests || {},
      privacySettings: prismaProfile.privacySettings || null,
      customFields: prismaProfile.customFields || null,
      metadata: prismaProfile.metadata || null,
      createdAt: prismaProfile.createdAt,
      updatedAt: prismaProfile.updatedAt,
      lastUpdated: prismaProfile.lastUpdated || null,
      avatarUpdatedAt: prismaProfile.avatarUpdatedAt || null,
      coverPhotoUpdatedAt: prismaProfile.coverPhotoUpdatedAt || null,
      completenessScore: prismaProfile.completenessScore || 0,
      completenessLevel:
        prismaProfile.completenessLevel || ProfileCompletenessLevel.INCOMPLETE,
    });
  }

  // -------- PRIVATE HELPERS --------

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // -------- END --------
}

// -------- END --------
