import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { IsNewPassword } from './password-constraints';

export class RequestPasswordResetDto {
  @ApiPropertyOptional({ description: 'Email address or Public ID (preferred)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  emailOrPublicId?: string;

  @ApiPropertyOptional({ description: 'Email address (legacy alias for emailOrPublicId)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  email?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password (minimum 8 characters)' })
  @IsNewPassword()
  newPassword: string;
}

export class ValidateResetTokenDto {
  @ApiProperty({ description: 'Password setup / reset token from the email link' })
  @IsString()
  token: string;
}
