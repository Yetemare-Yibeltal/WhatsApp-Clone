// backend/src/modules/calls/dto/calls.dto.ts
/**
 * 📄 Calls DTOs
 *
 * Defines all data transfer objects for call operations including:
 * - InitiateCallDto - Start a new call
 * - AnswerCallDto - Answer or reject a call
 * - EndCallDto - End an active call
 * - SignalDto - WebRTC signaling
 * - TransferCallDto - Transfer a call
 * - CallFilterDto - Filter call history
 * - StartRecordingDto - Start recording
 * - StopRecordingDto - Stop recording
 *
 * @module CallsDTO
 * @category DTOs
 */

import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsDate,
  MinLength,
  MaxLength,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  IsUrl,
  IsInt,
  IsPositive,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
} from "class-validator";
import {
  Transform,
  Type,
  Expose,
  Exclude,
  plainToClass,
} from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CallType,
  CallStatus,
} from "../../../common/types/socket-payload.interface";
import { SanitizeUtil } from "../../../common/utils/sanitize.util";

// -------- ENUMS --------

export enum SignalType {
  OFFER = "offer",
  ANSWER = "answer",
  CANDIDATE = "candidate",
  SDP = "sdp",
}

// -------- INITIATE CALL DTO --------

/**
 * DTO for initiating a new call.
 */
export class InitiateCallDto {
  @ApiProperty({
    description: "Type of call (VOICE or VIDEO)",
    enum: CallType,
    default: CallType.VOICE,
  })
  @IsEnum(CallType)
  @IsNotEmpty()
  callType: CallType;

