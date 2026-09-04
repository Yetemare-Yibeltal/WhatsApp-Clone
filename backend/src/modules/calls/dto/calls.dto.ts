// backend/src/modules/calls/dto/calls.dto.ts
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsObject,
  IsNumber,
  IsInt,
  IsPositive,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  IsUrl,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
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
import {
  CallType,
  CallStatus,
} from "../../../common/types/socket-payload.interface";
import { SanitizeUtil } from "../../../common/utils/sanitize.util";

export class InitiateCallDto {
  @ApiProperty({
    description: "Call type",
    enum: CallType,
    default: CallType.VOICE,
  })
  @IsEnum(CallType)
  @IsNotEmpty()
  callType: CallType;

  @ApiPropertyOptional({
    description: "Target user ID (for one-to-one)",
    example: "user_abc123",
  })
  @ValidateIf((o) => !o.groupId && !o.participantIds)
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({
    description: "Group ID (for group calls)",
    example: "group_abc123",
  })
  @ValidateIf((o) => !o.targetUserId && !o.participantIds)
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    description: "Participant user IDs (for custom calls)",
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
    description: "Video call flag",
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

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const hasTarget = !!this.targetUserId;
    const hasGroup = !!this.groupId;
    const hasParticipants = !!(
      this.participantIds && this.participantIds.length > 0
    );
    const count = [hasTarget, hasGroup, hasParticipants].filter(Boolean).length;
    if (count === 0)
      errors.push("Must specify targetUserId, groupId, or participantIds");
    if (count > 1)
      errors.push(
        "Cannot specify more than one of targetUserId, groupId, participantIds",
      );
    return { valid: errors.length === 0, errors };
  }

  isVideoCall(): boolean {
    return this.isVideo === true;
  }

  getEffectiveCallType(): CallType {
    if (this.isVideoCall()) {
      return this.groupId ? CallType.GROUP_VIDEO : CallType.VIDEO;
    }
    return this.groupId ? CallType.GROUP_VOICE : CallType.VOICE;
  }

  isGroupCall(): boolean {
    return !!this.groupId;
  }
  isOneToOne(): boolean {
    return !!this.targetUserId;
  }

  getParticipants(): string[] {
    if (this.targetUserId) return [this.targetUserId];
    if (this.participantIds) return this.participantIds;
    return [];
  }

  static fromPlain(obj: any): InitiateCallDto {
    return plainToClass(InitiateCallDto, obj, {
      enableImplicitConversion: true,
    });
  }

  static createVoiceCall(targetUserId: string): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.VOICE;
    dto.targetUserId = targetUserId;
    dto.isVideo = false;
    return dto;
  }

  static createVideoCall(targetUserId: string): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.VIDEO;
    dto.targetUserId = targetUserId;
    dto.isVideo = true;
    return dto;
  }

  static createGroupCall(
    groupId: string,
    isVideo: boolean = false,
  ): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = isVideo ? CallType.GROUP_VIDEO : CallType.GROUP_VOICE;
    dto.groupId = groupId;
    dto.isVideo = isVideo;
    return dto;
  }

  static createTest(overrides: Partial<InitiateCallDto> = {}): InitiateCallDto {
    const dto = new InitiateCallDto();
    dto.callType = CallType.VOICE;
    dto.targetUserId = "test-user-123";
    dto.isVideo = false;
    dto.metadata = { test: true };
    Object.assign(dto, overrides);
    return dto;
  }
}

export class AnswerCallDto {
  @ApiProperty({ description: "Accept or reject the call", example: true })
  @IsBoolean()
  @IsNotEmpty()
  accept: boolean;

  @ApiPropertyOptional({
    description: "SDP answer (for accepting)",
    example: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1",
  })
  @ValidateIf((o) => o.accept)
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  sdpAnswer?: string | null;

  @ApiPropertyOptional({
    description: "Rejection reason (for rejecting)",
    example: "Busy",
    maxLength: 100,
  })
  @ValidateIf((o) => !o.accept)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.accept && !this.sdpAnswer)
      errors.push("SDP answer is required when accepting");
    if (!this.accept && !this.reason)
      errors.push("Reason is required when rejecting");
    return { valid: errors.length === 0, errors };
  }

  getSanitizedSdpAnswer(): string | null {
    return this.sdpAnswer
      ? SanitizeUtil.sanitizeInput(this.sdpAnswer, {
          trim: true,
          maxLength: 10000,
        })
      : null;
  }

  getSanitizedReason(): string | null {
    return this.reason
      ? SanitizeUtil.sanitizeInput(this.reason, { trim: true, maxLength: 100 })
      : null;
  }

  static fromPlain(obj: any): AnswerCallDto {
    return plainToClass(AnswerCallDto, obj, { enableImplicitConversion: true });
  }

  static createAccept(sdpAnswer: string = "dummy-sdp"): AnswerCallDto {
    const dto = new AnswerCallDto();
    dto.accept = true;
    dto.sdpAnswer = sdpAnswer;
    return dto;
  }

  static createReject(reason: string = "Busy"): AnswerCallDto {
    const dto = new AnswerCallDto();
    dto.accept = false;
    dto.reason = reason;
    return dto;
  }

  static createTest(overrides: Partial<AnswerCallDto> = {}): AnswerCallDto {
    const dto = new AnswerCallDto();
    dto.accept = true;
    dto.sdpAnswer = "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1";
    Object.assign(dto, overrides);
    return dto;
  }
}

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

  getSanitizedReason(): string | null {
    return this.reason
      ? SanitizeUtil.sanitizeInput(this.reason, { trim: true, maxLength: 100 })
      : null;
  }

  static fromPlain(obj: any): EndCallDto {
    return plainToClass(EndCallDto, obj, { enableImplicitConversion: true });
  }

  static createTest(reason: string = "Test end"): EndCallDto {
    const dto = new EndCallDto();
    dto.reason = reason;
    return dto;
  }
}

