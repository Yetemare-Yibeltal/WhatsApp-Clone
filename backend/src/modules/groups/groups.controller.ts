// backend/src/modules/groups/groups.controller.ts
/**
 * 📄 Groups Controller
 *
 * Exposes REST endpoints for group management including CRUD operations,
 * member management, invites, and group settings.
 *
 * @module GroupsController
 * @category Controllers
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  HttpException,
  Logger,
  ValidationPipe,
  UsePipes,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiProduces,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { GroupsService } from "./groups.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  Roles,
  Permissions,
  Admin,
  UserRole,
  Moderator,
} from "../../common/constants/roles";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { ApiResponseBuilder } from "../../common/types/api-response.interface";
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddMemberDto,
  RemoveMemberDto,
  PromoteDemoteDto,
  GenerateInviteDto,
  AcceptInviteDto,
  GroupFilterDto,
} from "./dto";

// -------- CONTROLLER --------

@ApiTags("Groups")
@ApiBearerAuth()
@Controller("groups")
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  private readonly logger = new Logger(GroupsController.name);

  constructor(private readonly groupsService: GroupsService) {}

  // -------- CREATE GROUP --------

  /**
   * Create a new group.
   */
  @Post()
  @ApiOperation({
    summary: "Create a new group",
    description:
      "Create a new group with the provided information. The creator becomes the owner.",
  })
  @ApiCreatedResponse({
    description: "Group created successfully",
    schema: {
      example: {
        statusCode: 201,
        message: "Group created successfully",
        data: {
          id: "group_abc123",
          name: "My Awesome Group",
          slug: "my-awesome-group",
          description: "A group for awesome people",
          avatarUrl: "https://example.com/avatar.jpg",
          privacy: "public",
          isEncrypted: false,
          createdBy: "user_abc123",
          memberCount: 1,
          createdAt: "2024-01-15T10:30:00Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiConflictResponse({
    description: "Group with this name already exists",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createGroup(
    @Body() createDto: CreateGroupDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Creating group by user: ${currentUser.id}`);

    try {
      const result = await this.groupsService.createGroup({
        name: createDto.name,
        description: createDto.description,
        avatarUrl: createDto.avatarUrl,
        privacy: createDto.privacy || "public",
        creatorId: currentUser.id,
        memberIds: createDto.memberIds,
        isEncrypted: createDto.isEncrypted || false,
        metadata: createDto.metadata,
      });

      return ApiResponseBuilder.success(
        result,
        "Group created successfully",
        HttpStatus.CREATED,
      );
    } catch (error) {
      this.logger.error(`Failed to create group: ${error.message}`);
      throw error;
    }
  }

  // -------- GET GROUPS --------

  /**
   * Get groups with filtering and pagination.
   */
  @Get()
  @ApiOperation({
    summary: "Get groups",
    description: "Get a list of groups with filtering and pagination.",
  })
  @ApiQuery({
    name: "page",
    description: "Page number (1-indexed)",
    type: Number,
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    description: "Number of items per page",
    type: Number,
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: "search",
    description: "Search by group name or description",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "privacy",
    description: "Filter by privacy setting",
    enum: ["public", "private", "secret"],
    required: false,
  })
  @ApiQuery({
    name: "isEncrypted",
    description: "Filter by encryption status",
    type: Boolean,
    required: false,
  })
  @ApiQuery({
    name: "memberId",
    description: "Filter by member user ID",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "createdBy",
    description: "Filter by creator user ID",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "orderBy",
    description: "Sort field",
    enum: ["createdAt", "updatedAt", "name", "memberCount"],
    required: false,
  })
  @ApiQuery({
    name: "orderDirection",
    description: "Sort direction",
    enum: ["asc", "desc"],
    required: false,
  })
  @ApiOkResponse({
    description: "Groups retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Groups retrieved successfully",
        data: {
          groups: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getGroups(
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Query("search") search?: string,
    @Query("privacy") privacy?: "public" | "private" | "secret",
    @Query("isEncrypted") isEncrypted?: boolean,
    @Query("memberId") memberId?: string,
    @Query("createdBy") createdBy?: string,
    @Query("orderBy") orderBy?: string,
    @Query("orderDirection") orderDirection?: "asc" | "desc",
  ) {
    this.logger.debug(`Getting groups - page: ${page}, limit: ${limit}`);

    try {
      const result = await this.groupsService.getGroups({
        page,
        limit,
        search,
        privacy,
        isEncrypted: isEncrypted !== undefined ? isEncrypted : undefined,
        memberId,
        createdBy,
        orderBy: orderBy as any,
        orderDirection: orderDirection || "desc",
      });

      return ApiResponseBuilder.success(
        result,
        "Groups retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get groups: ${error.message}`);
      throw error;
    }
  }

  // -------- GET GROUP BY ID --------

  /**
   * Get a group by ID.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Get group by ID",
    description: "Get detailed information about a group including members.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Group retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Group retrieved successfully",
        data: {
          id: "group_abc123",
          name: "My Awesome Group",
          slug: "my-awesome-group",
          description: "A group for awesome people",
          avatarUrl: "https://example.com/avatar.jpg",
          privacy: "public",
          isEncrypted: false,
          createdBy: "user_abc123",
          memberCount: 5,
          createdAt: "2024-01-15T10:30:00Z",
          members: [],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getGroup(@Param("id", new ParseUUIDPipe()) id: string) {
    this.logger.debug(`Getting group: ${id}`);

    try {
      const result = await this.groupsService.getGroupWithDetails(id);

      return ApiResponseBuilder.success(
        result,
        "Group retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get group: ${error.message}`);
      throw error;
    }
  }

  // -------- UPDATE GROUP --------

  /**
   * Update a group.
   */
  @Patch(":id")
  @ApiOperation({
    summary: "Update group",
    description: "Update group settings. Requires admin or owner role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiBody({
    type: UpdateGroupDto,
    description: "Group update data",
  })
  @ApiOkResponse({
    description: "Group updated successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Group updated successfully",
        data: {
          id: "group_abc123",
          name: "Updated Group Name",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiNotFoundResponse({
    description: "Group not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires admin or owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateGroup(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateGroupDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Updating group ${id} by user: ${currentUser.id}`);

    try {
      const result = await this.groupsService.updateGroup(id, currentUser.id, {
        name: updateDto.name,
        description: updateDto.description,
        avatarUrl: updateDto.avatarUrl,
        privacy: updateDto.privacy,
        isEncrypted: updateDto.isEncrypted,
        metadata: updateDto.metadata,
      });

      return ApiResponseBuilder.success(
        result,
        "Group updated successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to update group: ${error.message}`);
      throw error;
    }
  }

  // -------- DELETE GROUP --------

  /**
   * Delete a group.
   */
  @Delete(":id")
  @ApiOperation({
    summary: "Delete group",
    description: "Delete a group. Requires owner or admin role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiQuery({
    name: "reason",
    description: "Reason for deletion",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "Group deleted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Group deleted successfully",
        data: {
          success: true,
          message: "Group abc123 deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async deleteGroup(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("reason") reason?: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Deleting group ${id} by user: ${currentUser.id}`);

    try {
      const result = await this.groupsService.deleteGroup(
        id,
        currentUser.id,
        reason,
      );

      return ApiResponseBuilder.success(
        result,
        "Group deleted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to delete group: ${error.message}`);
      throw error;
    }
  }

  // -------- RESTORE GROUP --------

  /**
   * Restore a deleted group.
   */
  @Post(":id/restore")
  @Admin()
  @ApiOperation({
    summary: "Restore group",
    description: "Restore a soft-deleted group. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Group restored successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Group restored successfully",
        data: {
          id: "group_abc123",
          name: "My Awesome Group",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group not found",
  })
  @ApiBadRequestResponse({
    description: "Group is not deleted",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async restoreGroup(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Restoring group ${id} by user: ${currentUser.id}`);

    try {
      const result = await this.groupsService.restoreGroup(id, currentUser.id);

      return ApiResponseBuilder.success(
        result,
        "Group restored successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to restore group: ${error.message}`);
      throw error;
    }
  }

  // -------- ADD MEMBER --------

  /**
   * Add a member to a group.
   */
  @Post(":id/members")
  @ApiOperation({
    summary: "Add member to group",
    description: "Add a user to the group. Requires admin or owner role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiBody({
    type: AddMemberDto,
    description: "Member data",
  })
  @ApiOkResponse({
    description: "Member added successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Member added successfully",
        data: {
          userId: "user_abc123",
          role: "MEMBER",
          joinedAt: "2024-01-15T10:30:00Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiConflictResponse({
    description: "User is already a member",
  })
  @ApiNotFoundResponse({
    description: "Group or user not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires admin or owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async addMember(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() addDto: AddMemberDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Adding member ${addDto.userId} to group ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.addMember({
        groupId: id,
        userId: addDto.userId,
        addedBy: currentUser.id,
        role: addDto.role,
      });

      return ApiResponseBuilder.success(
        result,
        "Member added successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to add member: ${error.message}`);
      throw error;
    }
  }

  // -------- REMOVE MEMBER --------

  /**
   * Remove a member from a group.
   */
  @Delete(":id/members/:userId")
  @ApiOperation({
    summary: "Remove member from group",
    description:
      "Remove a user from the group. Requires admin or owner role, or self-removal.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiParam({
    name: "userId",
    description: "User ID to remove",
    example: "user_abc123",
    type: "string",
  })
  @ApiQuery({
    name: "reason",
    description: "Reason for removal",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "Member removed successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Member removed successfully",
        data: {
          success: true,
          message: "User abc123 removed from group",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group or member not found",
  })
  @ApiBadRequestResponse({
    description: "Cannot remove the only owner",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async removeMember(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Query("reason") reason?: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Removing member ${userId} from group ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.removeMember({
        groupId: id,
        userId,
        removedBy: currentUser.id,
        reason,
      });

      return ApiResponseBuilder.success(
        result,
        "Member removed successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to remove member: ${error.message}`);
      throw error;
    }
  }

  // -------- PROMOTE MEMBER --------

  /**
   * Promote a member to admin.
   */
  @Post(":id/members/:userId/promote")
  @ApiOperation({
    summary: "Promote member to admin",
    description: "Promote a member to admin. Requires owner role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiParam({
    name: "userId",
    description: "User ID to promote",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Member promoted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Member promoted successfully",
        data: {
          userId: "user_abc123",
          role: "ADMIN",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group or member not found",
  })
  @ApiBadRequestResponse({
    description: "User is already an admin or owner",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async promoteMember(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Promoting member ${userId} in group ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.promoteMember({
        groupId: id,
        userId,
        performedBy: currentUser.id,
      });

      return ApiResponseBuilder.success(
        result,
        "Member promoted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to promote member: ${error.message}`);
      throw error;
    }
  }

  // -------- DEMOTE MEMBER --------

  /**
   * Demote an admin to member.
   */
  @Post(":id/members/:userId/demote")
  @ApiOperation({
    summary: "Demote admin to member",
    description: "Demote an admin to member. Requires owner role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiParam({
    name: "userId",
    description: "User ID to demote",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Member demoted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Member demoted successfully",
        data: {
          userId: "user_abc123",
          role: "MEMBER",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group or member not found",
  })
  @ApiBadRequestResponse({
    description: "User is not an admin",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async demoteMember(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Demoting member ${userId} in group ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.demoteMember({
        groupId: id,
        userId,
        performedBy: currentUser.id,
      });

      return ApiResponseBuilder.success(
        result,
        "Member demoted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to demote member: ${error.message}`);
      throw error;
    }
  }

  // -------- GENERATE INVITE --------

  /**
   * Generate an invite for a group.
   */
  @Post(":id/invites")
  @ApiOperation({
    summary: "Generate group invite",
    description:
      "Generate an invite link for the group. Requires admin or owner role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiBody({
    type: GenerateInviteDto,
    description: "Invite options",
  })
  @ApiOkResponse({
    description: "Invite generated successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Invite generated successfully",
        data: {
          id: "invite_abc123",
          token: "abc123def456",
          expiresAt: "2024-01-16T10:30:00Z",
          inviteLink: "https://example.com/invite/abc123def456",
          maxUses: 1,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires admin or owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async generateInvite(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() inviteDto: GenerateInviteDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Generating invite for group ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.generateInvite({
        groupId: id,
        createdBy: currentUser.id,
        expiresIn: inviteDto.expiresIn,
        maxUses: inviteDto.maxUses,
        isOneTime: inviteDto.isOneTime,
      });

      // Build invite link
      const baseUrl =
        this.groupsService["configService"].get<string>("FRONTEND_URL") ||
        "https://example.com";
      const inviteLink = `${baseUrl}/invite/${result.token}`;

      return ApiResponseBuilder.success(
        {
          ...result,
          inviteLink,
        },
        "Invite generated successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to generate invite: ${error.message}`);
      throw error;
    }
  }

  // -------- ACCEPT INVITE --------

  /**
   * Accept an invite.
   */
  @Post("invites/accept")
  @ApiOperation({
    summary: "Accept group invite",
    description: "Accept a group invite using an invite token.",
  })
  @ApiBody({
    type: AcceptInviteDto,
    description: "Invite token",
  })
  @ApiOkResponse({
    description: "Invite accepted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Invite accepted successfully",
        data: {
          success: true,
          groupId: "group_abc123",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid or expired invite",
  })
  @ApiConflictResponse({
    description: "User is already a member",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async acceptInvite(
    @Body() acceptDto: AcceptInviteDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Accepting invite with token ${acceptDto.token} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.acceptInvite(
        acceptDto.token,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Invite accepted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to accept invite: ${error.message}`);
      throw error;
    }
  }

  // -------- REJECT INVITE --------

  /**
   * Reject an invite.
   */
  @Post("invites/reject")
  @ApiOperation({
    summary: "Reject group invite",
    description: "Reject a group invite using an invite token.",
  })
  @ApiBody({
    type: AcceptInviteDto,
    description: "Invite token",
  })
  @ApiOkResponse({
    description: "Invite rejected successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Invite rejected successfully",
        data: {
          success: true,
          message: "Invite rejected successfully",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid invite",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async rejectInvite(
    @Body() rejectDto: AcceptInviteDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Rejecting invite with token ${rejectDto.token} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.rejectInvite(
        rejectDto.token,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Invite rejected successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to reject invite: ${error.message}`);
      throw error;
    }
  }

  // -------- GET INVITES --------

  /**
   * Get group invites.
   */
  @Get(":id/invites")
  @ApiOperation({
    summary: "Get group invites",
    description: "Get all invites for a group. Requires admin or owner role.",
  })
  @ApiParam({
    name: "id",
    description: "Group ID",
    example: "group_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Invites retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Invites retrieved successfully",
        data: [],
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Group not found",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Requires admin or owner role",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getInvites(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Getting invites for group ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.groupsService.getGroupInvites(
        id,
        currentUser.id,
      );

      return ApiResponseBuilder.success(
        result,
        "Invites retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get invites: ${error.message}`);
      throw error;
    }
  }

  // -------- USER GROUPS --------

  /**
   * Get groups a user is a member of.
   */
  @Get("user/me")
  @ApiOperation({
    summary: "Get current user groups",
    description: "Get all groups the current user is a member of.",
  })
  @ApiQuery({
    name: "page",
    description: "Page number (1-indexed)",
    type: Number,
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    description: "Number of items per page",
    type: Number,
    required: false,
    example: 20,
  })
  @ApiOkResponse({
    description: "User groups retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "User groups retrieved successfully",
        data: {
          groups: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getUserGroups(
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting groups for user: ${currentUser.id}`);

    try {
      const result = await this.groupsService.getUserGroups(currentUser.id, {
        page,
        limit,
      });

      return ApiResponseBuilder.success(
        result,
        "User groups retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get user groups: ${error.message}`);
      throw error;
    }
  }

  // -------- END --------
}
