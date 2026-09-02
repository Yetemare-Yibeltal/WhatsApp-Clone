// backend/src/modules/messages/messages.gateway.ts
/**
 * 📄 Messages Gateway
 *
 * Handles all WebSocket communication for real-time messaging.
 * This gateway manages message delivery, typing indicators, presence,
 * group events, and call signaling.
 *
 * @module MessagesGateway
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
import { UsersService } from "../users/users.service";
import { MessagesService } from "./messages.service";
import { GroupsService } from "../groups/groups.service";
import { WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { UseGuards as UseWsGuard } from "@nestjs/common";
import { WsExceptionFilter } from "../../common/filters/websocket-exception.filter";
import { UseFilters } from "@nestjs/common";
import {
  WsEvent,
  MessageStatus,
  MessageType,
  PresenceStatus,
  GroupRole,
  CallType,
  CallStatus,
  SendMessagePayload,
  ReceiveMessagePayload,
  TypingStartPayload,
  TypingStopPayload,
  ReadReceiptPayload,
  PresenceOnlinePayload,
  PresenceOfflinePayload,
  InitiateCallPayload,
  AnswerCallPayload,
  EndCallPayload,
  IceCandidatePayload,
  SdpPayload,
} from "../../common/types/socket-payload.interface";
import { EncryptionUtil } from "../../common/utils/encryption.util";
import { SanitizeUtil } from "../../common/utils/sanitize.util";

// -------- INTERFACES --------

interface ClientConnection {
  socket: Socket;
  userId: string;
  username: string;
  rooms: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  isAuthenticated: boolean;
}

interface ClientStorage {
  [clientId: string]: ClientConnection;
}

// -------- GATEWAY --------

@WebSocketGateway({
  cors: {
    origin: "*", // In production, restrict to frontend URL
    credentials: true,
  },
  namespace: "/messages",
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
})
@UseFilters(new WsExceptionFilter())
@Injectable()
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);
  private readonly clients: ClientStorage = {};
  private readonly userRooms: Map<string, Set<string>> = new Map(); // userId -> roomIds
  private readonly typingUsers: Map<
    string,
    { chatId: string; timeout: NodeJS.Timeout }
  > = new Map();
  private readonly rateLimitStore: Map<
    string,
    { count: number; resetAt: number }
  > = new Map();
  private readonly rateLimitMax = 50; // messages per minute
  private readonly rateLimitWindow = 60000; // 1 minute

  constructor(
    private readonly messagesService: MessagesService,
    private readonly usersService: UsersService,
    private readonly groupsService: GroupsService,
    private readonly jwtUtil: JwtUtil,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.logger.log("Messages Gateway initialized");
  }

  // -------- LIFECYCLE HOOKS --------

  /**
   * Called after the gateway is initialized.
   */
  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");
    this.server = server;

    // Set up heartbeat interval
    setInterval(() => {
      this.sendHeartbeat();
    }, 15000);
  }

  /**
   * Handle client connection.
   */
  async handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);

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
      this.clients[client.id] = {
        socket: client,
        userId: user.id,
        username: user.displayName,
        rooms: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        isAuthenticated: true,
      };

      // Join user's personal room for direct messages
      const userRoom = `user:${user.id}`;
      client.join(userRoom);
      this.addRoomToUser(user.id, userRoom);

      // Notify others that user is online
      this.broadcastPresence(user.id, user.displayName, PresenceStatus.ONLINE);

      // Update user's online status in DB
      await this.usersService.updateLastSeen(user.id);

      // Emit event
      this.eventEmitter.emit("user.online", {
        userId: user.id,
        username: user.displayName,
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
    this.logger.debug(`Client disconnected: ${client.id}`);

    const connection = this.clients[client.id];
    if (connection) {
      const userId = connection.userId;
      const username = connection.username;

      // Check if user has other connections
      const hasOtherConnections = this.hasActiveConnections(userId, client.id);

      if (!hasOtherConnections) {
        // Notify others that user is offline
        this.broadcastPresence(userId, username, PresenceStatus.OFFLINE);

        // Remove from typing status
        this.removeTypingUser(client.id);

        // Emit event
        this.eventEmitter.emit("user.offline", {
          userId,
          username,
          timestamp: new Date(),
        });
      }

      // Remove from client storage
      delete this.clients[client.id];

      // Remove from user rooms
      const userRooms = this.userRooms.get(userId);
      if (userRooms) {
        for (const room of userRooms) {
          client.leave(room);
        }
        this.userRooms.delete(userId);
      }

      this.logger.log(`Client ${client.id} disconnected. User: ${userId}`);
    }
  }

  // -------- SEND HEARTBEAT --------

  private sendHeartbeat() {
    const now = Date.now();
    this.server.emit("heartbeat", { timestamp: now });
  }

  // -------- MESSAGE HANDLERS --------

  /**
   * Send a new message.
   */
  @SubscribeMessage(WsEvent.MESSAGE_SEND)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
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
      if (!payload.chatId || !payload.content) {
        client.emit("error", {
          message: "Missing required fields: chatId and content",
        });
        return;
      }

      // Sanitize content
      const sanitizedContent = SanitizeUtil.sanitizeInput(payload.content, {
        trim: true,
        escapeHtml: true,
        removeXss: true,
        maxLength: 10000,
      });

      // Send message
      const message = await this.messagesService.sendMessage({
        chatId: payload.chatId,
        senderId: connection.userId,
        content: sanitizedContent,
        messageType: payload.messageType || MessageType.TEXT,
        replyToId: payload.replyToId,
        mentions: payload.mentions,
        metadata: payload.metadata,
      });

      // Prepare payload for recipients
      const receivePayload: ReceiveMessagePayload = {
        messageId: message.id,
        chatId: payload.chatId,
        senderId: connection.userId,
        senderName: connection.username,
        senderAvatar: message.sender?.profile?.avatarUrl || null,
        messageType: message.messageType,
        content: sanitizedContent,
        media: message.attachments?.[0] || null,
        replyToId: message.replyToId || undefined,
        replyToContent: message.replyTo?.content || undefined,
        mentions: payload.mentions || [],
        status: MessageStatus.SENT,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt?.toISOString(),
        isEdited: false,
        isDeleted: false,
        metadata: payload.metadata,
      };

      // Get chat participants to broadcast
      const participants = await this.getChatParticipants(payload.chatId);

      // Broadcast to all participants in the chat room
      const chatRoom = `chat:${payload.chatId}`;
      this.server.to(chatRoom).emit(WsEvent.MESSAGE_RECEIVE, receivePayload);

      // Send to sender's personal room for confirmation
      const userRoom = `user:${connection.userId}`;
      this.server.to(userRoom).emit(WsEvent.MESSAGE_RECEIVE, receivePayload);

      // Process mentions
      if (payload.mentions && payload.mentions.length > 0) {
        await this.messagesService.processMentions(
          message.id,
          payload.mentions,
        );
      }

      // Update last activity
      connection.lastActivity = new Date();

      this.logger.debug(
        `Message sent: ${message.id} from user: ${connection.userId}`,
      );
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Handle typing indicator.
   */
  @SubscribeMessage(WsEvent.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingStartPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      if (!payload.chatId) {
        client.emit("error", { message: "chatId is required" });
        return;
      }

      // Get chat participants
      const participants = await this.getChatParticipants(payload.chatId);

      // Send typing indicator to all participants
      const typingPayload: TypingStartPayload = {
        chatId: payload.chatId,
        userId: connection.userId,
        userName: connection.username,
        timestamp: new Date().toISOString(),
      };

      this.server.to(payload.chatId).emit(WsEvent.TYPING_START, typingPayload);

      // Store typing status with timeout
      this.setTypingUser(client.id, payload.chatId);
    } catch (error) {
      this.logger.error(`Error handling typing start: ${error.message}`);
    }
  }

  /**
   * Handle typing stop indicator.
   */
  @SubscribeMessage(WsEvent.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingStopPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      if (!payload.chatId) {
        client.emit("error", { message: "chatId is required" });
        return;
      }

      const typingPayload: TypingStopPayload = {
        chatId: payload.chatId,
        userId: connection.userId,
        timestamp: new Date().toISOString(),
      };

      this.server.to(payload.chatId).emit(WsEvent.TYPING_STOP, typingPayload);

      // Remove typing status
      this.removeTypingUser(client.id);
    } catch (error) {
      this.logger.error(`Error handling typing stop: ${error.message}`);
    }
  }

  /**
   * Handle read receipt.
   */
  @SubscribeMessage(WsEvent.READ_RECEIPT)
  async handleReadReceipt(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReadReceiptPayload,
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      if (
        !payload.chatId ||
        !payload.messageIds ||
        payload.messageIds.length === 0
      ) {
        client.emit("error", { message: "chatId and messageIds are required" });
        return;
      }

      // Update message statuses
      for (const messageId of payload.messageIds) {
        await this.messagesService.updateMessageStatus({
          messageId,
          userId: connection.userId,
          status: MessageStatus.READ,
        });
      }

      // Notify other participants
      const readPayload = {
        chatId: payload.chatId,
        messageIds: payload.messageIds,
        userId: connection.userId,
        userName: connection.username,
        readAt: new Date().toISOString(),
      };

      this.server.to(payload.chatId).emit(WsEvent.READ_RECEIPT, readPayload);
    } catch (error) {
      this.logger.error(`Error handling read receipt: ${error.message}`);
    }
  }

  // -------- PRESENCE HANDLERS --------

  /**
   * Broadcast presence update.
   */
  private broadcastPresence(
    userId: string,
    username: string,
    status: PresenceStatus,
  ) {
    const payload: PresenceOnlinePayload = {
      userId,
      userName: username,
      status,
      lastSeen: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients
    this.server.emit(WsEvent.PRESENCE_ONLINE, payload);
  }

  /**
   * Check if user has other active connections.
   */
  private hasActiveConnections(
    userId: string,
    excludeClientId: string,
  ): boolean {
    for (const [clientId, connection] of Object.entries(this.clients)) {
      if (clientId !== excludeClientId && connection.userId === userId) {
        return true;
      }
    }
    return false;
  }

  // -------- ROOM MANAGEMENT --------

  /**
   * Join a room.
   */
  @SubscribeMessage("join-room")
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; roomType: "chat" | "group" },
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const roomId = data.roomId;
      if (!roomId) {
        client.emit("error", { message: "roomId is required" });
        return;
      }

      // Validate access
      const hasAccess = await this.validateRoomAccess(
        roomId,
        connection.userId,
      );
      if (!hasAccess) {
        client.emit("error", { message: "Access denied" });
        return;
      }

      const roomName = `chat:${roomId}`;
      client.join(roomName);
      connection.rooms.add(roomName);
      this.addRoomToUser(connection.userId, roomName);

      client.emit("joined-room", { roomId, success: true });

      this.logger.debug(`User ${connection.userId} joined room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  /**
   * Leave a room.
   */
  @SubscribeMessage("leave-room")
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const connection = this.getConnection(client.id);
    if (!connection) {
      throw new WsException("Not authenticated");
    }

    try {
      const roomId = data.roomId;
      if (!roomId) {
        client.emit("error", { message: "roomId is required" });
        return;
      }

      const roomName = `chat:${roomId}`;
      client.leave(roomName);
      connection.rooms.delete(roomName);
      this.removeRoomFromUser(connection.userId, roomName);

      client.emit("left-room", { roomId, success: true });

      this.logger.debug(`User ${connection.userId} left room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`);
      client.emit("error", { message: error.message });
    }
  }

  // -------- GET CONNECTIONS --------

  /**
   * Get all active connections for a user.
   */
  private getUserConnections(userId: string): ClientConnection[] {
    const connections: ClientConnection[] = [];
    for (const connection of Object.values(this.clients)) {
      if (connection.userId === userId) {
        connections.push(connection);
      }
    }
    return connections;
  }

  // -------- TYPING HELPERS --------

  private setTypingUser(clientId: string, chatId: string): void {
    // Clear existing timeout
    if (this.typingUsers.has(clientId)) {
      const existing = this.typingUsers.get(clientId)!;
      clearTimeout(existing.timeout);
    }

    // Set new timeout (stop typing after 3 seconds of inactivity)
    const timeout = setTimeout(() => {
      this.removeTypingUser(clientId);
    }, 3000);

    this.typingUsers.set(clientId, { chatId, timeout });
  }

  private removeTypingUser(clientId: string): void {
    if (this.typingUsers.has(clientId)) {
      const entry = this.typingUsers.get(clientId)!;
      clearTimeout(entry.timeout);
      this.typingUsers.delete(clientId);
    }
  }

  // -------- RATE LIMITING --------

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

  // -------- HELPER METHODS --------

  /**
   * Get connection by client ID.
   */
  private getConnection(clientId: string): ClientConnection | undefined {
    return this.clients[clientId];
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
   * Validate room access.
   */
  private async validateRoomAccess(
    roomId: string,
    userId: string,
  ): Promise<boolean> {
    // Check if user is a member of the chat/group
    // This is a placeholder; we'll use actual validation
    try {
      const chat = await this.messagesService["prisma"].chat.findFirst({
        where: {
          id: roomId,
          OR: [
            { isGroup: false, messages: { some: { senderId: userId } } },
            { isGroup: true, members: { some: { userId } } },
          ],
        },
      });
      return !!chat;
    } catch (_) {
      return false;
    }
  }

  /**
   * Get chat participants.
   */
  private async getChatParticipants(chatId: string): Promise<string[]> {
    // Use the service's helper method
    return this.messagesService["getChatParticipants"](chatId);
  }

  /**
   * Add room to user's room list.
   */
  private addRoomToUser(userId: string, room: string): void {
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId)!.add(room);
  }

  /**
   * Remove room from user's room list.
   */
  private removeRoomFromUser(userId: string, room: string): void {
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId)!.delete(room);
      if (this.userRooms.get(userId)!.size === 0) {
        this.userRooms.delete(userId);
      }
    }
  }

  /**
   * Emit to room.
   */
  private emitToRoom(roomId: string, event: string, payload: any): void {
    const roomName = `chat:${roomId}`;
    this.server.to(roomName).emit(event, payload);
  }

  /**
   * Emit to user's personal room.
   */
  private emitToUser(userId: string, event: string, payload: any): void {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit(event, payload);
  }

  // -------- DISCONNECT HANDLER --------

  /**
   * Get connected clients count.
   */
  getConnectedClientsCount(): number {
    return Object.keys(this.clients).length;
  }

  /**
   * Get client connections for a user.
   */
  getClientsForUser(userId: string): ClientConnection[] {
    return this.getUserConnections(userId);
  }

  // -------- END --------
}
