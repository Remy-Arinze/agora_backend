import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength, NotContains } from 'class-validator';

/** Shared rules for a new password. School-specific length/special-char policy is enforced in AuthService. */
export function IsNewPassword() {
  return applyDecorators(
    IsString({ message: 'Password must be a string' }),
    MinLength(8, { message: 'Password must be at least 8 characters long' }),
    NotContains('<', { message: 'Invalid characters in password' }),
    NotContains('>', { message: 'Invalid characters in password' }),
    NotContains('"', { message: 'Invalid characters in password' }),
    NotContains("'", { message: 'Invalid characters in password' }),
    NotContains(';', { message: 'Invalid characters in password' }),
  );
}
