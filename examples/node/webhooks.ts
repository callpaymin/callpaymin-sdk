/**
 * CallPayMin Webhook Handler Examples
 *
 * Complete examples for handling all CallPayMin webhook events.
 * Includes signature verification, error handling, and best practices.
 */

import express from 'express';
import crypto from 'crypto';
import { CallPayMin } from '@callpaymin/sdk';

const app = express();
const client = new CallPayMin({
  apiKey: process.env.CALLPAYMIN_API_KEY!,
});

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify webhook signature to ensure request is from CallPayMin
 *
 * Signature format: t=timestamp,v1=hash
 * Signed payload: timestamp.JSON.stringify(body)
 */
function verifyWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  // Extract timestamp and hash from signature
  const timestampMatch = signature.match(/t=(\d+)/);
  const hashMatch = signature.match(/v1=([a-f0-9]+)/);

  if (!timestampMatch || !hashMatch) {
    console.error('Invalid signature format');
    return false;
  }

  const timestamp = timestampMatch[1];
  const hash = hashMatch[1];

  // Prevent replay attacks (reject requests older than 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestAge = currentTime - parseInt(timestamp);

  if (requestAge > 300) {
    console.error('Webhook timestamp too old:', requestAge, 'seconds');
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedHash)
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// ============================================================================
// WEBHOOK ENDPOINT
// ============================================================================

/**
 * Main webhook endpoint
 *
 * IMPORTANT: Use express.raw() to preserve raw body for signature verification
 */
