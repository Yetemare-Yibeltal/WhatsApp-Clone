// backend/src/modules/auth/dto/login.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @ApiProperty({
    description: "Email address or phone number (E.164 format)",
    example: "john.doe@example.com or +15551234567",
  })
  @IsString()
  @IsNotEmpty({ message: "Email or phone is required" })
  @Transform(({ value }) => value.trim())
  identifier: string;

  @ApiProperty({
    description: "User password",
    example: "SecureP@ssw0rd",
  })
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128)
  password: string;

  @ApiProperty({
    description: "Optional device name for session tracking",
    example: "Firefox on Ubuntu",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  deviceName?: string;

  @ApiProperty({
    description: "Optional device fingerprint for session validation",
    example: "xyz-789-uvw-012",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  deviceId?: string;

  @ApiProperty({
    description: "2FA verification code (if 2FA is enabled for the user)",
    example: "123456",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(6)
  @MinLength(6)
  twoFactorCode?: string;
}
