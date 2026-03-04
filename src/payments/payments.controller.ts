import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionPlansService } from '../subscriptions/plans/plans.service';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { SubscriptionTier } from '../subscriptions/dto/subscription.dto';

class InitializePaymentDto {
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @IsBoolean()
  @IsOptional()
  isYearly?: boolean;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: SubscriptionPlansService
  ) { }

  /**
   * Get available pricing plans (Fetched from dynamic subscription plans)
   */
  @Get('pricing')
  async getPricing() {
    const plans = await this.plansService.getPublicPlans();
    const publicTiers = [SubscriptionTier.FREE, SubscriptionTier.PRO, SubscriptionTier.PRO_PLUS];

    return {
      success: true,
      data: plans
        .filter(plan => publicTiers.includes(plan.tierCode as SubscriptionTier))
        .reduce((acc: any, plan) => {
          acc[plan.tierCode] = {
            id: plan.id,
            name: plan.name,
            monthly: plan.monthlyPrice,
            yearly: plan.yearlyPrice,
            features: (plan.features as any[] || []).map(f => f.text),
            highlight: plan.highlight,
            cta: plan.cta,
            accent: plan.accent,
            maxStudents: plan.maxStudents,
            maxTeachers: plan.maxTeachers,
            maxAdmins: plan.maxAdmins,
            aiCredits: plan.aiCredits,
          };
          return acc;
        }, {}),
    };
  }

  /**
   * Initialize a subscription payment
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async initializeSubscription(
    @Request() req: { user: UserWithContext },
    @Body() dto: InitializePaymentDto
  ) {
    await this.subscriptionsService.validatePrincipalAccess(req.user);
    const schoolId = req.user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('School context required');
    }

    // Get or create subscription
    const subscription = await this.subscriptionsService.getOrCreateSubscription(schoolId);

    // Get pricing
    const pricing = this.paymentsService.getPricing(dto.tier);
    const amount = dto.isYearly ? pricing.yearly : pricing.monthly;

    if (amount === 0) {
      throw new BadRequestException('This plan does not require payment');
    }

    // Get school email (use admin email from user or fetch school)
    const email = req.user.email || 'payment@agora.ng';

    const result = await this.paymentsService.initializePayment({
      email,
      amount,
      schoolId,
      subscriptionId: subscription.id,
      tier: dto.tier,
      isYearly: dto.isYearly || false,
    });

    return result;
  }

  /**
   * Verify a payment after redirect
   */
  @Get('verify/:reference')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Request() req: { user: UserWithContext },
    @Param('reference') reference: string
  ) {
    await this.subscriptionsService.validatePrincipalAccess(req.user);
    const result = await this.paymentsService.verifyPayment(reference);

    if (result.success) {
      // Process the successful payment
      await this.paymentsService.handleSuccessfulPayment(reference);
    }

    return {
      success: result.success,
      data: result,
    };
  }

  /**
   * Paystack webhook handler
   */
  @Post('webhooks/paystack')
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any
  ) {
    // Verify signature
    const rawBody = req.rawBody?.toString() || JSON.stringify(body);

    if (!this.paymentsService.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process webhook
    await this.paymentsService.processWebhook(body.event, body.data);

    return { received: true };
  }
}
