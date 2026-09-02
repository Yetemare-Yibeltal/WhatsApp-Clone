// backend/src/modules/auth/dto/register.dto.ts
import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsNotEmpty,
  ValidateIf,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class RegisterDto {
  @ApiProperty({
    description: "User email address (must be unique)",
    example: "john.doe@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  @Transform(({ value }) => value.toLowerCase().trim())
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "Phone number in international format (E.164)",
    example: "+15551234567",
    required: false,
  })
  @IsPhoneNumber(null, {
    message: "Please provide a valid phone number (E.164 format)",
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @ApiProperty({
    description: "Full display name (will appear in chat)",
    example: "John Doe",
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2, { message: "Display name must be at least 2 characters" })
  @MaxLength(50, { message: "Display name must be at most 50 characters" })
  @Transform(({ value }) => value.trim())
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({
    description:
      "Password (minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number)",
    example: "SecureP@ssw0rd",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password is too long" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        "Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character",
    },
  )
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: "Optional device name for session tracking",
    example: "Chrome Browser on Windows",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  deviceName?: string;

  @ApiProperty({
    description: "Optional device fingerprint for session validation",
    example: "abc-123-def-456",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  deviceId?: string;

  // Conditional validation: if phone is provided, it must be unique, but we handle uniqueness in service
  @ValidateIf((o) => o.phone !== undefined && o.phone !== "")
  @IsPhoneNumber(null)
  phoneIfPresent: string;
}
