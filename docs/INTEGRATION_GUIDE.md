# Integration Guide: CallPayMin SDK

Complete technical guide for integrating CallPayMin into your application. This guide covers both **Self-Managed** and **Fully Managed** payment modes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Frontend   │  │   Backend    │  │   Database   │     │
│  │   (React)    │  │   (Node.js)  │  │  (Postgres)  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          │ WebRTC          │ REST API        │ Webhook Events
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼──────────────┐
│                   CallPayMin Platform                        │
├─────────────────────────────────────────────────────────────┤
│  • Video/Audio Calls (WebRTC + TURN)                        │
│  • Per-Minute Billing Engine                                │
│  • User & Expert Management                                 │
│  • Chat Messaging                                           │
│  • AI Summaries (OpenAI)                                    │
│  • Payment Processing (Optional: Stripe)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Self-Managed Mode Integration](#self-managed-mode-integration)
2. [Fully Managed Mode Integration](#fully-managed-mode-integration)
3. [Frontend Integration](#frontend-integration)
4. [Backend Integration](#backend-integration)
5. [Webhook Implementation](#webhook-implementation)
6. [WebRTC Video Calls](#webrtc-video-calls)
7. [Security Best Practices](#security-best-practices)
8. [Production Deployment](#production-deployment)
9. [Testing Strategies](#testing-strategies)
10. [Troubleshooting](#troubleshooting)

---

## Self-Managed Mode Integration

**You control billing. We track usage.**

### Step 1: Initial Setup

```typescript
import { CallPayMin } from '@callpaymin/sdk';

const client = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY,
  baseUrl: 'https://api.callpaymin.com/v1',
});
```

### Step 2: Create Users and Experts

```typescript
// Create a client user
const user = await client.users.create({
  externalId: 'user_' + yourUserId, // Map to your user ID
  displayName: 'John Doe',
  email: 'john@example.com',
});

// Create an expert
const expert = await client.experts.create({
  externalId: 'expert_' + yourExpertId,
  displayName: 'Dr. Smith',
  email: 'smith@example.com',
  specialties: ['cardiology'],
  ratePerMinute: 5.00, // $5/minute
});
```

### Step 3: Charge User via Your Payment Processor

```typescript
// Example: Stripe charge on your end
const stripeCharge = await stripe.charges.create({
  amount: 10000, // $100.00
  currency: 'usd',
  customer: yourStripeCustomerId,
  description: 'CallPayMin credits',
});

if (stripeCharge.status === 'succeeded') {
  // Add funds to CallPayMin virtual balance
  await client.users.addFunds('user_' + yourUserId, {
    amount: 100.00,
    description: 'Stripe deposit',
  });
}
```

### Step 4: Start a Billed Call

```typescript
const call = await client.calls.create({
  participants: [
    { externalId: 'user_' + yourUserId, displayName: 'John', role: 'client' },
    { externalId: 'expert_' + yourExpertId, displayName: 'Dr. Smith', role: 'expert' },
  ],
  billing: {
    payerId: 'user_' + yourUserId,
    ratePerMinute: 5.00,
  },
});

// Return call.id and call.turnCredentials to frontend
```

### Step 5: Handle Webhooks

```typescript
// Webhook: balance.low
app.post('/webhooks/callpaymin', async (req, res) => {
  const event = req.body;

  if (event.type === 'balance.low') {
    const { userId, currentBalance, threshold } = event.data;

    // Notify user to add funds
    await sendEmailToUser(userId, {
      subject: 'Low balance alert',
      message: `Your balance is $${currentBalance}. Please add funds.`,
    });
  }

  res.status(200).send('OK');
});
```

### Step 6: Process Expert Payouts

```typescript
// View expert earnings
const earnings = await client.experts.getEarnings('expert_' + yourExpertId);
// { balance: 150.00, pendingPayout: 50.00, totalEarned: 1000.00 }

// Trigger payout when ready
const payout = await client.experts.requestPayout('expert_' + yourExpertId);

// Process payout via your payment processor
await processPayoutViaYourSystem({
  expertId: yourExpertId,
  amount: payout.amount,
  method: 'bank_transfer', // or 'paypal', etc.
});
```

### Self-Managed Flow Diagram

```
User                    Your App                 CallPayMin            Your Payment
  │                        │                         │                   Processor
  │   Add $100             │                         │                      │
  ├───────────────────────>│                         │                      │
  │                        │   Charge $100           │                      │
  │                        ├─────────────────────────┼─────────────────────>│
  │                        │                         │   ✓ Success          │
  │                        │<────────────────────────┼──────────────────────┤
  │                        │   Add $100 to balance   │                      │
  │                        ├────────────────────────>│                      │
  │   ✓ Funds added        │   ✓ Balance updated     │                      │
  │<───────────────────────┤<────────────────────────┤                      │
  │                        │                         │                      │
  │   Start Call           │                         │                      │
  ├───────────────────────>│   Create Call           │                      │
  │                        ├────────────────────────>│                      │
  │                        │   Billing starts        │                      │
  │   WebRTC Connection    │<────────────────────────┤                      │
  │<──────────────────────────────────────────────────                     │
  │                        │                         │                      │
  │   End Call             │   End Call              │                      │
  ├───────────────────────>├────────────────────────>│                      │
  │                        │   Final cost: $25       │                      │
  │   Receipt              │<────────────────────────┤                      │
  │<───────────────────────┤                         │                      │
```

---

## Fully Managed Mode Integration

**We handle everything via Stripe.**

### Step 1: Initial Setup

```typescript
import { CallPayMin } from '@callpaymin/sdk';

const client = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY,
});
```

### Step 2: Create Users with Stripe

```typescript
// Create a client user (Stripe Customer created automatically)
const user = await client.users.create({
  externalId: 'user_' + yourUserId,
  displayName: 'John Doe',
  email: 'john@example.com',
});

// Create Stripe Setup Intent for card collection
const { clientSecret } = await client.users.createSetupIntent('user_' + yourUserId);

// Send clientSecret to frontend for Stripe.js
```

### Step 3: Frontend Card Collection

```javascript
// Frontend: Collect card with Stripe.js
const stripe = Stripe('pk_live_your_publishable_key');

const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'John Doe' },
  },
});

if (!error) {
  // Save payment method on backend
  await fetch('/api/save-payment-method', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'user_' + yourUserId,
      paymentMethodId: setupIntent.payment_method,
    }),
  });
}
```

### Step 4: Backend Save Payment Method

```typescript
// Backend: Save payment method
app.post('/api/save-payment-method', async (req, res) => {
  const { userId, paymentMethodId } = req.body;

  await client.users.savePaymentMethod(userId, {
    paymentMethodId,
    setAsDefault: true,
  });

  res.json({ success: true });
});
```

### Step 5: Start Auto-Billed Call

```typescript
const call = await client.calls.create({
  participants: [
    { externalId: 'user_' + yourUserId, displayName: 'John', role: 'client' },
    { externalId: 'expert_' + yourExpertId, displayName: 'Dr. Smith', role: 'expert' },
  ],
  billing: {
    payerId: 'user_' + yourUserId,
    ratePerMinute: 5.00,
  },
});

// CallPayMin automatically:
// 1. Deducts from user's virtual balance
// 2. Auto-charges Stripe when balance is low
// 3. Splits revenue (80% expert, 20% you)
// 4. Schedules expert payout via Stripe Connect
```

### Step 6: View Your Stripe Balance

```typescript
// Get your organization's Stripe Connected Account balance
const balance = await client.organization.getStripeBalance({
  accountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
});

console.log('Available:', balance.available); // Ready to withdraw
console.log('Pending:', balance.pending);     // Processing
```

### Step 7: Access Stripe Dashboard

```typescript
// Generate Stripe Express Dashboard link for users
const dashboardLink = await client.organization.getStripeDashboardLink({
  accountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
});

// Redirect user to dashboardLink.url
res.redirect(dashboardLink.url);
```

### Fully Managed Flow Diagram

```
User               Your App          CallPayMin          Stripe
  │                   │                  │                 │
  │   Add Card        │                  │                 │
  ├──────────────────>│   Setup Intent   │                 │
  │                   ├─────────────────>│   Create Intent │
  │                   │                  ├────────────────>│
  │   Card Form       │   clientSecret   │   clientSecret  │
  │<──────────────────┤<─────────────────┤<────────────────┤
  │   Submit Card     │                  │                 │
  ├──────────────────────────────────────┼────────────────>│
  │                   │   Save PM        │   ✓ Saved       │
  │                   ├─────────────────>│<────────────────┤
  │   ✓ Card saved    │   ✓ Saved        │                 │
  │<──────────────────┤<─────────────────┤                 │
  │                   │                  │                 │
  │   Start Call      │   Create Call    │                 │
  ├──────────────────>├─────────────────>│                 │
  │   WebRTC Conn     │   Billing starts │                 │
  │<──────────────────────────────────────                 │
  │                   │                  │                 │
  │   End Call        │   End Call       │                 │
  ├──────────────────>├─────────────────>│   Auto-charge   │
  │                   │   Cost: $25      ├────────────────>│
  │   Receipt         │   Revenue split  │   ✓ Charged     │
  │<──────────────────┤<─────────────────┤<────────────────┤
  │                   │   (Expert: $20)  │   Payout queued │
  │                   │   (You: $5)      │                 │
```

---

## Frontend Integration

### React Example

```typescript
import { useState, useEffect } from 'react';
import { CallPayMinWebRTC } from '@callpaymin/sdk';

export function VideoCallPage() {
  const [callClient, setCallClient] = useState<CallPayMinWebRTC | null>(null);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  async function startCall() {
    const client = new CallPayMinWebRTC({
      apiKey: 'cpm_live_xxx', // Get from backend securely
      onLocalStream: (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      },
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onStateChange: (state) => {
        setCallState(state);
      },
      onCallEnded: (call) => {
        alert(`Call ended. Duration: ${call.duration}s, Cost: $${call.billing.totalCost}`);
      },
    });

    await client.startCall({
      participants: [
        { externalId: 'user_123', displayName: 'John', role: 'client' },
        { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
      ],
      billing: {
        payerId: 'user_123',
        ratePerMinute: 5,
      },
    });

    setCallClient(client);
  }

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted />
      <video ref={remoteVideoRef} autoPlay />

      {callState === 'idle' && (
        <button onClick={startCall}>Start Call</button>
      )}

      {callState === 'connected' && (
        <>
          <button onClick={() => callClient?.toggleAudio()}>Mute</button>
          <button onClick={() => callClient?.toggleVideo()}>Camera Off</button>
          <button onClick={() => callClient?.endCall()}>End Call</button>
        </>
      )}
    </div>
  );
}
```

### React Native Example

```typescript
import { RTCView } from 'react-native-webrtc';
import { CallPayMinWebRTC } from '@callpaymin/sdk';

export function VideoCallScreen() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const startCall = async () => {
    const client = new CallPayMinWebRTC({
      apiKey: await getApiKeyFromBackend(),
      onLocalStream: setLocalStream,
      onRemoteStream: setRemoteStream,
      onCallEnded: (call) => {
        Alert.alert('Call Ended', `Cost: $${call.billing.totalCost}`);
      },
    });

    await client.startCall({
      participants: [
        { externalId: 'user_123', displayName: 'John', role: 'client' },
        { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
      ],
      billing: {
        payerId: 'user_123',
        ratePerMinute: 5,
      },
    });
  };

  return (
    <View>
      {localStream && <RTCView streamURL={localStream.toURL()} />}
      {remoteStream && <RTCView streamURL={remoteStream.toURL()} />}
    </View>
  );
}
```

---

## Backend Integration

### Express.js Example

```typescript
import express from 'express';
import { CallPayMin } from '@callpaymin/sdk';

const app = express();
const client = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY,
});

// Create user
app.post('/api/users', async (req, res) => {
  const { externalId, displayName, email } = req.body;

  try {
    const user = await client.users.create({
      externalId,
      displayName,
      email,
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user balance
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const balance = await client.users.getBalance(req.params.userId);
    res.json(balance);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

// Start call
app.post('/api/calls', async (req, res) => {
  const { participants, billing } = req.body;

  try {
    const call = await client.calls.create({
      participants,
      billing,
    });
    res.json(call);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// End call
app.post('/api/calls/:callId/end', async (req, res) => {
  try {
    const call = await client.calls.end(req.params.callId);
    res.json(call);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

---

## Webhook Implementation

### Webhook Security

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
  const [timestamp, hash] = [
    signature.match(/t=(\d+)/)?.[1],
    signature.match(/v1=(\w+)/)?.[1],
  ];

  if (!timestamp || !hash) {
    return false;
  }

  // Prevent replay attacks (5-minute window)
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - parseInt(timestamp) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}
```

### Webhook Handler

```typescript
app.post('/webhooks/callpaymin', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-callpaymin-signature'] as string;
  const secret = process.env.CALLPAYMIN_WEBHOOK_SECRET;

  // Verify signature
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());

  try {
    switch (event.type) {
      case 'call.started':
        await handleCallStarted(event.data);
        break;

      case 'call.ended':
        await handleCallEnded(event.data);
        break;

      case 'balance.low':
        await handleBalanceLow(event.data);
        break;

      case 'summary.completed':
        await handleSummaryCompleted(event.data);
        break;

      case 'payout.completed':
        await handlePayoutCompleted(event.data);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Internal error');
  }
});

async function handleCallEnded(data: any) {
  const { callId, duration, billing } = data;

  // Save to your database
  await db.calls.create({
    callId,
    duration,
    cost: billing.totalCost,
    userId: billing.payerId,
  });

  // Send receipt email
  await sendReceiptEmail(billing.payerId, {
    duration,
    cost: billing.totalCost,
  });
}

async function handleBalanceLow(data: any) {
  const { userId, currentBalance, threshold } = data;

  // Notify user
  await sendPushNotification(userId, {
    title: 'Low Balance Alert',
    body: `Your balance is $${currentBalance}. Add funds to continue.`,
  });
}
```

---

## WebRTC Video Calls

### Browser Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>Video Call</title>
</head>
<body>
  <video id="localVideo" autoplay muted></video>
  <video id="remoteVideo" autoplay></video>

  <button id="startCall">Start Call</button>
  <button id="endCall" disabled>End Call</button>

  <script type="module">
    import { CallPayMinWebRTC } from '@callpaymin/sdk';

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const startBtn = document.getElementById('startCall');
    const endBtn = document.getElementById('endCall');

    let callClient;

    startBtn.addEventListener('click', async () => {
      callClient = new CallPayMinWebRTC({
        apiKey: 'cpm_live_xxx',
        onLocalStream: (stream) => {
          localVideo.srcObject = stream;
        },
        onRemoteStream: (stream) => {
          remoteVideo.srcObject = stream;
        },
        onCallEnded: (call) => {
          alert(`Duration: ${call.duration}s, Cost: $${call.billing.totalCost}`);
          startBtn.disabled = false;
          endBtn.disabled = true;
        },
      });

      await callClient.startCall({
        participants: [
          { externalId: 'user_123', displayName: 'John', role: 'client' },
          { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
        ],
        billing: {
          payerId: 'user_123',
          ratePerMinute: 5,
        },
      });

      startBtn.disabled = true;
      endBtn.disabled = false;
    });

    endBtn.addEventListener('click', async () => {
      await callClient.endCall();
    });
  </script>
</body>
</html>
```

### TURN Server Configuration

CallPayMin provides TURN servers automatically for NAT traversal:

```typescript
// TURN credentials are included in call.turnCredentials
const call = await client.calls.create({...});

console.log(call.turnCredentials);
// {
//   urls: ['turn:turn.callpaymin.com:3478'],
//   username: 'user_xxxxx',
//   credential: 'pass_xxxxx',
// }
```

---

## Security Best Practices

### 1. API Key Management

```bash
# .env
CALLPAYMIN_API_KEY=cpm_live_xxxxxxxxx
CALLPAYMIN_WEBHOOK_SECRET=whsec_xxxxxxxxx

# Never commit API keys to version control
echo ".env" >> .gitignore
```

### 2. Backend-Only API Calls

```typescript
// ❌ NEVER expose API key on frontend
const client = new CallPayMin({ apiKey: 'cpm_live_xxx' }); // UNSAFE!

// ✅ Make API calls from backend only
app.post('/api/start-call', async (req, res) => {
  const call = await client.calls.create({...});
  res.json(call);
});
```

### 3. User Authentication

```typescript
// Verify user owns the externalId before making calls
app.post('/api/calls', authenticateUser, async (req, res) => {
  const { userId } = req.user; // From JWT or session

  if (req.body.billing.payerId !== `user_${userId}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const call = await client.calls.create({...});
  res.json(call);
});
```

### 4. Webhook Signature Verification

Always verify webhook signatures to prevent spoofing:

```typescript
if (!verifyWebhookSignature(req.body, signature, secret)) {
  return res.status(401).send('Invalid signature');
}
```

### 5. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

app.use('/api/', limiter);
```

---

## Production Deployment

### Environment Variables

```bash
# Required
CALLPAYMIN_API_KEY=cpm_live_xxxxxxxxx
CALLPAYMIN_WEBHOOK_SECRET=whsec_xxxxxxxxx

# Optional
CALLPAYMIN_BASE_URL=https://api.callpaymin.com/v1
CALLPAYMIN_TIMEOUT=30000

# If using Fully Managed mode
STRIPE_CONNECTED_ACCOUNT_ID=acct_xxxxxxxxx
```

### Health Check Endpoint

```typescript
app.get('/health', async (req, res) => {
  try {
    // Verify CallPayMin connection
    const usage = await client.organization.getUsage();

    res.json({
      status: 'healthy',
      callpaymin: 'connected',
      usage: usage.callMinutes,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

### Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log all CallPayMin API calls
client.on('request', (req) => {
  logger.info('CallPayMin API request', {
    method: req.method,
    path: req.path,
  });
});

client.on('response', (res) => {
  logger.info('CallPayMin API response', {
    status: res.status,
    duration: res.duration,
  });
});
```

### Error Monitoring

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

app.use(Sentry.Handlers.errorHandler());
```

---

## Testing Strategies

### Unit Tests

```typescript
import { CallPayMin } from '@callpaymin/sdk';
import nock from 'nock';

describe('CallPayMin SDK', () => {
  const client = new CallPayMin({ apiKey: 'test_key' });

  beforeEach(() => {
    nock('https://api.callpaymin.com')
      .post('/v1/users')
      .reply(200, {
        id: 'user_123',
        externalId: 'test_user',
        displayName: 'Test User',
      });
  });

  it('creates a user', async () => {
    const user = await client.users.create({
      externalId: 'test_user',
      displayName: 'Test User',
      email: 'test@example.com',
    });

    expect(user.id).toBe('user_123');
  });
});
```

### Integration Tests

```typescript
describe('Call Flow', () => {
  it('completes a full call cycle', async () => {
    // Create user
    const user = await client.users.create({...});

    // Add funds (Self-Managed only)
    await client.users.addFunds(user.externalId, {
      amount: 50,
    });

    // Create expert
    const expert = await client.experts.create({...});

    // Start call
    const call = await client.calls.create({...});
    expect(call.status).toBe('active');

    // Wait 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    // End call
    const endedCall = await client.calls.end(call.id);
    expect(endedCall.status).toBe('completed');
    expect(endedCall.duration).toBeGreaterThan(25);
    expect(endedCall.billing.totalCost).toBeGreaterThan(2);
  });
});
```

### Load Testing

```typescript
import autocannon from 'autocannon';

autocannon({
  url: 'http://localhost:3000/api/calls',
  connections: 10,
  duration: 60,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    participants: [...],
    billing: {...},
  }),
}, (err, result) => {
  console.log('Requests/sec:', result.requests.mean);
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Insufficient balance" error

```typescript
try {
  await client.calls.create({...});
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    // Self-Managed: Add funds manually
    await client.users.addFunds(userId, { amount: 50 });

    // Fully Managed: Prompt user to add payment method
    const { clientSecret } = await client.users.createSetupIntent(userId);
    // Show Stripe card form
  }
}
```

#### 2. WebRTC connection fails

```typescript
// Ensure TURN credentials are used
const callClient = new CallPayMinWebRTC({
  apiKey: 'cpm_live_xxx',
  iceServers: call.turnCredentials, // Important!
});
```

#### 3. Webhook signature verification fails

```typescript
// Use raw body, not parsed JSON
app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  const payload = JSON.parse(req.body.toString());
  // Now verify signature
});
```

#### 4. API key has wrong scopes

```bash
# Check which scopes your key has
curl https://api.callpaymin.com/v1/organization/api-keys \
  -H "Authorization: Bearer cpm_live_xxx"

# Create new key with correct scopes
# Self-Managed: billing:write, payouts:write
# Fully Managed: stripe:read
```

### Debug Mode

```typescript
const client = new CallPayMin({
  apiKey: 'cpm_live_xxx',
  debug: true, // Enable debug logs
});

// Logs all API requests/responses
```

### Support

- **Documentation**: https://docs.callpaymin.com
- **API Status**: https://status.callpaymin.com
- **Support Email**: support@callpaymin.com
- **Community Forum**: https://community.callpaymin.com

---

## Next Steps

1. Review [Business Guide](./BUSINESS_GUIDE.md) for pricing and payment modes
2. Explore [Code Examples](../examples/) for full implementations
3. Read [API Reference](https://docs.callpaymin.com/api) for all endpoints
4. Join [Community Forum](https://community.callpaymin.com) for help

---

**Questions?** Reach out to our integration team at integrations@callpaymin.io
