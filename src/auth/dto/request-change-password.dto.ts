import { ApiProperty } from '@nestjs/swagger';
import { IsString, NotContains } from 'class-validator';

/**
 * DTO for requesting password change (step 1 – sends OTP to email)
 */
export class RequestChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'CurrentPassword123!',
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
}
