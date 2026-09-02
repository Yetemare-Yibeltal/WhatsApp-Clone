// backend/src/modules/users/users.controller.ts
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
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  Roles,
  Permissions,
  Public,
  UserRole,
  PermissionChecker,
  Admin,
  SuperAdmin,
} from "../../common/constants/roles";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { ApiResponseBuilder } from "../../common/types/api-response.interface";
import { APP_CONSTANTS } from "../../common/constants";

// -------- CONTROLLER --------

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // -------- CREATE USER --------

  /**
   * Create a new user.
   * This endpoint is public (registration).
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new user",
    description:
      "Register a new user account. This endpoint is publicly accessible.",
  })
  @ApiCreatedResponse({
    description: "User created successfully",
    type: UserResponseDto,
    schema: {
      example: {
        statusCode: 201,
        message: "User created successfully",
        data: {
          id: "user_abc123",
          email: "john.doe@example.com",
          phone: "+15551234567",
          displayName: "John Doe",
          isActive: true,
          isVerified: false,
          isAdmin: false,
          accountStatus: "active",
          roles: ["user"],
          permissions: [],
          createdAt: "2024-01-15T10:30:00Z",
          updatedAt: "2024-01-15T10:30:00Z",
          isOnline: true,
          lastSeenFormatted: "Just now",
          initials: "JD",
          profile: {
            bio: "Hello! I am using Real WhatsApp Clone.",
            status: "Available",
            completenessScore: 25,
            completenessLevel: "incomplete",
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed or invalid input",
    schema: {
      example: {
        statusCode: 400,
        message: "Validation failed",
        errors: ["Password must be at least 8 characters"],
      },
    },
  })
  @ApiConflictResponse({
    description: "User already exists with email or phone",
    schema: {
      example: {
        statusCode: 409,
        message: 'User with email "john.doe@example.com" already exists',
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
    schema: {
      example: {
        statusCode: 500,
        message: "An unexpected error occurred",
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createUser(@Body() createDto: CreateUserDto) {
    this.logger.debug(`Creating user with email: ${createDto.email}`);

    try {
      const result = await this.usersService.createUser(createDto);

      return ApiResponseBuilder.success(
        result,
        "User created successfully",
        HttpStatus.CREATED,
      );
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  // -------- GET CURRENT USER --------

  /**
   * Get the current authenticated user.
   */
  @Get("me")
  @ApiOperation({
    summary: "Get current user profile",
    description: "Get the profile of the currently authenticated user.",
  })
  @ApiOkResponse({
    description: "User profile retrieved successfully",
    type: UserResponseDto,
    schema: {
      example: {
        statusCode: 200,
        message: "User profile retrieved successfully",
        data: {
          id: "user_abc123",
          email: "john.doe@example.com",
          phone: "+15551234567",
          displayName: "John Doe",
          isActive: true,
          isVerified: true,
          isAdmin: false,
          accountStatus: "active",
          roles: ["user"],
          permissions: ["user:read", "message:send"],
          createdAt: "2024-01-15T10:30:00Z",
          updatedAt: "2024-01-15T10:30:00Z",
          lastSeen: "2024-01-15T10:30:00Z",
          isOnline: true,
          lastSeenFormatted: "Just now",
          initials: "JD",
          is2faEnabled: false,
          profile: {
            id: "prof_abc123",
            userId: "user_abc123",
            bio: "Hello! I am using Real WhatsApp Clone.",
            status: "Available",
            avatarUrl: "https://example.com/avatar.jpg",
            completenessScore: 75,
            completenessLevel: "complete",
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
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
    schema: {
      example: {
        statusCode: 401,
        message: "Authentication required. Please log in.",
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
    schema: {
      example: {
        statusCode: 500,
        message: "An unexpected error occurred",
      },
    },
  })
  async getCurrentUser(@CurrentUser() currentUser: AuthUser) {
    this.logger.debug(`Getting current user: ${currentUser.id}`);

    try {
      const user = await this.usersService.findUserById(currentUser.id, {
        includeProfile: true,
        includeSettings: true,
      });

      if (!user) {
        throw new HttpException("User not found", HttpStatus.NOT_FOUND);
      }

      const response = UserResponseDto.fromEntity(user, {
        includeProfile: true,
        includeSettings: true,
        includeStats: true,
      });

      return ApiResponseBuilder.success(
        response,
        "User profile retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get current user: ${error.message}`);
      throw error;
    }
  }

  // -------- GET USER BY ID --------

  /**
   * Get a user by ID.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Get user by ID",
    description: "Get user details by their unique ID.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "User retrieved successfully",
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: "User not found",
    schema: {
      example: {
        statusCode: 404,
        message: 'User with ID "user_abc123" not found',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
    schema: {
      example: {
        statusCode: 401,
        message: "Authentication required. Please log in.",
      },
    },
  })
  @ApiForbiddenResponse({
    description: "Access forbidden",
    schema: {
      example: {
        statusCode: 403,
        message: "Access forbidden. You do not have permission.",
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getUserById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting user by ID: ${id}`);

    // Check if the user is requesting their own profile or is admin
    if (id !== currentUser.id && !currentUser.isAdmin) {
      // Non-admin users can only see public info of other users
      // We'll return a limited response
      try {
        const user = await this.usersService.findUserById(id, {
          includeProfile: true,
          includeSettings: false,
        });

        if (!user) {
          throw new HttpException(
            `User with ID "${id}" not found`,
            HttpStatus.NOT_FOUND,
          );
        }

        const response = UserResponseDto.toPublic(user);

        return ApiResponseBuilder.success(
          response,
          "User retrieved successfully",
          HttpStatus.OK,
        );
      } catch (error) {
        throw error;
      }
    }

    // Full access for self or admin
    try {
      const user = await this.usersService.findUserById(id, {
        includeProfile: true,
        includeSettings: currentUser.isAdmin,
        includeDeleted: currentUser.isAdmin,
      });

      if (!user) {
        throw new HttpException(
          `User with ID "${id}" not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const response = currentUser.isAdmin
        ? UserResponseDto.toAdmin(user)
        : UserResponseDto.fromEntity(user, {
            includeProfile: true,
            includeSettings: true,
            includeStats: true,
          });

      return ApiResponseBuilder.success(
        response,
        "User retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get user: ${error.message}`);
      throw error;
    }
  }

  // -------- LIST USERS --------

  /**
   * List users with filtering and pagination.
   * Admin only endpoint.
   */
  @Get()
  @Admin()
  @ApiOperation({
    summary: "List users",
    description:
      "Get a paginated list of users with filtering and sorting. Admin only.",
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
    description: "Search by email, display name, or phone",
    type: String,
    required: false,
    example: "john",
  })
  @ApiQuery({
    name: "isActive",
    description: "Filter by active status",
    type: Boolean,
    required: false,
  })
  @ApiQuery({
    name: "isVerified",
    description: "Filter by verification status",
    type: Boolean,
    required: false,
  })
  @ApiQuery({
    name: "isAdmin",
    description: "Filter by admin status",
    type: Boolean,
    required: false,
  })
  @ApiQuery({
    name: "accountStatus",
    description: "Filter by account status",
    enum: ["active", "suspended", "banned", "inactive", "deleted"],
    required: false,
  })
  @ApiQuery({
    name: "orderBy",
    description: "Sort field",
    enum: ["createdAt", "updatedAt", "displayName", "lastSeen"],
    required: false,
  })
  @ApiQuery({
    name: "orderDirection",
    description: "Sort direction",
    enum: ["asc", "desc"],
    required: false,
  })
  @ApiOkResponse({
    description: "Users retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Users retrieved successfully",
        data: {
          users: [],
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async listUsers(
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Query("search") search?: string,
    @Query("isActive", new DefaultValuePipe(false), new ParseBoolPipe())
    isActive?: boolean,
    @Query("isVerified", new DefaultValuePipe(false), new ParseBoolPipe())
    isVerified?: boolean,
    @Query("isAdmin", new DefaultValuePipe(false), new ParseBoolPipe())
    isAdmin?: boolean,
    @Query("accountStatus") accountStatus?: string,
    @Query("orderBy") orderBy?: string,
    @Query("orderDirection") orderDirection?: "asc" | "desc",
  ) {
    this.logger.debug(`Listing users - page: ${page}, limit: ${limit}`);

    try {
      const result = await this.usersService.findUsers({
        page,
        limit,
        search,
        isActive: isActive !== undefined ? isActive : undefined,
        isVerified: isVerified !== undefined ? isVerified : undefined,
        isAdmin: isAdmin !== undefined ? isAdmin : undefined,
        accountStatus: accountStatus as any,
        orderBy: orderBy as any,
        orderDirection: orderDirection || "desc",
        includeDeleted: false,
      });

      return ApiResponseBuilder.success(
        result,
        "Users retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to list users: ${error.message}`);
      throw error;
    }
  }

  // -------- UPDATE USER --------

  /**
   * Update a user.
   */
  @Patch(":id")
  @ApiOperation({
    summary: "Update user",
    description:
      "Update user information. Admins can update any user, users can update themselves.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiBody({
    type: UpdateUserDto,
    description: "User update data",
  })
  @ApiOkResponse({
    description: "User updated successfully",
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiConflictResponse({
    description: "Email or phone already in use",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Cannot update other users unless admin",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Updating user: ${id}`);

    // Check if user is updating themselves or is admin
    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot update other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    // Non-admin users cannot update roles/permissions/account status
    if (!currentUser.isAdmin) {
      if (updateDto.roles !== undefined) {
        throw new HttpException(
          "Cannot update roles without admin privileges",
          HttpStatus.FORBIDDEN,
        );
      }
      if (updateDto.permissions !== undefined) {
        throw new HttpException(
          "Cannot update permissions without admin privileges",
          HttpStatus.FORBIDDEN,
        );
      }
      if (updateDto.accountStatus !== undefined) {
        throw new HttpException(
          "Cannot update account status without admin privileges",
          HttpStatus.FORBIDDEN,
        );
      }
      if (updateDto.isAdmin !== undefined) {
        throw new HttpException(
          "Cannot update admin status without admin privileges",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    try {
      const result = await this.usersService.updateUser(id, updateDto);

      return ApiResponseBuilder.success(
        result,
        "User updated successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  }

  // -------- UPDATE STATUS --------

  /**
   * Update user status.
   */
  @Patch(":id/status")
  @ApiOperation({
    summary: "Update user status",
    description:
      "Update the user's status message. Users can only update their own status.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiBody({
    type: UpdateStatusDto,
    description: "Status update data",
  })
  @ApiOkResponse({
    description: "Status updated successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Status updated successfully",
        data: {
          id: "user_abc123",
          displayName: "John Doe",
          status: "Working on a new project",
          isOnline: true,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Cannot update other users' status",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() statusDto: UpdateStatusDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Updating status for user: ${id}`);

    // Users can only update their own status
    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot update other users' status without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.updateStatus(id, statusDto);

      return ApiResponseBuilder.success(
        {
          id: result.id,
          displayName: result.displayName,
          status: result.status,
          isOnline: result.isOnline(),
        },
        "Status updated successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to update status: ${error.message}`);
      throw error;
    }
  }

  // -------- DELETE USER --------

  /**
   * Delete a user (soft delete).
   */
  @Delete(":id")
  @ApiOperation({
    summary: "Delete user",
    description:
      "Soft delete a user. Admins can delete any user, users can delete themselves.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiQuery({
    name: "reason",
    description: "Reason for deletion",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "User deleted successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "User deleted successfully",
        data: {
          success: true,
          message: "User abc123 deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Cannot delete other users unless admin",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async deleteUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("reason") reason?: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Deleting user: ${id}`);

    // Users can only delete themselves
    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot delete other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.deleteUser(id, reason);

      return ApiResponseBuilder.success(
        result,
        "User deleted successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to delete user: ${error.message}`);
      throw error;
    }
  }

  // -------- RESTORE USER --------

  /**
   * Restore a deleted user (admin only).
   */
  @Post(":id/restore")
  @Admin()
  @ApiOperation({
    summary: "Restore user",
    description: "Restore a soft-deleted user. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "User restored successfully",
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiBadRequestResponse({
    description: "User is not deleted",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async restoreUser(@Param("id", new ParseUUIDPipe()) id: string) {
    this.logger.debug(`Restoring user: ${id}`);

    try {
      const result = await this.usersService.restoreUser(id);

      return ApiResponseBuilder.success(
        result,
        "User restored successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to restore user: ${error.message}`);
      throw error;
    }
  }

  // -------- HARD DELETE USER --------

  /**
   * Permanently delete a user (admin only).
   */
  @Delete(":id/permanent")
  @Admin()
  @ApiOperation({
    summary: "Permanently delete user",
    description: "Hard delete a user from the system. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "User permanently deleted",
    schema: {
      example: {
        statusCode: 200,
        message: "User permanently deleted",
        data: {
          success: true,
          message: "User abc123 permanently deleted",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async hardDeleteUser(@Param("id", new ParseUUIDPipe()) id: string) {
    this.logger.warn(`Permanently deleting user: ${id}`);

    try {
      const result = await this.usersService.hardDeleteUser(id);

      return ApiResponseBuilder.success(
        result,
        "User permanently deleted",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to permanently delete user: ${error.message}`);
      throw error;
    }
  }

  // -------- SUSPEND USER --------

  /**
   * Suspend a user (admin only).
   */
  @Post(":id/suspend")
  @Admin()
  @ApiOperation({
    summary: "Suspend user",
    description: "Suspend a user account. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        reason: { type: "string", example: "Violation of terms of service" },
        duration: {
          type: "number",
          description: "Suspension duration in seconds",
          example: 86400,
        },
      },
      required: ["reason"],
    },
  })
  @ApiOkResponse({
    description: "User suspended successfully",
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiBadRequestResponse({
    description: "User already suspended",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async suspendUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body("reason") reason: string,
    @Body("duration") duration?: number,
  ) {
    this.logger.debug(`Suspending user: ${id}`);

    if (!reason) {
      throw new HttpException("Reason is required", HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.usersService.suspendUser(id, reason, duration);

      return ApiResponseBuilder.success(
        result,
        "User suspended successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to suspend user: ${error.message}`);
      throw error;
    }
  }

  // -------- UNSUSPEND USER --------

  /**
   * Unsuspend a user (admin only).
   */
  @Post(":id/unsuspend")
  @Admin()
  @ApiOperation({
    summary: "Unsuspend user",
    description: "Unsuspend a suspended user account. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "User unsuspended successfully",
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiBadRequestResponse({
    description: "User is not suspended",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async unsuspendUser(@Param("id", new ParseUUIDPipe()) id: string) {
    this.logger.debug(`Unsuspending user: ${id}`);

    try {
      const result = await this.usersService.unsuspendUser(id);

      return ApiResponseBuilder.success(
        result,
        "User unsuspended successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to unsuspend user: ${error.message}`);
      throw error;
    }
  }

  // -------- BAN USER --------

  /**
   * Ban a user (admin only).
   */
  @Post(":id/ban")
  @Admin()
  @ApiOperation({
    summary: "Ban user",
    description: "Permanently ban a user account. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          example: "Repeated violations of terms of service",
        },
      },
      required: ["reason"],
    },
  })
  @ApiOkResponse({
    description: "User banned successfully",
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiBadRequestResponse({
    description: "User already banned",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async banUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body("reason") reason: string,
  ) {
    this.logger.debug(`Banning user: ${id}`);

    if (!reason) {
      throw new HttpException("Reason is required", HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.usersService.banUser(id, reason);

      return ApiResponseBuilder.success(
        result,
        "User banned successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to ban user: ${error.message}`);
      throw error;
    }
  }

  // -------- UNBAN USER --------

  /**
   * Unban a user (admin only).
   */
  @Post(":id/unban")
  @Admin()
  @ApiOperation({
    summary: "Unban user",
    description: "Unban a banned user account. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "User unbanned successfully",
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiBadRequestResponse({
    description: "User is not banned",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async unbanUser(@Param("id", new ParseUUIDPipe()) id: string) {
    this.logger.debug(`Unbanning user: ${id}`);

    try {
      const result = await this.usersService.unbanUser(id);

      return ApiResponseBuilder.success(
        result,
        "User unbanned successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to unban user: ${error.message}`);
      throw error;
    }
  }

  // -------- USER STATISTICS --------

  /**
   * Get user statistics (admin only).
   */
  @Get(":id/stats")
  @Admin()
  @ApiOperation({
    summary: "Get user statistics",
    description: "Get detailed statistics for a user. Admin only.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "User statistics retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "User statistics retrieved successfully",
        data: {
          totalMessages: 1250,
          totalMessagesReceived: 980,
          totalGroups: 15,
          totalContacts: 42,
          totalFiles: 87,
          totalCalls: 56,
          totalCallsReceived: 63,
          totalCallsMissed: 12,
          accountAgeDays: 365,
          avgMessagesPerDay: 3.42,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "User not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access forbidden - Admin only",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getUserStats(@Param("id", new ParseUUIDPipe()) id: string) {
    this.logger.debug(`Getting stats for user: ${id}`);

    try {
      const stats = await this.usersService.getUserStats(id);

      return ApiResponseBuilder.success(
        stats,
        "User statistics retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get user stats: ${error.message}`);
      throw error;
    }
  }

  // -------- CONTACT MANAGEMENT --------

  /**
   * Add a contact.
   */
  @Post(":id/contacts/:contactId")
  @ApiOperation({
    summary: "Add contact",
    description: "Add a user to contacts.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiParam({
    name: "contactId",
    description: "Contact user ID",
    example: "user_def456",
    type: "string",
  })
  @ApiOkResponse({
    description: "Contact added successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Contact added successfully",
        data: {
          success: true,
          message: "Contact def456 added successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "User or contact not found",
  })
  @ApiConflictResponse({
    description: "Contact already exists",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Cannot add contacts for other users",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async addContact(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("contactId", new ParseUUIDPipe()) contactId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Adding contact ${contactId} for user ${id}`);

    // Users can only manage their own contacts
    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot manage contacts for other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.addContact(id, contactId);

      return ApiResponseBuilder.success(
        result,
        "Contact added successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to add contact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a contact.
   */
  @Delete(":id/contacts/:contactId")
  @ApiOperation({
    summary: "Remove contact",
    description: "Remove a user from contacts.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiParam({
    name: "contactId",
    description: "Contact user ID",
    example: "user_def456",
    type: "string",
  })
  @ApiOkResponse({
    description: "Contact removed successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Contact removed successfully",
        data: {
          success: true,
          message: "Contact def456 removed successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Contact not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Cannot remove contacts for other users",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async removeContact(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("contactId", new ParseUUIDPipe()) contactId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Removing contact ${contactId} for user ${id}`);

    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot manage contacts for other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.removeContact(id, contactId);

      return ApiResponseBuilder.success(
        result,
        "Contact removed successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to remove contact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Block a contact.
   */
  @Post(":id/contacts/:contactId/block")
  @ApiOperation({
    summary: "Block contact",
    description: "Block a user from contacts.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiParam({
    name: "contactId",
    description: "Contact user ID",
    example: "user_def456",
    type: "string",
  })
  @ApiOkResponse({
    description: "Contact blocked successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Contact blocked successfully",
        data: {
          success: true,
          message: "Contact def456 blocked successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Contact not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Cannot block contacts for other users",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async blockContact(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("contactId", new ParseUUIDPipe()) contactId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Blocking contact ${contactId} for user ${id}`);

    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot manage contacts for other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.blockContact(id, contactId);

      return ApiResponseBuilder.success(
        result,
        "Contact blocked successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to block contact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unblock a contact.
   */
  @Delete(":id/contacts/:contactId/block")
  @ApiOperation({
    summary: "Unblock contact",
    description: "Unblock a blocked user from contacts.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
  })
  @ApiParam({
    name: "contactId",
    description: "Contact user ID",
    example: "user_def456",
    type: "string",
  })
  @ApiOkResponse({
    description: "Contact unblocked successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Contact unblocked successfully",
        data: {
          success: true,
          message: "Contact def456 unblocked successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Blocked contact not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Cannot unblock contacts for other users",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async unblockContact(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("contactId", new ParseUUIDPipe()) contactId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Unblocking contact ${contactId} for user ${id}`);

    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot manage contacts for other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.unblockContact(id, contactId);

      return ApiResponseBuilder.success(
        result,
        "Contact unblocked successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to unblock contact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get contacts list.
   */
  @Get(":id/contacts")
  @ApiOperation({
    summary: "Get contacts",
    description: "Get the list of contacts for a user.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "user_abc123",
    type: "string",
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
    name: "status",
    description: "Filter by contact status",
    enum: ["pending", "accepted", "blocked"],
    required: false,
  })
  @ApiOkResponse({
    description: "Contacts retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Contacts retrieved successfully",
        data: {
          contacts: [],
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
  @ApiForbiddenResponse({
    description: "Cannot view contacts for other users",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getContacts(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Query("status") status?: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting contacts for user: ${id}`);

    // Users can only view their own contacts
    if (id !== currentUser.id && !currentUser.isAdmin) {
      throw new HttpException(
        "Cannot view contacts for other users without admin privileges",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.getContacts(id, {
        status: status as any,
        page,
        limit,
      });

      return ApiResponseBuilder.success(
        result,
        "Contacts retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get contacts: ${error.message}`);
      throw error;
    }
  }

  // -------- END --------
}
