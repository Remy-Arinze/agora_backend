import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
    description: 'OTP code sent via SMS',
    example: '123456',
    minLength: 4,
    maxLength: 6,
  })
  @IsString()
  @MinLength(4)
  code: string;
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
    profileId?: string | null;
    publicId?: string | null;
    schoolId?: string | null; // ✅ Current school context
  };
}

