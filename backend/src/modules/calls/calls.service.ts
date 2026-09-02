// backend/src/modules/calls/calls.service.ts
/**
 * 📄 Calls Service
 *
 * Handles all call-related business logic including call initiation,
 * answering, ending, WebRTC signaling, and call history.
 *
 * @module CallsService
 * @category Services
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { GroupsService } from "../groups/groups.service";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";
import { SYSTEM_EVENTS, BUSINESS_EVENTS } from "../../common/constants/events";
import {
  CallType,
  CallStatus,
} from "../../common/types/socket-payload.interface";
import { UserEntity } from "../users/entities/user.entity";

// -------- INTERFACES --------

export interface InitiateCallOptions {
  callType: CallType;
  initiatorId: string;
  targetUserId?: string;
  groupId?: string;
  participantIds?: string[];
  isVideo: boolean;
  metadata?: Record<string, any>;
}

export interface AnswerCallOptions {
  callId: string;
  userId: string;
  accept: boolean;
  sdpAnswer?: string;
}

export interface EndCallOptions {
  callId: string;
  userId: string;
  reason?: string;
}

export interface SignalOptions {
  callId: string;
  userId: string;
  targetUserId?: string;
  offer?: string;
  answer?: string;
  candidate?: string;
  sdp?: string;
}

export interface CallFilterOptions {
  userId?: string;
  callType?: CallType;
  status?: CallStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  orderBy?: "startedAt" | "endedAt" | "duration";
  orderDirection?: "asc" | "desc";
}

export interface CallStats {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  missedCalls: number;
  answeredCalls: number;
  rejectedCalls: number;
  byType: {
    voice: number;
    video: number;
  };
  byStatus: {
    [key in CallStatus]?: number;
  };
}

// -------- MAIN SERVICE --------

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly cachePrefix = "call:";
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    private readonly usersService: UsersService,
    @Optional()
    private readonly groupsService: GroupsService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.cacheTtl = this.configService.get<number>("CALL_CACHE_TTL") || 300; // 5 minutes default
    this.logger.log("CallsService initialized");
  }

  // -------- INITIATE CALL --------

  /**
   * Initiate a new call.
   */
  async initiateCall(options: InitiateCallOptions): Promise<any> {
    this.logger.debug(
      `Initiating ${options.callType} call by user: ${options.initiatorId}`,
    );

    // Validate initiator exists
    const initiator = await this.usersService.findUserById(options.initiatorId);
    if (!initiator) {
      throw new NotFoundException(
        `Initiator user with ID "${options.initiatorId}" not found`,
      );
    }

    // Determine participants
    let participantIds: string[] = [];

    if (options.groupId) {
      // Group call: get group members
      const groupMembers = await this.prisma.groupMember.findMany({
        where: { groupId: options.groupId },
        select: { userId: true },
      });
      participantIds = groupMembers.map((m) => m.userId);
    } else if (options.targetUserId) {
      // One-to-one call
      participantIds = [options.initiatorId, options.targetUserId];
    } else if (options.participantIds && options.participantIds.length > 0) {
      // Custom participants
      participantIds = [options.initiatorId, ...options.participantIds];
    } else {
      throw new BadRequestException("No target user or group specified");
    }

    // Validate all participants exist
    for (const userId of participantIds) {
      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID "${userId}" not found`);
      }
    }

    // Check if user is already in an active call
    const activeCall = await this.prisma.call.findFirst({
      where: {
        status: {
          in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED],
        },
        participants: { some: { userId: options.initiatorId } },
      },
    });

    if (activeCall) {
      throw new ConflictException("User is already in an active call");
    }

    // Create call
    const call = await this.prisma.$transaction(async (tx) => {
      const newCall = await tx.call.create({
        data: {
          callType: options.callType,
          status: CallStatus.INITIATED,
          startedAt: new Date(),
          metadata: options.metadata || null,
        },
      });

      // Add participants
      const participantData = participantIds.map((userId) => ({
        callId: newCall.id,
        userId,
        joinedAt: new Date(),
      }));

      await tx.callParticipant.createMany({
        data: participantData,
      });

      return newCall;
    });

    // Cache the call
    await this.cacheCall(call.id);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.CALL_START, {
      callId: call.id,
      callType: options.callType,
      initiatorId: options.initiatorId,
      participants: participantIds,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.CALL_INITIATED, {
      callId: call.id,
      callType: options.callType,
      initiatorId: options.initiatorId,
      participants: participantIds,
      timestamp: new Date(),
    });

    this.logger.log(`Call ${call.id} initiated by ${options.initiatorId}`);

    return this.getCallWithDetails(call.id);
  }

  // -------- ANSWER CALL --------

  /**
   * Answer or reject a call.
   */
  async answerCall(options: AnswerCallOptions): Promise<any> {
    this.logger.debug(
      `User ${options.userId} ${options.accept ? "answering" : "rejecting"} call ${options.callId}`,
    );

    // Get call
    const call = await this.prisma.call.findUnique({
      where: { id: options.callId },
      include: { participants: true },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${options.callId}" not found`);
    }

    // Check if call is active
    if (
      call.status !== CallStatus.INITIATED &&
      call.status !== CallStatus.RINGING
    ) {
      throw new BadRequestException(`Call is already ${call.status}`);
    }

    // Check if user is a participant
    const participant = call.participants.find(
      (p) => p.userId === options.userId,
    );
    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }

    // Update call status
    const status = options.accept ? CallStatus.ANSWERED : CallStatus.REJECTED;
    const endedAt = options.accept ? null : new Date();

    const updatedCall = await this.prisma.$transaction(async (tx) => {
      // Update call
      const updated = await tx.call.update({
        where: { id: options.callId },
        data: {
          status,
          endedAt: options.accept ? null : new Date(),
        },
      });

      // Update participant joined time
      await tx.callParticipant.update({
        where: {
          callId_userId: {
            callId: options.callId,
            userId: options.userId,
          },
        },
        data: {
          joinedAt: options.accept ? new Date() : null,
          leftAt: options.accept ? null : new Date(),
        },
      });

      return updated;
    });

    // Clear cache
    await this.clearCallCache(options.callId);

    // Emit events
    if (options.accept) {
      this.eventEmitter.emit(BUSINESS_EVENTS.CALL_ANSWERED, {
        callId: options.callId,
        userId: options.userId,
        timestamp: new Date(),
      });
    } else {
      this.eventEmitter.emit(BUSINESS_EVENTS.CALL_REJECTED, {
        callId: options.callId,
        userId: options.userId,
        timestamp: new Date(),
      });
    }

    this.logger.log(
      `Call ${options.callId} ${options.accept ? "answered" : "rejected"} by ${options.userId}`,
    );

    return this.getCallWithDetails(options.callId);
  }

  // -------- END CALL --------

  /**
   * End an active call.
   */
  async endCall(options: EndCallOptions): Promise<any> {
    this.logger.debug(
      `Ending call ${options.callId} by user: ${options.userId}`,
    );

    // Get call
    const call = await this.prisma.call.findUnique({
      where: { id: options.callId },
      include: { participants: true },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${options.callId}" not found`);
    }

    // Check if call is active
    if (
      call.status !== CallStatus.INITIATED &&
      call.status !== CallStatus.RINGING &&
      call.status !== CallStatus.ANSWERED
    ) {
      throw new BadRequestException(`Call is already ${call.status}`);
    }

    // Check if user is a participant
    const participant = call.participants.find(
      (p) => p.userId === options.userId,
    );
    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }

    // Update call
    const endedAt = new Date();
    const duration = Math.floor(
      (endedAt.getTime() - call.startedAt.getTime()) / 1000,
    );

    const updatedCall = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.call.update({
        where: { id: options.callId },
        data: {
          status: CallStatus.ENDED,
          endedAt,
          duration,
        },
      });

      // Update participant left time
      await tx.callParticipant.update({
        where: {
          callId_userId: {
            callId: options.callId,
            userId: options.userId,
          },
        },
        data: {
          leftAt: endedAt,
        },
      });

      return updated;
    });

    // Clear cache
    await this.clearCallCache(options.callId);

    // Emit events
    this.eventEmitter.emit(SYSTEM_EVENTS.CALL_END, {
      callId: options.callId,
      userId: options.userId,
      duration,
      reason: options.reason,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(BUSINESS_EVENTS.CALL_ENDED, {
      callId: options.callId,
      userId: options.userId,
      duration,
      reason: options.reason,
      timestamp: new Date(),
    });

    this.logger.log(
      `Call ${options.callId} ended by ${options.userId}, duration: ${duration}s`,
    );

    return this.getCallWithDetails(options.callId);
  }

  // -------- GET CALL --------

  /**
   * Get a call with full details.
   */
  async getCallWithDetails(callId: string): Promise<any> {
    // Check cache first
    const cached = await this.getCachedCall(callId);
    if (cached) return cached;

    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        participants: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${callId}" not found`);
    }

    // Cache the result
    await this.cacheCall(callId, call);

    return call;
  }

  /**
   * Get a call by ID (basic info).
   */
  async getCallById(callId: string): Promise<any> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${callId}" not found`);
    }

    return call;
  }

  // -------- GET CALL HISTORY --------

  /**
   * Get call history with filtering and pagination.
   */
  async getCallHistory(options: CallFilterOptions = {}): Promise<{
    calls: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      userId,
      callType,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      orderBy = "startedAt",
      orderDirection = "desc",
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: any = {};

    if (userId) {
      where.participants = {
        some: { userId },
      };
    }

    if (callType) {
      where.callType = callType;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    // Execute query
    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: {
          participants: {
            include: {
              user: {
                include: { profile: true },
              },
            },
          },
        },
      }),
      this.prisma.call.count({ where }),
    ]);

    return {
      calls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get call history for a specific user.
   */
  async getUserCallHistory(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    calls: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = options;

    // Get call IDs where user is a participant
    const participantCalls = await this.prisma.callParticipant.findMany({
      where: { userId },
      select: { callId: true },
      orderBy: { call: { startedAt: "desc" } },
    });

    const callIds = participantCalls.map((p) => p.callId);

    if (callIds.length === 0) {
      return {
        calls: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where: {
          id: { in: callIds },
        },
        skip,
        take,
        orderBy: { startedAt: "desc" },
        include: {
          participants: {
            include: {
              user: {
                include: { profile: true },
              },
            },
          },
        },
      }),
      this.prisma.call.count({
        where: { id: { in: callIds } },
      }),
    ]);

    return {
      calls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // -------- WEBRTC SIGNALING --------

  /**
   * Handle WebRTC signaling (offer, answer, candidate).
   */
  async handleSignal(options: SignalOptions): Promise<any> {
    this.logger.debug(
      `Handling signal for call ${options.callId} from user ${options.userId}`,
    );

    // Get call
    const call = await this.prisma.call.findUnique({
      where: { id: options.callId },
      include: { participants: true },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${options.callId}" not found`);
    }

    // Check if call is active
    if (
      call.status !== CallStatus.INITIATED &&
      call.status !== CallStatus.RINGING &&
      call.status !== CallStatus.ANSWERED
    ) {
      throw new BadRequestException(
        `Call is not active (status: ${call.status})`,
      );
    }

    // Check if user is a participant
    const participant = call.participants.find(
      (p) => p.userId === options.userId,
    );
    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }

    // Store signal data in metadata
    const metadata = call.metadata || {};
    const signals = metadata.signals || [];

    const signalData = {
      userId: options.userId,
      type: options.offer
        ? "offer"
        : options.answer
          ? "answer"
          : options.candidate
            ? "candidate"
            : options.sdp
              ? "sdp"
              : "unknown",
      data: {
        offer: options.offer,
        answer: options.answer,
        candidate: options.candidate,
        sdp: options.sdp,
        targetUserId: options.targetUserId,
      },
      timestamp: new Date().toISOString(),
    };

    signals.push(signalData);

    // Limit signal history (keep last 50)
    while (signals.length > 50) {
      signals.shift();
    }

    metadata.signals = signals;

    // Update call metadata
    await this.prisma.call.update({
      where: { id: options.callId },
      data: { metadata },
    });

    // Clear cache
    await this.clearCallCache(options.callId);

    this.logger.debug(`Signal processed for call ${options.callId}`);

    return {
      success: true,
      message: "Signal processed successfully",
    };
  }

  // -------- CALL STATS --------

  /**
   * Get call statistics for a user.
   */
  async getUserCallStats(userId: string): Promise<CallStats> {
    this.logger.debug(`Getting call stats for user: ${userId}`);

    // Get all calls where user is a participant
    const participantCalls = await this.prisma.callParticipant.findMany({
      where: { userId },
      select: { call: true },
    });

    const calls = participantCalls.map((p) => p.call);

    const totalCalls = calls.length;
    let totalDuration = 0;
    let answeredCalls = 0;
    let rejectedCalls = 0;
    let missedCalls = 0;
    let voiceCalls = 0;
    let videoCalls = 0;
    const byStatus: { [key in CallStatus]?: number } = {};

    for (const call of calls) {
      if (call.duration) {
        totalDuration += call.duration;
      }

      if (call.status === CallStatus.ANSWERED) {
        answeredCalls++;
      } else if (call.status === CallStatus.REJECTED) {
        rejectedCalls++;
      } else if (call.status === CallStatus.MISSED) {
        missedCalls++;
      }

      if (
        call.callType === CallType.VOICE ||
        call.callType === CallType.GROUP_VOICE
      ) {
        voiceCalls++;
      } else if (
        call.callType === CallType.VIDEO ||
        call.callType === CallType.GROUP_VIDEO
      ) {
        videoCalls++;
      }

      byStatus[call.status] = (byStatus[call.status] || 0) + 1;
    }

    return {
      totalCalls,
      totalDuration,
      averageDuration:
        totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      missedCalls,
      answeredCalls,
      rejectedCalls,
      byType: {
        voice: voiceCalls,
        video: videoCalls,
      },
      byStatus,
    };
  }

  // -------- CALL RECORDING --------

  /**
   * Start recording a call.
   */
  async startRecording(
    callId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(
      `Starting recording for call ${callId} by user ${userId}`,
    );

    // Get call
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${callId}" not found`);
    }

    // Check if user is a participant
    const participant = await this.prisma.callParticipant.findUnique({
      where: {
        callId_userId: {
          callId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }

    // Check if call is active
    if (call.status !== CallStatus.ANSWERED) {
      throw new BadRequestException("Call must be active to start recording");
    }

    // Update metadata
    const metadata = call.metadata || {};
    metadata.recording = {
      startedBy: userId,
      startedAt: new Date().toISOString(),
      active: true,
    };

    await this.prisma.call.update({
      where: { id: callId },
      data: { metadata },
    });

    // Clear cache
    await this.clearCallCache(callId);

    this.logger.log(`Recording started for call ${callId}`);

    return {
      success: true,
      message: "Recording started successfully",
    };
  }

  /**
   * Stop recording a call.
   */
  async stopRecording(
    callId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(
      `Stopping recording for call ${callId} by user ${userId}`,
    );

    // Get call
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${callId}" not found`);
    }

    // Check if user is a participant
    const participant = await this.prisma.callParticipant.findUnique({
      where: {
        callId_userId: {
          callId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }

    // Update metadata
    const metadata = call.metadata || {};
    if (metadata.recording && metadata.recording.active) {
      metadata.recording.active = false;
      metadata.recording.stoppedAt = new Date().toISOString();
      metadata.recording.stoppedBy = userId;
    } else {
      throw new BadRequestException("No active recording found");
    }

    await this.prisma.call.update({
      where: { id: callId },
      data: { metadata },
    });

    // Clear cache
    await this.clearCallCache(callId);

    this.logger.log(`Recording stopped for call ${callId}`);

    return {
      success: true,
      message: "Recording stopped successfully",
    };
  }

  // -------- CALL TRANSFER --------

  /**
   * Transfer a call to another user.
   */
  async transferCall(
    callId: string,
    userId: string,
    targetUserId: string,
  ): Promise<any> {
    this.logger.debug(
      `Transferring call ${callId} from ${userId} to ${targetUserId}`,
    );

    // Get call
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { participants: true },
    });

    if (!call) {
      throw new NotFoundException(`Call with ID "${callId}" not found`);
    }

    // Check if call is active
    if (call.status !== CallStatus.ANSWERED) {
      throw new BadRequestException("Call must be active to transfer");
    }

    // Check if user is a participant
    const participant = call.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }

    // Check if target user exists
    const targetUser = await this.usersService.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException(
        `Target user with ID "${targetUserId}" not found`,
      );
    }

    // Check if target user is already a participant
    const existing = call.participants.find((p) => p.userId === targetUserId);
    if (existing) {
      throw new ConflictException("Target user is already a participant");
    }

    // Add target user to call
    await this.prisma.callParticipant.create({
      data: {
        callId,
        userId: targetUserId,
        joinedAt: new Date(),
      },
    });

    // Update metadata to indicate transfer
    const metadata = call.metadata || {};
    metadata.transfer = {
      transferredBy: userId,
      transferredTo: targetUserId,
      transferredAt: new Date().toISOString(),
    };

    await this.prisma.call.update({
      where: { id: callId },
      data: { metadata },
    });

    // Clear cache
    await this.clearCallCache(callId);

    this.logger.log(
      `Call ${callId} transferred from ${userId} to ${targetUserId}`,
    );

    return this.getCallWithDetails(callId);
  }

  // -------- CALL VALIDATION --------

  /**
   * Validate that a user is a participant of a call.
   */
  async validateCallParticipant(callId: string, userId: string): Promise<void> {
    const participant = await this.prisma.callParticipant.findUnique({
      where: {
        callId_userId: {
          callId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException("User is not a participant of this call");
    }
  }

  /**
   * Check if a call is active.
   */
  async isCallActive(callId: string): Promise<boolean> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: { status: true },
    });

    if (!call) return false;
    return [
      CallStatus.INITIATED,
      CallStatus.RINGING,
      CallStatus.ANSWERED,
    ].includes(call.status);
  }

  // -------- CACHE HELPERS --------

  private async cacheCall(callId: string, data?: any): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}${callId}`;
      if (data) {
        await this.cacheManager.set(key, data, this.cacheTtl);
      } else {
        const fetched = await this.getCallWithDetails(callId);
        await this.cacheManager.set(key, fetched, this.cacheTtl);
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  private async getCachedCall(callId: string): Promise<any | null> {
    if (!this.cacheManager) return null;

    try {
      const key = `${this.cachePrefix}${callId}`;
      const cached = await this.cacheManager.get(key);
      if (cached) {
        return cached;
      }
    } catch (_) {
      // Cache errors are non-blocking
    }
    return null;
  }

  private async clearCallCache(callId: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const key = `${this.cachePrefix}${callId}`;
      await this.cacheManager.del(key);
    } catch (_) {
      // Cache errors are non-blocking
    }
  }

  // -------- END --------
}
