# Paystack Recurring Payment System

## Overview

The Agora platform integrates with Paystack to provide comprehensive recurring payment functionality for subscription management. This system handles automated billing, payment processing, subscription lifecycle management, and graceful failure recovery.

## Architecture

### Core Components

1. **PaymentsService** (`src/payments/payments.service.ts`)
   - Primary service for Paystack integration
   - Handles payment initialization, verification, and webhook processing
   - Manages recurring billing setup and lifecycle

2. **SubscriptionBillingService** (`src/subscriptions/subscription-billing.service.ts`)
   - Manages billing phases and subscription lifecycle
   - Handles grace periods, suspensions, and automated renewals
   - Provides billing state management and UI flags

3. **PaymentsController** (`src/payments/payments.controller.ts`)
   - REST API endpoints for payment operations
   - Webhook handler for Paystack events
   - Pricing and subscription management endpoints

### Database Schema

#### SubscriptionPlan Model
```prisma
model SubscriptionPlan {
  // Paystack recurring billing fields
  paystackMonthlyPlanCode String? @unique // Paystack plan code for monthly
  paystackYearlyPlanCode  String? @unique // Paystack plan code for yearly
  // ... other fields
}
```

#### Subscription Model
```prisma
model Subscription {
  // Paystack recurring billing fields
  paystackSubscriptionCode String? @unique
  paystackEmailToken       String? // For managing subscriptions via Paystack
  paystackCustomerId       String? // Store customer ID for recurring charges
  isRecurring              Boolean @default(false)
  // ... other fields
}
```

#### SubscriptionPayment Model
```prisma
model SubscriptionPayment {
  reference String @unique // Paystack reference
  type      String @default("INITIAL") // INITIAL, RECURRING, TOPUP
  provider  String @default("PAYSTACK")
  // ... other fields
}
```

## Features

### 1. Recurring Payment Setup

#### Plan-Based Recurring
- Uses Paystack's plan codes for automatic recurring charges
- Supports both monthly and yearly billing cycles
- Automatic subscription creation and management

#### Payment Initialization
```typescript
// Initialize recurring payment
const result = await paymentsService.initializePayment({
  email: 'school@example.com',
  amount: 49999, // Amount in Naira
  schoolId: 'school-123',
  subscriptionId: 'sub-123',
  tier: SubscriptionTier.PRO,
  isYearly: false,
  metadata: { customField: 'value' }
});
```

### 2. Webhook Processing

#### Supported Events
- `charge.success` - Initial and recurring payment success
- `invoice.create` - New recurring invoice generated
- `invoice.payment_failed` - Recurring payment failure
- `subscription.disable` - Subscription disabled/cancelled
- `subscription.not_renew` - Auto-renew disabled
- `charge.failed` - Payment attempt failed

#### Webhook Security
- HMAC signature verification using Paystack secret key
- IP whitelisting for webhook endpoints
- Idempotency protection to prevent duplicate processing

### 3. Billing Lifecycle Management

#### Billing Phases
1. **OK** - Active subscription, payments current
2. **GRACE_PERIOD** - Payment failed, 7-day grace period active
3. **ADMIN_ACTION_REQUIRED** - Grace period expired, manual intervention needed

#### Automated Processes
- Daily billing lifecycle job
- Grace period reminders (days 1, 3, 5, 7)
- Automatic subscription renewal on successful payments
- Account suspension after grace period expiration

### 4. Subscription Tiers & Pricing

| Tier | Monthly | Yearly | Features |
|------|---------|--------|----------|
| FREE | 0 | 0 | 100 students, 10 teachers, 2 admins |
| PRO | 49,999 | 499,990 | 800 students, 80 teachers, 20 admins, 10K AI credits |
| PRO_PLUS | 99,999 | 999,990 | 2000 students, 150 teachers, 35 admins, 25K AI credits |
| CUSTOM | Custom | Custom | Enterprise features and limits |

### 5. Prorated Upgrades

When upgrading subscriptions:
- Calculates remaining value on current plan
- Applies credit toward new plan
- Extends subscription end date proportionally
- Maintains service continuity

