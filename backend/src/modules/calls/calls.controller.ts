// backend/src/modules/calls/calls.controller.ts
/**
 * 📄 Calls Controller
 *
 * Exposes REST endpoints for call management including initiation,
 * answering, ending, signaling, history, and recording.
 *
 * @module CallsController
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
import { CallsService } from "./calls.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  Roles,
  Permissions,
  Admin,
  UserRole,
} from "../../common/constants/roles";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { ApiResponseBuilder } from "../../common/types/api-response.interface";
import {
  CallType,
  CallStatus,
} from "../../common/types/socket-payload.interface";
import {
  InitiateCallDto,
  AnswerCallDto,
  EndCallDto,
  SignalDto,
  TransferCallDto,
  CallFilterDto,
  StartRecordingDto,
  StopRecordingDto,
} from "./dto";

// -------- CONTROLLER --------

@ApiTags("Calls")
@ApiBearerAuth()
@Controller("calls")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallsController {
  private readonly logger = new Logger(CallsController.name);

  constructor(private readonly callsService: CallsService) {}

  // -------- INITIATE CALL --------

  /**
   * Initiate a new call.
   */
  @Post()
  @ApiOperation({
    summary: "Initiate a new call",
    description: "Start a new voice or video call to a user or group.",
  })
  @ApiCreatedResponse({
    description: "Call initiated successfully",
    schema: {
      example: {
        statusCode: 201,
        message: "Call initiated successfully",
        data: {
          id: "call_abc123",
          callType: "VOICE",
          status: "INITIATED",
          startedAt: "2024-01-15T10:30:00Z",
          participants: [],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
  })
  @ApiConflictResponse({
    description: "User is already in a call",
  })
  @ApiNotFoundResponse({
    description: "Target user or group not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async initiateCall(
    @Body() initiateDto: InitiateCallDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Initiating call by user: ${currentUser.id}`);

    try {
      const result = await this.callsService.initiateCall({
        callType: initiateDto.callType,
        initiatorId: currentUser.id,
        targetUserId: initiateDto.targetUserId,
        groupId: initiateDto.groupId,
        participantIds: initiateDto.participantIds,
        isVideo: initiateDto.isVideo || false,
        metadata: initiateDto.metadata,
      });

      return ApiResponseBuilder.success(
        result,
        "Call initiated successfully",
        HttpStatus.CREATED,
      );
    } catch (error) {
      this.logger.error(`Failed to initiate call: ${error.message}`);
      throw error;
    }
  }

  // -------- ANSWER CALL --------

  /**
   * Answer or reject a call.
   */
  @Post(":id/answer")
  @ApiOperation({
    summary: "Answer or reject a call",
    description: "Accept or reject an incoming call.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiBody({
    type: AnswerCallDto,
    description: "Answer options",
  })
  @ApiOkResponse({
    description: "Call answered/rejected successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Call answered successfully",
        data: {
          id: "call_abc123",
          status: "ANSWERED",
          startedAt: "2024-01-15T10:30:00Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Call is not active",
  })
  @ApiNotFoundResponse({
    description: "Call not found",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async answerCall(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() answerDto: AnswerCallDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Answering call ${id} by user: ${currentUser.id}`);

    try {
      const result = await this.callsService.answerCall({
        callId: id,
        userId: currentUser.id,
        accept: answerDto.accept,
      });

      const message = answerDto.accept
        ? "Call answered successfully"
        : "Call rejected successfully";

      return ApiResponseBuilder.success(result, message, HttpStatus.OK);
    } catch (error) {
      this.logger.error(`Failed to answer call: ${error.message}`);
      throw error;
    }
  }

  // -------- END CALL --------

  /**
   * End an active call.
   */
  @Post(":id/end")
  @ApiOperation({
    summary: "End a call",
    description: "End an active call.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiBody({
    type: EndCallDto,
    description: "End call options",
  })
  @ApiOkResponse({
    description: "Call ended successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Call ended successfully",
        data: {
          id: "call_abc123",
          status: "ENDED",
          endedAt: "2024-01-15T10:35:00Z",
          duration: 300,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Call is not active",
  })
  @ApiNotFoundResponse({
    description: "Call not found",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async endCall(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() endDto: EndCallDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Ending call ${id} by user: ${currentUser.id}`);

    try {
      const result = await this.callsService.endCall({
        callId: id,
        userId: currentUser.id,
        reason: endDto.reason,
      });

      return ApiResponseBuilder.success(
        result,
        "Call ended successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to end call: ${error.message}`);
      throw error;
    }
  }

  // -------- GET CALL --------

  /**
   * Get a call by ID.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Get call details",
    description: "Get detailed information about a call.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiOkResponse({
    description: "Call retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Call retrieved successfully",
        data: {
          id: "call_abc123",
          callType: "VOICE",
          status: "ANSWERED",
          startedAt: "2024-01-15T10:30:00Z",
          endedAt: "2024-01-15T10:35:00Z",
          duration: 300,
          participants: [],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Call not found",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  async getCall(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting call ${id}`);

    try {
      // Validate user is a participant
      await this.callsService.validateCallParticipant(id, currentUser.id);

      const result = await this.callsService.getCallWithDetails(id);

      return ApiResponseBuilder.success(
        result,
        "Call retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get call: ${error.message}`);
      throw error;
    }
  }

  // -------- GET CALL HISTORY --------

  /**
   * Get call history.
   */
  @Get()
  @ApiOperation({
    summary: "Get call history",
    description: "Get call history with filtering and pagination.",
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
    name: "callType",
    description: "Filter by call type",
    enum: CallType,
    required: false,
  })
  @ApiQuery({
    name: "status",
    description: "Filter by call status",
    enum: CallStatus,
    required: false,
  })
  @ApiQuery({
    name: "startDate",
    description: "Filter by start date (ISO 8601)",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "endDate",
    description: "Filter by end date (ISO 8601)",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "orderBy",
    description: "Sort field",
    enum: ["startedAt", "endedAt", "duration"],
    required: false,
  })
  @ApiQuery({
    name: "orderDirection",
    description: "Sort direction",
    enum: ["asc", "desc"],
    required: false,
  })
  @ApiOkResponse({
    description: "Call history retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Call history retrieved successfully",
        data: {
          calls: [],
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
  async getCallHistory(
    @Query("page", new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query("limit", new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Query("callType") callType?: CallType,
    @Query("status") status?: CallStatus,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("orderBy") orderBy?: string,
    @Query("orderDirection") orderDirection?: "asc" | "desc",
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Getting call history for user: ${currentUser.id}`);

    try {
      const result = await this.callsService.getUserCallHistory(
        currentUser.id,
        {
          page,
          limit,
        },
      );

      // Apply additional filters after retrieval (or use the service's filter method)
      // For simplicity, we'll use the service's getCallHistory with userId
      const filteredResult = await this.callsService.getCallHistory({
        userId: currentUser.id,
        callType,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page,
        limit,
        orderBy: orderBy as any,
        orderDirection: orderDirection || "desc",
      });

      return ApiResponseBuilder.success(
        filteredResult,
        "Call history retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get call history: ${error.message}`);
      throw error;
    }
  }

  // -------- GET CALL STATS --------

  /**
   * Get call statistics.
   */
  @Get("stats/me")
  @ApiOperation({
    summary: "Get user call statistics",
    description: "Get call statistics for the current user.",
  })
  @ApiOkResponse({
    description: "Call statistics retrieved successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Call statistics retrieved successfully",
        data: {
          totalCalls: 150,
          totalDuration: 36000,
          averageDuration: 240,
          missedCalls: 12,
          answeredCalls: 120,
          rejectedCalls: 18,
          byType: {
            voice: 100,
            video: 50,
          },
          byStatus: {
            ANSWERED: 120,
            REJECTED: 18,
            MISSED: 12,
          },
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
  async getUserCallStats(@CurrentUser() currentUser: AuthUser) {
    this.logger.debug(`Getting call stats for user: ${currentUser.id}`);

    try {
      const result = await this.callsService.getUserCallStats(currentUser.id);

      return ApiResponseBuilder.success(
        result,
        "Call statistics retrieved successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to get call stats: ${error.message}`);
      throw error;
    }
  }

  // -------- WEBRTC SIGNALING --------

  /**
   * Send WebRTC signaling data.
   */
  @Post(":id/signal")
  @ApiOperation({
    summary: "Send WebRTC signal",
    description: "Send offer, answer, or ICE candidate for WebRTC signaling.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiBody({
    type: SignalDto,
    description: "Signal data",
  })
  @ApiOkResponse({
    description: "Signal sent successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Signal sent successfully",
        data: {
          success: true,
          message: "Signal processed successfully",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Call is not active",
  })
  @ApiNotFoundResponse({
    description: "Call not found",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendSignal(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() signalDto: SignalDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Sending signal for call ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.callsService.handleSignal({
        callId: id,
        userId: currentUser.id,
        targetUserId: signalDto.targetUserId,
        offer: signalDto.offer,
        answer: signalDto.answer,
        candidate: signalDto.candidate,
        sdp: signalDto.sdp,
      });

      return ApiResponseBuilder.success(
        result,
        "Signal sent successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to send signal: ${error.message}`);
      throw error;
    }
  }

  // -------- TRANSFER CALL --------

  /**
   * Transfer a call to another user.
   */
  @Post(":id/transfer")
  @ApiOperation({
    summary: "Transfer a call",
    description: "Transfer an active call to another user.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiBody({
    type: TransferCallDto,
    description: "Transfer options",
  })
  @ApiOkResponse({
    description: "Call transferred successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Call transferred successfully",
        data: {
          id: "call_abc123",
          status: "ANSWERED",
          participants: [],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Call is not active",
  })
  @ApiNotFoundResponse({
    description: "Call or target user not found",
  })
  @ApiConflictResponse({
    description: "Target user is already a participant",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async transferCall(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() transferDto: TransferCallDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(`Transferring call ${id} by user: ${currentUser.id}`);

    try {
      const result = await this.callsService.transferCall(
        id,
        currentUser.id,
        transferDto.targetUserId,
      );

      return ApiResponseBuilder.success(
        result,
        "Call transferred successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to transfer call: ${error.message}`);
      throw error;
    }
  }

  // -------- START RECORDING --------

  /**
   * Start recording a call.
   */
  @Post(":id/recording/start")
  @ApiOperation({
    summary: "Start call recording",
    description: "Start recording an active call.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiBody({
    type: StartRecordingDto,
    description: "Recording options",
  })
  @ApiOkResponse({
    description: "Recording started successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Recording started successfully",
        data: {
          success: true,
          message: "Recording started successfully",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Call is not active",
  })
  @ApiNotFoundResponse({
    description: "Call not found",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async startRecording(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() startDto: StartRecordingDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Starting recording for call ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.callsService.startRecording(id, currentUser.id);

      return ApiResponseBuilder.success(
        result,
        "Recording started successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to start recording: ${error.message}`);
      throw error;
    }
  }

  // -------- STOP RECORDING --------

  /**
   * Stop recording a call.
   */
  @Post(":id/recording/stop")
  @ApiOperation({
    summary: "Stop call recording",
    description: "Stop recording an active call.",
  })
  @ApiParam({
    name: "id",
    description: "Call ID",
    example: "call_abc123",
    type: "string",
  })
  @ApiBody({
    type: StopRecordingDto,
    description: "Stop recording options",
  })
  @ApiOkResponse({
    description: "Recording stopped successfully",
    schema: {
      example: {
        statusCode: 200,
        message: "Recording stopped successfully",
        data: {
          success: true,
          message: "Recording stopped successfully",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "No active recording",
  })
  @ApiNotFoundResponse({
    description: "Call not found",
  })
  @ApiForbiddenResponse({
    description: "User is not a participant",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async stopRecording(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() stopDto: StopRecordingDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    this.logger.debug(
      `Stopping recording for call ${id} by user: ${currentUser.id}`,
    );

    try {
      const result = await this.callsService.stopRecording(id, currentUser.id);

      return ApiResponseBuilder.success(
        result,
        "Recording stopped successfully",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Failed to stop recording: ${error.message}`);
      throw error;
    }
  }

  // -------- END --------
}
