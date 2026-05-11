import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionTier } from '../subscriptions/dto/subscription.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionBillingService } from '../subscriptions/subscription-billing.service';
import { SubscriptionAuditService } from '../subscriptions/subscription-audit.service';
import * as crypto from 'crypto';

export interface InitializePaymentOptions {
  email: string;
  amount: number; // in Naira (will be converted to kobo)
  schoolId: string;
  subscriptionId: string;
  tier: SubscriptionTier;
  isYearly: boolean;
  callbackUrl?: string;
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

import { MetricsService } from '../common/metrics/metrics.service';

/**
 * Payments Service - Handles Paystack integration for subscription payments
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string | null;
  private readonly baseUrl = 'https://api.paystack.co';

  // Pricing configuration (in Naira) - 3 tiers: FREE, PRO, PRO_PLUS
  private readonly pricing: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
    [SubscriptionTier.FREE]: { monthly: 0, yearly: 0 },
    [SubscriptionTier.PRO]: { monthly: 49999, yearly: 499990 },
    [SubscriptionTier.PRO_PLUS]: { monthly: 99999, yearly: 999990 },
    [SubscriptionTier.CUSTOM]: { monthly: 0, yearly: 0 },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly metricsService: MetricsService,
    private readonly audit: SubscriptionAuditService,
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

    // Look for a Paystack plan code
    const plan = (await this.prisma.subscriptionPlan.findFirst({
      where: { tierCode: tier as any },
    })) as any;

    const planCode = isYearly ? plan?.paystackYearlyPlanCode : plan?.paystackMonthlyPlanCode;

    // Amount in kobo (Paystack expects kobo)
    const amountInKobo = amount * 100;

    try {
      const payload: any = {
        email,
        amount: planCode ? undefined : amountInKobo, // Paystack uses plan amount if plan is provided
        plan: planCode || undefined,
        reference,
        currency: 'NGN',
        callback_url: options.callbackUrl || `${this.configService.get('APP_URL')}/payment/callback`,
        metadata: {
          schoolId,
          subscriptionId,
          tier,
          isYearly,
          isRecurring: !!planCode,
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
      };

      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.status) {
        this.logger.error(`Paystack initialize failed: ${data.message}`);
        throw new BadRequestException(data.message || 'Failed to initialize payment');
      }

      // Store payment record
      await (this.prisma.subscriptionPayment as any).create({
        data: {
          subscriptionId,
          amount,
          currency: 'NGN',
          status: 'PENDING',
          reference,
          type: 'INITIAL',
          provider: 'PAYSTACK',
          metadata: { tier, isYearly, planCode },
        },
      });

      await this.audit.logChange({
        schoolId,
        action: 'PAYMENT_INITIALIZED',
        payload: { reference, tier, isYearly, planCode },
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

      // Handle successful payment immediately if verifying manually
      if (txData.status === 'success') {
        await this.handleSuccessfulPayment(reference, txData);
      }

      return {
        success: txData.status === 'success',
        reference: txData.reference,
        amount: txData.amount / 100,
        status: txData.status,
        metadata: txData.metadata,
      };
    } catch (error) {
      this.logger.error(`Payment verification error: ${error}`);
      throw new BadRequestException('Failed to verify payment');
    }
  }

  /**
   * Calculate prorated amount for upgrades
   */
  async calculateProratedAmount(schoolId: string, newTier: SubscriptionTier, isYearly: boolean): Promise<number> {
    const sub = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    const newPricing = this.getPricing(newTier);
    const newAmount = isYearly ? newPricing.yearly : newPricing.monthly;

    if (!sub || !sub.endDate || sub.endDate.getTime() <= Date.now() || sub.tier === SubscriptionTier.FREE) {
      return newAmount;
    }

    const now = new Date();
    const endDate = new Date(sub.endDate);
    const lastReset = sub.startDate > now ? sub.startDate : now; // Simple approximation
    
    // Find the last successful payment to determine the billing cycle length
    const lastPayment = await this.prisma.subscriptionPayment.findFirst({
      where: { subscriptionId: sub.id, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastPayment) return newAmount;

    const totalPeriodMs = endDate.getTime() - lastPayment.paidAt!.getTime();
    const remainingMs = endDate.getTime() - now.getTime();
    
    if (remainingMs <= 0 || totalPeriodMs <= 0) return newAmount;

    const currentAmount = Number(lastPayment.amount);
    const unusedCredit = (currentAmount * remainingMs) / totalPeriodMs;

    // Prorated amount is the new price minus the value of remaining days on old price
    return Math.max(0, Math.floor(newAmount - unusedCredit));
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
  async handleSuccessfulPayment(reference: string, paystackData?: any): Promise<void> {
    // Check idempotency
    if (await this.audit.isProcessed(reference)) {
      this.logger.log(`Payment ${reference} already processed (idempotency)`);
      return;
    }

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
      this.logger.warn(`Payment already marked as SUCCESS: ${reference}`);
      // Record idempotency just in case it was missed
      await this.audit.recordIdempotency(reference, 'PROCESSED', { status: 'already_success' });
      return;
    }

    const metadata = payment.metadata as { tier: SubscriptionTier; isYearly: boolean; planCode?: string; isRecurring?: boolean } | null;
    if (!metadata) {
      this.logger.error(`Payment metadata missing: ${reference}`);
      return;
    }

    // Update payment status
    await this.prisma.subscriptionPayment.update({
      where: { reference },
      data: {
        status: 'SUCCESS',
        paidAt: new Date(),
      },
    });

    // Record Metric
    this.metricsService.businessRevenueTotal.inc(
      { tier: metadata.tier, plan: metadata.isYearly ? 'yearly' : 'monthly' },
      Number(payment.amount)
    );

    // Calculate new end date
    const now = new Date();
    const currentEnd = payment.subscription.endDate;
    const base =
      currentEnd && currentEnd.getTime() > now.getTime() ? new Date(currentEnd) : now;
    const endDate = new Date(base);
    if (metadata.isYearly) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Tier Limits
    const tierLimits = {
      [SubscriptionTier.FREE]: { maxStudents: 100, maxTeachers: 10, maxAdmins: 2, aiCredits: 0 },
      [SubscriptionTier.PRO]: { maxStudents: 800, maxTeachers: 80, maxAdmins: 20, aiCredits: 10000 },
      [SubscriptionTier.PRO_PLUS]: { maxStudents: 2000, maxTeachers: 150, maxAdmins: 35, aiCredits: 25000 },
      [SubscriptionTier.CUSTOM]: { maxStudents: -1, maxTeachers: -1, maxAdmins: -1, aiCredits: -1 },
    };

    const limits = tierLimits[metadata.tier] || tierLimits[SubscriptionTier.FREE];

    const sub = payment.subscription;
    let newAiCredits = limits.aiCredits;
    if (limits.aiCredits === -1) {
      newAiCredits = -1;
    } else if (limits.aiCredits > 0 && sub.aiCredits !== -1) {
      const rolloverCredits = Math.max(0, sub.aiCredits - sub.aiCreditsUsed);
      newAiCredits = limits.aiCredits + rolloverCredits;
    }

    // Extract Paystack recurring info if available
    const subscriptionCode = paystackData?.subscription?.subscription_code || paystackData?.plan?.subscription_code;
    const emailToken = paystackData?.authorization?.email_token;
    const customerId = paystackData?.customer?.customer_code;

    // Atomically update the subscription
    await this.subscriptionBillingService.onSuccessfulPaidRenewal(payment.subscription.schoolId, {
      tier: metadata.tier as any,
      endDate,
      isActive: true,
      maxStudents: limits.maxStudents,
      maxTeachers: limits.maxTeachers,
      maxAdmins: limits.maxAdmins,
      aiCredits: newAiCredits,
      aiCreditsUsed: 0,
      lastCreditReset: new Date(),
      paystackSubscriptionCode: subscriptionCode || undefined,
      paystackEmailToken: emailToken || undefined,
      paystackCustomerId: customerId || undefined,
      isRecurring: !!metadata.planCode,
    });

    // Record idempotency
    await this.audit.recordIdempotency(reference, 'PROCESSED', { 
      schoolId: payment.subscription.schoolId,
      tier: metadata.tier,
      endDate 
    });

    // Sync tool access
    await this.subscriptionsService.syncToolAccessForTier(
      payment.subscription.schoolId,
      payment.subscriptionId,
      metadata.tier
    );

    this.logger.log(`Subscription processed successfully: ${payment.subscription.schoolId} -> ${metadata.tier} (Recurring: ${!!metadata.planCode})`);
  }

  /**
   * Process Paystack webhook
   */
  async processWebhook(event: string, data: any): Promise<void> {
    this.logger.log(`Processing webhook: ${event}`);

    // Handle initial payment success (standard transaction)
    if (event === 'charge.success') {
      await this.handleSuccessfulPayment(data.reference, data);
      return;
    }

    // For other events, we might not have a reference, so we find the school by subscription code or email
    const subscriptionCode = data.subscription_code || data.subscription?.subscription_code;
    const customerEmail = data.customer?.email;

    let schoolId: string | null = null;

    if (subscriptionCode) {
      const sub = await this.prisma.subscription.findFirst({
        where: { paystackSubscriptionCode: subscriptionCode },
      });
      schoolId = sub?.schoolId || null;
    }

    if (!schoolId && customerEmail) {
      const school = await this.prisma.school.findFirst({
        where: { email: customerEmail },
      });
      schoolId = school?.id || null;
    }

    if (!schoolId) {
      this.logger.warn(`Webhook ${event} received but no school found for sub: ${subscriptionCode} or email: ${customerEmail}`);
      return;
    }

    switch (event) {
      case 'invoice.create':
        await this.audit.logChange({
          schoolId,
          action: 'INVOICE_CREATED',
          payload: { amount: data.amount, periodStart: data.period_start, periodEnd: data.period_end },
        });
        break;

      case 'invoice.payment_failed':
        await this.subscriptionBillingService.handleFailedRenewal(schoolId, 'Paystack recurring payment failed');
        break;

      case 'subscription.disable':
        await this.subscriptionBillingService.lockSchoolDueToPayment(schoolId, 'Paystack subscription disabled');
        break;

      case 'subscription.not_renew':
        await this.audit.logChange({
          schoolId,
          action: 'SUBSCRIPTION_NON_RENEWAL_SET',
          payload: { reason: 'User disabled auto-renew on Paystack' },
        });
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
