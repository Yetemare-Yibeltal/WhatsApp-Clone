// backend/src/modules/users/users.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import {
  UserEntity,
  AccountStatus,
  UserVerificationStatus,
} from "./entities/user.entity";
import { UserProfileEntity } from "./entities/user-profile.entity";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { JwtUtil } from "../../common/utils/jwt.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { UserRole } from "../../common/constants/roles";
import { SYSTEM_EVENTS, BUSINESS_EVENTS } from "../../common/constants/events";
import { AppError } from "../../common/constants/errors";

// -------- INTERFACES --------

export interface FindUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isAdmin?: boolean;
  roles?: UserRole[];
  accountStatus?: AccountStatus;
  ids?: string[];
  excludeIds?: string[];
  includeDeleted?: boolean;
  orderBy?: "createdAt" | "updatedAt" | "displayName" | "lastSeen";
  orderDirection?: "asc" | "desc";
}

export interface ContactOptions {
  status?: "pending" | "accepted" | "blocked";
  includeBlocked?: boolean;
  page?: number;
  limit?: number;
}

// -------- MAIN SERVICE --------

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly cachePrefix = "user:";
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtUtil: JwtUtil,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.cacheTtl = this.configService.get<number>("USER_CACHE_TTL") || 300; // 5 minutes default
    this.logger.log("UsersService initialized");
  }

  // -------- CREATE USER --------

  /**
   * Create a new user with all associated data.
   */
  async createUser(createDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.debug(`Creating user with email: ${createDto.email}`);

    // Validate password confirmation
    if (createDto.passwordConfirmation) {
      const validation = createDto.validatePasswordConfirmation();
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join("; "));
      }
    }

    // Check for existing user by email
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: createDto.email.toLowerCase() },
    });
    if (existingByEmail) {
      throw new ConflictException(
        `User with email "${createDto.email}" already exists`,
      );
    }

    // Check for existing user by phone (if provided)
    if (createDto.phone) {
      const existingByPhone = await this.prisma.user.findUnique({
        where: { phone: createDto.phone },
      });
      if (existingByPhone) {
        throw new ConflictException(
          `User with phone "${createDto.phone}" already exists`,
        );
      }
    }

    // Hash the password
    const hashedPassword = await EncryptionUtil.hashPassword(
      createDto.password,
    );

    // Generate email verification token
    const verificationToken = this.jwtUtil.sign(
      { email: createDto.email.toLowerCase(), type: "email_verification" },
      { expiresIn: "24h" },
    );

    // Create user in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: createDto.email.toLowerCase(),
          phone: createDto.phone || null,
          displayName: createDto.displayName || createDto.email.split("@")[0],
          passwordHash: hashedPassword,
          isActive: true,
          isVerified: createDto.autoVerify || false,
          isAdmin: false,
          roles: createDto.initialRole
            ? [createDto.initialRole]
            : [UserRole.USER],
          permissions: [],
          accountStatus: AccountStatus.ACTIVE,
          verificationStatus: createDto.autoVerify
            ? UserVerificationStatus.VERIFIED
            : UserVerificationStatus.PENDING,
          lastSeen: new Date(),
          lastActive: new Date(),
          settings: createDto.settings || {
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
        },
      });

      // Create profile
      const profileData: any = {
        userId: newUser.id,
        bio: createDto.bio || null,
        status: createDto.status || null,
        language: "en",
        timezone: "UTC",
      };

      if (createDto.profile) {
        if (createDto.profile.bio) profileData.bio = createDto.profile.bio;
        if (createDto.profile.status)
          profileData.status = createDto.profile.status;
        if (createDto.profile.avatarUrl)
          profileData.avatarUrl = createDto.profile.avatarUrl;
        if (createDto.profile.location)
          profileData.location = createDto.profile.location;
        if (createDto.profile.website)
          profileData.website = createDto.profile.website;
        if (createDto.profile.businessEmail)
          profileData.businessEmail = createDto.profile.businessEmail;
        if (createDto.profile.birthday)
          profileData.birthday = new Date(createDto.profile.birthday);
        if (createDto.profile.gender)
          profileData.gender = createDto.profile.gender;
        if (createDto.profile.relationshipStatus)
          profileData.relationshipStatus = createDto.profile.relationshipStatus;
        if (createDto.profile.language)
          profileData.language = createDto.profile.language;
        if (createDto.profile.timezone)
          profileData.timezone = createDto.profile.timezone;
        if (createDto.profile.countryCode)
          profileData.countryCode = createDto.profile.countryCode;
        if (createDto.profile.region)
          profileData.region = createDto.profile.region;
      }

      // Social links
      if (createDto.socialLinks) {
        profileData.socialLinks = {
          ...(createDto.socialLinks.facebook && {
            facebook: createDto.socialLinks.facebook,
          }),
          ...(createDto.socialLinks.twitter && {
            twitter: createDto.socialLinks.twitter,
          }),
          ...(createDto.socialLinks.instagram && {
            instagram: createDto.socialLinks.instagram,
          }),
          ...(createDto.socialLinks.linkedin && {
            linkedin: createDto.socialLinks.linkedin,
          }),
          ...(createDto.socialLinks.github && {
            github: createDto.socialLinks.github,
          }),
          ...(createDto.socialLinks.youtube && {
            youtube: createDto.socialLinks.youtube,
          }),
          ...(createDto.socialLinks.tiktok && {
            tiktok: createDto.socialLinks.tiktok,
          }),
          ...(createDto.socialLinks.discord && {
            discord: createDto.socialLinks.discord,
          }),
          ...(createDto.socialLinks.telegram && {
            telegram: createDto.socialLinks.telegram,
          }),
          ...(createDto.socialLinks.whatsapp && {
            whatsapp: createDto.socialLinks.whatsapp,
          }),
        };
      }

      await tx.profile.create({ data: profileData });

      return newUser;
    });

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.USER_CREATE, {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      verificationToken,
      timestamp: new Date(),
    });

    // Cache the user
    await this.cacheUser(user.id);

    this.logger.log(`User created: ${user.email} (ID: ${user.id})`);

    // Return the created user
    return UserResponseDto.fromPrisma(
      await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { profile: true },
      }),
      { includeProfile: true, includeSettings: true },
    );
  }

  // -------- FIND USER(S) --------

  /**
   * Find a user by ID.
   */
  async findUserById(
    id: string,
    options: {
      includeProfile?: boolean;
      includeSettings?: boolean;
      includeDeleted?: boolean;
    } = {},
  ): Promise<UserEntity | null> {
    // Check cache first
    const cached = await this.getCachedUser(id);
    if (cached) return cached;

    const {
      includeProfile = true,
      includeSettings = false,
      includeDeleted = false,
    } = options;

    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: includeDeleted ? undefined : null },
      include: {
        profile: includeProfile,
      },
    });

    if (!user) return null;

    // Convert to entity
    const entity = UserEntity.fromPrisma(user);
    if (includeSettings && user.settings) {
      entity.settings = user.settings;
    }

    // Cache the result
    await this.cacheUser(id, entity);

    return entity;
  }

  /**
   * Find a user by email.
   */
  async findUserByEmail(
    email: string,
    includeDeleted: boolean = false,
  ): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
        deletedAt: includeDeleted ? undefined : null,
      },
      include: { profile: true },
    });

    if (!user) return null;
    return UserEntity.fromPrisma(user);
  }

  /**
   * Find a user by phone.
   */
  async findUserByPhone(
    phone: string,
    includeDeleted: boolean = false,
  ): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { phone, deletedAt: includeDeleted ? undefined : null },
      include: { profile: true },
    });

    if (!user) return null;
    return UserEntity.fromPrisma(user);
  }

  /**
   * Find a user by email or phone.
   */
  async findUserByIdentifier(identifier: string): Promise<UserEntity | null> {
    // Try email first
    let user = await this.findUserByEmail(identifier);
    if (user) return user;

    // Try phone
    return this.findUserByPhone(identifier);
  }

  /**
   * Find multiple users with filters and pagination.
   */
  async findUsers(options: FindUsersOptions = {}): Promise<{
    users: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      isVerified,
      isAdmin,
      roles,
      accountStatus,
      ids,
      excludeIds,
      includeDeleted = false,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: any = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }

    if (isAdmin !== undefined) {
      where.isAdmin = isAdmin;
    }

    if (accountStatus) {
      where.accountStatus = accountStatus;
    }

    if (roles && roles.length > 0) {
      where.roles = { hasSome: roles };
    }

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    }

    if (excludeIds && excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    // Execute query
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: { profile: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userDtos = users.map((user) =>
      UserResponseDto.fromPrisma(user, {
        includeProfile: true,
        includeSettings: false,
      }),
    );

    return {
      users: userDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // -------- UPDATE USER --------

  /**
   * Update a user's information.
   */
  async updateUser(
    id: string,
    updateDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.debug(`Updating user ${id}`);

    // Check if user exists
    const existingUser = await this.findUserById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Validate password confirmation
    if (updateDto.password) {
      const validation = updateDto.validatePasswordConfirmation();
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join("; "));
      }
    }

    // Check email uniqueness if changing
    if (updateDto.email && updateDto.email !== existingUser.email) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: updateDto.email.toLowerCase() },
      });
      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConflictException(
          `Email "${updateDto.email}" is already in use`,
        );
      }
    }

    // Check phone uniqueness if changing
    if (updateDto.phone && updateDto.phone !== existingUser.phone) {
      const existingByPhone = await this.prisma.user.findUnique({
        where: { phone: updateDto.phone },
      });
      if (existingByPhone && existingByPhone.id !== id) {
        throw new ConflictException(
          `Phone "${updateDto.phone}" is already in use`,
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateDto.email) updateData.email = updateDto.email.toLowerCase();
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.displayName) updateData.displayName = updateDto.displayName;
    if (updateDto.isActive !== undefined)
      updateData.isActive = updateDto.isActive;
    if (updateDto.isVerified !== undefined)
      updateData.isVerified = updateDto.isVerified;
    if (updateDto.isAdmin !== undefined) updateData.isAdmin = updateDto.isAdmin;
    if (updateDto.accountStatus)
      updateData.accountStatus = updateDto.accountStatus;
    if (updateDto.roles) updateData.roles = updateDto.roles;
    if (updateDto.permissions) updateData.permissions = updateDto.permissions;
    if (updateDto.metadata) updateData.metadata = updateDto.metadata;

    // Password update
    if (updateDto.password) {
      const hashedPassword = await EncryptionUtil.hashPassword(
        updateDto.password,
      );
      updateData.passwordHash = hashedPassword;
    }

    // 2FA update
    if (
      updateDto.enable2fa !== undefined ||
      updateDto.disable2fa !== undefined
    ) {
      if (updateDto.disable2fa) {
        updateData.is2faEnabled = false;
        updateData.twoFactorSecret = null;
      } else if (updateDto.enable2fa) {
        // 2FA should be enabled through a separate flow
        throw new BadRequestException(
          "2FA should be enabled through the 2FA setup flow",
        );
      }
    }

    // Update user
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      // Update user
      const user = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // Update profile if provided
      if (updateDto.profile) {
        const profileUpdate: any = {};
        if (updateDto.profile.bio !== undefined)
          profileUpdate.bio = updateDto.profile.bio;
        if (updateDto.profile.status !== undefined)
          profileUpdate.status = updateDto.profile.status;
        if (updateDto.profile.avatarUrl !== undefined)
          profileUpdate.avatarUrl = updateDto.profile.avatarUrl;
        if (updateDto.profile.avatarThumb !== undefined)
          profileUpdate.avatarThumb = updateDto.profile.avatarThumb;
        if (updateDto.profile.coverPhoto !== undefined)
          profileUpdate.coverPhoto = updateDto.profile.coverPhoto;
        if (updateDto.profile.location !== undefined)
          profileUpdate.location = updateDto.profile.location;
        if (updateDto.profile.latitude !== undefined)
          profileUpdate.latitude = updateDto.profile.latitude;
        if (updateDto.profile.longitude !== undefined)
          profileUpdate.longitude = updateDto.profile.longitude;
        if (updateDto.profile.website !== undefined)
          profileUpdate.website = updateDto.profile.website;
        if (updateDto.profile.businessEmail !== undefined)
          profileUpdate.businessEmail = updateDto.profile.businessEmail;
        if (updateDto.profile.birthday !== undefined)
          profileUpdate.birthday = updateDto.profile.birthday;
        if (updateDto.profile.gender !== undefined)
          profileUpdate.gender = updateDto.profile.gender;
        if (updateDto.profile.relationshipStatus !== undefined)
          profileUpdate.relationshipStatus =
            updateDto.profile.relationshipStatus;
        if (updateDto.profile.language !== undefined)
          profileUpdate.language = updateDto.profile.language;
        if (updateDto.profile.timezone !== undefined)
          profileUpdate.timezone = updateDto.profile.timezone;
        if (updateDto.profile.countryCode !== undefined)
          profileUpdate.countryCode = updateDto.profile.countryCode;
        if (updateDto.profile.region !== undefined)
          profileUpdate.region = updateDto.profile.region;

        if (Object.keys(profileUpdate).length > 0) {
          await tx.profile.update({
            where: { userId: id },
            data: profileUpdate,
          });
        }
      }

      // Update social links if provided
      if (updateDto.socialLinks) {
        const socialUpdate: any = {};
        if (updateDto.socialLinks.facebook !== undefined)
          socialUpdate.facebook = updateDto.socialLinks.facebook;
        if (updateDto.socialLinks.twitter !== undefined)
          socialUpdate.twitter = updateDto.socialLinks.twitter;
        if (updateDto.socialLinks.instagram !== undefined)
          socialUpdate.instagram = updateDto.socialLinks.instagram;
        if (updateDto.socialLinks.linkedin !== undefined)
          socialUpdate.linkedin = updateDto.socialLinks.linkedin;
        if (updateDto.socialLinks.github !== undefined)
          socialUpdate.github = updateDto.socialLinks.github;
        if (updateDto.socialLinks.youtube !== undefined)
          socialUpdate.youtube = updateDto.socialLinks.youtube;
        if (updateDto.socialLinks.tiktok !== undefined)
          socialUpdate.tiktok = updateDto.socialLinks.tiktok;
        if (updateDto.socialLinks.discord !== undefined)
          socialUpdate.discord = updateDto.socialLinks.discord;
        if (updateDto.socialLinks.telegram !== undefined)
          socialUpdate.telegram = updateDto.socialLinks.telegram;
        if (updateDto.socialLinks.whatsapp !== undefined)
          socialUpdate.whatsapp = updateDto.socialLinks.whatsapp;

        if (Object.keys(socialUpdate).length > 0) {
          await tx.profile.update({
            where: { userId: id },
            data: { socialLinks: socialUpdate },
          });
        }
      }

      // Update settings if provided
      if (updateDto.settings) {
        const currentSettings =
          (
            await tx.user.findUnique({
              where: { id },
              select: { settings: true },
            })
          )?.settings || {};

        const newSettings = {
          ...currentSettings,
          notifications: {
            ...currentSettings?.notifications,
            ...updateDto.settings.notifications,
          },
          privacy: {
            ...currentSettings?.privacy,
            ...updateDto.settings.privacy,
          },
          theme: updateDto.settings.theme || currentSettings?.theme,
          language: updateDto.settings.language || currentSettings?.language,
          timezone: updateDto.settings.timezone || currentSettings?.timezone,
          fontSize: updateDto.settings.fontSize || currentSettings?.fontSize,
          chatBackground:
            updateDto.settings.chatBackground !== undefined
              ? updateDto.settings.chatBackground
              : currentSettings?.chatBackground,
        };

        await tx.user.update({
          where: { id },
          data: { settings: newSettings },
        });
      }

      return tx.user.findUnique({
        where: { id },
        include: { profile: true },
      });
    });

    // Clear cache
    await this.clearUserCache(id);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.USER_UPDATE, {
      userId: id,
      email: updatedUser.email,
      updates: updateDto.getUpdatedFields(),
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.USER_PROFILE_UPDATED, {
      userId: id,
      email: updatedUser.email,
      timestamp: new Date(),
    });

    this.logger.log(`User updated: ${updatedUser.email} (ID: ${id})`);

    return UserResponseDto.fromPrisma(updatedUser, {
      includeProfile: true,
      includeSettings: true,
    });
  }

  /**
   * Update a user's status.
   */
  async updateStatus(
    id: string,
    statusDto: UpdateStatusDto,
  ): Promise<UserEntity> {
    this.logger.debug(`Updating status for user ${id}`);

    // Check if user exists
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Validate the status
    const validation = statusDto.isValid();
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join("; "));
    }

    // Prepare status data
    let statusText: string | null = null;
    let emoji: string | null = null;
    let color: string | null = null;
    let type: string | null = null;
    let category: string | null = null;
    let expiresAt: Date | null = null;

    if (statusDto.clear) {
      // Clear status
      statusText = null;
      emoji = null;
      color = null;
      type = null;
      category = null;
      expiresAt = null;
    } else {
      statusText = statusDto.status;
      emoji = statusDto.emoji || null;
      color = statusDto.color || null;
      type = statusDto.type || "custom";
      category = statusDto.category || null;

      if (statusDto.expiresAt) {
        expiresAt = new Date(statusDto.expiresAt);
      } else if (statusDto.schedule?.endAt) {
        expiresAt = new Date(statusDto.schedule.endAt);
      }

      // Set expiry action in metadata if needed
      if (statusDto.expiryAction) {
        // Store expiry action in metadata for background job processing
        const metadata = statusDto.metadata || {};
        metadata._expiryAction = statusDto.expiryAction;
        metadata._replacementStatus = statusDto.replacementStatus || null;
        statusDto.metadata = metadata;
      }
    }

    // Update user's status fields
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: statusText,
        // Also update profile status if needed
      },
    });

    // Update profile status if needed
    if (statusText !== undefined) {
      await this.prisma.profile.update({
        where: { userId: id },
        data: {
          status: statusText,
          emoji,
          color,
          statusType: type,
          statusCategory: category,
          statusExpiresAt: expiresAt,
          statusMetadata: statusDto.metadata || null,
        },
      });
    }

    // Clear cache
    await this.clearUserCache(id);

    // Emit event
    this.eventEmitter.emit(SYSTEM_EVENTS.USER_UPDATE, {
      userId: id,
      email: updatedUser.email,
      updates: ["status"],
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.USER_STATUS_UPDATED, {
      userId: id,
      email: updatedUser.email,
      status: statusText,
      emoji,
      type,
      timestamp: new Date(),
    });

    this.logger.log(
      `Status updated for user ${id}: ${statusText || "cleared"}`,
    );

    return UserEntity.fromPrisma(
      await this.prisma.user.findUnique({
        where: { id },
        include: { profile: true },
      }),
    );
  }

  // -------- DELETE USER --------

  /**
   * Soft delete a user.
   */
  async deleteUser(
    id: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Deleting user ${id}`);

    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        accountStatus: AccountStatus.DELETED,
        deletedAt: new Date(),
        // Clear sensitive data
        email: `deleted_${id}@deleted.com`,
        phone: null,
        displayName: `Deleted User ${id.slice(0, 8)}`,
      },
    });

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    // Clear cache
    await this.clearUserCache(id);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.USER_DELETE, {
      userId: id,
      email: user.email,
      reason,
      timestamp: new Date(),
    });

    this.logger.log(`User deleted: ${user.email} (ID: ${id})`);

    return {
      success: true,
      message: `User ${id} deleted successfully`,
    };
  }

  /**
   * Restore a soft-deleted user.
   */
  async restoreUser(id: string): Promise<UserResponseDto> {
    this.logger.debug(`Restoring user ${id}`);

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (user.accountStatus !== AccountStatus.DELETED) {
      throw new BadRequestException(
        `User is not deleted (status: ${user.accountStatus})`,
      );
    }

    // Restore user
    const restoredUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        // Restore email if possible
        email: user.email.replace(/^deleted_/, ""),
      },
      include: { profile: true },
    });

    // Clear cache
    await this.clearUserCache(id);

    this.eventEmitter.emit(SYSTEM_EVENTS.USER_UPDATE, {
      userId: id,
      email: restoredUser.email,
      updates: ["restored"],
      timestamp: new Date(),
    });

    this.logger.log(`User restored: ${restoredUser.email} (ID: ${id})`);

    return UserResponseDto.fromPrisma(restoredUser, {
      includeProfile: true,
      includeSettings: true,
    });
  }

  /**
   * Permanently delete a user (hard delete).
   */
  async hardDeleteUser(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.warn(`Hard deleting user ${id}`);

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Delete all related data and user
    await this.prisma.$transaction(async (tx) => {
      // Delete profile
      await tx.profile.delete({ where: { userId: id } });
      // Delete sessions
      await tx.session.deleteMany({ where: { userId: id } });
      // Delete contacts
      await tx.contact.deleteMany({
        where: { OR: [{ userId: id }, { contactId: id }] },
      });
      // Delete user
      await tx.user.delete({ where: { id } });
    });

    // Clear cache
    await this.clearUserCache(id);

    this.eventEmitter.emit(SYSTEM_EVENTS.USER_DELETE, {
      userId: id,
      email: user.email,
      hardDelete: true,
      timestamp: new Date(),
    });

    this.logger.log(`User hard deleted: ${user.email} (ID: ${id})`);

    return {
      success: true,
      message: `User ${id} permanently deleted`,
    };
  }

  // -------- CONTACT MANAGEMENT --------

  /**
   * Add a contact.
   */
  async addContact(
    userId: string,
    contactId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Adding contact ${contactId} for user ${userId}`);

    // Check if users exist
    const [user, contact] = await Promise.all([
      this.findUserById(userId),
      this.findUserById(contactId),
    ]);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (!contact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    // Check if already contacts
    const existing = await this.prisma.contact.findFirst({
      where: {
        userId,
        contactId,
      },
    });

    if (existing) {
      throw new ConflictException("Contact already exists");
    }

    // Check if blocked
    const blocked = await this.prisma.contact.findFirst({
      where: {
        userId,
        contactId,
        status: "blocked",
      },
    });

    if (blocked) {
      throw new BadRequestException("Cannot add blocked contact");
    }

    // Create contact
    await this.prisma.contact.create({
      data: {
        userId,
        contactId,
        status: "pending",
      },
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.CONTACT_ADDED, {
      userId,
      contactId,
      timestamp: new Date(),
    });

    this.logger.log(`Contact added: ${contactId} for user ${userId}`);

    return {
      success: true,
      message: `Contact ${contactId} added successfully`,
    };
  }

  /**
   * Remove a contact.
   */
  async removeContact(
    userId: string,
    contactId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Removing contact ${contactId} for user ${userId}`);

    const contact = await this.prisma.contact.findFirst({
      where: {
        userId,
        contactId,
      },
    });

    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    await this.prisma.contact.delete({
      where: { id: contact.id },
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.CONTACT_REMOVED, {
      userId,
      contactId,
      timestamp: new Date(),
    });

    this.logger.log(`Contact removed: ${contactId} for user ${userId}`);

    return {
      success: true,
      message: `Contact ${contactId} removed successfully`,
    };
  }

  /**
   * Block a contact.
   */
  async blockContact(
    userId: string,
    contactId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Blocking contact ${contactId} for user ${userId}`);

    // Check if contact exists
    let contact = await this.prisma.contact.findFirst({
      where: {
        userId,
        contactId,
      },
    });

    if (!contact) {
      // Create contact with blocked status
      await this.prisma.contact.create({
        data: {
          userId,
          contactId,
          status: "blocked",
        },
      });
    } else {
      // Update to blocked
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { status: "blocked" },
      });
    }

    this.eventEmitter.emit(BUSINESS_EVENTS.CONTACT_BLOCKED, {
      userId,
      contactId,
      timestamp: new Date(),
    });

    this.logger.log(`Contact blocked: ${contactId} for user ${userId}`);

    return {
      success: true,
      message: `Contact ${contactId} blocked successfully`,
    };
  }

  /**
   * Unblock a contact.
   */
  async unblockContact(
    userId: string,
    contactId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Unblocking contact ${contactId} for user ${userId}`);

    const contact = await this.prisma.contact.findFirst({
      where: {
        userId,
        contactId,
        status: "blocked",
      },
    });

    if (!contact) {
      throw new NotFoundException("Blocked contact not found");
    }

    // Unblock (set to pending)
    await this.prisma.contact.update({
      where: { id: contact.id },
      data: { status: "pending" },
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.CONTACT_UNBLOCKED, {
      userId,
      contactId,
      timestamp: new Date(),
    });

    this.logger.log(`Contact unblocked: ${contactId} for user ${userId}`);

    return {
      success: true,
      message: `Contact ${contactId} unblocked successfully`,
    };
  }

  /**
   * Get contacts for a user.
   */
  async getContacts(
    userId: string,
    options: ContactOptions = {},
  ): Promise<{
    contacts: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { status, includeBlocked = false, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    if (!includeBlocked) {
      where.status = { not: "blocked" };
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        include: {
          contact: {
            include: { profile: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.contact.count({ where }),
    ]);

    // Format contacts
    const formattedContacts = contacts.map((contact) => ({
      id: contact.id,
      status: contact.status,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      user: contact.contact
        ? UserResponseDto.fromPrisma(contact.contact, {
            includeProfile: true,
            includeSettings: false,
          })
        : null,
    }));

    return {
      contacts: formattedContacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // -------- ADMIN OPERATIONS --------

  /**
   * Suspend a user.
   */
  async suspendUser(
    id: string,
    reason: string,
    duration?: number,
  ): Promise<UserResponseDto> {
    this.logger.debug(`Suspending user ${id}`);

    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const updateData: any = {
      isActive: false,
      accountStatus: AccountStatus.SUSPENDED,
      suspendedReason: reason,
      suspendedAt: new Date(),
    };

    // Set automatic unsuspend if duration is provided
    if (duration) {
      updateData.suspendedUntil = new Date(Date.now() + duration * 1000);
    }

    const suspendedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { profile: true },
    });

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    // Clear cache
    await this.clearUserCache(id);

    this.eventEmitter.emit(SYSTEM_EVENTS.USER_SUSPEND, {
      userId: id,
      email: user.email,
      reason,
      duration,
      timestamp: new Date(),
    });

    this.logger.log(`User suspended: ${user.email} (ID: ${id})`);

    return UserResponseDto.fromPrisma(suspendedUser, {
      includeProfile: true,
      includeSettings: true,
    });
  }

  /**
   * Unsuspend a user.
   */
  async unsuspendUser(id: string): Promise<UserResponseDto> {
    this.logger.debug(`Unsuspending user ${id}`);

    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (user.accountStatus !== AccountStatus.SUSPENDED) {
      throw new BadRequestException(
        `User is not suspended (status: ${user.accountStatus})`,
      );
    }

    const unsuspendedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        accountStatus: AccountStatus.ACTIVE,
        suspendedReason: null,
        suspendedAt: null,
        suspendedUntil: null,
      },
      include: { profile: true },
    });

    // Clear cache
    await this.clearUserCache(id);

    this.eventEmitter.emit(SYSTEM_EVENTS.USER_UNSUSPEND, {
      userId: id,
      email: user.email,
      timestamp: new Date(),
    });

    this.logger.log(`User unsuspended: ${user.email} (ID: ${id})`);

    return UserResponseDto.fromPrisma(unsuspendedUser, {
      includeProfile: true,
      includeSettings: true,
    });
  }

  /**
   * Ban a user.
   */
  async banUser(id: string, reason: string): Promise<UserResponseDto> {
    this.logger.debug(`Banning user ${id}`);

    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const bannedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        accountStatus: AccountStatus.BANNED,
        suspendedReason: reason,
        suspendedAt: new Date(),
      },
      include: { profile: true },
    });

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    // Clear cache
    await this.clearUserCache(id);

    this.eventEmitter.emit(SYSTEM_EVENTS.USER_SUSPEND, {
      userId: id,
      email: user.email,
      reason,
      banned: true,
      timestamp: new Date(),
    });

    this.logger.log(`User banned: ${user.email} (ID: ${id})`);

    return UserResponseDto.fromPrisma(bannedUser, {
      includeProfile: true,
      includeSettings: true,
    });
  }

  /**
   * Unban a user.
   */
  async unbanUser(id: string): Promise<UserResponseDto> {
    this.logger.debug(`Unbanning user ${id}`);

    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (user.accountStatus !== AccountStatus.BANNED) {
      throw new BadRequestException(
        `User is not banned (status: ${user.accountStatus})`,
      );
    }

    const unbannedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        accountStatus: AccountStatus.ACTIVE,
        suspendedReason: null,
        suspendedAt: null,
        suspendedUntil: null,
      },
      include: { profile: true },
    });

    // Clear cache
    await this.clearUserCache(id);

    this.eventEmitter.emit(SYSTEM_EVENTS.USER_UNSUSPEND, {
      userId: id,
      email: user.email,
      unbanned: true,
      timestamp: new Date(),
    });

    this.logger.log(`User unbanned: ${user.email} (ID: ${id})`);

    return UserResponseDto.fromPrisma(unbannedUser, {
      includeProfile: true,
      includeSettings: true,
    });
  }

  // -------- AUTHENTICATION HELPERS --------

  /**
   * Validate user credentials.
   */
  async validateCredentials(
    identifier: string,
    password: string,
  ): Promise<{ user: UserEntity | null; valid: boolean; reason?: string }> {
    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      return { user: null, valid: false, reason: "User not found" };
    }

    if (!user.isActiveUser()) {
      return {
        user: null,
        valid: false,
        reason: `Account is ${user.accountStatus}`,
      };
    }

    const isValid = await EncryptionUtil.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!isValid) {
      return { user: null, valid: false, reason: "Invalid password" };
    }

    return { user, valid: true };
  }

  /**
   * Update user's last seen timestamp.
   */
  async updateLastSeen(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastSeen: new Date() },
    });
    // Clear cache
    await this.clearUserCache(id);
  }

  /**
   * Update user's last active timestamp.
   */
  async updateLastActive(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastActive: new Date() },
    });
    // Clear cache
    await this.clearUserCache(id);
  }

  // -------- STATISTICS --------

  /**
   * Get user statistics.
   */
  async getUserStats(id: string): Promise<{
    totalMessages: number;
    totalMessagesReceived: number;
    totalGroups: number;
    totalContacts: number;
    totalFiles: number;
    totalCalls: number;
    totalCallsReceived: number;
    totalCallsMissed: number;
    accountAgeDays: number;
  }> {
    // This would aggregate from multiple tables
    // For now, return placeholder values
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Get contacts count
    const totalContacts = await this.prisma.contact.count({
      where: { userId: id, status: { not: "blocked" } },
    });

    // Get groups count (from group memberships)
    const totalGroups = await this.prisma.groupMember.count({
      where: { userId: id },
    });

    // Get messages count (from messages sent)
    const totalMessages = await this.prisma.message.count({
      where: { senderId: id, isDeleted: false },
    });

    // Get calls count (from call participants)
    const totalCalls = await this.prisma.callParticipant.count({
      where: { userId: id },
    });

    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      totalMessages,
      totalMessagesReceived: 0, // Would need separate query
      totalGroups,
      totalContacts,
      totalFiles: 0, // Would need separate query
      totalCalls,
      totalCallsReceived: 0, // Would need separate query
      totalCallsMissed: 0, // Would need separate query
      accountAgeDays,
    };
  }

  // -------- CACHE HELPERS --------

  private async cacheUser(id: string, user?: UserEntity): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}${id}`;
      if (user) {
        await this.cacheManager.set(key, user, this.cacheTtl);
      } else {
        // Fetch and cache
        const fetched = await this.findUserById(id, { includeProfile: true });
        if (fetched) {
          await this.cacheManager.set(key, fetched, this.cacheTtl);
        }
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async getCachedUser(id: string): Promise<UserEntity | null> {
    if (!this.cacheManager) return null;

    try {
      const key = `${this.cachePrefix}${id}`;
      const cached = await this.cacheManager.get<UserEntity>(key);
      if (cached) {
        return cached;
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
    return null;
  }

  private async clearUserCache(id: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}${id}`;
      await this.cacheManager.del(key);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  // -------- END --------
}
