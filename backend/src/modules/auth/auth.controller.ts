// backend/src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Get,
  Patch,
  Delete,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Request } from "express";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User registered successfully" })
  @ApiResponse({ status: 409, description: "Email or phone already exists" })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post("verify-email")
  @ApiOperation({ summary: "Verify email address using token" })
  @ApiResponse({ status: 200, description: "Email verified" })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  async verifyEmail(@Query("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Login with email/phone and password (supports 2FA)",
  })
  @ApiResponse({ status: 200, description: "Login successful" })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials or 2FA required",
  })
  @ApiBody({ type: LoginDto })
  async login(
    @Req() req: Request,
    @Body() loginDto: LoginDto,
    @Body("deviceName") deviceName?: string,
    @Body("deviceId") deviceId?: string,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "Unknown";
    return this.authService.login(
      req.user,
      deviceName,
      deviceId,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  @ApiResponse({ status: 200, description: "New access token generated" })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  @ApiBody({
    schema: {
      properties: {
        refreshToken: { type: "string" },
        deviceId: { type: "string" },
      },
    },
  })
  async refreshTokens(
    @Body("refreshToken") refreshToken: string,
    @Body("deviceId") deviceId?: string,
  ) {
    return this.authService.refreshTokens(refreshToken, deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout from current device or all devices" })
  @ApiResponse({ status: 200, description: "Logged out successfully" })
  async logout(@CurrentUser() user: any, @Body("deviceId") deviceId?: string) {
    return this.authService.logout(user.id, deviceId);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request password reset link" })
  @ApiResponse({
    status: 200,
    description: "Reset link sent (if email exists)",
  })
  @ApiBody({ schema: { properties: { email: { type: "string" } } } })
  async forgotPassword(@Body("email") email: string) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password using token" })
  @ApiResponse({ status: 200, description: "Password reset successfully" })
  @ApiResponse({ status: 400, description: "Invalid token or password" })
  @ApiBody({
    schema: {
      properties: {
        token: { type: "string" },
        newPassword: { type: "string" },
      },
    },
  })
  async resetPassword(
    @Body("token") token: string,
    @Body("newPassword") newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/setup")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initiate 2FA setup (generates secret and OTP URL)",
  })
  @ApiResponse({ status: 200, description: "2FA secret generated" })
  async setup2fa(@CurrentUser() user: any) {
    return this.authService.enable2fa(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/verify")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify 2FA code and enable 2FA" })
  @ApiResponse({ status: 200, description: "2FA enabled" })
  @ApiResponse({ status: 400, description: "Invalid verification code" })
  @ApiBody({ schema: { properties: { code: { type: "string" } } } })
  async verify2fa(@CurrentUser() user: any, @Body("code") code: string) {
    return this.authService.verify2faAndEnable(user.id, code);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("2fa/disable")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Disable 2FA (requires verification code)" })
  @ApiResponse({ status: 200, description: "2FA disabled" })
  @ApiBody({ schema: { properties: { code: { type: "string" } } } })
  async disable2fa(@CurrentUser() user: any, @Body("code") code: string) {
    return this.authService.disable2fa(user.id, code);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile" })
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user profile" })
  @ApiResponse({ status: 200, description: "Profile updated" })
  @ApiBody({
    schema: {
      properties: {
        displayName: { type: "string" },
        bio: { type: "string" },
        status: { type: "string" },
        avatarUrl: { type: "string" },
      },
    },
  })
  async updateProfile(
    @CurrentUser() user: any,
    @Body()
    updateData: {
      displayName?: string;
      bio?: string;
      status?: string;
      avatarUrl?: string;
    },
  ) {
    return this.authService.updateProfile(user.id, updateData);
  }
}
