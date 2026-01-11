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
    private readonly subscriptionsService: SubscriptionsService
  ) {}

  /**
   * Get available pricing plans
   */
  @Get('pricing')
  getPricing() {
    return {
      success: true,
      data: {
        FREE: {
          monthly: 0,
          yearly: 0,
          features: ['50 Students', '5 Teachers', '2 Admins', 'Basic Bursary'],
        },
        STARTER: {
          monthly: 15000,
          yearly: 150000,
          features: [
            'Unlimited Students',
            'Unlimited Teachers',
            '5 Admins',
            'PrepMaster',
            'Full Bursary',
            '100 AI Credits',
          ],
        },
        PROFESSIONAL: {
          monthly: 45000,
          yearly: 450000,
          features: [
            'Unlimited Students',
            'Unlimited Teachers',
            '10 Admins',
            'PrepMaster',
            'Socrates',
            'Full Bursary',
            '500 AI Credits',
          ],
        },
        ENTERPRISE: {
          monthly: null,
          yearly: null,
          features: [
            'Unlimited Everything',
            'RollCall + Hardware',
            'Priority Support',
            'Custom Pricing',
          ],
        },
      },
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
  async verifyPayment(@Param('reference') reference: string) {
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
