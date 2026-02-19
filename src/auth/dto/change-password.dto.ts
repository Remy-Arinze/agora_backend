import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, NotContains } from 'class-validator';

/**
 * DTO for changing password (authenticated users)
 * Includes validation and sanitization to prevent injection attacks
 */
export class ChangePasswordDto {
  @ApiProperty({ 
    description: 'Current password for verification',
    example: 'CurrentPassword123!'
  })
  @IsString({ message: 'Current password must be a string' })
  @NotContains('<', { message: 'Invalid characters in password' })
  @NotContains('>', { message: 'Invalid characters in password' })
  @NotContains('&', { message: 'Invalid characters in password' })
  @NotContains('"', { message: 'Invalid characters in password' })
  @NotContains("'", { message: 'Invalid characters in password' })
  @NotContains(';', { message: 'Invalid characters in password' })
  @NotContains('--', { message: 'Invalid characters in password' })
  @NotContains('/*', { message: 'Invalid characters in password' })
  @NotContains('*/', { message: 'Invalid characters in password' })
  currentPassword: string;

  @ApiProperty({ 
    description: 'New password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
    example: 'NewPassword123!',
    minLength: 8
  })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    }
  )
  @NotContains('<', { message: 'Invalid characters in password' })
  @NotContains('>', { message: 'Invalid characters in password' })
  @NotContains('&', { message: 'Invalid characters in password' })
  @NotContains('"', { message: 'Invalid characters in password' })
  @NotContains("'", { message: 'Invalid characters in password' })
  @NotContains(';', { message: 'Invalid characters in password' })
  @NotContains('--', { message: 'Invalid characters in password' })
  @NotContains('/*', { message: 'Invalid characters in password' })
  @NotContains('*/', { message: 'Invalid characters in password' })
  newPassword: string;
}
