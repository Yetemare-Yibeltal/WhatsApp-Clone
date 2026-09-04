// backend/src/common/filters/websocket-exception.filter.ts
import {
  Catch,
  ArgumentsHost,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  HttpException,
} from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { Prisma } from "@prisma/client";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface WsErrorResponse {
  event: "error";
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId?: string;
    timestamp: string;
    statusCode: number;
  };
  reconnection?: {
    recommended: boolean;
    delayMs?: number;
  };
}

export interface WsValidationErrorResponse {
  event: "error";
  error: {
    code: string;
    message: string;
    details: {
      validationErrors: Record<string, string[]>;
    };
    requestId?: string;
    timestamp: string;
    statusCode: number;
  };
}

export interface WsErrorMetadata {
  clientId: string;
  room?: string | string[];
  userId?: string;
  event: string;
  payload?: any;
  ip: string;
  userAgent: string;
}

@Catch()
export class WebsocketExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WebsocketExceptionFilter.name);
  private readonly isDevelopment: boolean;
  private readonly logSampleRate: number;
  private readonly disconnectOnCriticalErrors: boolean;
  private readonly logCounter = new Map<
    string,
    { count: number; lastLogTime: number }
  >();
  private readonly rateLimitWindow = 60000;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter?: EventEmitter2,
  ) {
    super();
    this.isDevelopment = this.configService.get("nodeEnv") === "development";
    this.logSampleRate = parseFloat(
      this.configService.get("WS_ERROR_LOG_SAMPLE") || "1.0",
    );
    this.disconnectOnCriticalErrors =
      this.configService.get("WS_DISCONNECT_ON_CRITICAL_ERROR") !== "false";
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const context = host.switchToWs().getData();
    const event = host.switchToWs().getPattern();

    const metadata = this.buildMetadata(client, event, context);
    const errorResponse = this.classifyException(exception, metadata);

    const shouldLog = this.shouldLogError(
      errorResponse.error.code,
      event,
      metadata.userId,
    );
    if (shouldLog) {
      this.logError(exception, errorResponse, metadata);
    }

    if (this.eventEmitter && errorResponse.error.statusCode >= 500) {
      this.eventEmitter.emit("ws.error.critical", {
        error: errorResponse,
        metadata,
        exception,
        timestamp: new Date(),
      });
    }

    try {
      errorResponse.error.requestId = metadata.clientId;
      errorResponse.error.timestamp = new Date().toISOString();

      client.emit("error", errorResponse);
      client.emit("ws:error", {
        code: errorResponse.error.code,
        message: errorResponse.error.message,
        details: errorResponse.error.details,
        timestamp: errorResponse.error.timestamp,
        requestId: errorResponse.error.requestId,
      });

      if (
        this.disconnectOnCriticalErrors &&
        errorResponse.error.statusCode >= 500
      ) {
        this.logger.warn(
          `Disconnecting client ${metadata.clientId} due to critical error: ${errorResponse.error.code}`,
        );
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(
        `Failed to send error response to client ${metadata.clientId}: ${error.message}`,
      );
      try {
        client.disconnect();
      } catch (_) {}
    }
  }

  private classifyException(
    exception: unknown,
    metadata: WsErrorMetadata,
  ): WsErrorResponse {
    const now = new Date().toISOString();

    if (exception instanceof WsException) {
      const message = exception.message || "WebSocket error";
      const errorCode = this.getErrorCodeFromMessage(message);
      if (typeof exception.getError() === "object") {
        const errorObj = exception.getError() as any;
        if (errorObj.details && errorObj.details.validationErrors) {
          return {
            event: "error",
            error: {
              code: errorCode || "VALIDATION_ERROR",
              message: errorObj.message || "Validation failed",
              details: errorObj.details,
              timestamp: now,
              statusCode: 400,
            },
          };
        }
        return {
          event: "error",
          error: {
            code: errorCode || "WS_ERROR",
            message: errorObj.message || message,
            details: errorObj.details,
            timestamp: now,
            statusCode: 400,
          },
        };
      }
      let details: Record<string, any> | undefined;
      if (typeof exception.getError() === "object") {
        const errorObj = exception.getError() as any;
        details = errorObj.details || errorObj;
      }
      return {
        event: "error",
        error: {
          code: errorCode || "WS_ERROR",
          message,
          details,
          timestamp: now,
          statusCode: 400,
        },
      };
    }

    if (exception instanceof UnauthorizedException) {
      const response = exception.getResponse() as any;
      return {
        event: "error",
        error: {
          code: "AUTH_UNAUTHORIZED",
          message: response.message || "Authentication required",
          details: response.details,
          timestamp: now,
          statusCode: 401,
        },
        reconnection: { recommended: true, delayMs: 1000 },
      };
    }

    if (exception instanceof ForbiddenException) {
      const response = exception.getResponse() as any;
      return {
        event: "error",
        error: {
          code: "AUTH_FORBIDDEN",
          message: response.message || "Access denied",
          details: response.details,
          timestamp: now,
          statusCode: 403,
        },
        reconnection: { recommended: false },
      };
    }

    if (exception instanceof BadRequestException) {
      const response = exception.getResponse() as any;
      let details: Record<string, any> | undefined;
      if (response.message && Array.isArray(response.message)) {
        const validationErrors: Record<string, string[]> = {};
        for (const msg of response.message) {
          if (typeof msg === "string" && msg.includes(" ")) {
            const field = msg.split(" ")[0];
            if (!validationErrors[field]) validationErrors[field] = [];
            validationErrors[field].push(msg);
          }
        }
        details = { validationErrors, rawErrors: response.message };
      } else if (response.details) {
        details = response.details;
      }
      return {
        event: "error",
        error: {
          code: "BAD_REQUEST",
          message: response.message || "Invalid request",
          details,
          timestamp: now,
          statusCode: 400,
        },
      };
    }

    if (exception instanceof NotFoundException) {
      const response = exception.getResponse() as any;
      return {
        event: "error",
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: response.message || "Resource not found",
          details: response.details,
          timestamp: now,
          statusCode: 404,
        },
      };
    }

    if (exception instanceof ConflictException) {
      const response = exception.getResponse() as any;
      return {
        event: "error",
        error: {
          code: "CONFLICT",
          message: response.message || "Resource conflict",
          details: response.details,
          timestamp: now,
          statusCode: 409,
        },
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse() as any;
      const errorCodes: Record<number, string> = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
      };
      return {
        event: "error",
        error: {
          code: errorCodes[statusCode] || "HTTP_ERROR",
          message: response.message || response.error || "HTTP error",
          details: response.details,
          timestamp: now,
          statusCode,
        },
        reconnection: {
          recommended: statusCode >= 500,
          delayMs: statusCode >= 500 ? 2000 : undefined,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, now);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        event: "error",
        error: {
          code: "DATABASE_VALIDATION_ERROR",
          message: "Invalid data provided to database",
          details: {
            message: this.isDevelopment
              ? exception.message
              : "Validation error",
          },
          timestamp: now,
          statusCode: 400,
        },
      };
    }

    if (exception instanceof TokenExpiredError) {
      return {
        event: "error",
        error: {
          code: "TOKEN_EXPIRED",
          message: "Authentication token has expired",
          timestamp: now,
          statusCode: 401,
        },
        reconnection: { recommended: true, delayMs: 1000 },
      };
    }

    if (exception instanceof JsonWebTokenError) {
      return {
        event: "error",
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid authentication token",
          timestamp: now,
          statusCode: 401,
        },
      };
    }

    if (exception instanceof Error) {
      const errorCode = this.getErrorCodeFromMessage(exception.message);
      const message = this.isDevelopment
        ? exception.message
        : "An unexpected error occurred";
      return {
        event: "error",
        error: {
          code: errorCode || "INTERNAL_SERVER_ERROR",
          message,
          details:
            this.isDevelopment && exception.stack
              ? { stack: exception.stack }
              : undefined,
          timestamp: now,
          statusCode: 500,
        },
        reconnection: { recommended: true, delayMs: 2000 },
      };
    }

    return {
      event: "error",
      error: {
        code: "UNKNOWN_ERROR",
        message: this.isDevelopment
          ? `Unknown error: ${String(exception)}`
          : "An unexpected error occurred",
        timestamp: now,
        statusCode: 500,
      },
      reconnection: { recommended: true, delayMs: 2000 },
    };
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
  ): WsErrorResponse {
    const baseResponse: WsErrorResponse = {
      event: "error",
      error: {
        code: "DATABASE_ERROR",
        message: "A database error occurred",
        timestamp,
        statusCode: 500,
      },
      reconnection: { recommended: true, delayMs: 2000 },
    };

    switch (exception.code) {
      case "P2002": {
        const target = exception.meta?.target as string[];
        return {
          ...baseResponse,
          error: {
            ...baseResponse.error,
            code: "DB_UNIQUE_CONSTRAINT",
            message: `A record with the same ${target?.join(", ") || "value"} already exists`,
            details: { fields: target, model: exception.meta?.modelName },
            statusCode: 409,
          },
        };
      }
      case "P2003": {
        return {
          ...baseResponse,
          error: {
            ...baseResponse.error,
            code: "DB_FOREIGN_KEY",
            message: "The referenced record does not exist",
            details: { field: exception.meta?.field_name },
            statusCode: 400,
          },
        };
      }
      case "P2025": {
        return {
          ...baseResponse,
          error: {
            ...baseResponse.error,
            code: "DB_RECORD_NOT_FOUND",
            message: "The requested record was not found",
            statusCode: 404,
          },
        };
      }
      case "P2014": {
        return {
          ...baseResponse,
          error: {
            ...baseResponse.error,
            code: "DB_RELATION_VIOLATION",
            message: "The operation would violate a required relation",
            statusCode: 400,
          },
        };
      }
      case "P1000":
      case "P1001":
      case "P1002":
      case "P1008":
      case "P1017": {
        return {
          ...baseResponse,
          error: {
            ...baseResponse.error,
            code: "DB_CONNECTION_ERROR",
            message: "Database connection error",
            statusCode: 503,
          },
          reconnection: { recommended: true, delayMs: 5000 },
        };
      }
      default: {
        const devDetails = this.isDevelopment
          ? {
              code: exception.code,
              meta: exception.meta,
              message: exception.message,
            }
          : undefined;
        return {
          ...baseResponse,
          error: {
            ...baseResponse.error,
            details: devDetails,
            message: this.isDevelopment ? exception.message : "Database error",
          },
        };
      }
    }
  }

  private buildMetadata(
    client: Socket,
    event: string | undefined,
    payload: any,
  ): WsErrorMetadata {
    const handshake = client.handshake;
    const user = client.data?.user;
    let ip = "0.0.0.0";
    const forwarded = handshake.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = (
        typeof forwarded === "string" ? forwarded : forwarded[0] || ""
      )
        .split(",")
        .map((s) => s.trim());
      ip = ips[0] || "0.0.0.0";
    } else if (handshake.address) {
      ip = handshake.address;
    }
    const userAgent = handshake.headers["user-agent"] || "unknown";
    let rooms: string[] = [];
    try {
      const socketRooms = client.rooms || new Set();
      rooms = Array.from(socketRooms).filter(
        (r) => r !== client.id,
      ) as string[];
    } catch (_) {}
    return {
      clientId: client.id,
      room: rooms.length > 0 ? rooms : undefined,
      userId: user?.id,
      event: event || "unknown",
      payload: this.isDevelopment ? payload : undefined,
      ip,
      userAgent,
    };
  }

  private getErrorCodeFromMessage(message: string): string {
    const patterns: Record<string, RegExp> = {
      AUTH_UNAUTHORIZED: /unauthorized|unauthenticated|login|auth required/i,
      AUTH_FORBIDDEN: /forbidden|permission|denied|access/i,
      BAD_REQUEST: /invalid|bad request|missing|required/i,
      NOT_FOUND: /not found|does not exist|no such/i,
      CONFLICT: /conflict|duplicate|already exists/i,
      TOO_MANY_REQUESTS: /rate limit|too many|throttle/i,
      VALIDATION_ERROR: /validation|valid|invalid|required field/i,
      TIMEOUT: /timeout|timed out|time out/i,
      INTERNAL_SERVER_ERROR: /server error|internal|unexpected error/i,
    };
    for (const [code, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) return code;
    }
    return "UNKNOWN_ERROR";
  }

  private shouldLogError(
    errorCode: string,
    event: string | undefined,
    userId: string | undefined,
  ): boolean {
    if (
      errorCode === "INTERNAL_SERVER_ERROR" ||
      errorCode === "DB_CONNECTION_ERROR"
    )
      return true;
    if (this.logSampleRate < 1.0 && Math.random() > this.logSampleRate)
      return false;
    const key = `${errorCode}:${event || "unknown"}:${userId || "anonymous"}`;
    const now = Date.now();
    const entry = this.logCounter.get(key);
    if (!entry) {
      this.logCounter.set(key, { count: 1, lastLogTime: now });
      return true;
    }
    if (now - entry.lastLogTime > this.rateLimitWindow) {
      this.logCounter.set(key, { count: 1, lastLogTime: now });
      return true;
    }
    entry.count++;
    if (entry.count % 10 === 0) return true;
    return false;
  }

  private logError(
    exception: unknown,
    errorResponse: WsErrorResponse,
    metadata: WsErrorMetadata,
  ): void {
    const logContext = {
      clientId: metadata.clientId,
      userId: metadata.userId || "anonymous",
      event: metadata.event,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      room: metadata.room,
      statusCode: errorResponse.error.statusCode,
      errorCode: errorResponse.error.code,
      errorMessage: errorResponse.error.message,
      timestamp: errorResponse.error.timestamp,
    };
    if (errorResponse.error.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `WS ERROR [${errorResponse.error.code}]: ${errorResponse.error.message} | Client: ${metadata.clientId} | User: ${metadata.userId || "anon"}`,
        stack,
        logContext,
      );
    } else if (errorResponse.error.statusCode >= 400) {
      this.logger.warn(
        `WS ERROR [${errorResponse.error.code}]: ${errorResponse.error.message} | Client: ${metadata.clientId}`,
        logContext,
      );
    } else {
      this.logger.debug(
        `WS ERROR [${errorResponse.error.code}]: ${errorResponse.error.message}`,
        logContext,
      );
    }
  }

  static createValidationError(
    validationErrors: Record<string, string[]>,
    message: string = "Validation failed",
  ): WsValidationErrorResponse {
    return {
      event: "error",
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: { validationErrors },
        timestamp: new Date().toISOString(),
        statusCode: 400,
      },
    };
  }

  static createError(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, any>,
  ): WsErrorResponse {
    return {
      event: "error",
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        statusCode,
      },
    };
  }

  static isCriticalError(error: WsErrorResponse): boolean {
    const criticalCodes = [
      "AUTH_UNAUTHORIZED",
      "AUTH_FORBIDDEN",
      "TOKEN_EXPIRED",
      "INVALID_TOKEN",
      "DB_CONNECTION_ERROR",
      "INTERNAL_SERVER_ERROR",
    ];
    return (
      criticalCodes.includes(error.error.code) || error.error.statusCode >= 500
    );
  }

  static getClientFriendlyMessage(error: WsErrorResponse): string {
    const messages: Record<string, string> = {
      AUTH_UNAUTHORIZED: "Please log in to continue.",
      AUTH_FORBIDDEN: "You do not have permission to perform this action.",
      TOKEN_EXPIRED: "Your session has expired. Please log in again.",
      INVALID_TOKEN: "Invalid authentication token. Please log in again.",
      VALIDATION_ERROR: "Please check your input and try again.",
      BAD_REQUEST: "The request was invalid. Please check your data.",
      NOT_FOUND: "The requested resource was not found.",
      CONFLICT: "A conflict occurred. Please try again.",
      TOO_MANY_REQUESTS: "Too many requests. Please slow down.",
      DB_CONNECTION_ERROR:
        "Service temporarily unavailable. Please try again later.",
      INTERNAL_SERVER_ERROR:
        "An unexpected error occurred. Please try again later.",
    };
    return (
      messages[error.error.code] || error.error.message || "An error occurred"
    );
  }
}
