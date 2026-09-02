// backend/src/modules/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomBytes } from "crypto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptSaltRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // --------------------- REGISTRATION ---------------------
  async register(registerDto: RegisterDto) {
    const { email, phone, displayName, password, deviceName, deviceId } =
      registerDto;

    // Check for existing user by email
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingByEmail) {
      throw new ConflictException("A user with this email already exists");
    }

    // Check for existing user by phone (if provided)
    if (phone) {
      const existingByPhone = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existingByPhone) {
        throw new ConflictException(
          "A user with this phone number already exists",
        );
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, this.bcryptSaltRounds);

    // Generate email verification token (JWT)
    const verificationToken = this.jwtService.sign(
      { email: email.toLowerCase() },
      {
        secret: this.configService.get<string>("jwtSecret"),
        expiresIn: "24h",
      },
    );

    try {
      // Create user and profile in a transaction
      const newUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            phone: phone || null,
            passwordHash: hashedPassword,
            displayName: displayName.trim(),
            isActive: true,
            isVerified: false,
            lastSeen: new Date(),
            profile: {
              create: {
                bio: "Hey there! I am using Real WhatsApp Clone.",
                status: "Available",
              },
            },
          },
          include: {
            profile: true,
          },
        });

        // If device info provided, create a session immediately
        if (deviceName || deviceId) {
          const refreshToken = this.generateRefreshToken();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

          await tx.session.create({
            data: {
              userId: user.id,
              refreshToken: await bcrypt.hash(refreshToken, 10),
              deviceName: deviceName || "Unknown Device",
              deviceId: deviceId || undefined,
              expiresAt,
              ipAddress: "0.0.0.0", // We'll update from request later
              userAgent: "Unknown",
            },
          });
        }

        return user;
      });

      // Emit event for sending welcome email (async)
      this.eventEmitter.emit("user.registered", {
        userId: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        verificationToken,
      });

      this.logger.log(
        `User registered successfully: ${newUser.email} (ID: ${newUser.id})`,
      );

      // Return user without passwordHash
      const { passwordHash, ...safeUser } = newUser;
      return {
        ...safeUser,
        verificationToken, // Only sent once; user must verify email
      };
    } catch (error) {
      this.logger.error(`Registration failed for ${email}: ${error.message}`);
      throw new InternalServerErrorException(
        "Could not complete registration. Please try again later.",
      );
    }
  }

  // --------------------- EMAIL VERIFICATION ---------------------
  async verifyEmail(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("jwtSecret"),
      });

      const user = await this.prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new BadRequestException("Invalid verification token");
      }

      if (user.isVerified) {
        throw new BadRequestException("Email is already verified");
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });

      this.logger.log(`Email verified for user: ${user.email}`);
      return { message: "Email verified successfully. You can now log in." };
    } catch (error) {
      this.logger.warn(`Email verification failed: ${error.message}`);
      throw new BadRequestException("Invalid or expired verification token");
    }
  }

  // --------------------- LOGIN / VALIDATION ---------------------
  async validateUser(loginDto: LoginDto) {
    const { identifier, password, twoFactorCode } = loginDto;

    // Find user by email or phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      this.logger.warn(
        `Login attempt failed: user not found for ${identifier}`,
      );
      return null;
    }

    if (!user.isActive) {
      this.logger.warn(
        `Login attempt blocked: user ${user.email} is suspended`,
      );
      throw new UnauthorizedException(
        "Your account has been suspended. Contact support.",
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(
        `Login attempt failed: incorrect password for ${user.email}`,
      );
      return null;
    }

    // Check if 2FA is enabled
    if (user.is2faEnabled) {
      if (!twoFactorCode) {
        throw new UnauthorizedException("2FA code required");
      }

      const is2faValid = authenticator.verify({
        token: twoFactorCode,
        secret: user.twoFactorSecret,
      });

      if (!is2faValid) {
        this.logger.warn(
          `Login attempt failed: invalid 2FA code for ${user.email}`,
        );
        throw new UnauthorizedException("Invalid 2FA code");
      }
    }

    // Update last seen
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date() },
    });

    // Remove password hash before returning
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // --------------------- LOGIN (TOKEN GENERATION) ---------------------
  async login(
    user: any,
    deviceName?: string,
    deviceId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Generate tokens
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    // Hash refresh token and store in DB
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Check if device already exists, update or create
    let session;
    if (deviceId) {
      session = await this.prisma.session.findFirst({
        where: { userId: user.id, deviceId },
      });
    }

    if (session) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          refreshToken: hashedRefreshToken,
          expiresAt,
          ipAddress: ipAddress || session.ipAddress,
          userAgent: userAgent || session.userAgent,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: hashedRefreshToken,
          deviceName: deviceName || "Unknown Device",
          deviceId: deviceId || undefined,
          expiresAt,
          ipAddress: ipAddress || "0.0.0.0",
          userAgent: userAgent || "Unknown",
        },
      });
    }

    this.logger.log(
      `User logged in: ${user.email} (Device: ${deviceName || "unknown"})`,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        isVerified: user.isVerified,
        profile: user.profile,
      },
    };
  }

  // --------------------- REFRESH TOKEN ---------------------
  async refreshTokens(refreshToken: string, deviceId?: string) {
    try {
      // Find session with this refresh token (we store hashed)
      const sessions = await this.prisma.session.findMany({
        where: { deviceId: deviceId || undefined },
        include: { user: true },
      });

      let validSession = null;
      for (const session of sessions) {
        const isValid = await bcrypt.compare(
          refreshToken,
          session.refreshToken,
        );
        if (isValid) {
          validSession = session;
          break;
        }
      }

      if (!validSession) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      if (new Date() > validSession.expiresAt) {
        throw new UnauthorizedException(
          "Refresh token expired. Please log in again.",
        );
      }

      const user = validSession.user;
      if (!user.isActive) {
        throw new UnauthorizedException("Account is suspended");
      }

      // Generate new tokens
      const payload = { sub: user.id, email: user.email };
      const newAccessToken = this.jwtService.sign(payload);
      const newRefreshToken = this.generateRefreshToken();
      const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Rotate refresh token in DB
      await this.prisma.session.update({
        where: { id: validSession.id },
        data: {
          refreshToken: hashedNewRefreshToken,
          expiresAt,
        },
      });

      this.logger.log(`Tokens refreshed for user: ${user.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      this.logger.error(`Refresh token failed: ${error.message}`);
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  // --------------------- LOGOUT ---------------------
  async logout(userId: string, deviceId?: string) {
    if (deviceId) {
      await this.prisma.session.deleteMany({
        where: { userId, deviceId },
      });
      this.logger.log(`User ${userId} logged out from device ${deviceId}`);
    } else {
      // Logout all devices
      await this.prisma.session.deleteMany({
        where: { userId },
      });
      this.logger.log(`User ${userId} logged out from ALL devices`);
    }
    return { message: "Logged out successfully" };
  }

  // --------------------- FORGOT PASSWORD ---------------------
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // For security, do not reveal if user exists
      this.logger.warn(
        `Password reset requested for non-existent email: ${email}`,
      );
      return { message: "If this email exists, a reset link has been sent." };
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.get<string>("jwtSecret"),
        expiresIn: "1h",
      },
    );

    this.eventEmitter.emit("user.password-reset", {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      resetToken,
    });

    this.logger.log(`Password reset link sent to ${user.email}`);
    return { message: "If this email exists, a reset link has been sent." };
  }

  // --------------------- RESET PASSWORD ---------------------
  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("jwtSecret"),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new BadRequestException("Invalid or expired reset token");
      }

      if (!user.isActive) {
        throw new BadRequestException("Account is suspended");
      }

      const hashedPassword = await bcrypt.hash(
        newPassword,
        this.bcryptSaltRounds,
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
        },
      });

      // Invalidate all sessions after password reset (security best practice)
      await this.prisma.session.deleteMany({
        where: { userId: user.id },
      });

      this.logger.log(`Password reset successfully for user: ${user.email}`);
      return { message: "Password updated successfully. Please log in again." };
    } catch (error) {
      this.logger.warn(`Password reset failed: ${error.message}`);
      throw new BadRequestException("Invalid or expired reset token");
    }
  }

  // --------------------- 2FA SETUP ---------------------
  async enable2fa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.is2faEnabled) {
      throw new BadRequestException("2FA is already enabled for this user");
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      "RealWhatsAppClone",
      secret,
    );

    // Store the secret temporarily (we will activate after verification)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    this.logger.log(`2FA setup initiated for user: ${user.email}`);
    return {
      secret,
      otpauthUrl,
    };
  }

  async verify2faAndEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        "2FA setup not initiated. Please request setup first.",
      );
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException("Invalid 2FA verification code");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { is2faEnabled: true },
    });

    this.logger.log(`2FA enabled for user: ${user.email}`);
    return { message: "2FA enabled successfully" };
  }

  async disable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.is2faEnabled) {
      throw new BadRequestException("2FA is not enabled");
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException("Invalid 2FA verification code");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        is2faEnabled: false,
        twoFactorSecret: null,
      },
    });

    this.logger.log(`2FA disabled for user: ${user.email}`);
    return { message: "2FA disabled successfully" };
  }

  // --------------------- HELPER: GENERATE REFRESH TOKEN ---------------------
  private generateRefreshToken(): string {
    return randomBytes(64).toString("hex");
  }

  // --------------------- GET PROFILE (for /me) ---------------------
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // --------------------- UPDATE PROFILE ---------------------
  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      bio?: string;
      status?: string;
      avatarUrl?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updateData: any = {};
    if (data.displayName) {
      updateData.displayName = data.displayName.trim();
    }

    const profileUpdateData: any = {};
    if (data.bio !== undefined) {
      profileUpdateData.bio = data.bio?.trim() || null;
    }
    if (data.status !== undefined) {
      profileUpdateData.status = data.status?.trim() || "Available";
    }
    if (data.avatarUrl !== undefined) {
      profileUpdateData.avatarUrl = data.avatarUrl || null;
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      let userUpdate = user;
      if (Object.keys(updateData).length > 0) {
        userUpdate = await tx.user.update({
          where: { id: userId },
          data: updateData,
          include: { profile: true },
        });
      }

      if (Object.keys(profileUpdateData).length > 0 && user.profile) {
        await tx.profile.update({
          where: { userId: userId },
          data: profileUpdateData,
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });
    });

    this.logger.log(`Profile updated for user: ${user.email}`);
    const { passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }
}
