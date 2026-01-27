# Business Guide: CallPayMin Platform

Complete guide for businesses integrating CallPayMin's per-minute billing platform for video calls, chat, and AI summaries.

## Overview

CallPayMin provides a complete platform for monetizing expert consultations through:
- **Per-minute billing** for video/audio calls and chat sessions
- **Automatic payment processing** with revenue splits
- **AI-powered summaries** of consultations
- **WebRTC infrastructure** for high-quality calls
- **Expert payout management** with multiple payment options

---

## Payment Modes: Choose Your Approach

CallPayMin offers two payment processing modes to fit your business needs:

### Self-Managed Mode

**You handle all payment processing**

✅ **Best For:**
- Businesses with existing payment infrastructure
- Companies requiring custom billing logic
- Organizations processing high volumes (lower fees)
- Businesses needing full payment control

**How It Works:**
1. You charge users through your payment processor
2. Add funds to user balances via API
3. CallPayMin tracks virtual balances and usage
4. You receive webhooks when balances are low
5. You handle expert payouts on your schedule

**Pricing:**
- Free: $0/month - 100 call minutes
- Pay-as-you-go: $0.05/minute
- Starter: $49/month - 2,000 minutes
- Growth: $199/month - 10,000 minutes
- Enterprise: Custom pricing

**API Scopes Available:**
- `billing:write` - Add funds to user balances
- `payouts:read` - View expert payout data
- `payouts:write` - Trigger expert payouts

---

### Fully Managed Mode

**CallPayMin handles everything via Stripe**

✅ **Best For:**
- New businesses without payment infrastructure
- Quick platform launches
- Teams wanting hands-off billing
- Organizations focused on core product

**How It Works:**
1. CallPayMin automatically charges users via Stripe
2. Revenue is split automatically (default: 80% expert, 20% platform)
3. Experts receive payouts via Stripe Connect
4. You receive your share in your Stripe Connected Account
5. View balance and manage payouts through Stripe Express Dashboard

**Pricing:**
- Free: $0/month - 50 call minutes
- Pay-as-you-go: $0.08/minute
- Starter: $79/month - 1,500 minutes
- Growth: $299/month - 7,500 minutes
- Enterprise: Custom pricing

**Stripe Fees:**
- Platform fee: 3.5% on usage
- Expert payout fee: 1.0%
- Business payout fee: 1.0%
- Stripe card processing: 2.9% + $0.30
- Stripe Connect payout: 0.25% + $0.25

**API Scopes Available:**
- `stripe:read` - View Stripe Connected Account balance

---

## Comparison: Self-Managed vs Fully Managed

| Feature | Self-Managed | Fully Managed |
|---------|-------------|---------------|
| **Setup Complexity** | Higher | Lower |
| **Platform Fees** | Lower | Higher |
| **Payment Control** | Full | Limited |
| **Billing Automation** | Manual | Automatic |
| **Expert Payouts** | You handle | Automatic via Stripe |
| **Revenue Split** | You configure | Automatic (80/20 default) |
| **KYC/Compliance** | Your responsibility | Handled by Stripe |
| **Payout Speed** | Your schedule | Stripe schedule (7-14 days) |
| **Custom Logic** | Yes | Limited |
| **Recommended For** | High-volume, existing infra | Quick launch, hands-off |

---

## Getting Started

### 1. Create Your Organization

```bash
# Sign up at https://callpaymin.io/signup
# Choose payment mode: Self-Managed or Fully Managed
# Select subscription plan
```

### 2. Complete Setup (Fully Managed Only)

If you chose Fully Managed mode:
1. Complete Stripe onboarding
2. Verify business information
3. Complete KYC verification
4. Connect bank account for payouts

### 3. Get API Keys

```bash
# Navigate to Organization > API Keys
# Create key with required scopes:
# - Self-Managed: billing:write, payouts:write
# - Fully Managed: stripe:read
```

### 4. Install SDK

```bash
npm install @callpaymin/sdk
# or
yarn add @callpaymin/sdk
```

### 5. Initialize Client

```javascript
import { CallPayMin } from '@callpaymin/sdk';

const client = new CallPayMin({
  apiKey: 'cpm_live_your_api_key',
});
```

---

## Use Cases

### Healthcare Telemedicine

Perfect for:
- Doctor consultations
- Mental health therapy
- Nutrition counseling
- Medical second opinions

**Implementation:**
- HIPAA-compliant with proper setup
- Recording and transcription available
- AI summaries for medical records
- Per-minute billing for insurance compatibility

### Legal Consultations

Perfect for:
- Attorney consultations
- Legal advice calls
- Contract reviews
- Paralegal services

**Implementation:**
- Professional recording for documentation
- AI summaries for case notes
- Billable hours tracking
- Secure video/audio calls

### Financial Advisory

Perfect for:
- Financial planning
- Investment advice
- Tax consultation
- Accounting services

**Implementation:**
- Screen sharing for portfolio review
- Session recordings for compliance
- AI summaries for client records
- Transparent billing

### Customer Support

Perfect for:
- Technical support
- Product demos
- Training sessions
- VIP customer service

**Implementation:**
- Queue management
- Expert routing
- Performance analytics
- Cost tracking per session

### Education & Coaching

Perfect for:
- Online tutoring
- Life coaching
- Business mentoring
- Skill training

**Implementation:**
- Session scheduling
- Progress tracking via summaries
- Multiple pricing tiers
- Student balance management

---

## Revenue Models

### Expert Marketplace

**Setup:**
- Experts set their own rates
- Platform takes percentage cut
- Users pay per minute
- Automatic revenue split

**Best Payment Mode:** Fully Managed (automatic splits)

### Subscription + Usage

**Setup:**
- Users pay monthly subscription
- Includes free minutes
- Additional minutes billed separately
- Expert payouts based on usage

**Best Payment Mode:** Self-Managed (custom billing logic)

### Enterprise B2B

**Setup:**
- Companies pay bulk rates
- Employees get access
- Usage tracking per department
- Monthly invoicing

**Best Payment Mode:** Self-Managed (custom contracts)

### Freemium

**Setup:**
- Free tier with limited minutes
- Paid upgrades for more usage
- Premium features (recording, AI summaries)
- Tiered pricing

**Best Payment Mode:** Either (depends on volume)

---

## Compliance & Security

### Data Privacy
- End-to-end encryption for calls
- GDPR compliant
- Data residency options
- User data export available

### Payment Security
- PCI DSS compliant (via Stripe in Fully Managed)
- Secure API key management
- Webhook signature verification
- Fraud detection built-in

### Recording & Consent
- Automatic consent prompts
- Recording disclaimers
- Transcript storage options
- Retention policy configuration

---

## Support & Resources

### Documentation
- API Reference: https://docs.callpaymin.io
- SDK Documentation: https://github.com/callpaymin/callpaymin-sdk
- Video Tutorials: https://callpaymin.io/tutorials

### Support Channels
- Email: support@callpaymin.io
- Live Chat: Available in dashboard
- Community Forum: https://community.callpaymin.io
- Enterprise Support: Dedicated account manager

### Migration Assistance
- Free migration consultation
- Technical integration support
- Custom development available
- Training sessions for your team

---

## Next Steps

1. **Read the Integration Guide** → [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
2. **Review API Documentation** → [API_ACCESS_BY_PAYMENT_MODE.md](./API_ACCESS_BY_PAYMENT_MODE.md)
3. **Explore Code Examples** → [examples/](../examples/)
4. **Join Our Community** → https://community.callpaymin.io

---

**Questions?** Reach out to our sales team at sales@callpaymin.io for personalized guidance on choosing the right payment mode and plan for your business.
