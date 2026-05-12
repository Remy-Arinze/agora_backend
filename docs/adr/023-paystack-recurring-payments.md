# 023. Paystack Recurring Payment Integration

## Status
Accepted

## Context
The Agora platform needs a robust payment system to handle subscription billing for schools using the platform. We need to support recurring payments, automated billing, grace periods, and subscription lifecycle management.

## Decision
We will integrate with Paystack as our primary payment provider for recurring subscription billing.

### Key Components
1. **Paystack Plans**: Use Paystack's plan codes for automated recurring charges
2. **Webhook Processing**: Handle Paystack webhooks for payment events
3. **Billing Lifecycle**: Implement grace periods and automated suspensions
4. **Prorated Upgrades**: Support seamless plan upgrades with credit calculation

### Architecture
- **PaymentsService**: Core service for Paystack integration
- **SubscriptionBillingService**: Billing lifecycle management
- **Database Schema**: Store Paystack subscription codes and payment tokens
- **Webhook Handler**: Secure webhook processing with HMAC verification

## Consequences

### Positive
- **Automated Billing**: Hands-off recurring payment processing
- **Reliable**: Paystack handles payment retries and failures
- **Secure**: PCI compliance handled by Paystack
- **Local**: Nigerian payment methods supported
- **Cost-Effective**: Competitive transaction fees

### Negative
- **Vendor Lock-in**: Migration to other providers requires significant work
- **Dependency**: System availability depends on Paystack uptime
- **Complexity**: Webhook processing adds system complexity
- **Maintenance**: Requires ongoing monitoring and maintenance

### Risks
- **Payment Failures**: Card declines, insufficient funds
- **Webhook Delays**: Network issues causing delayed processing
- **Data Consistency**: Ensuring subscription state matches payment status
- **Security**: Protecting webhook endpoints and payment data

### Mitigations
- **Grace Periods**: 7-day grace period for payment failures
- **Idempotency**: Prevent duplicate webhook processing
- **Monitoring**: Comprehensive logging and alerting
- **Security**: HMAC signature verification and IP whitelisting

## Implementation Details

### Database Changes
- Add Paystack plan codes to SubscriptionPlan model
- Add recurring billing fields to Subscription model
- Create SubscriptionPayment model for payment tracking
- Add PaymentIdempotency model for duplicate prevention

### API Endpoints
- POST /api/payments/subscribe - Initialize payment
- GET /api/payments/verify/:reference - Verify payment
- POST /api/payments/webhooks/paystack - Webhook handler
- GET /api/payments/pricing - Get pricing plans

### Webhook Events
- charge.success - Payment successful
- invoice.payment_failed - Recurring payment failed
- subscription.disable - Subscription cancelled
- invoice.create - New invoice generated

### Billing Phases
1. **OK** - Active subscription
2. **GRACE_PERIOD** - 7-day grace period after failure
3. **ADMIN_ACTION_REQUIRED** - Manual intervention needed

## Alternatives Considered

### Stripe
- **Pros**: Global reach, extensive documentation
- **Cons**: Higher fees, limited Nigerian payment methods

### Flutterwave
- **Pros**: Nigerian focus, good local support
- **Cons**: Less mature recurring billing features

### Manual Billing
- **Pros**: Full control, no vendor dependency
- **Cons**: High operational overhead, poor user experience

## Rationale for Paystack

1. **Local Market**: Strong presence in Nigeria with local payment methods
2. **Recurring Billing**: Mature subscription management features
3. **Reliability**: Proven track record with Nigerian businesses
4. **Support**: Good developer support and documentation
5. **Cost**: Competitive transaction fees for Nigerian market

## Future Considerations

### Multi-Provider Support
- Abstract payment provider interface
- Support for multiple payment methods
- Fallback options for redundancy

### Advanced Features
- Usage-based billing
- Custom billing cycles
- Subscription pause/resume
- Advanced analytics and reporting

### Scaling
- Microservice architecture for payments
- Event-driven billing system
- Real-time payment notifications
- Advanced fraud detection

## Testing Strategy

### Unit Tests
- Payment initialization and verification
- Webhook processing logic
- Billing phase transitions
- Prorated upgrade calculations

### Integration Tests
- End-to-end payment flows
- Webhook event processing
- Database transaction handling
- Error scenarios and recovery

### User Acceptance Tests
- Payment flow usability
- Billing dashboard functionality
- Grace period behavior
- Customer support workflows

## Monitoring and Alerting

### Key Metrics
- Payment success rate
- Subscription churn rate
- Revenue by tier
- Grace period utilization

### Alerts
- Payment processing failures
- Webhook processing errors
- High failure rates
- Subscription cancellations

## Security Considerations

### Payment Security
- HMAC signature verification for webhooks
- IP whitelisting for webhook endpoints
- Rate limiting on payment endpoints
- Secure storage of payment tokens

### Data Protection
- Encryption of sensitive payment data
- Audit logging for all billing actions
- Compliance with payment regulations
- Secure API key management

## Documentation

### Technical Documentation
- API endpoint documentation
- Database schema documentation
- Webhook event reference
- Troubleshooting guides

### User Documentation
- Payment flow guides
- Billing dashboard help
- FAQ for common issues
- Customer support procedures

## Conclusion

Paystack provides the best balance of features, reliability, and cost for the Nigerian market. The recurring payment system will provide automated billing, reduce manual overhead, and improve the user experience for schools using the Agora platform.

The implementation includes comprehensive error handling, grace periods, and monitoring to ensure reliable operation and good customer experience.
