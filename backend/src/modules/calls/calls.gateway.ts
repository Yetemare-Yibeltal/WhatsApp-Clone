// backend/src/modules/calls/calls.gateway.ts
/**
 * 📄 Calls Gateway
 *
 * Handles all WebSocket communication for real-time call signaling.
 * This gateway manages WebRTC signaling, call events, and participant
 * tracking for both one-to-one and group calls.
 *
 * @module CallsGateway
 * @category WebSocket
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from "@nestjs/websockets";
import {
  Injectable,
  Logger,
  UseGuards,
  Inject,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { JwtUtil } from "../../common/utils/jwt.util";
import { CallsService } from "./calls.service";
import { UsersService } from "../users/users.service";
import { GroupsService } from "../groups/groups.service";
import { WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { UseGuards as UseWsGuard } from "@nestjs/common";
import { WsExceptionFilter } from "../../common/filters/websocket-exception.filter";
import { UseFilters } from "@nestjs/common";
import {
  WsEvent,
  CallType,
  CallStatus,
  InitiateCallPayload,
  AnswerCallPayload,
  EndCallPayload,
  IceCandidatePayload,
  SdpPayload,
  CallRingingPayload,
  CallBusyPayload,
  CallMutePayload,
  CallVideoTogglePayload,
  ScreenSharePayload,
  CallRecordPayload,
} from "../../common/types/socket-payload.interface";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";

// -------- INTERFACES --------

interface CallParticipant {
  userId: string;
  socketId: string;
  username: string;
  joinedAt: Date;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
}

interface CallSession {
  callId: string;
  callType: CallType;
  status: CallStatus;
  initiatorId: string;
  participants: Map<string, CallParticipant>;
  startedAt: Date;
  endedAt?: Date;
  isGroup: boolean;
  groupId?: string;
  metadata?: Record<string, any>;
}

interface ClientConnection {
  socket: Socket;
  userId: string;
  username: string;
  currentCallId?: string;
  joinedRooms: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
  isAuthenticated: boolean;
}

// -------- GATEWAY --------

@WebSocketGateway({
  cors: {
    origin: "*", // In production, restrict to frontend URL
    credentials: true,
  },
  namespace: "/calls",
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
})
@UseFilters(new WsExceptionFilter())
@Injectable()
export class CallsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallsGateway.name);
  private readonly clients: Map<string, ClientConnection> = new Map();
  private readonly callSessions: Map<string, CallSession> = new Map();
  private readonly userToCall: Map<string, string> = new Map(); // userId -> callId
  private readonly rateLimitStore: Map<
    string,
    { count: number; resetAt: number }
  > = new Map();
  private readonly rateLimitMax = 100; // signals per minute
  private readonly rateLimitWindow = 60000; // 1 minute

  constructor(
    private readonly callsService: CallsService,
    private readonly usersService: UsersService,
    private readonly groupsService: GroupsService,
    private readonly jwtUtil: JwtUtil,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.logger.log("Calls Gateway initialized");
  }

  // -------- LIFECYCLE HOOKS --------

  /**
   * Called after the gateway is initialized.
   */
  afterInit(server: Server) {
    this.logger.log("Calls WebSocket Gateway initialized");
    this.server = server;

    // Set up heartbeat interval
    setInterval(() => {
      this.sendHeartbeat();
    }, 15000);

    // Clean up stale call sessions periodically
    setInterval(() => {
      this.cleanStaleCalls();
    }, 60000); // Every minute
  }

  /**
   * Handle client connection.
   */
  async handleConnection(client: Socket) {
    this.logger.debug(`Client connected to calls: ${client.id}`);

    try {
      // Extract token from handshake
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.emit("error", { message: "Authentication required" });
        client.disconnect();
        return;
      }

      // Validate token
      const payload = this.jwtUtil.verifyAccessToken(token);
      if (!payload || !payload.sub) {
        this.logger.warn(`Client ${client.id} disconnected: Invalid token`);
        client.emit("error", { message: "Invalid authentication token" });
        client.disconnect();
        return;
      }

      // Get user
      const user = await this.usersService.findUserById(payload.sub);
      if (!user || !user.isActiveUser()) {
        this.logger.warn(
          `Client ${client.id} disconnected: User not found or inactive`,
        );
        client.emit("error", { message: "User not found or inactive" });
        client.disconnect();
        return;
      }

      // Store client connection
      this.clients.set(client.id, {
        socket: client,
        userId: user.id,
        username: user.displayName,
        currentCallId: undefined,
        joinedRooms: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        isAuthenticated: true,
      });

      // Join user's personal room for direct messages
      const userRoom = `user:${user.id}`;
      client.join(userRoom);
      this.clients.get(client.id)!.joinedRooms.add(userRoom);

      // Emit event
      this.eventEmitter.emit("call.connected", {
        userId: user.id,
        username: user.displayName,
        socketId: client.id,
        timestamp: new Date(),
      });

      this.logger.log(`Client ${client.id} authenticated as user: ${user.id}`);
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error.message}`);
      client.emit("error", { message: "Authentication failed" });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection.
   */
  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected from calls: ${client.id}`);

    const connection = this.clients.get(client.id);
    if (connection) {
      const userId = connection.userId;

      // If user was in a call, handle disconnection
      if (connection.currentCallId) {
        this.handleUserDisconnectedFromCall(
          userId,
          connection.currentCallId,
          client.id,
        );
      }

      // Remove from client storage
      this.clients.delete(client.id);

      // Emit event
      this.eventEmitter.emit("call.disconnected", {
        userId,
        socketId: client.id,
        timestamp: new Date(),
      });

      this.logger.log(`Client ${client.id} disconnected. User: ${userId}`);
    }
  }

  // -------- HEARTBEAT --------

  private sendHeartbeat() {
    const now = Date.now();
    this.server.emit("heartbeat", { timestamp: now });
  }

  // -------- CLEAN STALE CALLS --------

  private cleanStaleCalls() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [callId, session] of this.callSessions) {
      const lastActivity = session.startedAt.getTime();
      if (
        now - lastActivity > staleThreshold &&
        (session.status === CallStatus.INITIATED ||
          session.status === CallStatus.RINGING)
      ) {
        this.logger.warn(`Stale call ${callId} cleaned up`);
        this.endCall(callId, "system", "Call timed out");
      }
    }
  }

  // -------- CALL INITIATION --------

  /**
   * Initiate a new call.
   */
  @SubscribeMessage(WsEvent.CALL_INITIATE)
  async handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: InitiateCallPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    // Rate limit check
    if (!this.checkRateLimit(client.id)) {
      client.emit("error", {
        message: "Rate limit exceeded. Please slow down.",
      });
      return;
    }

    try {
      // Validate payload
      if (!payload.targetUserId && !payload.groupId) {
        client.emit("error", { message: "Missing targetUserId or groupId" });
        return;
      }

      // Check if user is already in a call
      if (this.userToCall.has(connection.userId)) {
        client.emit("error", { message: "Already in a call" });
        return;
      }

      // Create call session
      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const callType = payload.isVideo
        ? payload.groupId
          ? CallType.GROUP_VIDEO
          : CallType.VIDEO
        : payload.groupId
          ? CallType.GROUP_VOICE
          : CallType.VOICE;

      const session: CallSession = {
        callId,
        callType,
        status: CallStatus.INITIATED,
        initiatorId: connection.userId,
        participants: new Map(),
        startedAt: new Date(),
        isGroup: !!payload.groupId,
        groupId: payload.groupId,
        metadata: payload.metadata,
      };

      // Add initiator as participant
      session.participants.set(connection.userId, {
        userId: connection.userId,
        socketId: client.id,
        username: connection.username,
        joinedAt: new Date(),
        isMuted: false,
        isVideoEnabled: payload.isVideo || false,
        isScreenSharing: false,
        isRecording: false,
      });

      this.callSessions.set(callId, session);
      this.userToCall.set(connection.userId, callId);

      // Get target participants
      let targetParticipants: string[] = [];
      if (payload.groupId) {
        // Get group members
        const group = await this.groupsService.getGroupById(payload.groupId);
        if (group) {
          const members = await this.groupsService[
            "prisma"
          ].groupMember.findMany({
            where: { groupId: payload.groupId },
            select: { userId: true },
          });
          targetParticipants = members
            .map((m) => m.userId)
            .filter((id) => id !== connection.userId);
        }
      } else if (payload.targetUserId) {
        targetParticipants = [payload.targetUserId];
      }

      // Create call in database
      await this.callsService.initiateCall({
        callType,
        initiatorId: connection.userId,
        targetUserId: payload.targetUserId,
        groupId: payload.groupId,
        participantIds: [connection.userId, ...targetParticipants],
        isVideo: payload.isVideo || false,
        metadata: payload.metadata,
      });

      // Join call room
      const callRoom = `call:${callId}`;
      client.join(callRoom);

      // Notify participants
      const initiatorName = connection.username;
      const initiatorAvatar = await this.getUserAvatar(connection.userId);

      // Send ringing to targets
      for (const targetId of targetParticipants) {
        const targetConnections = this.getUserConnections(targetId);
        if (targetConnections.length > 0) {
          const ringingPayload: CallRingingPayload = {
            callId,
            userId: targetId,
            userName: targetId,
            callerId: connection.userId,
            callerName: initiatorName,
            callerAvatar: initiatorAvatar,
            isVideo: payload.isVideo || false,
            callType,
            timestamp: new Date().toISOString(),
          };

          for (const conn of targetConnections) {
            conn.socket.emit(WsEvent.CALL_RINGING, ringingPayload);
          }

          // Update call status
          session.status = CallStatus.RINGING;
        } else {
          // User offline - mark as missed
          this.logger.debug(`Target user ${targetId} is offline`);
          // We'll handle missed call later
        }
      }

      // Emit event
      this.eventEmitter.emit("call.initiated", {
        callId,
        initiatorId: connection.userId,
        targetParticipants,
        timestamp: new Date(),
      });

      this.logger.log(`Call ${callId} initiated by ${connection.userId}`);

      // Send confirmation to initiator
      client.emit("call:initiated", { callId, status: "initiated" });
    } catch (error) {
      this.logger.error(`Error initiating call: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- ANSWER CALL --------

  /**
   * Answer or reject a call.
   */
  @SubscribeMessage(WsEvent.CALL_ANSWER)
  async handleAnswerCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AnswerCallPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, accept } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      // Check if user is a participant
      const participant = session.participants.get(connection.userId);
      if (!participant) {
        client.emit("error", { message: "Not a participant of this call" });
        return;
      }

      // Update participant socket ID
      participant.socketId = client.id;

      // Join call room
      const callRoom = `call:${callId}`;
      client.join(callRoom);

      if (accept) {
        // Accept call
        session.status = CallStatus.ANSWERED;
        participant.joinedAt = new Date();

        // Update call in database
        await this.callsService.answerCall({
          callId,
          userId: connection.userId,
          accept: true,
        });

        // Notify all participants
        const answerPayload = {
          callId,
          userId: connection.userId,
          userName: connection.username,
          accepted: true,
          timestamp: new Date().toISOString(),
        };

        this.server.to(callRoom).emit(WsEvent.CALL_ANSWER, answerPayload);

        this.logger.log(`Call ${callId} answered by ${connection.userId}`);
      } else {
        // Reject call
        session.status = CallStatus.REJECTED;

        // Update call in database
        await this.callsService.answerCall({
          callId,
          userId: connection.userId,
          accept: false,
        });

        // Notify initiator
        const rejectPayload = {
          callId,
          userId: connection.userId,
          userName: connection.username,
          accepted: false,
          reason: payload.reason || "User rejected the call",
          timestamp: new Date().toISOString(),
        };

        this.server.to(callRoom).emit(WsEvent.CALL_ANSWER, rejectPayload);

        // End call if no participants left
        this.checkAndEndCall(callId);

        this.logger.log(`Call ${callId} rejected by ${connection.userId}`);
      }
    } catch (error) {
      this.logger.error(`Error answering call: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- END CALL --------

  /**
   * End an active call.
   */
  @SubscribeMessage(WsEvent.CALL_END)
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EndCallPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, reason } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      // End the call
      await this.endCall(callId, connection.userId, reason);
    } catch (error) {
      this.logger.error(`Error ending call: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- WEBRTC SIGNALING --------

  /**
   * Handle ICE candidate exchange.
   */
  @SubscribeMessage(WsEvent.CALL_CANDIDATE)
  async handleCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: IceCandidatePayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, candidate, targetUserId } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      // Forward candidate to target user
      if (targetUserId) {
        const targetConnections = this.getUserConnections(targetUserId);
        const candidatePayload = {
          callId,
          userId: connection.userId,
          candidate,
          timestamp: new Date().toISOString(),
        };

        for (const conn of targetConnections) {
          conn.socket.emit(WsEvent.CALL_CANDIDATE, candidatePayload);
        }
      }

      this.logger.debug(`ICE candidate forwarded for call ${callId}`);
    } catch (error) {
      this.logger.error(`Error handling candidate: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Handle SDP offer.
   */
  @SubscribeMessage(WsEvent.CALL_OFFER)
  async handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SdpPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, sdp, targetUserId } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      // Forward offer to target user
      if (targetUserId) {
        const targetConnections = this.getUserConnections(targetUserId);
        const offerPayload = {
          callId,
          userId: connection.userId,
          sdp,
          timestamp: new Date().toISOString(),
        };

        for (const conn of targetConnections) {
          conn.socket.emit(WsEvent.CALL_OFFER, offerPayload);
        }
      }

      this.logger.debug(`SDP offer forwarded for call ${callId}`);
    } catch (error) {
      this.logger.error(`Error handling offer: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Handle SDP answer.
   */
  @SubscribeMessage(WsEvent.CALL_RESPONSE)
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SdpPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, sdp, targetUserId } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      // Forward answer to target user
      if (targetUserId) {
        const targetConnections = this.getUserConnections(targetUserId);
        const answerPayload = {
          callId,
          userId: connection.userId,
          sdp,
          timestamp: new Date().toISOString(),
        };

        for (const conn of targetConnections) {
          conn.socket.emit(WsEvent.CALL_RESPONSE, answerPayload);
        }
      }

      this.logger.debug(`SDP answer forwarded for call ${callId}`);
    } catch (error) {
      this.logger.error(`Error handling answer: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- CALL CONTROLS --------

  /**
   * Handle mute/unmute.
   */
  @SubscribeMessage(WsEvent.CALL_MUTE)
  async handleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallMutePayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, muted } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      const participant = session.participants.get(connection.userId);
      if (participant) {
        participant.isMuted = muted;
      }

      // Notify all participants
      const mutePayload = {
        callId,
        userId: connection.userId,
        userName: connection.username,
        muted,
        timestamp: new Date().toISOString(),
      };

      const callRoom = `call:${callId}`;
      this.server.to(callRoom).emit(WsEvent.CALL_MUTE, mutePayload);

      this.logger.debug(
        `User ${connection.userId} ${muted ? "muted" : "unmuted"} in call ${callId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling mute: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Handle video toggle.
   */
  @SubscribeMessage(WsEvent.CALL_VIDEO_TOGGLE)
  async handleVideoToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallVideoTogglePayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, enabled } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      const participant = session.participants.get(connection.userId);
      if (participant) {
        participant.isVideoEnabled = enabled;
      }

      // Notify all participants
      const videoPayload = {
        callId,
        userId: connection.userId,
        userName: connection.username,
        enabled,
        timestamp: new Date().toISOString(),
      };

      const callRoom = `call:${callId}`;
      this.server.to(callRoom).emit(WsEvent.CALL_VIDEO_TOGGLE, videoPayload);

      this.logger.debug(
        `User ${connection.userId} ${enabled ? "enabled" : "disabled"} video in call ${callId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling video toggle: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Handle screen sharing.
   */
  @SubscribeMessage(WsEvent.CALL_SCREEN_SHARE)
  async handleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ScreenSharePayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, enabled } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      const participant = session.participants.get(connection.userId);
      if (participant) {
        participant.isScreenSharing = enabled;
      }

      // Notify all participants
      const screenPayload = {
        callId,
        userId: connection.userId,
        userName: connection.username,
        enabled,
        timestamp: new Date().toISOString(),
      };

      const callRoom = `call:${callId}`;
      this.server.to(callRoom).emit(WsEvent.CALL_SCREEN_SHARE, screenPayload);

      this.logger.debug(
        `User ${connection.userId} ${enabled ? "started" : "stopped"} screen sharing in call ${callId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling screen share: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Handle recording start/stop.
   */
  @SubscribeMessage(WsEvent.CALL_RECORD_START)
  async handleRecordStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallRecordPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, recording } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      const participant = session.participants.get(connection.userId);
      if (participant) {
        participant.isRecording = recording;
      }

      // Start recording in service
      if (recording) {
        await this.callsService.startRecording(callId, connection.userId);
      }

      // Notify all participants
      const recordPayload = {
        callId,
        userId: connection.userId,
        userName: connection.username,
        recording,
        timestamp: new Date().toISOString(),
      };

      const callRoom = `call:${callId}`;
      this.server.to(callRoom).emit(WsEvent.CALL_RECORD_START, recordPayload);

      this.logger.debug(
        `User ${connection.userId} ${recording ? "started" : "stopped"} recording in call ${callId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling recording: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- CALL BUSY --------

  /**
   * Handle busy status.
   */
  @SubscribeMessage(WsEvent.CALL_BUSY)
  async handleBusy(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallBusyPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const { callId, userId, userName } = payload;
      const session = this.callSessions.get(callId);
      if (!session) {
        client.emit("error", { message: "Call not found" });
        return;
      }

      // Notify initiator
      const busyPayload = {
        callId,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      };

      this.server.to(`call:${callId}`).emit(WsEvent.CALL_BUSY, busyPayload);

      // End call if no participants
      this.checkAndEndCall(callId);
    } catch (error) {
      this.logger.error(`Error handling busy: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- HELPER METHODS --------

  /**
   * End a call and notify all participants.
   */
  private async endCall(
    callId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const session = this.callSessions.get(callId);
    if (!session) return;

    // Update status
    session.status = CallStatus.ENDED;
    session.endedAt = new Date();

    // Update database
    await this.callsService.endCall({
      callId,
      userId,
      reason,
    });

    // Notify all participants
    const endPayload = {
      callId,
      userId,
      reason: reason || "Call ended",
      timestamp: new Date().toISOString(),
    };

    const callRoom = `call:${callId}`;
    this.server.to(callRoom).emit(WsEvent.CALL_END, endPayload);

    // Clean up
    this.cleanupCall(callId);

    this.logger.log(`Call ${callId} ended by ${userId}`);
  }

  /**
   * Check if call should end (no participants).
   */
  private checkAndEndCall(callId: string): void {
    const session = this.callSessions.get(callId);
    if (!session) return;

    const activeParticipants = Array.from(
      session.participants.entries(),
    ).filter(([_, p]) => {
      const conn = this.clients.get(p.socketId);
      return conn && conn.isAuthenticated;
    });

    if (
      activeParticipants.length === 0 &&
      session.status !== CallStatus.ENDED
    ) {
      this.endCall(callId, "system", "No participants");
    }
  }

  /**
   * Handle user disconnection from a call.
   */
  private handleUserDisconnectedFromCall(
    userId: string,
    callId: string,
    socketId: string,
  ): void {
    const session = this.callSessions.get(callId);
    if (!session) return;

    // Remove participant
    session.participants.delete(userId);
    this.userToCall.delete(userId);

    // Notify other participants
    const disconnectPayload = {
      callId,
      userId,
      timestamp: new Date().toISOString(),
    };

    this.server
      .to(`call:${callId}`)
      .emit("call:participant:left", disconnectPayload);

    // Check if call should end
    this.checkAndEndCall(callId);

    this.logger.debug(`User ${userId} disconnected from call ${callId}`);
  }

  /**
   * Clean up call resources.
   */
  private cleanupCall(callId: string): void {
    const session = this.callSessions.get(callId);
    if (!session) return;

    // Remove all participants from userToCall
    for (const [userId] of session.participants) {
      this.userToCall.delete(userId);
    }

    // Remove call session
    this.callSessions.delete(callId);

    // Clear any room subscriptions
    const callRoom = `call:${callId}`;
    this.server.to(callRoom).socketsLeave(callRoom);
  }

  /**
   * Get user connections.
   */
  private getUserConnections(userId: string): ClientConnection[] {
    const connections: ClientConnection[] = [];
    for (const [_, conn] of this.clients) {
      if (conn.userId === userId && conn.isAuthenticated) {
        connections.push(conn);
      }
    }
    return connections;
  }

  /**
   * Get connection by client ID.
   */
  private getConnection(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get user avatar.
   */
  private async getUserAvatar(userId: string): Promise<string | null> {
    try {
      const user = await this.usersService.findUserById(userId);
      return user?.avatarUrl || null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Extract token from handshake.
   */
  private extractToken(client: Socket): string | null {
    const handshake = client.handshake;
    const token =
      handshake.auth?.token ||
      handshake.query?.token ||
      handshake.headers?.authorization?.replace("Bearer ", "");
    return token || null;
  }

  /**
   * Rate limiting for signaling.
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitStore.get(clientId);

    if (!entry) {
      this.rateLimitStore.set(clientId, {
        count: 1,
        resetAt: now + this.rateLimitWindow,
      });
      return true;
    }

    if (now > entry.resetAt) {
      this.rateLimitStore.set(clientId, {
        count: 1,
        resetAt: now + this.rateLimitWindow,
      });
      return true;
    }

    if (entry.count >= this.rateLimitMax) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get connected clients count.
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get active calls count.
   */
  getActiveCallsCount(): number {
    return this.callSessions.size;
  }

  // -------- END --------
}