  @ApiPropertyOptional({
    description: "Target user ID for one-to-one call",
    example: "user_abc123",
  })
  @ValidateIf((o) => !o.groupId && !o.participantIds)
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({
    description: "Group ID for group call",
    example: "group_abc123",
  })
  @ValidateIf((o) => !o.targetUserId && !o.participantIds)
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    description: "List of participant user IDs for custom call",
    example: ["user_abc123", "user_def456"],
  })
  @ValidateIf((o) => !o.targetUserId && !o.groupId)
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  participantIds?: string[];

  @ApiPropertyOptional({
    description: "Whether the call is video call",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVideo?: boolean;

  @ApiPropertyOptional({
    description: "Call metadata",
    example: { custom: "data" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;

  // -------- VALIDATION HELPERS --------

  /**
   * Validate that exactly one target is specified.
   */
  validateTarget(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const hasTarget = !!this.targetUserId;
    const hasGroup = !!this.groupId;
    const hasParticipants = !!(
      this.participantIds && this.participantIds.length > 0
    );

    const count = [hasTarget, hasGroup, hasParticipants].filter(Boolean).length;
    if (count === 0) {
      errors.push(
        "Must specify at least one of: targetUserId, groupId, or participantIds",
      );
    }
    if (count > 1) {
      errors.push(
        "Cannot specify more than one of: targetUserId, groupId, participantIds",
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the effective call participants.
   */
  getEffectiveParticipants(): string[] {
    if (this.targetUserId) return [this.targetUserId];
    if (this.groupId) return []; // Group participants resolved later
    if (this.participantIds) return this.participantIds;
    return [];
  }

  /**
   * Get the effective call type (VOICE or VIDEO).
   */
  getEffectiveCallType(): CallType {
    if (this.isVideo) {
      return this.groupId ? CallType.GROUP_VIDEO : CallType.VIDEO;
    }
    return this.groupId ? CallType.GROUP_VOICE : CallType.VOICE;
  }

  /**
   * Check if the call is a group call.
   */
  isGroupCall(): boolean {
    return !!this.groupId;
  }

  /**
   * Check if the call is a one-to-one call.
   */
  isOneToOne(): boolean {
    return !!this.targetUserId;
  }

  /**
   * Get the sanitized metadata.
   */
  getSanitizedMetadata(): Record<string, any> | null {
    if (!this.metadata) return null;
    return SanitizeUtil.sanitizeInput(this.metadata, {
      trim: true,
      maxLength: 1000,
    });
  }

  // -------- FACTORY METHODS --------

  /**
   * Create a one-to-one voice call DTO.
   */
  static oneToOneVoice(targetUserId: string): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.VOICE;
    dto.targetUserId = targetUserId;
    dto.isVideo = false;
    return dto;
  }

  /**
   * Create a one-to-one video call DTO.
   */
  static oneToOneVideo(targetUserId: string): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.VIDEO;
    dto.targetUserId = targetUserId;
    dto.isVideo = true;
    return dto;
  }

  /**
   * Create a group voice call DTO.
   */
  static groupVoice(groupId: string): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.GROUP_VOICE;
    dto.groupId = groupId;
    dto.isVideo = false;
    return dto;
  }

  /**
   * Create a group video call DTO.
   */
  static groupVideo(groupId: string): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.GROUP_VIDEO;
    dto.groupId = groupId;
    dto.isVideo = true;
    return dto;
  }

  /**
   * Create a test DTO.
   */
  static createTest(overrides: Partial<InitiateCallDto> = {}): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = overrides.callType || CallType.VOICE;
    dto.targetUserId = overrides.targetUserId || "test_user_123";
    dto.isVideo = overrides.isVideo || false;
    dto.metadata = overrides.metadata || { test: true };
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): InitiateCallDto {
    return plainToClass(InitiateCallDto, obj, {
      enableImplicitConversion: true,
    });
  }
}

// -------- ANSWER CALL DTO --------

/**
 * DTO for answering or rejecting a call.
 */
export class AnswerCallDto {
  @ApiProperty({
    description: "Whether to accept the call",
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  accept: boolean;

  @ApiPropertyOptional({
    description: "SDP answer for WebRTC (if accepting)",
    example: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...",
  })
  @ValidateIf((o) => o.accept)
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  sdpAnswer?: string | null;

  @ApiPropertyOptional({
    description: "Reason for rejection (if rejecting)",
    example: "Busy",
    maxLength: 100,
  })
  @ValidateIf((o) => !o.accept)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  // -------- HELPERS --------

  /**
   * Validate that SDP is provided when accepting.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.accept && !this.sdpAnswer) {
      errors.push("SDP answer is required when accepting a call");
    }
    if (!this.accept && !this.reason) {
      errors.push("Reason is required when rejecting a call");
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the effective rejection reason.
   */
  getRejectionReason(): string {
    return this.reason || "Call rejected";
  }

  /**
   * Create a test DTO.
   */
  static createAccept(sdpAnswer?: string): AnswerCallDto {
    const dto = new AnswerCallDto();
    dto.accept = true;
    dto.sdpAnswer =
      sdpAnswer || "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...";
    return dto;
  }

  /**
   * Create a reject DTO.
   */
  static createReject(reason?: string): AnswerCallDto {
    const dto = new AnswerCallDto();
    dto.accept = false;
    dto.reason = reason || "Busy";
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): AnswerCallDto {
    return plainToClass(AnswerCallDto, obj, { enableImplicitConversion: true });
  }
}

// -------- END CALL DTO --------

/**
 * DTO for ending an active call.
 */
export class EndCallDto {
  @ApiPropertyOptional({
    description: "Reason for ending the call",
    example: "Call completed",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  // -------- HELPERS --------

  /**
   * Get the effective end reason.
   */
  getEndReason(): string {
    return this.reason || "Call ended";
  }

  /**
   * Create a test DTO.
   */
  static createTest(reason?: string): EndCallDto {
    const dto = new EndCallDto();
    dto.reason = reason || "Test end";
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): EndCallDto {
    return plainToClass(EndCallDto, obj, { enableImplicitConversion: true });
  }
}

// -------- SIGNAL DTO --------

/**
 * DTO for WebRTC signaling (offer, answer, candidate).
 */
export class SignalDto {
  @ApiPropertyOptional({
    description: "Target user ID for the signal",
    example: "user_abc123",
  })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({
    description: "SDP offer string",
    example: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  offer?: string | null;

  @ApiPropertyOptional({
    description: "SDP answer string",
    example: "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n...",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  answer?: string | null;

  @ApiPropertyOptional({
    description: "ICE candidate string",
    example: "candidate:1 1 UDP 2122252543 192.168.1.1 57682 typ host",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim() || null)
  candidate?: string | null;

  @ApiPropertyOptional({
    description: "SDP (generic)",
    example: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  sdp?: string | null;

  // -------- VALIDATION --------

  /**
   * Validate that at least one signal type is provided.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const hasSignal = !!(
      this.offer ||
      this.answer ||
      this.candidate ||
      this.sdp
    );
    if (!hasSignal) {
      errors.push(
        "At least one of offer, answer, candidate, or sdp must be provided",
      );
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the signal type.
   */
  getSignalType(): SignalType | null {
    if (this.offer) return SignalType.OFFER;
    if (this.answer) return SignalType.ANSWER;
    if (this.candidate) return SignalType.CANDIDATE;
    if (this.sdp) return SignalType.SDP;
    return null;
  }

  /**
   * Get the signal content.
   */
  getSignalContent(): string | null {
    return this.offer || this.answer || this.candidate || this.sdp || null;
  }

  /**
   * Create a test signal DTO.
   */
  static createOffer(offer: string, targetUserId?: string): SignalDto {
    const dto = new SignalDto();
    dto.offer = offer;
    dto.targetUserId = targetUserId;
    return dto;
  }

  /**
   * Create a test answer DTO.
   */
  static createAnswer(answer: string, targetUserId?: string): SignalDto {
    const dto = new SignalDto();
    dto.answer = answer;
    dto.targetUserId = targetUserId;
    return dto;
  }

  /**
   * Create a test candidate DTO.
   */
  static createCandidate(candidate: string, targetUserId?: string): SignalDto {
    const dto = new SignalDto();
    dto.candidate = candidate;
    dto.targetUserId = targetUserId;
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): SignalDto {
    return plainToClass(SignalDto, obj, { enableImplicitConversion: true });
  }
}

// -------- TRANSFER CALL DTO --------

/**
 * DTO for transferring a call to another user.
 */
export class TransferCallDto {
  @ApiProperty({
    description: "Target user ID to transfer the call to",
    example: "user_def456",
  })
  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;

  @ApiPropertyOptional({
    description: "Transfer reason",
    example: "Transferring to manager",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  // -------- HELPERS --------

  /**
   * Get the transfer reason.
   */
  getTransferReason(): string {
    return this.reason || "Call transferred";
  }

  /**
   * Create a test DTO.
   */
  static createTest(targetUserId: string, reason?: string): TransferCallDto {
    const dto = new TransferCallDto();
    dto.targetUserId = targetUserId;
    dto.reason = reason || "Test transfer";
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): TransferCallDto {
    return plainToClass(TransferCallDto, obj, {
      enableImplicitConversion: true,
    });
  }
}

// -------- CALL FILTER DTO --------

/**
 * DTO for filtering call history.
 */
export class CallFilterDto {
  @ApiPropertyOptional({
    description: "Filter by call type",
    enum: CallType,
  })
  @IsOptional()
  @IsEnum(CallType)
  callType?: CallType;

  @ApiPropertyOptional({
    description: "Filter by call status",
    enum: CallStatus,
  })
  @IsOptional()
  @IsEnum(CallStatus)
  status?: CallStatus;

  @ApiPropertyOptional({
    description: "Start date for filtering (ISO 8601)",
    example: "2024-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: "End date for filtering (ISO 8601)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: "Page number (1-indexed)",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  page?: number;

  @ApiPropertyOptional({
    description: "Number of items per page",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  limit?: number;

  @ApiPropertyOptional({
    description: "Sort field",
    enum: ["startedAt", "endedAt", "duration"],
    default: "startedAt",
  })
  @IsOptional()
  @IsIn(["startedAt", "endedAt", "duration"])
  orderBy?: string;

  @ApiPropertyOptional({
    description: "Sort direction",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  orderDirection?: "asc" | "desc";

  // -------- HELPERS --------

  /**
   * Get effective page.
   */
  getEffectivePage(): number {
    return this.page || 1;
  }

  /**
   * Get effective limit.
   */
  getEffectiveLimit(): number {
    return Math.min(this.limit || 20, 500);
  }

  /**
   * Get effective order field.
   */
  getEffectiveOrderBy(): string {
    return this.orderBy || "startedAt";
  }

  /**
   * Get effective order direction.
   */
  getEffectiveOrderDirection(): "asc" | "desc" {
    return this.orderDirection || "desc";
  }

  /**
   * Create a test filter.
   */
  static createTest(overrides: Partial<CallFilterDto> = {}): CallFilterDto {
    const dto = new CallFilterDto();
    dto.callType = overrides.callType || undefined;
    dto.status = overrides.status || undefined;
    dto.startDate = overrides.startDate || undefined;
    dto.endDate = overrides.endDate || undefined;
    dto.page = overrides.page || 1;
    dto.limit = overrides.limit || 20;
    dto.orderBy = overrides.orderBy || "startedAt";
    dto.orderDirection = overrides.orderDirection || "desc";
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): CallFilterDto {
    return plainToClass(CallFilterDto, obj, { enableImplicitConversion: true });
  }
}

// -------- START RECORDING DTO --------

/**
 * DTO for starting call recording.
 */
export class StartRecordingDto {
  @ApiPropertyOptional({
    description: "Recording options",
    example: { quality: "hd", storage: "cloud" },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: "Notify participants about recording",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyParticipants?: boolean;

  // -------- HELPERS --------

  /**
   * Get the effective options.
   */
  getEffectiveOptions(): Record<string, any> {
    return this.options || {};
  }

  /**
   * Check if participants should be notified.
   */
  shouldNotifyParticipants(): boolean {
    return this.notifyParticipants !== false;
  }

  /**
   * Create a test DTO.
   */
  static createTest(
    overrides: Partial<StartRecordingDto> = {},
  ): StartRecordingDto {
    const dto = new StartRecordingDto();
    dto.options = overrides.options || { quality: "hd" };
    dto.notifyParticipants =
      overrides.notifyParticipants !== undefined
        ? overrides.notifyParticipants
        : true;
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): StartRecordingDto {
    return plainToClass(StartRecordingDto, obj, {
      enableImplicitConversion: true,
    });
  }
}

// -------- STOP RECORDING DTO --------

/**
 * DTO for stopping call recording.
 */
export class StopRecordingDto {
  @ApiPropertyOptional({
    description: "Reason for stopping recording",
    example: "Recording completed",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  @ApiPropertyOptional({
    description: "Save recording to storage",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  saveRecording?: boolean;

  // -------- HELPERS --------

  /**
   * Get the stop reason.
   */
  getStopReason(): string {
    return this.reason || "Recording stopped";
  }

  /**
   * Check if recording should be saved.
   */
  shouldSaveRecording(): boolean {
    return this.saveRecording !== false;
  }

  /**
   * Create a test DTO.
   */
  static createTest(
    overrides: Partial<StopRecordingDto> = {},
  ): StopRecordingDto {
    const dto = new StopRecordingDto();
    dto.reason = overrides.reason || "Test stop";
    dto.saveRecording =
      overrides.saveRecording !== undefined ? overrides.saveRecording : true;
    return dto;
  }

  /**
   * Create a DTO from a plain object.
   */
  static fromPlain(obj: any): StopRecordingDto {
    return plainToClass(StopRecordingDto, obj, {
      enableImplicitConversion: true,
    });
  }
}

// -------- END --------