app.post(
  '/webhooks/callpaymin',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-callpaymin-signature'] as string;
    const secret = process.env.CALLPAYMIN_WEBHOOK_SECRET!;

    // Verify signature
    const payload = JSON.parse(req.body.toString());

    if (!verifyWebhookSignature(payload, signature, secret)) {
      console.error('Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }

    // Process webhook event
    try {
      await handleWebhookEvent(payload);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
);

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  console.log(`Received webhook: ${event.type} (${event.id})`);

  switch (event.type) {
    case 'call.started':
      await handleCallStarted(event);
      break;

    case 'call.ended':
      await handleCallEnded(event);
      break;

    case 'call.failed':
      await handleCallFailed(event);
      break;

    case 'chat.started':
      await handleChatStarted(event);
      break;

    case 'chat.message':
      await handleChatMessage(event);
      break;

    case 'chat.ended':
      await handleChatEnded(event);
      break;

    case 'balance.low':
      await handleBalanceLow(event);
      break;

    case 'balance.depleted':
      await handleBalanceDepleted(event);
      break;

    case 'summary.completed':
      await handleSummaryCompleted(event);
      break;

    case 'payout.completed':
      await handlePayoutCompleted(event);
      break;

    case 'payout.failed':
      await handlePayoutFailed(event);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

// ----------------------------------------------------------------------------
// CALL EVENTS
// ----------------------------------------------------------------------------

async function handleCallStarted(event: WebhookEvent): Promise<void> {
  const { callId, participants, billing, startedAt } = event.data;

  console.log(`Call started: ${callId}`);
  console.log(`Participants: ${participants.map(p => p.displayName).join(', ')}`);
  console.log(`Rate: $${billing.ratePerMinute}/min`);

  // Save to your database
  await saveCallToDatabase({
    callId,
    status: 'active',
    participants,
    startedAt,
    ratePerMinute: billing.ratePerMinute,
  });

  // Send notifications to participants
  for (const participant of participants) {
    await sendPushNotification(participant.externalId, {
      title: 'Call Started',
      body: `Your call with ${participants.find(p => p.externalId !== participant.externalId)?.displayName} has started.`,
    });
  }
}

async function handleCallEnded(event: WebhookEvent): Promise<void> {
  const { callId, duration, billing, endedAt, endReason } = event.data;

  console.log(`Call ended: ${callId}`);
  console.log(`Duration: ${duration}s (${Math.ceil(duration / 60)}min)`);
  console.log(`Total cost: $${billing.totalCost}`);
  console.log(`Reason: ${endReason}`);

  // Update database
  await updateCallInDatabase(callId, {
    status: 'completed',
    endedAt,
    duration,
    totalCost: billing.totalCost,
    endReason,
  });

  // Send receipt email to payer
  await sendReceiptEmail(billing.payerId, {
    callId,
    duration,
    cost: billing.totalCost,
    ratePerMinute: billing.ratePerMinute,
  });

  // Update expert earnings
  if (billing.expertId) {
    await updateExpertEarnings(billing.expertId, {
      amount: billing.expertPayout,
      callId,
    });
  }

  // Generate AI summary (optional)
  if (duration > 60) { // Only for calls longer than 1 minute
    try {
      await client.summaries.generateForCall(callId, {
        type: 'detailed',
        includeActionItems: true,
        includeKeyPoints: true,
      });
      console.log(`AI summary generation initiated for call ${callId}`);
    } catch (error) {
      console.error(`Failed to generate summary for call ${callId}:`, error);
    }
  }
}

async function handleCallFailed(event: WebhookEvent): Promise<void> {
  const { callId, reason, participants } = event.data;

  console.error(`Call failed: ${callId} - ${reason}`);

  // Save error to database
  await saveCallErrorToDatabase({
    callId,
    reason,
    timestamp: new Date(),
  });

  // Notify participants
  for (const participant of participants) {
    await sendPushNotification(participant.externalId, {
      title: 'Call Failed',
      body: `The call could not be connected. Reason: ${reason}`,
    });
  }
}

// ----------------------------------------------------------------------------
// CHAT EVENTS
// ----------------------------------------------------------------------------

async function handleChatStarted(event: WebhookEvent): Promise<void> {
  const { chatId, participants, billing } = event.data;

  console.log(`Chat started: ${chatId}`);

  await saveChatToDatabase({
    chatId,
    status: 'active',
    participants,
    ratePerMinute: billing.ratePerMinute,
  });
}

async function handleChatMessage(event: WebhookEvent): Promise<void> {
  const { chatId, message } = event.data;

  console.log(`New message in chat ${chatId} from ${message.sender}`);

  // Save message to database
  await saveMessageToDatabase({
    chatId,
    messageId: message.id,
    senderExternalId: message.sender,
    content: message.content,
    timestamp: message.timestamp,
  });

  // Send push notification to recipient
  const recipient = event.data.participants.find(
    p => p.externalId !== message.sender
  );

  if (recipient) {
    await sendPushNotification(recipient.externalId, {
      title: `Message from ${message.senderDisplayName}`,
      body: message.content,
    });
  }
}

async function handleChatEnded(event: WebhookEvent): Promise<void> {
  const { chatId, messageCount, billing } = event.data;

  console.log(`Chat ended: ${chatId}`);
  console.log(`Total messages: ${messageCount}`);
  console.log(`Total cost: $${billing.totalCost}`);

  await updateChatInDatabase(chatId, {
    status: 'completed',
    messageCount,
    totalCost: billing.totalCost,
  });
}

// ----------------------------------------------------------------------------
// BILLING EVENTS
// ----------------------------------------------------------------------------

async function handleBalanceLow(event: WebhookEvent): Promise<void> {
  const { userId, currentBalance, threshold } = event.data;

  console.warn(`Low balance alert for user ${userId}: $${currentBalance}`);

  // Self-Managed Mode: Notify user to add funds
  if (event.data.paymentMode === 'self-managed') {
    await sendEmailNotification(userId, {
      subject: 'Low Balance Alert',
      template: 'balance-low',
      data: {
        currentBalance,
        threshold,
        topUpLink: `${process.env.APP_URL}/billing/add-funds`,
      },
    });

    await sendPushNotification(userId, {
      title: 'Low Balance',
      body: `Your balance is $${currentBalance}. Add funds to continue using the service.`,
    });
  }

  // Fully Managed Mode: Auto-charge will happen automatically
  if (event.data.paymentMode === 'fully-managed') {
    console.log(`Auto-charge will be initiated for user ${userId}`);
  }
}

async function handleBalanceDepleted(event: WebhookEvent): Promise<void> {
  const { userId, lastTransactionId } = event.data;

  console.error(`Balance depleted for user ${userId}`);

  // Notify user immediately
  await sendEmailNotification(userId, {
    subject: 'Balance Depleted - Service Interrupted',
    template: 'balance-depleted',
    data: {
      topUpLink: `${process.env.APP_URL}/billing/add-funds`,
    },
  });

  await sendPushNotification(userId, {
    title: 'Balance Depleted',
    body: 'Your balance is $0. Add funds immediately to continue using the service.',
    priority: 'high',
  });

  // Temporarily disable user's access to prevent new charges
  await setUserAccessStatus(userId, 'suspended');
}

// ----------------------------------------------------------------------------
// SUMMARY EVENTS
// ----------------------------------------------------------------------------

async function handleSummaryCompleted(event: WebhookEvent): Promise<void> {
  const { summaryId, callId, chatId, summary } = event.data;

  console.log(`AI summary completed: ${summaryId}`);

  // Save summary to database
  await saveSummaryToDatabase({
    summaryId,
    callId: callId || null,
    chatId: chatId || null,
    content: summary.content,
    actionItems: summary.actionItems,
    keyPoints: summary.keyPoints,
    sentiment: summary.sentiment,
  });

  // Notify participants
  const participants = callId
    ? await getCallParticipants(callId)
    : await getChatParticipants(chatId);

  for (const participant of participants) {
    await sendEmailNotification(participant.externalId, {
      subject: 'Your Call Summary is Ready',
      template: 'summary-completed',
      data: {
        summary: summary.content,
        actionItems: summary.actionItems,
        viewLink: `${process.env.APP_URL}/summaries/${summaryId}`,
      },
    });
  }
}

// ----------------------------------------------------------------------------
// PAYOUT EVENTS (Self-Managed Mode Only)
// ----------------------------------------------------------------------------

async function handlePayoutCompleted(event: WebhookEvent): Promise<void> {
  const { payoutId, expertId, amount, method } = event.data;

  console.log(`Payout completed: ${payoutId} - $${amount} to ${expertId}`);

  // Update database
  await updatePayoutStatus(payoutId, 'completed');

  // Notify expert
  await sendEmailNotification(expertId, {
    subject: 'Payout Completed',
    template: 'payout-completed',
    data: {
      amount,
      method,
      date: new Date().toLocaleDateString(),
    },
  });
}

async function handlePayoutFailed(event: WebhookEvent): Promise<void> {
  const { payoutId, expertId, amount, reason } = event.data;

  console.error(`Payout failed: ${payoutId} - Reason: ${reason}`);

  // Update database
  await updatePayoutStatus(payoutId, 'failed', reason);

  // Notify expert
  await sendEmailNotification(expertId, {
    subject: 'Payout Failed',
    template: 'payout-failed',
    data: {
      amount,
      reason,
      supportLink: `${process.env.APP_URL}/support`,
    },
  });

  // Alert admin
  await sendAdminAlert({
    type: 'payout-failure',
    expertId,
    amount,
    reason,
  });
}

// ============================================================================
// HELPER FUNCTIONS (Implement based on your stack)
// ============================================================================

async function saveCallToDatabase(data: any): Promise<void> {
  // TODO: Implement database save
  console.log('Saving call to database:', data);
}

async function updateCallInDatabase(callId: string, data: any): Promise<void> {
  // TODO: Implement database update
  console.log('Updating call in database:', callId, data);
}

async function saveCallErrorToDatabase(data: any): Promise<void> {
  // TODO: Implement error logging
  console.error('Saving call error:', data);
}

async function saveChatToDatabase(data: any): Promise<void> {
  // TODO: Implement database save
  console.log('Saving chat to database:', data);
}

async function updateChatInDatabase(chatId: string, data: any): Promise<void> {
  // TODO: Implement database update
  console.log('Updating chat in database:', chatId, data);
}

async function saveMessageToDatabase(data: any): Promise<void> {
  // TODO: Implement message save
  console.log('Saving message:', data);
}

async function updateExpertEarnings(expertId: string, data: any): Promise<void> {
  // TODO: Implement earnings update
  console.log('Updating expert earnings:', expertId, data);
}

async function saveSummaryToDatabase(data: any): Promise<void> {
  // TODO: Implement summary save
  console.log('Saving summary:', data);
}

async function updatePayoutStatus(
  payoutId: string,
  status: string,
  reason?: string
): Promise<void> {
  // TODO: Implement payout status update
  console.log('Updating payout status:', payoutId, status, reason);
}

async function sendReceiptEmail(userId: string, data: any): Promise<void> {
  // TODO: Implement email sending
  console.log('Sending receipt email to:', userId, data);
}

async function sendEmailNotification(
  userId: string,
  options: {
    subject: string;
    template: string;
    data: any;
  }
): Promise<void> {
  // TODO: Implement email notification
  console.log('Sending email to:', userId, options);
}

async function sendPushNotification(
  userId: string,
  notification: {
    title: string;
    body: string;
    priority?: string;
  }
): Promise<void> {
  // TODO: Implement push notification
  console.log('Sending push notification to:', userId, notification);
}

async function sendAdminAlert(data: any): Promise<void> {
  // TODO: Implement admin alerting
  console.error('Admin alert:', data);
}

async function setUserAccessStatus(
  userId: string,
  status: string
): Promise<void> {
  // TODO: Implement user access control
  console.log('Setting user access status:', userId, status);
}

async function getCallParticipants(callId: string): Promise<any[]> {
  // TODO: Implement database query
  return [];
}

async function getChatParticipants(chatId: string): Promise<any[]> {
  // TODO: Implement database query
  return [];
}

// ============================================================================
// WEBHOOK EVENT TYPES
// ============================================================================

interface WebhookEvent {
  id: string;
  type:
    | 'call.started'
    | 'call.ended'
    | 'call.failed'
    | 'chat.started'
    | 'chat.message'
    | 'chat.ended'
    | 'balance.low'
    | 'balance.depleted'
    | 'summary.completed'
    | 'payout.completed'
    | 'payout.failed';
  data: any;
  createdAt: string;
}

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhooks/callpaymin`);
});

// ============================================================================
// TESTING YOUR WEBHOOKS
// ============================================================================

/**
 * To test webhooks locally, use a tool like ngrok:
 *
 * 1. Install ngrok: https://ngrok.com/download
 * 2. Start your server: npm start
 * 3. Expose via ngrok: ngrok http 3000
 * 4. Configure webhook URL in CallPayMin dashboard:
 *    https://your-ngrok-url.ngrok.io/webhooks/callpaymin
 * 5. Make test calls/chats to trigger webhooks
 *
 * Example ngrok command:
 * $ ngrok http 3000
 * Forwarding: https://abc123.ngrok.io -> http://localhost:3000
 *
 * Then set webhook URL to: https://abc123.ngrok.io/webhooks/callpaymin
 */

/**
 * Manual webhook testing with curl:
 *
 * curl -X POST http://localhost:3000/webhooks/callpaymin \
 *   -H "Content-Type: application/json" \
 *   -H "X-CallPayMin-Signature: t=1234567890,v1=abcdef..." \
 *   -d '{"type":"call.ended","data":{...}}'
 */
