/**
 * CallPayMin SDK - Node.js Server Integration Example
 *
 * This example shows how to:
 * 1. Create users and experts
 * 2. Handle billing (add funds, charge cards)
 * 3. Process webhooks
 * 4. Generate AI summaries
 */

import { CallPayMin } from '@callpaymin/sdk';
import express from 'express';
import crypto from 'crypto';

// Initialize SDK with your API key
const callpaymin = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY!,
  // baseUrl: 'https://api.callpaymin.com/v1', // Production
});

const app = express();
app.use(express.json());

// ============================================
// User Management
// ============================================

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { externalId, displayName, email } = req.body;

    const user = await callpaymin.users.create({
      externalId,
      displayName,
      email,
      metadata: {
        source: 'web',
        createdAt: new Date().toISOString(),
      },
    });

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user balance
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const balance = await callpaymin.users.getBalance(req.params.userId);
    res.json(balance);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Billing - Self Managed Mode
// ============================================

// Add funds to user balance (your own payment processing)
app.post('/api/users/:userId/add-funds', async (req, res) => {
  try {
    const { amount, description } = req.body;

    // Your payment processing here (Stripe, PayPal, etc.)
    // const paymentResult = await yourPaymentProcessor.charge(amount);

    // After successful payment, add funds via CallPayMin
    const result = await callpaymin.users.addFunds(req.params.userId, {
      amount,
      description: description || 'Funds added',
    });

    res.json({
      success: true,
      newBalance: result.balance,
      transaction: result.transaction,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Billing - Managed Mode (CallPayMin handles Stripe)
// ============================================

// Create setup intent for adding payment method
app.post('/api/users/:userId/setup-intent', async (req, res) => {
  try {
    const { clientSecret } = await callpaymin.users.createSetupIntent(
      req.params.userId
    );

    // Return clientSecret to frontend for Stripe.js
    res.json({ clientSecret });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Save payment method after setup intent confirmation
app.post('/api/users/:userId/payment-methods', async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    const result = await callpaymin.users.savePaymentMethod(req.params.userId, {
      paymentMethodId,
      setAsDefault: true,
    });

    res.json({
      success: true,
      paymentMethod: result.paymentMethod,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Charge user's card
app.post('/api/users/:userId/charge', async (req, res) => {
  try {
    const { amount, description } = req.body;

    const result = await callpaymin.users.charge(req.params.userId, {
      amount,
      description,
      passStripeFeeToUser: false, // You absorb Stripe fees
    });

    res.json({
      success: true,
      transaction: result.transaction,
    });
  } catch (error: any) {
    // Handle specific errors
    if (error.message.includes('CARD_DECLINED')) {
      res.status(402).json({ error: 'Card declined', code: 'CARD_DECLINED' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

// ============================================
// Expert Management
// ============================================

// Create an expert
app.post('/api/experts', async (req, res) => {
  try {
    const { externalId, displayName, email, specialties, ratePerMinute } = req.body;

    const expert = await callpaymin.experts.create({
      externalId,
      displayName,
      email,
      specialties,
      ratePerMinute,
    });

    res.json({ success: true, expert });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get expert earnings
app.get('/api/experts/:expertId/earnings', async (req, res) => {
  try {
    const earnings = await callpaymin.experts.getEarnings(req.params.expertId);
    res.json(earnings);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Call Management
// ============================================

// Create a call session
app.post('/api/calls', async (req, res) => {
  try {
    const { userId, expertId, ratePerMinute, freeMinutes } = req.body;

    const call = await callpaymin.calls.create({
      participants: [
        { externalId: userId, displayName: 'Client', role: 'client' },
        { externalId: expertId, displayName: 'Expert', role: 'expert' },
      ],
      billing: {
        payerId: userId,
        ratePerMinute,
        freeTier: freeMinutes ? { minutes: freeMinutes } : undefined,
      },
    });

    res.json({ success: true, call });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get TURN credentials for WebRTC
app.get('/api/calls/:callId/credentials', async (req, res) => {
  try {
    const credentials = await callpaymin.calls.getCredentials(req.params.callId);
    res.json(credentials);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// AI Summaries
// ============================================

// Generate summary for a call
app.post('/api/calls/:callId/summary', async (req, res) => {
  try {
    const { type = 'detailed' } = req.body;

    const summary = await callpaymin.summaries.generateForCall(req.params.callId, {
      type,
      includeActionItems: true,
      includeKeyPoints: true,
    });

    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Webhooks
// ============================================

// Webhook endpoint
app.post('/webhooks/callpaymin', async (req, res) => {
  const signature = req.headers['x-callpaymin-signature'] as string;
  const webhookSecret = process.env.CALLPAYMIN_WEBHOOK_SECRET!;

  // Verify signature
  if (!verifyWebhookSignature(req.body, signature, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  console.log(`Received webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'call.started':
        console.log(`Call started: ${event.data.callId}`);
        // Notify your app that a call has started
        break;

      case 'call.ended':
        console.log(`Call ended: ${event.data.callId}`);
        console.log(`Duration: ${event.data.duration}s`);
        console.log(`Total cost: $${event.data.billing.totalCost}`);
        // Update your database, send notifications, etc.
        break;

      case 'summary.completed':
        console.log(`Summary ready: ${event.data.summaryId}`);
        // Notify user that summary is ready
        break;

      case 'billing.threshold_reached':
        console.log(`User ${event.data.userId} reached ${event.data.percentage}% of quota`);
        // Send low balance warning
        break;

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify webhook signature
function verifyWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  if (!signature) return false;

  // Parse signature: t=timestamp,v1=hash
  const parts = signature.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const hash = parts.find((p) => p.startsWith('v1='))?.slice(3);

  if (!timestamp || !hash) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

// ============================================
// Organization Management
// ============================================

// Get usage stats
app.get('/api/organization/usage', async (req, res) => {
  try {
    const usage = await callpaymin.organization.getUsage();
    res.json(usage);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Configure webhooks
app.put('/api/organization/webhooks', async (req, res) => {
  try {
    const { url, events } = req.body;

    const config = await callpaymin.organization.configureWebhooks({
      url,
      events,
    });

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
