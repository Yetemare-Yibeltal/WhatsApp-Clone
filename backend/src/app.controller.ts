// backend/src/app.controller.ts
import {
  Controller,
  Get,
  Head,
  Options,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Res,
  Req,
  UseGuards,
  Logger,
  HttpException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { AppService } from "./app.service";
import { Public } from "./common/decorators/public.decorator";
import { ApiResponseBuilder } from "./common/types/api-response.interface";

@ApiTags("Health")
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Root endpoint",
    description: "Returns basic information about the API.",
  })
  @ApiOkResponse({
    description: "API information retrieved",
    schema: {
      example: {
        statusCode: 200,
        message: "API is running",
        data: {
          name: "Real WhatsApp Clone API",
          version: "1.0.0",
          status: "online",
          timestamp: "2024-01-15T10:30:00Z",
          docs: "/api/docs",
          health: "/health",
        },
      },
    },
  })
  async getRoot() {
    const version = await this.appService.getVersion();
    return ApiResponseBuilder.success(
      {
        name: version.name,
        version: version.version,
        status: "online",
        timestamp: new Date().toISOString(),
        docs: "/api/docs",
        health: "/health",
        ready: "/ready",
        live: "/live",
        metrics: "/metrics",
      },
      "API is running",
      HttpStatus.OK,
    );
  }

  @Public()
  @Get("health")
  @ApiOperation({
    summary: "Health check",
    description:
      "Returns the health status of the application and its dependencies.",
  })
  @ApiOkResponse({
    description: "Health status retrieved",
    schema: {
      example: {
        statusCode: 200,
        message: "Health check passed",
        data: {
          status: "ok",
          timestamp: "2024-01-15T10:30:00Z",
          uptime: 3600,
          services: {
            database: { status: "ok", latency: 5 },
            redis: { status: "ok", latency: 2 },
            elasticsearch: { status: "ok", latency: 10 },
            minio: { status: "ok", latency: 8 },
          },
          system: {
            cpu: { usage: 15.5, cores: 8 },
            memory: {
              total: 16000000000,
              free: 8000000000,
              used: 8000000000,
              usagePercent: 50,
            },
            disk: {
              total: 500000000000,
              free: 250000000000,
              used: 250000000000,
              usagePercent: 50,
            },
            loadAvg: [1.5, 2.0, 1.8],
            uptime: 3600,
          },
          version: "1.0.0",
          environment: "production",
          nodeVersion: "v18.17.0",
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Health check failed",
  })
  async getHealth() {
    this.logger.debug("Health check requested");
    try {
      const result = await this.appService.getHealth();
      const isHealthy = result.status !== "down";
      const statusCode = isHealthy
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;
      const message = isHealthy ? "Health check passed" : "Health check failed";
      return ApiResponseBuilder.success(result, message, statusCode);
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Health check failed",
          HttpStatus.SERVICE_UNAVAILABLE,
          "HEALTH_CHECK_FAILED",
        ),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Public()
  @Get("ready")
  @ApiOperation({
    summary: "Readiness probe",
    description: "Returns whether the application is ready to accept traffic.",
  })
  @ApiOkResponse({
    description: "Application is ready",
    schema: {
      example: {
        statusCode: 200,
        message: "Application is ready",
        data: {
          ready: true,
          services: {
            database: true,
            redis: true,
            elasticsearch: true,
            minio: true,
          },
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Application is not ready",
  })
  async getReady() {
    this.logger.debug("Readiness check requested");
    try {
      const result = await this.appService.getReady();
      const isReady = result.ready;
      const statusCode = isReady
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;
      const message = isReady
        ? "Application is ready"
        : "Application is not ready";
      return ApiResponseBuilder.success(result, message, statusCode);
    } catch (error) {
      this.logger.error(`Readiness check failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Readiness check failed",
          HttpStatus.SERVICE_UNAVAILABLE,
          "READINESS_CHECK_FAILED",
        ),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Public()
  @Get("live")
  @ApiOperation({
    summary: "Liveness probe",
    description: "Returns whether the application is alive and running.",
  })
  @ApiOkResponse({
    description: "Application is alive",
    schema: {
      example: {
        statusCode: 200,
        message: "Application is alive",
        data: {
          alive: true,
          uptime: "1h 30m 15s",
          startTime: "2024-01-15T09:00:00Z",
        },
      },
    },
  })
  async getLive() {
    this.logger.debug("Liveness check requested");
    try {
      const uptime = await this.appService.getUptime();
      return ApiResponseBuilder.success(
        {
          alive: true,
          uptime: uptime.formatted,
          startTime: uptime.startTime,
        },
        "Application is alive",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Liveness check failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Liveness check failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
          "LIVENESS_CHECK_FAILED",
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Get("metrics")
  @ApiOperation({
    summary: "Metrics endpoint",
    description: "Returns system metrics for monitoring.",
  })
  @ApiOkResponse({
    description: "Metrics retrieved",
    schema: {
      example: {
        statusCode: 200,
        message: "Metrics retrieved",
        data: {
          timestamp: "2024-01-15T10:30:00Z",
          uptime: "1h 30m 15s",
          status: "ok",
          system: {
            cpu: { usage: 15.5, cores: 8 },
            memory: {
              total: 16000000000,
              free: 8000000000,
              used: 8000000000,
              usagePercent: 50,
            },
            disk: {
              total: 500000000000,
              free: 250000000000,
              used: 250000000000,
              usagePercent: 50,
            },
            loadAvg: [1.5, 2.0, 1.8],
          },
          services: {
            database: "ok",
            redis: "ok",
            elasticsearch: "ok",
            minio: "ok",
          },
          version: "1.0.0",
          environment: "production",
          nodeVersion: "v18.17.0",
        },
      },
    },
  })
  async getMetrics() {
    this.logger.debug("Metrics requested");
    try {
      const result = await this.appService.getMetrics();
      return ApiResponseBuilder.success(
        result,
        "Metrics retrieved",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Metrics retrieval failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Metrics retrieval failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
          "METRICS_FAILED",
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Get("version")
  @ApiOperation({
    summary: "Version endpoint",
    description: "Returns the application version information.",
  })
  @ApiOkResponse({
    description: "Version retrieved",
    schema: {
      example: {
        statusCode: 200,
        message: "Version retrieved",
        data: {
          version: "1.0.0",
          name: "whatsapp-clone",
          description: "Real WhatsApp Clone",
        },
      },
    },
  })
  async getVersion() {
    this.logger.debug("Version requested");
    try {
      const result = await this.appService.getVersion();
      return ApiResponseBuilder.success(
        result,
        "Version retrieved",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Version retrieval failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Version retrieval failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
          "VERSION_FAILED",
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Get("system")
  @ApiOperation({
    summary: "System info",
    description: "Returns detailed system information.",
  })
  @ApiOkResponse({
    description: "System info retrieved",
  })
  async getSystemInfo() {
    this.logger.debug("System info requested");
    try {
      const result = await this.appService.getSystemInfo();
      return ApiResponseBuilder.success(
        result,
        "System info retrieved",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`System info retrieval failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "System info retrieval failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
          "SYSTEM_INFO_FAILED",
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Get("ping")
  @ApiOperation({
    summary: "Ping endpoint",
    description: "Simple ping-pong endpoint for connectivity testing.",
  })
  @ApiOkResponse({
    description: "Pong response",
    schema: {
      example: {
        statusCode: 200,
        message: "Pong",
        data: {
          pong: "pong",
          timestamp: "2024-01-15T10:30:00Z",
          service: "whatsapp-clone-api",
        },
      },
    },
  })
  async getPing() {
    this.logger.debug("Ping requested");
    try {
      const result = await this.appService.ping();
      return ApiResponseBuilder.success(result, "Pong", HttpStatus.OK);
    } catch (error) {
      this.logger.error(`Ping failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Ping failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
          "PING_FAILED",
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Get("uptime")
  @ApiOperation({
    summary: "Uptime endpoint",
    description: "Returns the application uptime.",
  })
  @ApiOkResponse({
    description: "Uptime retrieved",
    schema: {
      example: {
        statusCode: 200,
        message: "Uptime retrieved",
        data: {
          uptime: 3600,
          startTime: "2024-01-15T09:00:00Z",
          formatted: "1h 0m 0s",
        },
      },
    },
  })
  async getUptime() {
    this.logger.debug("Uptime requested");
    try {
      const result = await this.appService.getUptime();
      return ApiResponseBuilder.success(
        result,
        "Uptime retrieved",
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Uptime retrieval failed: ${error.message}`);
      throw new HttpException(
        ApiResponseBuilder.error(
          "Uptime retrieval failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
          "UPTIME_FAILED",
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Options("*")
  @Public()
  @ApiOperation({
    summary: "CORS preflight",
    description: "Handles CORS preflight requests.",
  })
  async options(@Res() res: Response) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization, X-Requested-With, X-Request-ID, X-Correlation-ID",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).send();
  }

  @Public()
  @Head("*")
  async head(@Req() req: Request, @Res() res: Response) {
    res.setHeader("X-Powered-By", "NestJS");
    res.setHeader(
      "X-Response-Time",
      `${Date.now() - (req as any)._startTime || 0}ms`,
    );
    res.status(200).send();
  }
}
