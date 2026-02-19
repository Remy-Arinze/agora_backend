import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserWithContext } from '../types/user-with-context.type';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserWithContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
