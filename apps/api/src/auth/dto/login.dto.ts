import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address (for super admin) or public ID (for admins/teachers)',
    example: 'teacher@school.com or AG-SCHL-A3B5C7',
    required: true,
  })
  @IsString()
  emailOrPublicId: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Parent phone number',
    example: '+2348012345678',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'OTP code sent via SMS (6 digits)',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'OTP code must be exactly 6 digits' })
  @MaxLength(6, { message: 'OTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP code must contain only digits' })
  code: string;
}

export class VerifyLoginOtpDto {
  @ApiProperty({
    description: 'Session ID returned from login endpoint',
    example: 'abc123def456...',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'OTP code sent via email (6 digits)',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'OTP code must be exactly 6 digits' })
  @MaxLength(6, { message: 'OTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP code must contain only digits' })
  code: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Whether OTP verification is required',
    example: true,
  })
  requiresOtp: boolean;

  @ApiProperty({
    description: 'Session ID for OTP verification (only if requiresOtp is true)',
    example: 'abc123def456...',
    required: false,
  })
  sessionId?: string;

  @ApiProperty({
    description: 'User email (for display purposes)',
    example: 'user@example.com',
    required: false,
  })
  email?: string;
}

export class AuthTokensDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'User profile information',
  })
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    accountStatus: string;
    firstName?: string | null;
    lastName?: string | null;
    profileId?: string | null;
    publicId?: string | null;
    schoolId?: string | null; // ✅ Current school context
  };
}
