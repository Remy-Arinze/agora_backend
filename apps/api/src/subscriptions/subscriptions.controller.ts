import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { 
  SubscriptionDto, 
  SubscriptionSummaryDto, 
  ToolAccessResultDto,
  AiCreditsResultDto,
  UseAiCreditsDto,
  ToolDto,
} from './dto/subscription.dto';
import { UserWithContext } from '../auth/types/user-with-context.type';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Get current school's subscription
   */
  @Get('my-subscription')
  async getMySubscription(@Request() req: { user: UserWithContext }): Promise<{ success: boolean; data: SubscriptionDto }> {
    const schoolId = req.user.currentSchoolId;
    
    if (!schoolId) {
      return {
        success: false,
        data: null as any,
      };
    }

    const subscription = await this.subscriptionsService.getOrCreateSubscription(schoolId);
    
    return {
      success: true,
      data: subscription,
    };
  }

  /**
   * Get subscription summary (lightweight version)
   */
  @Get('summary')
  async getSubscriptionSummary(@Request() req: { user: UserWithContext }): Promise<{ success: boolean; data: SubscriptionSummaryDto | null }> {
    const schoolId = req.user.currentSchoolId;
    
    if (!schoolId) {
      return {
        success: false,
        data: null,
      };
    }

    const summary = await this.subscriptionsService.getSubscriptionSummary(schoolId);
    
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Check if current school has access to a specific tool
   */
  @Get('tools/:toolSlug/access')
  async checkToolAccess(
    @Request() req: { user: UserWithContext },
    @Param('toolSlug') toolSlug: string,
  ): Promise<{ success: boolean; data: ToolAccessResultDto }> {
    const schoolId = req.user.currentSchoolId;
    
    if (!schoolId) {
      return {
        success: false,
        data: {
          hasAccess: false,
          status: null,
          tool: null,
          reason: 'school_not_found',
        },
      };
    }

    const result = await this.subscriptionsService.checkToolAccess(schoolId, toolSlug);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get all available tools
   */
  @Get('tools')
  async getAllTools(): Promise<{ success: boolean; data: ToolDto[] }> {
    const tools = await this.subscriptionsService.getAllTools();
    
    return {
      success: true,
      data: tools,
    };
  }

  /**
   * Get tools available for current user's role
   */
  @Get('tools/my-tools')
  async getMyTools(@Request() req: { user: UserWithContext }): Promise<{ success: boolean; data: ToolDto[] }> {
    const tools = await this.subscriptionsService.getToolsForRole(req.user.role);
    
    return {
      success: true,
      data: tools,
    };
  }

  /**
   * Use AI credits
   */
  @Post('ai-credits/use')
  async useAiCredits(
    @Request() req: { user: UserWithContext },
    @Body() dto: UseAiCreditsDto,
  ): Promise<{ success: boolean; data: AiCreditsResultDto }> {
    const schoolId = req.user.currentSchoolId;
    
    if (!schoolId) {
      return {
        success: false,
        data: {
          success: false,
          creditsUsed: 0,
          creditsRemaining: 0,
          message: 'School context required',
        },
      };
    }

    const result = await this.subscriptionsService.useAiCredits(schoolId, dto.credits, dto.action);
    
    return {
      success: result.success,
      data: result,
    };
  }
}