export class SignalDto {
  @ApiPropertyOptional({
    description: "Target user ID",
    example: "user_abc123",
  })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({
    description: "SDP offer",
    example: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  offer?: string | null;

  @ApiPropertyOptional({
    description: "SDP answer",
    example: "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  answer?: string | null;

  @ApiPropertyOptional({
    description: "ICE candidate",
    example: "candidate:1 1 UDP 2122252543 192.168.1.1 57682 typ host",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim() || null)
  candidate?: string | null;

  @ApiPropertyOptional({
    description: "SDP (generic)",
    example: "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => value?.trim() || null)
  sdp?: string | null;

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.offer && !this.answer && !this.candidate && !this.sdp) {
      errors.push(
        "At least one of offer, answer, candidate, or sdp must be provided",
      );
    }
    return { valid: errors.length === 0, errors };
  }

  getSignalType(): "offer" | "answer" | "candidate" | "sdp" | null {
    if (this.offer) return "offer";
    if (this.answer) return "answer";
    if (this.candidate) return "candidate";
    if (this.sdp) return "sdp";
    return null;
  }

  getSignalContent(): string | null {
    return this.offer || this.answer || this.candidate || this.sdp || null;
  }

  static fromPlain(obj: any): SignalDto {
    return plainToClass(SignalDto, obj, { enableImplicitConversion: true });
  }

  static createOffer(offer: string, targetUserId?: string): SignalDto {
    const dto = new SignalDto();
    dto.offer = offer;
    dto.targetUserId = targetUserId;
    return dto;
  }

  static createAnswer(answer: string, targetUserId?: string): SignalDto {
    const dto = new SignalDto();
    dto.answer = answer;
    dto.targetUserId = targetUserId;
    return dto;
  }

  static createCandidate(candidate: string, targetUserId?: string): SignalDto {
    const dto = new SignalDto();
    dto.candidate = candidate;
    dto.targetUserId = targetUserId;
    return dto;
  }

  static createTest(overrides: Partial<SignalDto> = {}): SignalDto {
    const dto = new SignalDto();
    dto.offer = "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1";
    dto.targetUserId = "test-user-123";
    Object.assign(dto, overrides);
    return dto;
  }
}

export class TransferCallDto {
  @ApiProperty({ description: "Target user ID", example: "user_def456" })
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

  getSanitizedReason(): string | null {
    return this.reason
      ? SanitizeUtil.sanitizeInput(this.reason, { trim: true, maxLength: 100 })
      : null;
  }

  static fromPlain(obj: any): TransferCallDto {
    return plainToClass(TransferCallDto, obj, {
      enableImplicitConversion: true,
    });
  }

  static createTest(
    targetUserId: string = "test-user-456",
    reason: string = "Test transfer",
  ): TransferCallDto {
    const dto = new TransferCallDto();
    dto.targetUserId = targetUserId;
    dto.reason = reason;
    return dto;
  }
}

export class CallFilterDto {
  @ApiPropertyOptional({ description: "Filter by call type", enum: CallType })
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
    description: "Filter by start date (ISO 8601)",
    example: "2024-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter by end date (ISO 8601)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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
    description: "Items per page",
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

  getEffectivePage(): number {
    return this.page || 1;
  }
  getEffectiveLimit(): number {
    return Math.min(this.limit || 20, 500);
  }
  getEffectiveOrderBy(): string {
    return this.orderBy || "startedAt";
  }
  getEffectiveOrderDirection(): "asc" | "desc" {
    return this.orderDirection || "desc";
  }

  hasFilters(): boolean {
    return !!(this.callType || this.status || this.startDate || this.endDate);
  }

  static fromPlain(obj: any): CallFilterDto {
    return plainToClass(CallFilterDto, obj, { enableImplicitConversion: true });
  }

  static createTest(overrides: Partial<CallFilterDto> = {}): CallFilterDto {
    const dto = new CallFilterDto();
    dto.callType = CallType.VOICE;
    dto.status = CallStatus.ANSWERED;
    dto.page = 1;
    dto.limit = 20;
    dto.orderBy = "startedAt";
    dto.orderDirection = "desc";
    Object.assign(dto, overrides);
    return dto;
  }
}

export class StartRecordingDto {
  @ApiPropertyOptional({
    description: "Recording options",
    example: { quality: "hd" },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: "Notify participants",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyParticipants?: boolean;

  shouldNotify(): boolean {
    return this.notifyParticipants !== false;
  }

  static fromPlain(obj: any): StartRecordingDto {
    return plainToClass(StartRecordingDto, obj, {
      enableImplicitConversion: true,
    });
  }

  static createTest(
    overrides: Partial<StartRecordingDto> = {},
  ): StartRecordingDto {
    const dto = new StartRecordingDto();
    dto.options = { quality: "hd" };
    dto.notifyParticipants = true;
    Object.assign(dto, overrides);
    return dto;
  }
}

export class StopRecordingDto {
  @ApiPropertyOptional({
    description: "Reason for stopping",
    example: "Recording completed",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  reason?: string | null;

  @ApiPropertyOptional({
    description: "Save recording",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  saveRecording?: boolean;

  shouldSave(): boolean {
    return this.saveRecording !== false;
  }

  static fromPlain(obj: any): StopRecordingDto {
    return plainToClass(StopRecordingDto, obj, {
      enableImplicitConversion: true,
    });
  }

  static createTest(reason: string = "Test stop"): StopRecordingDto {
    const dto = new StopRecordingDto();
    dto.reason = reason;
    dto.saveRecording = true;
    return dto;
  }
}
