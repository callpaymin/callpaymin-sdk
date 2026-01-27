/**
 * Fully Managed Payment Mode Integration Example
 *
 * In Fully Managed mode, CallPayMin handles ALL payment processing via Stripe.
 *
 * Flow:
 * 1. Users add payment methods via Stripe
 * 2. CallPayMin auto-charges when balance is low
 * 3. Revenue is automatically split (default: 80% expert, 20% platform)
 * 4. Experts receive payouts via Stripe Connect
 * 5. You receive your share in your Stripe Connected Account
 *
 * Benefits:
 * - No payment processor integration needed
 * - Automatic billing and payouts
 * - PCI compliance handled by Stripe
 * - No manual balance management
 */

import express from 'express';
import { CallPayMin } from '@callpaymin/sdk';

const app = express();
app.use(express.json());

// Initialize CallPayMin client
const callPayMin = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY!,
});

// ============================================================================
// USER REGISTRATION
// ============================================================================

/**
 * Step 1: Register user
 * CallPayMin automatically creates a Stripe Customer
 */
app.post('/api/users/register', async (req, res) => {
  const { email, displayName } = req.body;

  try {
    const user = await callPayMin.users.create({
      externalId: `user_${generateId()}`,
      displayName,
      email,
    });

    // Save to your database
    await saveUserToDatabase({
      callPayMinExternalId: user.externalId,
      email,
      displayName,
    });

    res.json({
      userId: user.externalId,
      message: 'User registered successfully',
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ============================================================================
// PAYMENT METHOD COLLECTION
// ============================================================================

/**
 * Step 2: Create Stripe Setup Intent for card collection
 */
app.post('/api/users/:userId/setup-intent', async (req, res) => {
  try {
    const { clientSecret } = await callPayMin.users.createSetupIntent(
      req.params.userId
    );

    res.json({ clientSecret });
  } catch (error) {
    console.error('Setup intent error:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

/**
 * Step 3: Save payment method after user adds card
 * Call this endpoint from your frontend after Stripe.js confirms the card
 */
app.post('/api/users/:userId/payment-methods', async (req, res) => {
  const { paymentMethodId, setAsDefault } = req.body;

  try {
    await callPayMin.users.savePaymentMethod(req.params.userId, {
      paymentMethodId,
      setAsDefault: setAsDefault ?? true,
    });

    res.json({
      success: true,
      message: 'Payment method saved successfully',
    });
  } catch (error) {
    console.error('Save payment method error:', error);
    res.status(500).json({ error: 'Failed to save payment method' });
  }
});

/**
 * Get user's payment methods
 */
app.get('/api/users/:userId/payment-methods', async (req, res) => {
  try {
    const methods = await callPayMin.users.getPaymentMethods(req.params.userId);

    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * Delete a payment method
 */
app.delete('/api/users/:userId/payment-methods/:methodId', async (req, res) => {
  try {
    await callPayMin.users.deletePaymentMethod(
      req.params.userId,
      req.params.methodId
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// ============================================================================
// MANUAL CHARGING (Optional)
// ============================================================================

/**
 * Manually charge a user's saved payment method
 * Note: Auto-charging happens automatically when balance is low
 */
app.post('/api/users/:userId/charge', async (req, res) => {
  const { amount, description } = req.body;

  try {
    const charge = await callPayMin.users.charge(req.params.userId, {
      amount,
      description: description || 'Account credit',
    });

    res.json({
      success: true,
      chargeId: charge.id,
      amount: charge.amount,
      balance: await callPayMin.users.getBalance(req.params.userId),
    });
  } catch (error) {
    console.error('Charge error:', error);
    res.status(500).json({ error: 'Failed to charge user' });
  }
});

// ============================================================================
// BALANCE & TRANSACTIONS
// ============================================================================

/**
 * Get user's CallPayMin balance
 */
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const balance = await callPayMin.users.getBalance(req.params.userId);

    res.json(balance);
    // {
    //   balance: 25.50,
    //   currency: 'usd',
    //   autoRechargeEnabled: true,
    //   autoRechargeAmount: 50,
    //   autoRechargeThreshold: 10,
    // }
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

/**
 * Get user's transaction history
 */
app.get('/api/users/:userId/transactions', async (req, res) => {
  try {
    const transactions = await callPayMin.users.getTransactions(
      req.params.userId
    );

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ============================================================================
// START CALL
// ============================================================================

/**
 * Step 4: Start a call
 * CallPayMin handles all billing automatically
 */
app.post('/api/calls/start', async (req, res) => {
  const { userId, expertId } = req.body;

  try {
    // Get expert info
    const expert = await callPayMin.experts.get(expertId);

    // Create call
    const call = await callPayMin.calls.create({
      participants: [
        {
          externalId: userId,
          displayName: await getUserDisplayName(userId),
          role: 'client',
        },
        {
          externalId: expertId,
          displayName: expert.displayName,
          role: 'expert',
        },
      ],
      billing: {
        payerId: userId,
        ratePerMinute: expert.ratePerMinute,
      },
    });

    res.json({
      callId: call.id,
      turnCredentials: call.turnCredentials,
      ratePerMinute: expert.ratePerMinute,
    });
  } catch (error) {
    console.error('Start call error:', error);

    if (error.code === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({
        error: 'Insufficient balance',
        message: 'Please add a payment method for auto-recharge',
      });
    } else if (error.code === 'NO_PAYMENT_METHOD') {
      res.status(400).json({
        error: 'No payment method',
        message: 'Please add a payment method to start a call',
      });
    } else {
      res.status(500).json({ error: 'Failed to start call' });
    }
  }
});

/**
 * End a call
 */
app.post('/api/calls/:callId/end', async (req, res) => {
  try {
    const call = await callPayMin.calls.end(req.params.callId);

    res.json({
      callId: call.id,
      duration: call.duration,
      cost: call.billing.totalCost,
      expertPayout: call.billing.expertPayout,
      platformRevenue: call.billing.platformRevenue,
    });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

// ============================================================================
// EXPERT REGISTRATION
// ============================================================================

/**
 * Register an expert
 * CallPayMin creates a Stripe Connect Express account automatically
 */
app.post('/api/experts/register', async (req, res) => {
  const { email, displayName, specialties, ratePerMinute } = req.body;

  try {
    const expert = await callPayMin.experts.create({
      externalId: `expert_${generateId()}`,
      displayName,
      email,
      specialties,
      ratePerMinute,
    });

    // Save to your database
    await saveExpertToDatabase({
      callPayMinExternalId: expert.externalId,
      email,
      displayName,
      specialties,
      ratePerMinute,
    });

    res.json({
      expertId: expert.externalId,
      message: 'Expert registered successfully',
      // Expert will receive email to complete Stripe onboarding
    });
  } catch (error) {
    console.error('Expert registration error:', error);
    res.status(500).json({ error: 'Failed to register expert' });
  }
});

/**
 * Get expert earnings
 * Earnings are automatically transferred to expert's Stripe account
 */
app.get('/api/experts/:expertId/earnings', async (req, res) => {
  try {
    const earnings = await callPayMin.experts.getEarnings(req.params.expertId);

    res.json(earnings);
    // {
    //   balance: 150.00,        // Pending payout to Stripe
    //   pendingPayout: 50.00,   // Currently processing
    //   totalEarned: 1000.00,   // Lifetime earnings
    //   nextPayoutDate: '2024-02-01',
    // }
  } catch (error) {
    res.status(404).json({ error: 'Expert not found' });
  }
});

/**
 * Get Stripe onboarding link for expert
 * Experts complete KYC via Stripe Express
 */
app.get('/api/experts/:expertId/stripe-onboarding', async (req, res) => {
  try {
    const link = await callPayMin.experts.getStripeOnboardingLink(
      req.params.expertId,
      {
        refreshUrl: `${process.env.APP_URL}/experts/onboarding/refresh`,
        returnUrl: `${process.env.APP_URL}/experts/onboarding/complete`,
      }
    );

    res.json({ url: link.url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create onboarding link' });
  }
});

/**
 * Get Stripe Dashboard link for expert
 * Experts can view earnings and manage payouts
 */
app.get('/api/experts/:expertId/stripe-dashboard', async (req, res) => {
  try {
    const link = await callPayMin.experts.getStripeDashboardLink(
      req.params.expertId
    );

    res.json({ url: link.url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create dashboard link' });
  }
});

// ============================================================================
// ORGANIZATION STRIPE ACCOUNT (Your Revenue)
// ============================================================================

/**
 * View your organization's Stripe Connected Account balance
 * This is YOUR share of the revenue (default: 20%)
 */
app.get('/api/organization/stripe-balance', async (req, res) => {
  try {
    const balance = await callPayMin.organization.getStripeBalance({
      accountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID!,
    });

    res.json(balance);
    // {
    //   available: [
    //     { amount: 50000, currency: 'usd' } // $500.00 ready to withdraw
    //   ],
    //   pending: [
    //     { amount: 10000, currency: 'usd' } // $100.00 processing
    //   ]
    // }
  } catch (error) {
    console.error('Stripe balance error:', error);
    res.status(500).json({ error: 'Failed to fetch Stripe balance' });
  }
});

/**
 * Get Stripe Express Dashboard link for your organization
 * Manage payouts and view detailed reports
 */
app.get('/api/organization/stripe-dashboard', async (req, res) => {
  try {
    const link = await callPayMin.organization.getStripeDashboardLink({
      accountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID!,
    });

    res.json({ url: link.url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create dashboard link' });
  }
});

// ============================================================================
// WEBHOOKS
// ============================================================================

/**
 * Handle CallPayMin webhooks
 * Most events are informational since billing is automatic
 */
app.post('/webhooks/callpaymin', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = JSON.parse(req.body.toString());

  try {
    switch (event.type) {
      case 'call.ended':
        // Log the call and revenue
        await logCallRevenue(event.data);
        break;

      case 'balance.low':
        // Auto-charge will happen automatically
        // Just log for analytics
        console.log(`User ${event.data.userId} has low balance, auto-charge will trigger`);
        break;

      case 'charge.succeeded':
        // User was auto-charged successfully
        await notifyUserOfCharge(event.data);
        break;

      case 'charge.failed':
        // Auto-charge failed (card declined, etc.)
        await notifyUserOfFailedCharge(event.data);
        break;

      case 'payout.completed':
        // Expert received payout via Stripe
        await notifyExpertOfPayout(event.data);
        break;

      case 'summary.completed':
        // AI summary ready
        await notifyUsersOfSummary(event.data);
        break;

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal error');
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function saveUserToDatabase(data: any): Promise<void> {
  console.log('Saving user:', data);
}

async function saveExpertToDatabase(data: any): Promise<void> {
  console.log('Saving expert:', data);
}

async function getUserDisplayName(userId: string): Promise<string> {
  return 'User';
}

async function logCallRevenue(data: any): Promise<void> {
  const { callId, billing } = data;

  console.log('Call revenue:', {
    callId,
    totalCost: billing.totalCost,
    expertPayout: billing.expertPayout,
    platformRevenue: billing.platformRevenue,
  });

  // Save to analytics database
  // await analytics.track('call_completed', { ... });
}

async function notifyUserOfCharge(data: any): Promise<void> {
  const { userId, amount, paymentMethodLast4 } = data;

  console.log(`User ${userId} charged $${amount}`);

  // Send email notification
  // await sendEmail(userId, {
  //   subject: 'Payment Processed',
  //   body: `Your card ending in ${paymentMethodLast4} was charged $${amount}`,
  // });
}

async function notifyUserOfFailedCharge(data: any): Promise<void> {
  const { userId, amount, reason } = data;

  console.error(`Charge failed for user ${userId}: ${reason}`);

  // Send urgent email
  // await sendEmail(userId, {
  //   subject: 'Payment Failed',
  //   body: `Your card was declined. Please update your payment method.`,
  //   priority: 'high',
  // });
}

async function notifyExpertOfPayout(data: any): Promise<void> {
  const { expertId, amount } = data;

  console.log(`Expert ${expertId} received payout: $${amount}`);

  // Send email notification
  // await sendEmail(expertId, {
  //   subject: 'Payout Received',
  //   body: `You received a payout of $${amount}`,
  // });
}

async function notifyUsersOfSummary(data: any): Promise<void> {
  const { callId, summary } = data;

  console.log(`AI summary completed for call ${callId}`);

  // Send email to participants
  // await sendSummaryEmail(callId, summary);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Fully Managed payment mode integration ready');
});

// ============================================================================
// FRONTEND INTEGRATION EXAMPLE
// ============================================================================

/**
 * Frontend: Add payment method with Stripe.js
 *
 * ```javascript
 * import { loadStripe } from '@stripe/stripe-js';
 *
 * const stripe = await loadStripe('pk_live_your_publishable_key');
 *
 * // 1. Get clientSecret from backend
 * const { clientSecret } = await fetch('/api/users/user_123/setup-intent')
 *   .then(r => r.json());
 *
 * // 2. Show Stripe card form
 * const cardElement = elements.create('card');
 * cardElement.mount('#card-element');
 *
 * // 3. Confirm card setup
 * const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
 *   payment_method: {
 *     card: cardElement,
 *     billing_details: {
 *       name: 'John Doe',
 *     },
 *   },
 * });
 *
 * if (!error) {
 *   // 4. Save payment method on backend
 *   await fetch('/api/users/user_123/payment-methods', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       paymentMethodId: setupIntent.payment_method,
 *       setAsDefault: true,
 *     }),
 *   });
 *
 *   alert('Payment method added! Auto-recharge is now enabled.');
 * }
 * ```
 */

// ============================================================================
// REVENUE CALCULATION
// ============================================================================

/**
 * How revenue is split in Fully Managed mode:
 *
 * Example call:
 * - Duration: 5 minutes
 * - Rate: $5/minute
 * - Total cost: $25
 *
 * Split (default: 80/20):
 * - Expert receives: $20 (80%)
 * - Platform receives: $5 (20%)
 *
 * Fees:
 * - Platform fee: 3.5% of $25 = $0.88
 * - Expert payout fee: 1.0% of $20 = $0.20
 * - Business payout fee: 1.0% of $5 = $0.05
 * - Stripe card fee: 2.9% + $0.30 = $1.03
 * - Stripe Connect fee: 0.25% + $0.25 = $0.31
 *
 * Net:
 * - Expert nets: $19.80
 * - Platform nets: $4.95
 * - Stripe + CallPayMin fees: $2.47
 */
