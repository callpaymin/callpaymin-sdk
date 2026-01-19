# CallPayMin SDK

Official JavaScript/TypeScript SDK for the CallPayMin API. Build per-minute billing video calls, chat messaging, and AI summaries into your applications.

## Installation

```bash
npm install @callpaymin/sdk
# or
yarn add @callpaymin/sdk
# or
pnpm add @callpaymin/sdk
```

## Quick Start

```typescript
import { CallPayMin } from '@callpaymin/sdk';

const client = new CallPayMin({
  apiKey: 'cpm_live_your_api_key',
});

// Create a user
const user = await client.users.create({
  externalId: 'user_123',
  displayName: 'John Doe',
  email: 'john@example.com',
});

// Create an expert
const expert = await client.experts.create({
  externalId: 'expert_456',
  displayName: 'Dr. Smith',
  ratePerMinute: 5,
});

// Start a call with per-minute billing
const call = await client.calls.create({
  participants: [
    { externalId: 'user_123', displayName: 'John', role: 'client' },
    { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
  ],
  billing: {
    payerId: 'user_123',
    ratePerMinute: 5,
  },
});
```

## Features

- **Video/Audio Calls** - WebRTC-powered calls with TURN server support
- **Per-Minute Billing** - Automatic billing based on call duration
- **Chat Messaging** - Real-time chat with per-message billing
- **AI Summaries** - Generate call/chat summaries using AI
- **Payment Methods** - Stripe integration for card payments
- **Webhooks** - Real-time event notifications

## Payment Modes

### Self-Managed Mode

You handle payments. We track virtual balances.

```typescript
// Add funds after your own payment processing
await client.users.addFunds('user_123', {
  amount: 50,
  description: 'Deposit',
});
```

### Managed Mode

CallPayMin handles Stripe payments for you.

```typescript
// Create setup intent for card collection
const { clientSecret } = await client.users.createSetupIntent('user_123');

// Use clientSecret with Stripe.js on frontend
// After user adds card, save it:
await client.users.savePaymentMethod('user_123', {
  paymentMethodId: 'pm_xxx',
  setAsDefault: true,
});

// Charge user's card
await client.users.charge('user_123', {
  amount: 25,
  description: 'Consultation fee',
});
```

## WebRTC Video Calls

### Browser

```typescript
import { CallPayMin, CallPayMinWebRTC } from '@callpaymin/sdk';

const client = new CallPayMin({ apiKey: 'cpm_live_xxx' });

const callClient = new CallPayMinWebRTC({
  client,
  onLocalStream: (stream) => {
    localVideo.srcObject = stream;
  },
  onRemoteStream: (stream) => {
    remoteVideo.srcObject = stream;
  },
  onStateChange: (state) => {
    console.log('Call state:', state);
  },
  onCallEnded: (call) => {
    console.log(`Duration: ${call.duration}s, Cost: $${call.billing.totalCost}`);
  },
});

// Start call
const call = await callClient.startCall({
  participants: [
    { externalId: 'user_123', displayName: 'John', role: 'client' },
    { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
  ],
  billing: {
    payerId: 'user_123',
    ratePerMinute: 5,
  },
});

// Controls
callClient.toggleAudio(false); // Mute
callClient.toggleVideo(false); // Camera off

// End call
await callClient.endCall();
```

### React Native

```bash
npm install @callpaymin/sdk react-native-webrtc
```

See [examples/react-native](./examples/react-native) for full implementation.

## Chat Messaging

```typescript
// Create chat session
const chat = await client.chats.create({
  participants: [
    { externalId: 'user_123', displayName: 'John', role: 'client' },
    { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
  ],
  billing: {
    payerId: 'user_123',
    ratePerMinute: 2,
    freeTier: { messages: 10 },
  },
});

// Send message
const message = await client.chats.sendMessage(chat.id, {
  senderExternalId: 'user_123',
  content: 'Hello, I have a question...',
});

// Get messages
const messages = await client.chats.getMessages(chat.id);

// End chat
await client.chats.end(chat.id);
```

## AI Summaries

