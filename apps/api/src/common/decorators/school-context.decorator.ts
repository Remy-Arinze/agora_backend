import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract schoolId from request
 * The schoolId is set by SchoolDataAccessGuard
 *
 * Usage:
 * @Get()
 * async getData(@SchoolContext() schoolId: string) {
 *   // schoolId is automatically extracted from request
 * }
 */
export const SchoolContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.schoolId || null;
  }
);

/**
 * Decorator to extract current user's school context
 * Returns the schoolId from the user object (set by JWT strategy)
 *
 * Usage:
 * @Get()
 * async getData(@CurrentSchool() schoolId: string | null) {
 *   // schoolId from user.currentSchoolId
 * }
 */
export const CurrentSchool = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return user?.currentSchoolId || null;
  }
);
