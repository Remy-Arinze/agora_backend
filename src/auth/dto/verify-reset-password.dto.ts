import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { IsNewPassword } from './password-constraints';

/**
 * DTO for verifying reset-password OTP and setting new password (forgot-password flow)
 */
export class VerifyResetPasswordDto {
  @ApiPropertyOptional({ description: 'Email address or Public ID used in request-password-reset' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  emailOrPublicId?: string;

  @ApiPropertyOptional({ description: 'Email address (legacy alias for emailOrPublicId)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  email?: string;

  @ApiProperty({ description: '6-digit OTP code sent to email', example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  otpCode: string;

  @ApiProperty({
    description: 'New password (min 8 characters; school policy may require more)',
    example: 'NewPassword123!',
  })
  @IsNewPassword()
  newPassword: string;
}
