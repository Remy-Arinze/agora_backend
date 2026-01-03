import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TOOL_KEY } from '../decorators/require-tool.decorator';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import { ToolStatus } from '../../subscriptions/dto/subscription.dto';

/**
 * Guard that checks if the current school has access to a required tool
 * Use with @RequireTool('toolSlug') decorator
 * 
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, ToolAccessGuard)
 * @RequireTool('socrates')
 * @Get('lesson-plans')
 * async getLessonPlans() { ... }
 * ```
 */
@Injectable()
export class ToolAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required tool from decorator
    const requiredTool = this.reflector.get<string>(TOOL_KEY, context.getHandler());
    
    // If no tool required, allow access
    if (!requiredTool) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserWithContext = request.user;

    // Super admin bypasses tool access checks
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new ForbiddenException('School context required to access this tool');
    }

    // Check tool access
    const accessResult = await this.subscriptionsService.checkToolAccess(schoolId, requiredTool);

    if (!accessResult.hasAccess) {
      const toolName = accessResult.tool?.name || requiredTool;
      
      switch (accessResult.reason) {
        case 'not_subscribed':
          throw new ForbiddenException(
            `Your school does not have access to ${toolName}. Please upgrade your subscription.`
          );
        case 'expired':
          throw new ForbiddenException(
            `Your school's access to ${toolName} has expired. Please renew your subscription.`
          );
        case 'trial_expired':
          throw new ForbiddenException(
            `Your trial for ${toolName} has ended. Please upgrade to continue using this tool.`
          );
        case 'disabled':
          throw new ForbiddenException(
            `${toolName} is currently disabled for your school.`
          );
        default:
          throw new ForbiddenException(
            `Access to ${toolName} is not available.`
          );
      }
    }

    // Attach tool access info to request for use in controllers
    request.toolAccess = accessResult;

    return true;
  }
}














