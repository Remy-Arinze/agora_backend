import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionTier } from '../subscriptions/dto/subscription.dto';
import * as crypto from 'crypto';

export interface InitializePaymentOptions {
  email: string;
  amount: number; // in Naira (will be converted to kobo)
  schoolId: string;
  subscriptionId: string;
  tier: SubscriptionTier;
  isYearly: boolean;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    authorizationUrl: string;
    accessCode: string;
  };
}

export interface VerifyPaymentResult {
  success: boolean;
  reference: string;
  amount: number;
  status: string;
  metadata?: Record<string, any>;
}

export interface PaystackWebhookData {
  event: string;
  data: {
    reference: string;
    amount: number;
    status: string;
    customer: {
      email: string;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * Payments Service - Handles Paystack integration for subscription payments
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string | null;
  private readonly baseUrl = 'https://api.paystack.co';

  // Pricing configuration (in Naira) - 3 tiers: FREE, STARTER, ENTERPRISE
  private readonly pricing: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
    [SubscriptionTier.FREE]: { monthly: 0, yearly: 0 },
    [SubscriptionTier.STARTER]: { monthly: 15000, yearly: 150000 },
    [SubscriptionTier.PROFESSIONAL]: { monthly: 15000, yearly: 150000 }, // Deprecated - same as STARTER
    [SubscriptionTier.ENTERPRISE]: { monthly: 0, yearly: 0 }, // Custom pricing
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || null;

    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not configured - payment features will be disabled');
    } else {
      this.logger.log('Paystack payment service initialized');
    }
  }

  /**
   * Check if Paystack is configured
   */
  isConfigured(): boolean {
    return !!this.secretKey;
  }

  /**
   * Get pricing for a tier
   */
  getPricing(tier: SubscriptionTier): { monthly: number; yearly: number } {
    return this.pricing[tier] || { monthly: 0, yearly: 0 };
  }

  /**
   * Initialize a subscription payment
   */
  async initializePayment(options: InitializePaymentOptions): Promise<PaymentResponse> {
    if (!this.secretKey) {
      throw new BadRequestException('Payment service is not configured');
    }

    const { email, amount, schoolId, subscriptionId, tier, isYearly, metadata } = options;

    // Generate unique reference
    const reference = `agora_sub_${schoolId.slice(-6)}_${Date.now()}_${Math.random().toString(36).slice(-4)}`;

    // Amount in kobo (Paystack expects kobo)
    const amountInKobo = amount * 100;

    try {
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: amountInKobo,
          reference,
          currency: 'NGN',
          callback_url: `${this.configService.get('APP_URL')}/dashboard/school/subscription/callback`,
          metadata: {
            schoolId,
            subscriptionId,
            tier,
            isYearly,
            custom_fields: [
              { display_name: 'School ID', variable_name: 'school_id', value: schoolId },
              {
                display_name: 'Plan',
                variable_name: 'plan',
                value: `${tier} (${isYearly ? 'Yearly' : 'Monthly'})`,
              },
            ],
            ...metadata,
          },
        }),
      });

      const data = await response.json();

      if (!data.status) {
        this.logger.error(`Paystack initialize failed: ${data.message}`);
        throw new BadRequestException(data.message || 'Failed to initialize payment');
      }

      // Store payment record
      await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId,
          amount,
          currency: 'NGN',
          status: 'PENDING',
          reference,
          provider: 'PAYSTACK',
          metadata: { tier, isYearly },
        },
      });

      return {
        success: true,
        message: 'Payment initialized',
        data: {
          reference,
          authorizationUrl: data.data.authorization_url,
          accessCode: data.data.access_code,
        },
      };
    } catch (error) {
      this.logger.error(`Payment initialization error: ${error}`);
      throw new BadRequestException('Failed to initialize payment. Please try again.');
    }
  }

  /**
   * Verify a payment
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    if (!this.secretKey) {
      throw new BadRequestException('Payment service is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await response.json();

      if (!data.status) {
        return {
          success: false,
          reference,
          amount: 0,
          status: 'failed',
        };
      }

      const txData = data.data;

      return {
        success: txData.status === 'success',
        reference: txData.reference,
        amount: txData.amount / 100, // Convert from kobo to Naira
        status: txData.status,
        metadata: txData.metadata,
      };
    } catch (error) {
      this.logger.error(`Payment verification error: ${error}`);
      throw new BadRequestException('Failed to verify payment');
    }
  }

  /**
   * Verify Paystack webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.secretKey) return false;

    const hash = crypto.createHmac('sha512', this.secretKey).update(body).digest('hex');

    return hash === signature;
  }

  /**
   * Handle successful payment - upgrade subscription
   */
  async handleSuccessfulPayment(reference: string): Promise<void> {
    // Get payment record
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { reference },
      include: { subscription: true },
    });

    if (!payment) {
      this.logger.warn(`Payment not found: ${reference}`);
      return;
    }

    if (payment.status === 'SUCCESS') {
      this.logger.warn(`Payment already processed: ${reference}`);
      return;
    }

    const metadata = payment.metadata as { tier: SubscriptionTier; isYearly: boolean } | null;
    if (!metadata) {
      this.logger.error(`Payment metadata missing: ${reference}`);
      return;
    }

    // Calculate end date
    const endDate = new Date();
    if (metadata.isYearly) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Tier limits (3 tiers: FREE, STARTER, ENTERPRISE)
    const tierLimits: Record<SubscriptionTier, { maxAdmins: number; aiCredits: number }> = {
      [SubscriptionTier.FREE]: { maxAdmins: 10, aiCredits: 0 },
      [SubscriptionTier.STARTER]: { maxAdmins: 50, aiCredits: 500 },
      [SubscriptionTier.PROFESSIONAL]: { maxAdmins: 50, aiCredits: 500 }, // Deprecated
      [SubscriptionTier.ENTERPRISE]: { maxAdmins: -1, aiCredits: -1 },
    };

    const limits = tierLimits[metadata.tier];

    await this.prisma.$transaction([
      // Update payment status
      this.prisma.subscriptionPayment.update({
        where: { reference },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      }),

      // Update subscription
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          tier: metadata.tier,
          endDate,
          isActive: true,
          maxAdmins: limits.maxAdmins,
          aiCredits: limits.aiCredits,
          aiCreditsUsed: 0, // Reset usage on upgrade
          lastCreditReset: new Date(),
        },
      }),
    ]);

    this.logger.log(`Subscription upgraded: ${payment.subscription.schoolId} -> ${metadata.tier}`);
  }

  /**
   * Process Paystack webhook
   */
  async processWebhook(event: string, data: PaystackWebhookData['data']): Promise<void> {
    this.logger.log(`Processing webhook: ${event} for ${data.reference}`);

    switch (event) {
      case 'charge.success':
        await this.handleSuccessfulPayment(data.reference);
        break;

      case 'charge.failed':
        await this.prisma.subscriptionPayment.updateMany({
          where: { reference: data.reference },
          data: { status: 'FAILED' },
        });
        break;

      default:
        this.logger.log(`Unhandled webhook event: ${event}`);
    }
  }
}
