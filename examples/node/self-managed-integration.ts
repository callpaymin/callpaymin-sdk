/**
 * Self-Managed Payment Mode Integration Example
 *
 * In Self-Managed mode, YOU handle all payment processing.
 * CallPayMin tracks virtual balances and usage.
 *
 * Flow:
 * 1. Charge users via YOUR payment processor (Stripe, PayPal, etc.)
 * 2. Add funds to CallPayMin virtual balance via API
 * 3. CallPayMin deducts from balance during calls/chats
 * 4. Receive webhooks when balance is low
 * 5. Process expert payouts via YOUR payment processor
 */

import express from 'express';
import Stripe from 'stripe';
import { CallPayMin } from '@callpaymin/sdk';

const app = express();
app.use(express.json());

// Initialize clients
const callPayMin = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY!,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// ============================================================================
// USER REGISTRATION
// ============================================================================

/**
 * Step 1: Register user in both systems
 */
app.post('/api/users/register', async (req, res) => {
  const { email, displayName } = req.body;

  try {
    // Create Stripe customer (for YOUR billing)
    const stripeCustomer = await stripe.customers.create({
      email,
      name: displayName,
    });

    // Create CallPayMin user
    const callPayMinUser = await callPayMin.users.create({
      externalId: `user_${stripeCustomer.id}`,
      displayName,
      email,
    });

    // Save to your database
    await saveUserToDatabase({
      stripeCustomerId: stripeCustomer.id,
      callPayMinExternalId: callPayMinUser.externalId,
      email,
      displayName,
    });

    res.json({
      userId: stripeCustomer.id,
      message: 'User registered successfully',
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ============================================================================
// ADD FUNDS FLOW
// ============================================================================

/**
 * Step 2: User adds funds via YOUR Stripe
 */
app.post('/api/billing/add-funds', async (req, res) => {
  const { userId, amount, paymentMethodId } = req.body;

  try {
    // Charge user via YOUR Stripe account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      customer: userId,
      payment_method: paymentMethodId,
      confirm: true,
      description: 'CallPayMin credits',
    });

    if (paymentIntent.status === 'succeeded') {
      // Add funds to CallPayMin virtual balance
      await callPayMin.users.addFunds(`user_${userId}`, {
        amount,
        description: `Stripe charge ${paymentIntent.id}`,
      });

      // Save transaction to your database
      await saveTransactionToDatabase({
        userId,
        amount,
        type: 'deposit',
        stripePaymentIntentId: paymentIntent.id,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        balance: await callPayMin.users.getBalance(`user_${userId}`),
      });
    } else {
      res.status(400).json({ error: 'Payment failed' });
    }
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ error: 'Failed to add funds' });
  }
});

/**
 * Alternative: Charge via PayPal
 */
app.post('/api/billing/add-funds-paypal', async (req, res) => {
  const { userId, amount, paypalOrderId } = req.body;

  try {
    // Capture PayPal order
    const order = await capturePayPalOrder(paypalOrderId);

    if (order.status === 'COMPLETED') {
      // Add funds to CallPayMin
      await callPayMin.users.addFunds(`user_${userId}`, {
        amount,
        description: `PayPal order ${paypalOrderId}`,
      });

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'PayPal payment failed' });
    }
  } catch (error) {
    console.error('PayPal error:', error);
    res.status(500).json({ error: 'Failed to process PayPal payment' });
  }
});

// ============================================================================
// CHECK BALANCE
// ============================================================================

/**
 * Get user's CallPayMin balance
 */
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const balance = await callPayMin.users.getBalance(
      `user_${req.params.userId}`
    );

    res.json(balance);
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
      `user_${req.params.userId}`
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
 * Step 3: Start a billed call
 */
