import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { IsNewPassword } from './password-constraints';

/**
 * DTO for confirming password change with OTP (step 2 of change-password flow)
 */
export class ConfirmChangePasswordDto {
  @ApiProperty({ description: 'Session ID returned from request-change-password' })
  @IsString()
  sessionId: string;

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