```typescript
// Generate summary for a call
const summary = await client.summaries.generateForCall('call_abc123', {
  type: 'detailed',
  includeActionItems: true,
  includeKeyPoints: true,
});

console.log(summary.content);
console.log(summary.actionItems);
console.log(summary.keyPoints);

// Generate summary for a chat
const chatSummary = await client.summaries.generateForChat('chat_xyz789');
```

## Users & Experts

### Users (Clients)

```typescript
// Create user
const user = await client.users.create({
  externalId: 'user_123',
  displayName: 'John Doe',
  email: 'john@example.com',
});

// Get balance
const { balance } = await client.users.getBalance('user_123');

// Get transactions
const transactions = await client.users.getTransactions('user_123');

// Payment methods (managed mode)
const methods = await client.users.getPaymentMethods('user_123');
```

### Experts

```typescript
// Create expert
const expert = await client.experts.create({
  externalId: 'expert_456',
  displayName: 'Dr. Smith',
  email: 'smith@example.com',
  specialties: ['cardiology'],
  ratePerMinute: 5,
});

// Update availability
await client.experts.setStatus('expert_456', 'available');

// Get earnings
const earnings = await client.experts.getEarnings('expert_456');
// { balance: 150, pendingPayout: 50, totalEarned: 1000 }

// Request payout
await client.experts.requestPayout('expert_456');
```

## Organization & API Keys

```typescript
// Get usage
const usage = await client.organization.getUsage();
// { callMinutes: { used: 150, limit: 1000 }, ... }

// Create API key
const { apiKey, key } = await client.organization.createApiKey({
  name: 'Production Server',
  scopes: ['calls:write', 'users:read'],
});
// Save `key` securely - it won't be shown again!

// Configure webhooks
await client.organization.configureWebhooks({
  url: 'https://yourapp.com/webhooks/callpaymin',
  events: ['call.started', 'call.ended', 'summary.completed'],
});
```

## Webhooks

Configure webhooks to receive real-time notifications:

```typescript
// Events: call.started, call.ended, summary.completed, billing.threshold_reached
```

Verify webhook signatures:

```typescript
import crypto from 'crypto';

function verifySignature(payload, signature, secret) {
  const [timestamp, hash] = [
    signature.match(/t=(\d+)/)?.[1],
    signature.match(/v1=(\w+)/)?.[1],
  ];

  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}
```

## Fee Structure (Managed Mode)

| Fee Type | Rate | When |
|----------|------|------|
| Platform Fee | 3.5% | On call/chat usage |
| Expert Payout | 1.0% | When experts withdraw |
| Business Payout | 1.0% | When you withdraw |
| Stripe Card | 2.9% + $0.30 | Card charges |
| Stripe Connect | 0.25% + $0.25 | Payouts |

**No fees on deposits** - only on usage.

## API Reference

### CallPayMin

```typescript
new CallPayMin({
  apiKey: string,      // Your API key
  baseUrl?: string,    // API URL (default: https://api.callpaymin.com/v1)
  timeout?: number,    // Request timeout in ms (default: 30000)
})
```

### Resources

- `client.users` - User management
- `client.experts` - Expert management
- `client.calls` - Call sessions
- `client.chats` - Chat sessions
- `client.summaries` - AI summaries
- `client.organization` - Org settings, API keys, webhooks

## Examples

- [Web Video Call](./examples/web/video-call.html) - Browser-based video calling
- [React Native](./examples/react-native/VideoCallScreen.tsx) - Mobile video calling
- [Node.js Server](./examples/node/server-integration.ts) - Backend integration

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  User,
  Expert,
  Call,
  Chat,
  Summary,
  Transaction,
  PaymentMethod,
} from '@callpaymin/sdk';
```

## Error Handling

```typescript
try {
  await client.users.charge('user_123', { amount: 50 });
} catch (error) {
  if (error.code === 'CARD_DECLINED') {
    // Handle declined card
  } else if (error.code === 'INSUFFICIENT_BALANCE') {
    // Handle low balance
  } else {
    // Handle other errors
  }
}
```

## Support

- Documentation: https://docs.callpaymin.com
- Email: support@callpaymin.com
- GitHub Issues: https://github.com/callpaymin/sdk/issues

## License

MIT
