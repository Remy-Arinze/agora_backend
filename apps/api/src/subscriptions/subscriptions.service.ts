import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { 
  SubscriptionDto, 
  SubscriptionSummaryDto, 
  ToolAccessResultDto, 
  AiCreditsResultDto,
  SubscriptionTier,
  ToolStatus,
  ToolDto,
  SchoolToolAccessDto,
} from './dto/subscription.dto';

/**
 * Service for managing school subscriptions and tool access
 * Handles subscription tiers, tool access checks, and AI credit management
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  // Tier limits configuration
  // Students & Teachers are UNLIMITED on all tiers
  // 3 tiers: FREE, STARTER, ENTERPRISE
  private readonly tierLimits: Record<SubscriptionTier, { maxStudents: number; maxTeachers: number; maxAdmins: number; aiCredits: number }> = {
    [SubscriptionTier.FREE]: { maxStudents: -1, maxTeachers: -1, maxAdmins: 10, aiCredits: 0 },
    [SubscriptionTier.STARTER]: { maxStudents: -1, maxTeachers: -1, maxAdmins: 50, aiCredits: 100 },
    [SubscriptionTier.PROFESSIONAL]: { maxStudents: -1, maxTeachers: -1, maxAdmins: 50, aiCredits: 500 }, // Deprecated - use STARTER or ENTERPRISE
    [SubscriptionTier.ENTERPRISE]: { maxStudents: -1, maxTeachers: -1, maxAdmins: -1, aiCredits: -1 }, // -1 = unlimited
  };

  // Tools available per tier (3 tiers: FREE, STARTER, ENTERPRISE)
  private readonly tierTools: Record<SubscriptionTier, string[]> = {
    [SubscriptionTier.FREE]: ['bursary'], // Basic bursary only
    [SubscriptionTier.STARTER]: ['prepmaster', 'socrates', 'bursary'], // All AI tools
    [SubscriptionTier.PROFESSIONAL]: ['prepmaster', 'socrates', 'bursary'], // Deprecated - same as STARTER
    [SubscriptionTier.ENTERPRISE]: ['prepmaster', 'socrates', 'rollcall', 'bursary'], // Everything + RollCall
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create subscription for a school
   */
  async getOrCreateSubscription(schoolId: string): Promise<SubscriptionDto> {
    let subscription = await this.prisma.subscription.findUnique({
      where: { schoolId },
      include: {
        toolAccess: {
          include: { tool: true },
        },
      },
    });

    // Create FREE subscription if none exists
    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: {
          schoolId,
          tier: 'FREE',
          ...this.tierLimits[SubscriptionTier.FREE],
        },
        include: {
          toolAccess: {
            include: { tool: true },
          },
        },
      });

      // Initialize tool access based on tier
      await this.syncToolAccessForTier(schoolId, subscription.id, SubscriptionTier.FREE);
      
      // Refetch with updated tool access
      subscription = await this.prisma.subscription.findUnique({
        where: { schoolId },
        include: {
          toolAccess: {
            include: { tool: true },
          },
        },
      });
    }

    return this.mapToSubscriptionDto(subscription!);
  }

  /**
   * Get subscription summary (lightweight version for frontend)
   */
  async getSubscriptionSummary(schoolId: string): Promise<SubscriptionSummaryDto> {
    const subscription = await this.getOrCreateSubscription(schoolId);
    
    return {
      tier: subscription.tier,
      isActive: subscription.isActive,
      aiCredits: subscription.aiCredits,
      aiCreditsUsed: subscription.aiCreditsUsed,
      aiCreditsRemaining: subscription.aiCreditsRemaining,
      limits: {
        maxStudents: subscription.maxStudents,
        maxTeachers: subscription.maxTeachers,
        maxAdmins: subscription.maxAdmins,
      },
      tools: subscription.toolAccess.map(ta => ({
        slug: ta.tool.slug,
        name: ta.tool.name,
        status: ta.status,
        hasAccess: ta.status === ToolStatus.ACTIVE || ta.status === ToolStatus.TRIAL,
      })),
    };
  }

  /**
   * Check if school has access to a specific tool
   */
  async checkToolAccess(schoolId: string, toolSlug: string): Promise<ToolAccessResultDto> {
    // Get the tool
    const tool = await this.prisma.tool.findUnique({
      where: { slug: toolSlug },
    });

    if (!tool) {
      return {
        hasAccess: false,
        status: null,
        tool: null,
        reason: 'tool_not_found',
      };
    }

    // Get school's tool access
    const toolAccess = await this.prisma.schoolToolAccess.findUnique({
      where: {
        schoolId_toolId: { schoolId, toolId: tool.id },
      },
      include: { tool: true },
    });

    if (!toolAccess) {
      return {
        hasAccess: false,
        status: null,
        tool: this.mapToToolDto(tool),
        reason: 'not_subscribed',
      };
    }

    // Check status
    const now = new Date();
    
    if (toolAccess.status === ToolStatus.ACTIVE) {
      // Check if expired
      if (toolAccess.expiresAt && toolAccess.expiresAt < now) {
        // Mark as expired
        await this.prisma.schoolToolAccess.update({
          where: { id: toolAccess.id },
          data: { status: 'EXPIRED' },
        });
        return {
          hasAccess: false,
          status: ToolStatus.EXPIRED,
          tool: this.mapToToolDto(tool),
          reason: 'expired',
        };
      }
      return {
        hasAccess: true,
        status: ToolStatus.ACTIVE,
        tool: this.mapToToolDto(tool),
        reason: 'active',
      };
    }

    if (toolAccess.status === ToolStatus.TRIAL) {
      // Check if trial expired
      if (toolAccess.trialEndsAt && toolAccess.trialEndsAt < now) {
        await this.prisma.schoolToolAccess.update({
          where: { id: toolAccess.id },
          data: { status: 'EXPIRED' },
        });
        return {
          hasAccess: false,
          status: ToolStatus.EXPIRED,
          tool: this.mapToToolDto(tool),
          reason: 'trial_expired',
        };
      }
      
      const trialDaysRemaining = toolAccess.trialEndsAt
        ? Math.ceil((toolAccess.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      return {
        hasAccess: true,
        status: ToolStatus.TRIAL,
        tool: this.mapToToolDto(tool),
        reason: 'trial',
        trialDaysRemaining,
      };
    }

    return {
      hasAccess: false,
      status: toolAccess.status as ToolStatus,
      tool: this.mapToToolDto(tool),
      reason: toolAccess.status.toLowerCase(),
    };
  }

  /**
   * Use AI credits for a school
   */
  async useAiCredits(schoolId: string, credits: number, action?: string): Promise<AiCreditsResultDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const available = subscription.aiCredits - subscription.aiCreditsUsed;
    
    if (credits > available) {
      return {
        success: false,
        creditsUsed: 0,
        creditsRemaining: available,
        message: `Insufficient AI credits. Required: ${credits}, Available: ${available}`,
      };
    }

    // Update credits
    const updated = await this.prisma.subscription.update({
      where: { schoolId },
      data: {
        aiCreditsUsed: { increment: credits },
      },
    });

    this.logger.log(`School ${schoolId} used ${credits} AI credits for ${action || 'unknown action'}`);

    return {
      success: true,
      creditsUsed: credits,
      creditsRemaining: updated.aiCredits - updated.aiCreditsUsed,
    };
  }

  /**
   * Check if school can add more admins (based on subscription tier)
   * Returns { canAdd: boolean, currentCount: number, maxAllowed: number, message?: string }
   */
  async checkAdminLimit(schoolId: string): Promise<{ canAdd: boolean; currentCount: number; maxAllowed: number; message?: string }> {
    // Get subscription
    const subscription = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    // No subscription = FREE tier limits
    const maxAdmins = subscription?.maxAdmins ?? this.tierLimits[SubscriptionTier.FREE].maxAdmins;
    
    // -1 means unlimited
    if (maxAdmins === -1) {
      const currentCount = await this.prisma.schoolAdmin.count({ where: { schoolId } });
      return { canAdd: true, currentCount, maxAllowed: -1 };
    }

    // Count current admins
    const currentCount = await this.prisma.schoolAdmin.count({ where: { schoolId } });

    if (currentCount >= maxAdmins) {
      const tier = subscription?.tier ?? 'FREE';
      return {
        canAdd: false,
        currentCount,
        maxAllowed: maxAdmins,
        message: `Your ${tier} plan allows a maximum of ${maxAdmins} administrators. Current: ${currentCount}. Please upgrade your subscription to add more.`,
      };
    }

    return { canAdd: true, currentCount, maxAllowed: maxAdmins };
  }

  /**
   * Get all available tools
   */
  async getAllTools(): Promise<ToolDto[]> {
    const tools = await this.prisma.tool.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return tools.map(this.mapToToolDto);
  }

  /**
   * Get tools available for a specific role
   */
  async getToolsForRole(role: string): Promise<ToolDto[]> {
    const tools = await this.prisma.tool.findMany({
      where: {
        isActive: true,
        targetRoles: { has: role },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return tools.map(this.mapToToolDto);
  }

  /**
   * Sync tool access based on subscription tier
   */
  private async syncToolAccessForTier(
    schoolId: string, 
    subscriptionId: string, 
    tier: SubscriptionTier
  ): Promise<void> {
    const allowedToolSlugs = this.tierTools[tier];
    
    // Get all tools
    const allTools = await this.prisma.tool.findMany({
      where: { isActive: true },
    });

    for (const tool of allTools) {
      const isAllowed = allowedToolSlugs.includes(tool.slug);
      
      // Check existing access
      const existing = await this.prisma.schoolToolAccess.findUnique({
        where: {
          schoolId_toolId: { schoolId, toolId: tool.id },
        },
      });

      if (isAllowed) {
        // Grant or update access
        if (existing) {
          if (existing.status !== 'ACTIVE') {
            await this.prisma.schoolToolAccess.update({
              where: { id: existing.id },
              data: {
                status: 'ACTIVE',
                subscriptionId,
                activatedAt: new Date(),
              },
            });
          }
        } else {
          await this.prisma.schoolToolAccess.create({
            data: {
              schoolId,
              toolId: tool.id,
              subscriptionId,
              status: 'ACTIVE',
              activatedAt: new Date(),
            },
          });
        }
      } else {
        // Revoke access if not allowed
        if (existing && existing.status === 'ACTIVE') {
          await this.prisma.schoolToolAccess.update({
            where: { id: existing.id },
            data: { status: 'DISABLED' },
          });
        }
      }
    }
  }

  /**
   * Map Prisma subscription to DTO
   */
  private mapToSubscriptionDto(subscription: any): SubscriptionDto {
    return {
      id: subscription.id,
      schoolId: subscription.schoolId,
      tier: subscription.tier as SubscriptionTier,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      isActive: subscription.isActive,
      maxStudents: subscription.maxStudents,
      maxTeachers: subscription.maxTeachers,
      maxAdmins: subscription.maxAdmins,
      aiCredits: subscription.aiCredits,
      aiCreditsUsed: subscription.aiCreditsUsed,
      aiCreditsRemaining: subscription.aiCredits - subscription.aiCreditsUsed,
      toolAccess: (subscription.toolAccess || []).map((ta: any) => this.mapToToolAccessDto(ta)),
    };
  }

  /**
   * Map Prisma tool to DTO
   */
  private mapToToolDto(tool: any): ToolDto {
    return {
      id: tool.id,
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      icon: tool.icon,
      monthlyPrice: Number(tool.monthlyPrice),
      yearlyPrice: Number(tool.yearlyPrice),
      isCore: tool.isCore,
      isActive: tool.isActive,
      features: tool.features as { name: string; description: string }[] | null,
      targetRoles: tool.targetRoles,
    };
  }

  /**
   * Map Prisma tool access to DTO
   */
  private mapToToolAccessDto(toolAccess: any): SchoolToolAccessDto {
    return {
      id: toolAccess.id,
      toolId: toolAccess.toolId,
      tool: this.mapToToolDto(toolAccess.tool),
      status: toolAccess.status as ToolStatus,
      trialEndsAt: toolAccess.trialEndsAt,
      activatedAt: toolAccess.activatedAt,
      expiresAt: toolAccess.expiresAt,
    };
  }
}

