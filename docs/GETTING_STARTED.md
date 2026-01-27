# Getting Started with CallPayMin

Complete step-by-step guide to integrate CallPayMin into your application.

## Table of Contents

1. [Choose Your Payment Mode](#1-choose-your-payment-mode)
2. [Create Your Organization](#2-create-your-organization)
3. [Get API Keys](#3-get-api-keys)
4. [Install the SDK](#4-install-the-sdk)
5. [Your First Integration](#5-your-first-integration)
6. [Testing](#6-testing)
7. [Go Live](#7-go-live)

---

## 1. Choose Your Payment Mode

CallPayMin offers two payment processing modes. Choose the one that fits your needs:

### Self-Managed Mode

**Best For:**
- Businesses with existing payment infrastructure
- Companies requiring custom billing logic
- High-volume platforms (lower fees)
- Need full control over payments

**What You Handle:**
- Charging users via your payment processor
- Adding funds to CallPayMin virtual balances
- Expert payout processing

**Pricing:**
- Free: $0/month - 100 call minutes
- Pay-as-you-go: $0.05/minute
- Starter: $49/month - 2,000 minutes
- Growth: $199/month - 10,000 minutes

**Learn More:** [Self-Managed Integration Guide](./INTEGRATION_GUIDE.md#self-managed-mode-integration)

---

### Fully Managed Mode

**Best For:**
- New businesses without payment infrastructure
- Quick platform launches
- Teams wanting hands-off billing
- Focus on product, not payments

**What CallPayMin Handles:**
- Automatic user charging via Stripe
- Revenue splitting (80% expert, 20% platform default)
- Expert payouts via Stripe Connect
- All compliance and KYC

**Pricing:**
- Free: $0/month - 50 call minutes
- Pay-as-you-go: $0.08/minute
- Starter: $79/month - 1,500 minutes
- Growth: $299/month - 7,500 minutes

**Learn More:** [Fully Managed Integration Guide](./INTEGRATION_GUIDE.md#fully-managed-mode-integration)

---

## 2. Create Your Organization

### Sign Up

1. Go to [https://callpaymin.io/signup](https://callpaymin.io/signup)
2. Enter your business information:
   - Organization name
   - Business email
   - Password
3. Select your payment mode (can be changed later on free plan)
4. Choose your subscription plan

### Complete Stripe Onboarding (Fully Managed Only)

If you chose Fully Managed mode:

1. Click "Complete Stripe Onboarding" in your dashboard
2. Fill out business information:
   - Business type (individual, company, nonprofit)
   - Business address
   - Tax ID (EIN, SSN)
3. Connect bank account for payouts
4. Submit for review
5. Wait for approval (usually 1-2 business days)

**Note:** You can start development immediately. Stripe onboarding is only required for production.

---

## 3. Get API Keys

### Create an API Key

1. Navigate to **Organization → API Keys**
2. Click **"Create API Key"**
3. Configure your key:
   - **Name:** Descriptive name (e.g., "Production Server", "Staging Environment")
   - **Scopes:** Select required permissions

#### Recommended Scopes by Payment Mode

**Self-Managed Mode:**
```
✓ calls:read, calls:write
✓ users:read, users:write
✓ experts:read, experts:write
✓ billing:read, billing:write
✓ payouts:read, payouts:write
✓ summaries:read, summaries:write
✓ organization:read
```

**Fully Managed Mode:**
```
✓ calls:read, calls:write
✓ users:read, users:write
✓ experts:read, experts:write
✓ billing:read
✓ stripe:read
✓ summaries:read, summaries:write
✓ organization:read
```

4. Click **"Create Key"**
5. **IMPORTANT:** Copy the API key immediately. It won't be shown again!
   - Format: `cpm_live_xxxxxxxxxxxxxxxxxxxx`
   - Store in environment variables (never commit to version control)

### Create Webhook Endpoint (Optional but Recommended)

1. Navigate to **Organization → Webhooks**
2. Click **"Create Webhook"**
3. Enter your webhook URL:
   - Development: Use [ngrok](https://ngrok.com) for local testing
   - Production: Your public HTTPS endpoint
4. Select events to receive:
   - `call.started`, `call.ended` - Track call activity
   - `balance.low`, `balance.depleted` - User balance alerts
   - `summary.completed` - AI summary notifications
   - `payout.completed`, `payout.failed` - Expert payout updates
5. Copy the webhook secret for signature verification

---

## 4. Install the SDK

### Node.js / Express

```bash
npm install @callpaymin/sdk
# or
yarn add @callpaymin/sdk
# or
pnpm add @callpaymin/sdk
```

### Browser / React

```bash
npm install @callpaymin/sdk
```

For WebRTC video calls:
```bash
npm install @callpaymin/sdk
```

### React Native

```bash
npm install @callpaymin/sdk react-native-webrtc
```

Follow React Native WebRTC setup: https://github.com/react-native-webrtc/react-native-webrtc

---

## 5. Your First Integration

### Setup Environment Variables

Create a `.env` file in your project root:

```bash
# CallPayMin
CALLPAYMIN_API_KEY=cpm_live_your_api_key_here
CALLPAYMIN_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# If using Fully Managed mode
STRIPE_CONNECTED_ACCOUNT_ID=acct_your_stripe_account_id

# Your app
APP_URL=http://localhost:3000
```

**IMPORTANT:** Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
```

---

### Initialize the SDK

#### Backend (Node.js)

```typescript
import { CallPayMin } from '@callpaymin/sdk';

const client = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY,
});

// Test connection
const usage = await client.organization.getUsage();
console.log('Connected to CallPayMin!', usage);
```

#### Frontend (Browser)

**⚠️ SECURITY WARNING:** Never expose your API key on the frontend!

Instead, create backend endpoints that use the SDK:

```typescript
// ❌ WRONG - Don't do this!
const client = new CallPayMin({ apiKey: 'cpm_live_xxx' });

// ✓ CORRECT - Use backend endpoints
const response = await fetch('/api/users/create', {
  method: 'POST',
  body: JSON.stringify({ displayName, email }),
});
```

---

### Create Your First User

```typescript
const user = await client.users.create({
  externalId: 'user_' + yourUserId, // Map to YOUR user ID
  displayName: 'John Doe',
  email: 'john@example.com',
});

console.log('User created:', user.id);
```

**Best Practice:** Use your own user IDs as `externalId` for easy mapping:
```typescript
externalId: `user_${yourDatabaseUserId}`
```

---

### Create Your First Expert

```typescript
const expert = await client.experts.create({
  externalId: 'expert_' + yourExpertId,
  displayName: 'Dr. Smith',
  email: 'smith@example.com',
  specialties: ['cardiology', 'internal-medicine'],
  ratePerMinute: 5.00, // $5 per minute
});

console.log('Expert created:', expert.id);
```

---

### Add Funds (Self-Managed Mode Only)

```typescript
// After charging user via YOUR payment processor
await client.users.addFunds('user_123', {
  amount: 50.00,
  description: 'Initial deposit',
});

// Check balance
const balance = await client.users.getBalance('user_123');
console.log('Balance:', balance.balance); // 50.00
```

---

### Add Payment Method (Fully Managed Mode Only)

**Backend:**
```typescript
// Create Setup Intent
const { clientSecret } = await client.users.createSetupIntent('user_123');

// Send clientSecret to frontend
res.json({ clientSecret });
```

**Frontend:**
```javascript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_live_your_publishable_key');

// Collect card details
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Confirm card
const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'John Doe' },
  },
});

if (!error) {
  // Save payment method via backend
  await fetch('/api/users/user_123/payment-methods', {
    method: 'POST',
    body: JSON.stringify({
      paymentMethodId: setupIntent.payment_method,
      setAsDefault: true,
    }),
  });

  alert('Payment method added!');
}
```

**Backend:**
```typescript
await client.users.savePaymentMethod('user_123', {
  paymentMethodId: req.body.paymentMethodId,
  setAsDefault: true,
});
```

---

### Start Your First Call

```typescript
const call = await client.calls.create({
  participants: [
    {
      externalId: 'user_123',
      displayName: 'John Doe',
      role: 'client',
    },
    {
      externalId: 'expert_456',
      displayName: 'Dr. Smith',
      role: 'expert',
    },
  ],
  billing: {
    payerId: 'user_123',
    ratePerMinute: 5.00,
  },
});

console.log('Call started:', call.id);
console.log('TURN credentials:', call.turnCredentials);

// Return call data to frontend for WebRTC connection
res.json({
  callId: call.id,
  turnCredentials: call.turnCredentials,
});
```

---

### End the Call

```typescript
const endedCall = await client.calls.end('call_abc123');

console.log('Duration:', endedCall.duration, 'seconds');
console.log('Total cost:', endedCall.billing.totalCost);
console.log('Expert earned:', endedCall.billing.expertPayout);
console.log('Platform revenue:', endedCall.billing.platformRevenue);
```

---

## 6. Testing

### Use Test Mode

During development, use test API keys:
- Format: `cpm_test_xxxxxxxxxxxxxxxxxxxx`
- No charges or real payouts
- Full feature access

### Test Scenarios

#### 1. Low Balance Alert (Self-Managed)

```typescript
// Create user with low balance
await client.users.addFunds('user_test', { amount: 2.00 });

// Start a call (rate: $5/min)
// After ~30 seconds, you'll receive a balance.low webhook
```

#### 2. Auto-Charge (Fully Managed)

```typescript
// Add payment method
// Set low balance
// Start call
// CallPayMin will auto-charge when balance drops below threshold
```

#### 3. Failed Charge (Fully Managed)

Use Stripe test cards:
```typescript
// Declined card: 4000000000000002
// Auto-charge will fail, webhook: charge.failed
```

#### 4. Expert Payout (Self-Managed)

```typescript
// Complete calls as expert
const earnings = await client.experts.getEarnings('expert_test');
console.log('Earnings:', earnings.balance);

// Request payout
const payout = await client.experts.requestPayout('expert_test');
console.log('Payout amount:', payout.amount);
```

### Local Webhook Testing with ngrok

1. Install ngrok: https://ngrok.com/download
2. Start your server: `npm run dev`
3. Expose with ngrok: `ngrok http 3000`
4. Copy the HTTPS URL: `https://abc123.ngrok.io`
5. Set webhook URL in dashboard: `https://abc123.ngrok.io/webhooks/callpaymin`
6. Test by making calls and watching webhook logs

---

## 7. Go Live

### Pre-Launch Checklist

#### Security
- [ ] All API keys stored in environment variables
- [ ] `.env` added to `.gitignore`
- [ ] Webhook signature verification implemented
- [ ] Rate limiting enabled on API endpoints
- [ ] User authentication enforced on all endpoints
- [ ] HTTPS enabled on production

#### Payment Mode: Self-Managed
- [ ] Payment processor integration tested (Stripe, PayPal, etc.)
- [ ] Add funds endpoint secured and tested
- [ ] Expert payout process documented
- [ ] Low balance notifications working
- [ ] Transaction logging implemented

#### Payment Mode: Fully Managed
- [ ] Stripe onboarding completed
- [ ] Bank account connected
- [ ] Test charges successful
- [ ] Expert Stripe Connect setup tested
- [ ] Auto-recharge tested

#### Features
- [ ] Call creation and ending working
- [ ] Balance tracking accurate
- [ ] Webhooks receiving and processing events
- [ ] Error handling implemented
- [ ] Logging and monitoring setup
- [ ] AI summaries tested (if using)

#### Testing
- [ ] Integration tests passing
- [ ] Load testing completed
- [ ] Error scenarios handled
- [ ] User flows tested end-to-end

---

### Switch to Production API Keys

1. Navigate to **Organization → API Keys**
2. Create new production API key:
   - Name: "Production"
   - Same scopes as development key
3. Update environment variables:
   ```bash
   CALLPAYMIN_API_KEY=cpm_live_new_production_key
   ```
4. Restart your application

---

### Monitor Your Usage

1. Navigate to **Organization → Usage**
2. Track metrics:
   - Call minutes used
   - Number of active users
   - Total revenue
   - Expert payouts
3. Set up alerts for:
   - Approaching plan limits
   - High error rates
   - Failed payments

---

### Get Help

- **Documentation:** https://docs.callpaymin.com
- **API Reference:** [Integration Guide](./INTEGRATION_GUIDE.md)
- **Code Examples:** [examples/](../examples/)
- **Email Support:** support@callpaymin.com
- **Live Chat:** Available in dashboard
- **Community Forum:** https://community.callpaymin.com

---

## Next Steps

Now that you're up and running, explore advanced features:

1. **[WebRTC Video Calls](./INTEGRATION_GUIDE.md#webrtc-video-calls)** - Add video/audio calling
2. **[Chat Messaging](./INTEGRATION_GUIDE.md#chat-messaging)** - Real-time chat with billing
3. **[AI Summaries](./INTEGRATION_GUIDE.md#ai-summaries)** - Generate call/chat summaries
4. **[Webhooks](../examples/node/webhooks.ts)** - Real-time event handling
5. **[Revenue Optimization](./BUSINESS_GUIDE.md#revenue-models)** - Explore revenue strategies

---

## Common Issues

### "Invalid API key"
- Ensure API key is correct (starts with `cpm_live_` or `cpm_test_`)
- Check that key has required scopes
- Verify key hasn't been revoked

### "Insufficient balance"
- **Self-Managed:** Add funds via `client.users.addFunds()`
- **Fully Managed:** User needs to add payment method

### "Webhook signature verification failed"
- Ensure webhook secret is correct
- Use raw request body (not parsed JSON)
- Check timestamp tolerance (5 minutes)

### "TURN server connection failed"
- Ensure `call.turnCredentials` are passed to WebRTC
- Check firewall allows UDP on ports 3478-3479
- Test with browser WebRTC troubleshooter

---

**Ready to build?** Start with our [Integration Guide](./INTEGRATION_GUIDE.md) for detailed implementation steps.
