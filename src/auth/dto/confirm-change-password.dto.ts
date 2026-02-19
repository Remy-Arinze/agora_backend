import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, NotContains, Length } from 'class-validator';

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
    description: 'New password (min 8 chars, uppercase, lowercase, number, special)',
    example: 'NewPassword123!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    },
  )
  @NotContains('<', { message: 'Invalid characters in password' })
  @NotContains('>', { message: 'Invalid characters in password' })
  @NotContains('&', { message: 'Invalid characters in password' })
  @NotContains('"', { message: 'Invalid characters in password' })
  @NotContains("'", { message: 'Invalid characters in password' })
  @NotContains(';', { message: 'Invalid characters in password' })
  newPassword: string;
}
