import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ShadowUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.accountStatus === 'SHADOW') {
      throw new ForbiddenException(
        'Account not activated. Please verify your OTP to claim your account.'
      );
    }

    return true;
  }
}

