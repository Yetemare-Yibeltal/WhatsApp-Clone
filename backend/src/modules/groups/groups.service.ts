// backend/src/modules/groups/groups.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SlugifyUtil } from "../../common/utils/slugify.util";
import { SYSTEM_EVENTS, BUSINESS_EVENTS } from "../../common/constants/events";
import { GroupRole, UserRole } from "../../common/constants/roles";
import { UserEntity } from "../users/entities/user.entity";

// -------- INTERFACES --------

export interface CreateGroupOptions {
  name: string;
  description?: string;
  avatarUrl?: string;
  privacy: "public" | "private" | "secret";
  creatorId: string;
  memberIds?: string[];
  isEncrypted?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateGroupOptions {
  name?: string;
  description?: string;
  avatarUrl?: string;
  privacy?: "public" | "private" | "secret";
  isEncrypted?: boolean;
  metadata?: Record<string, any>;
}

export interface AddMemberOptions {
  groupId: string;
  userId: string;
  addedBy: string;
  role?: GroupRole;
}

export interface RemoveMemberOptions {
  groupId: string;
  userId: string;
  removedBy: string;
  reason?: string;
}

export interface PromoteDemoteOptions {
  groupId: string;
  userId: string;
  performedBy: string;
}

export interface InviteOptions {
  groupId: string;
  createdBy: string;
  expiresIn?: number; // seconds
  maxUses?: number;
  isOneTime?: boolean;
}

export interface GroupFilterOptions {
  search?: string;
  privacy?: "public" | "private" | "secret";
  isEncrypted?: boolean;
  memberId?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "updatedAt" | "name" | "memberCount";
  orderDirection?: "asc" | "desc";
}

// -------- MAIN SERVICE --------

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);
  private readonly cachePrefix = "group:";
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    private readonly usersService: UsersService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.cacheTtl = this.configService.get<number>("GROUP_CACHE_TTL") || 300; // 5 minutes default
    this.logger.log("GroupsService initialized");
  }

  // -------- CREATE GROUP --------

  /**
   * Create a new group.
   */
  async createGroup(options: CreateGroupOptions): Promise<any> {
    this.logger.debug(
      `Creating group "${options.name}" by user: ${options.creatorId}`,
    );

    // Validate creator exists
    const creator = await this.usersService.findUserById(options.creatorId);
    if (!creator) {
      throw new NotFoundException(
        `Creator user with ID "${options.creatorId}" not found`,
      );
    }

    // Sanitize group name
    const sanitizedName = SanitizeUtil.sanitizeInput(options.name, {
      trim: true,
      escapeHtml: true,
      removeXss: true,
      maxLength: 100,
    });

    // Generate slug from name
    const slug = SlugifyUtil.slugify(sanitizedName, { maxLength: 80 });

    // Check if group with same slug exists
    const existingGroup = await this.prisma.group.findFirst({
      where: { slug },
    });
    if (existingGroup) {
      throw new ConflictException(
        `Group with name "${sanitizedName}" already exists`,
      );
    }

    // Prepare members list (include creator as admin)
    const memberIds = [...(options.memberIds || [])];
    if (!memberIds.includes(options.creatorId)) {
      memberIds.push(options.creatorId);
    }

    // Validate all members exist
    for (const memberId of memberIds) {
      const user = await this.usersService.findUserById(memberId);
      if (!user) {
        throw new NotFoundException(`User with ID "${memberId}" not found`);
      }
    }

    // Create group in transaction
    const group = await this.prisma.$transaction(async (tx) => {
      // Create the group
      const newGroup = await tx.group.create({
        data: {
          name: sanitizedName,
          slug,
          description: options.description || null,
          avatarUrl: options.avatarUrl || null,
          privacy: options.privacy || "public",
          isEncrypted: options.isEncrypted || false,
          createdBy: options.creatorId,
          metadata: options.metadata || null,
        },
      });

      // Add members
      const memberData = memberIds.map((userId, index) => ({
        groupId: newGroup.id,
        userId,
        role: userId === options.creatorId ? GroupRole.OWNER : GroupRole.MEMBER,
        joinedAt: new Date(),
      }));

      await tx.groupMember.createMany({
        data: memberData,
      });

      // Create initial chat for the group
      await tx.chat.create({
        data: {
          id: newGroup.id, // Use group ID as chat ID
          isGroup: true,
          name: sanitizedName,
          avatarUrl: options.avatarUrl || null,
          groupId: newGroup.id,
        },
      });

      return newGroup;
    });

    // Cache the group
    await this.cacheGroup(group.id);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_CREATE, {
      groupId: group.id,
      name: group.name,
      createdBy: options.creatorId,
      memberCount: memberIds.length,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_CREATED, {
      groupId: group.id,
      name: group.name,
      createdBy: options.creatorId,
      members: memberIds,
      timestamp: new Date(),
    });

    this.logger.log(`Group created: ${group.name} (ID: ${group.id})`);

    return this.getGroupWithDetails(group.id);
  }

  // -------- GET GROUP --------

  /**
   * Get a group by ID with full details.
   */
  async getGroupWithDetails(groupId: string): Promise<any> {
    // Check cache first
    const cached = await this.getCachedGroup(groupId);
    if (cached) return cached;

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        invites: true,
        chat: true,
        creator: {
          include: { profile: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found`);
    }

    // Calculate member count
    const memberCount = group.members.length;

    // Format response
    const result = {
      ...group,
      memberCount,
    };

    // Cache the result
    await this.cacheGroup(groupId, result);

    return result;
  }

  /**
   * Get a group by ID (basic info).
   */
  async getGroupById(groupId: string): Promise<any> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found`);
    }

    return group;
  }

  /**
   * Get groups with filtering and pagination.
   */
  async getGroups(options: GroupFilterOptions = {}): Promise<{
    groups: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      search,
      privacy,
      isEncrypted,
      memberId,
      createdBy,
      page = 1,
      limit = 20,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (privacy) {
      where.privacy = privacy;
    }

    if (isEncrypted !== undefined) {
      where.isEncrypted = isEncrypted;
    }

    if (memberId) {
      where.members = {
        some: { userId: memberId },
      };
    }

    if (createdBy) {
      where.createdBy = createdBy;
    }

    // Execute query
    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: {
          members: {
            select: {
              userId: true,
              role: true,
              joinedAt: true,
            },
          },
          creator: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: { avatarUrl: true },
              },
            },
          },
        },
      }),
      this.prisma.group.count({ where }),
    ]);

    // Format groups with member counts
    const formattedGroups = groups.map((group) => ({
      ...group,
      memberCount: group.members.length,
    }));

    return {
      groups: formattedGroups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get groups a user is a member of.
   */
  async getUserGroups(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    groups: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Get group memberships
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      skip,
      take: limit,
      include: {
        group: {
          include: {
            creator: {
              select: {
                id: true,
                displayName: true,
                profile: {
                  select: { avatarUrl: true },
                },
              },
            },
            members: {
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const total = await this.prisma.groupMember.count({
      where: { userId },
    });

    const groups = memberships.map((membership) => ({
      ...membership.group,
      memberCount: membership.group.members.length,
      role: membership.role,
      joinedAt: membership.joinedAt,
    }));

    return {
      groups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // -------- UPDATE GROUP --------

  /**
   * Update a group's settings.
   */
  async updateGroup(
    groupId: string,
    userId: string,
    options: UpdateGroupOptions,
  ): Promise<any> {
    this.logger.debug(`Updating group ${groupId} by user: ${userId}`);

    // Check if user is a member and has admin/owner role
    await this.validateGroupAccess(groupId, userId, ["ADMIN", "OWNER"]);

    // Sanitize name if provided
    let sanitizedName: string | undefined;
    if (options.name) {
      sanitizedName = SanitizeUtil.sanitizeInput(options.name, {
        trim: true,
        escapeHtml: true,
        removeXss: true,
        maxLength: 100,
      });
    }

    // Update group
    const updateData: any = {};

    if (sanitizedName) {
      updateData.name = sanitizedName;
      updateData.slug = SlugifyUtil.slugify(sanitizedName, { maxLength: 80 });
    }

    if (options.description !== undefined) {
      updateData.description = options.description
        ? SanitizeUtil.sanitizeInput(options.description, {
            trim: true,
            escapeHtml: true,
            removeXss: true,
            maxLength: 500,
          })
        : null;
    }

    if (options.avatarUrl !== undefined) {
      updateData.avatarUrl = options.avatarUrl || null;
    }

    if (options.privacy) {
      updateData.privacy = options.privacy;
    }

    if (options.isEncrypted !== undefined) {
      updateData.isEncrypted = options.isEncrypted;
    }

    if (options.metadata) {
      updateData.metadata = options.metadata;
    }

    const updatedGroup = await this.prisma.group.update({
      where: { id: groupId },
      data: updateData,
    });

    // Update chat name if changed
    if (sanitizedName) {
      await this.prisma.chat.update({
        where: { id: groupId },
        data: { name: sanitizedName },
      });
    }

    // Clear cache
    await this.clearGroupCache(groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_UPDATE, {
      groupId,
      updatedBy: userId,
      updates: Object.keys(updateData),
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_UPDATED, {
      groupId,
      name: updatedGroup.name,
      updatedBy: userId,
      timestamp: new Date(),
    });

    this.logger.log(`Group updated: ${updatedGroup.name} (ID: ${groupId})`);

    return this.getGroupWithDetails(groupId);
  }

  // -------- DELETE GROUP --------

  /**
   * Delete a group (soft delete).
   */
  async deleteGroup(
    groupId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Deleting group ${groupId} by user: ${userId}`);

    // Check if user is owner or admin
    await this.validateGroupAccess(groupId, userId, ["OWNER", "ADMIN"]);

    // Soft delete group
    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Also soft delete chat
    await this.prisma.chat.update({
      where: { id: groupId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Remove members (or keep them for history)
    // We'll soft delete memberships or keep them

    // Clear cache
    await this.clearGroupCache(groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_DELETE, {
      groupId,
      deletedBy: userId,
      reason,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_DELETED, {
      groupId,
      deletedBy: userId,
      reason,
      timestamp: new Date(),
    });

    this.logger.log(`Group deleted: ${groupId}`);

    return {
      success: true,
      message: `Group ${groupId} deleted successfully`,
    };
  }

  /**
   * Restore a deleted group.
   */
  async restoreGroup(groupId: string, userId: string): Promise<any> {
    this.logger.debug(`Restoring group ${groupId} by user: ${userId}`);

    // Check if user is admin or has permission
    // For restoration, only system admin or owner can restore
    const user = await this.usersService.findUserById(userId);
    if (!user || !user.isAdmin) {
      throw new ForbiddenException("Only administrators can restore groups");
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found`);
    }

    if (!group.deletedAt) {
      throw new BadRequestException("Group is not deleted");
    }

    // Restore group
    const restoredGroup = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        deletedAt: null,
      },
    });

    // Restore chat
    await this.prisma.chat.update({
      where: { id: groupId },
      data: {
        deletedAt: null,
      },
    });

    // Clear cache
    await this.clearGroupCache(groupId);

    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_UPDATE, {
      groupId,
      updatedBy: userId,
      updates: ["restored"],
      timestamp: new Date(),
    });

    this.logger.log(`Group restored: ${groupId}`);

    return this.getGroupWithDetails(groupId);
  }

  // -------- MEMBER MANAGEMENT --------

  /**
   * Add a member to a group.
   */
  async addMember(options: AddMemberOptions): Promise<any> {
    this.logger.debug(
      `Adding user ${options.userId} to group ${options.groupId} by ${options.addedBy}`,
    );

    // Check if adding user has permission (admin or owner)
    await this.validateGroupAccess(options.groupId, options.addedBy, [
      "ADMIN",
      "OWNER",
    ]);

    // Check if user exists
    const user = await this.usersService.findUserById(options.userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${options.userId}" not found`);
    }

    // Check if user is already a member
    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException(`User is already a member of the group`);
    }

    // Check group capacity (optional)
    const memberCount = await this.prisma.groupMember.count({
      where: { groupId: options.groupId },
    });
    const maxMembers =
      this.configService.get<number>("GROUP_MAX_MEMBERS") || 1000;
    if (memberCount >= maxMembers) {
      throw new BadRequestException(
        `Group has reached maximum capacity of ${maxMembers} members`,
      );
    }

    // Add member
    const member = await this.prisma.groupMember.create({
      data: {
        groupId: options.groupId,
        userId: options.userId,
        role: options.role || GroupRole.MEMBER,
        joinedAt: new Date(),
      },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    // Clear cache
    await this.clearGroupCache(options.groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_MEMBER_ADD, {
      groupId: options.groupId,
      userId: options.userId,
      addedBy: options.addedBy,
      role: member.role,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_MEMBER_ADDED, {
      groupId: options.groupId,
      userId: options.userId,
      addedBy: options.addedBy,
      timestamp: new Date(),
    });

    this.logger.log(`User ${options.userId} added to group ${options.groupId}`);

    return member;
  }

  /**
   * Remove a member from a group.
   */
  async removeMember(
    options: RemoveMemberOptions,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(
      `Removing user ${options.userId} from group ${options.groupId} by ${options.removedBy}`,
    );

    // Check if removing user has permission (admin or owner, or self)
    const isSelf = options.userId === options.removedBy;
    if (!isSelf) {
      await this.validateGroupAccess(options.groupId, options.removedBy, [
        "ADMIN",
        "OWNER",
      ]);
    }

    // Check if member exists
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`User is not a member of the group`);
    }

    // Prevent removing the owner if they are the only owner
    if (member.role === GroupRole.OWNER) {
      const ownerCount = await this.prisma.groupMember.count({
        where: {
          groupId: options.groupId,
          role: GroupRole.OWNER,
        },
      });

      if (ownerCount <= 1 && !isSelf) {
        throw new BadRequestException(
          "Cannot remove the only owner of the group",
        );
      }

      // If self-removing as owner, we need to transfer ownership
      if (isSelf) {
        // Find another admin or member to transfer ownership to
        const nextAdmin = await this.prisma.groupMember.findFirst({
          where: {
            groupId: options.groupId,
            role: { in: [GroupRole.ADMIN, GroupRole.MEMBER] },
            userId: { not: options.userId },
          },
        });

        if (nextAdmin) {
          await this.prisma.groupMember.update({
            where: {
              groupId_userId: {
                groupId: options.groupId,
                userId: nextAdmin.userId,
              },
            },
            data: { role: GroupRole.OWNER },
          });
        } else {
          // If no other member, we need to block self-removal
          throw new BadRequestException(
            "Cannot leave group as the only member",
          );
        }
      }
    }

    // Remove member
    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
    });

    // Clear cache
    await this.clearGroupCache(options.groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_MEMBER_REMOVE, {
      groupId: options.groupId,
      userId: options.userId,
      removedBy: options.removedBy,
      reason: options.reason,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_MEMBER_REMOVED, {
      groupId: options.groupId,
      userId: options.userId,
      removedBy: options.removedBy,
      timestamp: new Date(),
    });

    this.logger.log(
      `User ${options.userId} removed from group ${options.groupId}`,
    );

    return {
      success: true,
      message: `User ${options.userId} removed from group`,
    };
  }

  /**
   * Promote a member to admin.
   */
  async promoteMember(options: PromoteDemoteOptions): Promise<any> {
    this.logger.debug(
      `Promoting user ${options.userId} in group ${options.groupId} by ${options.performedBy}`,
    );

    // Check if performer is owner
    await this.validateGroupAccess(options.groupId, options.performedBy, [
      "OWNER",
    ]);

    // Check if target is a member
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`User is not a member of the group`);
    }

    if (member.role === GroupRole.OWNER) {
      throw new BadRequestException("Cannot promote an owner");
    }

    if (member.role === GroupRole.ADMIN) {
      throw new BadRequestException("User is already an admin");
    }

    // Promote to admin
    const updatedMember = await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
      data: { role: GroupRole.ADMIN },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    // Clear cache
    await this.clearGroupCache(options.groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_MEMBER_ADD, {
      groupId: options.groupId,
      userId: options.userId,
      promotedBy: options.performedBy,
      newRole: GroupRole.ADMIN,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_ADMIN_PROMOTED, {
      groupId: options.groupId,
      userId: options.userId,
      promotedBy: options.performedBy,
      timestamp: new Date(),
    });

    this.logger.log(
      `User ${options.userId} promoted to admin in group ${options.groupId}`,
    );

    return updatedMember;
  }

  /**
   * Demote an admin to member.
   */
  async demoteMember(options: PromoteDemoteOptions): Promise<any> {
    this.logger.debug(
      `Demoting user ${options.userId} in group ${options.groupId} by ${options.performedBy}`,
    );

    // Check if performer is owner
    await this.validateGroupAccess(options.groupId, options.performedBy, [
      "OWNER",
    ]);

    // Check if target is a member
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`User is not a member of the group`);
    }

    if (member.role === GroupRole.OWNER) {
      throw new BadRequestException("Cannot demote an owner");
    }

    if (member.role === GroupRole.MEMBER) {
      throw new BadRequestException("User is already a member");
    }

    // Demote to member
    const updatedMember = await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId: options.groupId,
          userId: options.userId,
        },
      },
      data: { role: GroupRole.MEMBER },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    // Clear cache
    await this.clearGroupCache(options.groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_MEMBER_REMOVE, {
      groupId: options.groupId,
      userId: options.userId,
      demotedBy: options.performedBy,
      newRole: GroupRole.MEMBER,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_ADMIN_DEMOTED, {
      groupId: options.groupId,
      userId: options.userId,
      demotedBy: options.performedBy,
      timestamp: new Date(),
    });

    this.logger.log(
      `User ${options.userId} demoted to member in group ${options.groupId}`,
    );

    return updatedMember;
  }

  // -------- INVITE MANAGEMENT --------

  /**
   * Generate an invite for a group.
   */
  async generateInvite(options: InviteOptions): Promise<any> {
    this.logger.debug(
      `Generating invite for group ${options.groupId} by ${options.createdBy}`,
    );

    // Check if creator has permission
    await this.validateGroupAccess(options.groupId, options.createdBy, [
      "ADMIN",
      "OWNER",
    ]);

    // Generate unique invite token
    const token = EncryptionUtil.generateRandom(16, "hex");

    const expiresIn = options.expiresIn || 86400; // 24 hours default
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const invite = await this.prisma.groupInvite.create({
      data: {
        groupId: options.groupId,
        token,
        createdBy: options.createdBy,
        expiresAt,
        maxUses: options.maxUses || 1,
        isOneTime: options.isOneTime || false,
        usedCount: 0,
      },
    });

    // Clear cache
    await this.clearGroupCache(options.groupId);

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_INVITE_CREATED, {
      groupId: options.groupId,
      inviteId: invite.id,
      createdBy: options.createdBy,
      expiresAt,
      timestamp: new Date(),
    });

    this.logger.log(`Invite generated for group ${options.groupId}`);

    return invite;
  }

  /**
   * Accept an invite using a token.
   */
  async acceptInvite(
    token: string,
    userId: string,
  ): Promise<{ success: boolean; groupId: string }> {
    this.logger.debug(`Accepting invite with token ${token} by user ${userId}`);

    // Find invite
    const invite = await this.prisma.groupInvite.findUnique({
      where: { token },
      include: { group: true },
    });

    if (!invite) {
      throw new NotFoundException("Invalid invite token");
    }

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException("Invite has expired");
    }

    // Check if max uses exceeded
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException("Invite has reached maximum uses");
    }

    // Check if user is already a member
    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: invite.groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException("User is already a member of the group");
    }

    // Check group capacity
    const memberCount = await this.prisma.groupMember.count({
      where: { groupId: invite.groupId },
    });
    const maxMembers =
      this.configService.get<number>("GROUP_MAX_MEMBERS") || 1000;
    if (memberCount >= maxMembers) {
      throw new BadRequestException(
        `Group has reached maximum capacity of ${maxMembers} members`,
      );
    }

    // Add user to group
    await this.prisma.groupMember.create({
      data: {
        groupId: invite.groupId,
        userId,
        role: GroupRole.MEMBER,
        joinedAt: new Date(),
      },
    });

    // Increment invite use count
    await this.prisma.groupInvite.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    });

    // If one-time use, mark as used
    if (invite.isOneTime) {
      await this.prisma.groupInvite.update({
        where: { id: invite.id },
        data: { expiresAt: new Date() },
      });
    }

    // Clear cache
    await this.clearGroupCache(invite.groupId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.GROUP_JOIN, {
      groupId: invite.groupId,
      userId,
      viaInvite: token,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.GROUP_MEMBER_JOINED, {
      groupId: invite.groupId,
      userId,
      viaInvite: true,
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} joined group ${invite.groupId} via invite`);

    return {
      success: true,
      groupId: invite.groupId,
    };
  }

  /**
   * Reject an invite.
   */
  async rejectInvite(
    token: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Rejecting invite with token ${token} by user ${userId}`);

    const invite = await this.prisma.groupInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      throw new NotFoundException("Invalid invite token");
    }

    // Mark invite as used or delete it
    await this.prisma.groupInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date() },
    });

    this.logger.log(`Invite ${token} rejected by user ${userId}`);

    return {
      success: true,
      message: "Invite rejected successfully",
    };
  }

  /**
   * Get group invites.
   */
  async getGroupInvites(groupId: string, userId: string): Promise<any[]> {
    // Check if user has permission
    await this.validateGroupAccess(groupId, userId, ["ADMIN", "OWNER"]);

    const invites = await this.prisma.groupInvite.findMany({
      where: { groupId },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return invites;
  }

  // -------- GROUP VALIDATION --------

  /**
   * Validate that a user is a member of a group with the required role.
   */
  private async validateGroupAccess(
    groupId: string,
    userId: string,
    allowedRoles: string[] = ["MEMBER", "ADMIN", "OWNER"],
  ): Promise<void> {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException("User is not a member of this group");
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException(
        `User requires one of these roles: ${allowedRoles.join(", ")}`,
      );
    }
  }

  // -------- CACHE HELPERS --------

  private async cacheGroup(groupId: string, data?: any): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}${groupId}`;
      if (data) {
        await this.cacheManager.set(key, data, this.cacheTtl);
      } else {
        const fetched = await this.getGroupWithDetails(groupId);
        await this.cacheManager.set(key, fetched, this.cacheTtl);
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async getCachedGroup(groupId: string): Promise<any | null> {
    if (!this.cacheManager) return null;

    try {
      const key = `${this.cachePrefix}${groupId}`;
      const cached = await this.cacheManager.get(key);
      if (cached) {
        return cached;
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
    return null;
  }

  private async clearGroupCache(groupId: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}${groupId}`;
      await this.cacheManager.del(key);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  // -------- END --------
}