### 6. Grace Period Management

#### Grace Period Features
- 7-day grace period after payment failure
- Automated email reminders on days 1, 3, 5, 7
- Continued service access during grace period
- Clear UI indicators for billing status

#### Post-Grace Actions
- Automatic account suspension
- Enrollment locking for excess students
- Staff access limitation
- Admin dashboard blocking

### 7. Downgrade Management

#### Controlled Downgrade Process
- Only available after grace period expiration
- Requires selection of students to keep active
- Automatic suspension of excess staff accounts
- Audit trail for all downgrade actions

## API Endpoints

### Payment Management

#### Initialize Subscription
```http
POST /api/payments/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "tier": "PRO",
  "isYearly": false,
  "callbackUrl": "https://example.com/callback"
}
```

#### Verify Payment
```http
GET /api/payments/verify/:reference
Authorization: Bearer <token>
```

#### Get Pricing
```http
GET /api/payments/pricing
```

### Webhook Handler
```http
POST /api/payments/webhooks/paystack
X-Paystack-Signature: <hmac-signature>
Content-Type: application/json

{
  "event": "charge.success",
  "data": { ... }
}
```

## Configuration

### Environment Variables
```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=YOUR_PAYSTACK_SECRET_KEY
APP_URL=https://your-domain.com
```

### Paystack Plan Setup
1. Create plans in Paystack dashboard
2. Copy plan codes to database
3. Configure monthly and yearly plan codes
4. Test webhook endpoints

## Security Considerations

### Payment Security
- HMAC signature verification for all webhooks
- IP whitelisting for webhook endpoints
- Request rate limiting on payment endpoints
- Idempotency protection for duplicate payments

### Data Protection
- Encrypted storage of payment tokens
- Audit logging for all billing actions
- Secure handling of customer data
- Compliance with payment industry standards

## Monitoring & Observability

### Metrics Tracked
- Revenue by tier and billing cycle
- Payment success/failure rates
- Subscription churn rates
- Grace period utilization

### Logging
- Detailed payment transaction logs
- Webhook processing logs
- Billing phase transition logs
- Error and exception tracking

## Error Handling

### Payment Failures
- Graceful degradation during payment issues
- Clear error messages to users
- Automatic retry mechanisms where appropriate
- Manual override capabilities for administrators

### System Failures
- Self-healing on service restart
- Database transaction rollback on errors
- Notification system for critical failures
- Fallback mechanisms for webhook processing

## Testing

### Payment Testing
- Paystack test environment integration
- Mock webhook event testing
- End-to-end payment flow testing
- Edge case and failure scenario testing

### Billing Logic Testing
- Grace period calculation testing
- Prorated upgrade testing
- Downgrade scenario testing
- Subscription lifecycle testing

## Deployment Considerations

### Production Setup
- Paystack live API keys
- SSL certificates for webhook endpoints
- Database backups for payment records
- Monitoring and alerting setup

### Scaling Considerations
- Database indexing for payment queries
- Caching of pricing information
- Load balancing for payment endpoints
- Queue-based webhook processing

## Troubleshooting

### Common Issues

#### Payment Not Processing
1. Check Paystack API key configuration
2. Verify webhook endpoint accessibility
3. Review payment initialization logs
4. Check plan code configuration

#### Subscription Not Renewing
1. Verify Paystack subscription status
2. Check webhook event processing
3. Review billing phase transitions
4. Validate customer token storage

#### Grace Period Not Working
1. Check daily billing job execution
2. Verify subscription end dates
3. Review billing phase calculations
4. Check notification system status

### Debug Tools
- Payment reference lookup
- Webhook event replay
- Subscription status debugging
- Billing phase inspection

## Future Enhancements

### Planned Features
- Multiple payment provider support
- Advanced billing analytics
- Custom billing cycles
- Subscription pause/resume functionality

### Scalability Improvements
- Microservice architecture for payments
- Event-driven billing system
- Real-time payment notifications
- Advanced fraud detection