app.post('/api/calls/start', async (req, res) => {
  const { userId, expertId } = req.body;

  try {
    // Check if user has sufficient balance
    const balance = await callPayMin.users.getBalance(`user_${userId}`);

    if (balance.balance < 5) {
      return res.status(400).json({
        error: 'Insufficient balance',
        currentBalance: balance.balance,
        message: 'Please add funds to continue',
      });
    }

    // Get expert info
    const expert = await callPayMin.experts.get(`expert_${expertId}`);

    // Create call
    const call = await callPayMin.calls.create({
      participants: [
        {
          externalId: `user_${userId}`,
          displayName: await getUserDisplayName(userId),
          role: 'client',
        },
        {
          externalId: `expert_${expertId}`,
          displayName: expert.displayName,
          role: 'expert',
        },
      ],
      billing: {
        payerId: `user_${userId}`,
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
    res.status(500).json({ error: 'Failed to start call' });
  }
});

// ============================================================================
// WEBHOOK: LOW BALANCE ALERT
// ============================================================================

/**
 * Step 4: Handle low balance webhook
 */
app.post('/webhooks/callpaymin', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = JSON.parse(req.body.toString());

  if (event.type === 'balance.low') {
    const { userId, currentBalance, threshold } = event.data;

    console.warn(`Low balance for user ${userId}: $${currentBalance}`);

    // Send email notification
    await sendEmailNotification(userId, {
      subject: 'Low Balance Alert',
      template: 'balance-low',
      data: {
        currentBalance,
        threshold,
        topUpLink: `${process.env.APP_URL}/billing/add-funds`,
      },
    });

    // Send push notification
    await sendPushNotification(userId, {
      title: 'Low Balance',
      body: `Your balance is $${currentBalance}. Add funds to continue.`,
    });

    // Optional: Auto-charge default payment method
    const user = await getUserFromDatabase(userId);
    if (user.autoRecharge && user.defaultPaymentMethod) {
      try {
        await autoChargeUser(userId, 50); // Auto-add $50
        console.log(`Auto-charged user ${userId} for $50`);
      } catch (error) {
        console.error('Auto-charge failed:', error);
      }
    }
  }

  res.status(200).send('OK');
});

/**
 * Auto-charge user when balance is low
 */
async function autoChargeUser(userId: string, amount: number): Promise<void> {
  const user = await getUserFromDatabase(userId);

  // Charge via Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: 'usd',
    customer: user.stripeCustomerId,
    payment_method: user.defaultPaymentMethod,
    confirm: true,
    off_session: true,
    description: 'Auto-recharge',
  });

  if (paymentIntent.status === 'succeeded') {
    await callPayMin.users.addFunds(`user_${userId}`, {
      amount,
      description: 'Auto-recharge',
    });
  }
}

// ============================================================================
// EXPERT REGISTRATION
// ============================================================================

/**
 * Register an expert
 */
app.post('/api/experts/register', async (req, res) => {
  const { email, displayName, specialties, ratePerMinute } = req.body;

  try {
    // Create expert in CallPayMin
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
    });
  } catch (error) {
    console.error('Expert registration error:', error);
    res.status(500).json({ error: 'Failed to register expert' });
  }
});

// ============================================================================
// EXPERT PAYOUTS
// ============================================================================

/**
 * Step 5: View expert earnings
 */
app.get('/api/experts/:expertId/earnings', async (req, res) => {
  try {
    const earnings = await callPayMin.experts.getEarnings(
      `expert_${req.params.expertId}`
    );

    res.json(earnings);
    // {
    //   balance: 150.00,        // Available for payout
    //   pendingPayout: 50.00,   // Currently processing
    //   totalEarned: 1000.00,   // Lifetime earnings
    // }
  } catch (error) {
    res.status(404).json({ error: 'Expert not found' });
  }
});

/**
 * Step 6: Trigger expert payout
 */
app.post('/api/experts/:expertId/payout', async (req, res) => {
  const expertId = `expert_${req.params.expertId}`;

  try {
    // Request payout from CallPayMin
    const payout = await callPayMin.experts.requestPayout(expertId);

    // Process payout via YOUR payment processor
    const expert = await getExpertFromDatabase(expertId);

    if (expert.payoutMethod === 'stripe') {
      // Transfer via Stripe
      await stripe.transfers.create({
        amount: payout.amount * 100,
        currency: 'usd',
        destination: expert.stripeAccountId,
        description: `Payout for ${payout.callCount} calls`,
      });
    } else if (expert.payoutMethod === 'paypal') {
      // Transfer via PayPal
      await sendPayPalPayout(expert.paypalEmail, payout.amount);
    } else if (expert.payoutMethod === 'bank_transfer') {
      // Queue bank transfer
      await queueBankTransfer(expert.bankAccount, payout.amount);
    }

    // Save payout record
    await savePayoutToDatabase({
      expertId,
      amount: payout.amount,
      method: expert.payoutMethod,
      status: 'completed',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      amount: payout.amount,
      method: expert.payoutMethod,
    });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

/**
 * Automatic weekly payouts (cron job)
 */
async function processWeeklyPayouts(): Promise<void> {
  console.log('Running weekly payout job...');

  // Get all experts with available balance
  const experts = await getExpertsWithBalance();

  for (const expert of experts) {
    try {
      const earnings = await callPayMin.experts.getEarnings(expert.externalId);

      // Only payout if balance >= $50
      if (earnings.balance >= 50) {
        await callPayMin.experts.requestPayout(expert.externalId);

        // Process payout via your payment processor
        // ... (same as manual payout above)

        console.log(`Processed payout for ${expert.externalId}: $${earnings.balance}`);
      }
    } catch (error) {
      console.error(`Failed to process payout for ${expert.externalId}:`, error);
    }
  }
}

// Run weekly payouts every Monday at 9 AM
// Use a cron library like node-cron:
// cron.schedule('0 9 * * MON', processWeeklyPayouts);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function saveUserToDatabase(data: any): Promise<void> {
  // TODO: Implement database save
  console.log('Saving user:', data);
}

async function saveExpertToDatabase(data: any): Promise<void> {
  // TODO: Implement database save
  console.log('Saving expert:', data);
}

async function saveTransactionToDatabase(data: any): Promise<void> {
  // TODO: Implement database save
  console.log('Saving transaction:', data);
}

async function savePayoutToDatabase(data: any): Promise<void> {
  // TODO: Implement database save
  console.log('Saving payout:', data);
}

async function getUserFromDatabase(userId: string): Promise<any> {
  // TODO: Implement database query
  return {
    stripeCustomerId: userId,
    autoRecharge: false,
    defaultPaymentMethod: null,
  };
}

async function getExpertFromDatabase(expertId: string): Promise<any> {
  // TODO: Implement database query
  return {
    payoutMethod: 'stripe',
    stripeAccountId: 'acct_xxx',
    paypalEmail: 'expert@example.com',
    bankAccount: {},
  };
}

async function getExpertsWithBalance(): Promise<any[]> {
  // TODO: Implement database query
  return [];
}

async function getUserDisplayName(userId: string): Promise<string> {
  const user = await getUserFromDatabase(userId);
  return user.displayName || 'User';
}

async function sendEmailNotification(userId: string, options: any): Promise<void> {
  // TODO: Implement email sending
  console.log('Sending email to:', userId, options);
}

async function sendPushNotification(userId: string, notification: any): Promise<void> {
  // TODO: Implement push notification
  console.log('Sending push to:', userId, notification);
}

async function capturePayPalOrder(orderId: string): Promise<any> {
  // TODO: Implement PayPal capture
  return { status: 'COMPLETED' };
}

async function sendPayPalPayout(email: string, amount: number): Promise<void> {
  // TODO: Implement PayPal payout
  console.log('Sending PayPal payout:', email, amount);
}

async function queueBankTransfer(bankAccount: any, amount: number): Promise<void> {
  // TODO: Implement bank transfer
  console.log('Queueing bank transfer:', bankAccount, amount);
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
  console.log('Self-Managed payment mode integration ready');
});

// ============================================================================
// PRICING CALCULATION EXAMPLE
// ============================================================================

/**
 * Calculate total cost for a call
 */
function calculateCallCost(duration: number, ratePerMinute: number): number {
  const minutes = Math.ceil(duration / 60); // Round up to nearest minute
  return minutes * ratePerMinute;
}

// Example:
// Duration: 150 seconds (2.5 minutes)
// Rate: $5/minute
// Cost: 3 minutes * $5 = $15

/**
 * Calculate revenue split
 */
function calculateRevenueSplit(totalCost: number, expertRate: number = 0.8): {
  expertPayout: number;
  platformRevenue: number;
} {
  const expertPayout = totalCost * expertRate;
  const platformRevenue = totalCost * (1 - expertRate);

  return {
    expertPayout: Math.round(expertPayout * 100) / 100,
    platformRevenue: Math.round(platformRevenue * 100) / 100,
  };
}

// Example:
// Total cost: $15
// Split: 80% expert, 20% platform
// Expert gets: $12
// Platform gets: $3
