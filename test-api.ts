/**
 * CallPayMin API Test Script
 * Tests all API endpoints against localhost
 */

const BASE_URL = 'http://localhost:3000/api/v1';

// You need a valid API key - get one from your dashboard or database
const API_KEY = process.env.CALLPAYMIN_API_KEY || 'YOUR_API_KEY_HERE';

async function request(method: string, path: string, data?: any) {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  console.log(`\n🔄 ${method} ${path}`);

  try {
    const response = await fetch(url, options);
    const json = await response.json();

    if (!response.ok) {
      console.log(`❌ ${response.status}: ${JSON.stringify(json, null, 2)}`);
      return { error: true, status: response.status, data: json };
    }

    console.log(`✅ ${response.status}: ${JSON.stringify(json, null, 2).substring(0, 500)}...`);
    return { error: false, status: response.status, data: json };
  } catch (error: any) {
    console.log(`❌ Network error: ${error.message}`);
    return { error: true, message: error.message };
  }
}

async function testHealthCheck() {
  console.log('\n' + '='.repeat(60));
  console.log('🏥 HEALTH CHECK');
  console.log('='.repeat(60));

  await request('GET', '/health');
}

async function testUsers() {
  console.log('\n' + '='.repeat(60));
  console.log('👤 USERS / BILLING API');
  console.log('='.repeat(60));

  const timestamp = Date.now();
  const userId = `test_user_${timestamp}`;

  // Create user
  const createResult = await request('POST', '/billing/users', {
    externalId: userId,
    displayName: 'Test User',
    email: `test${timestamp}@example.com`,
    initialBalance: 0,
  });

  if (createResult.error) {
    console.log('⚠️  Skipping remaining user tests due to creation failure');
    return null;
  }

  // Get user
  await request('GET', `/billing/users/${userId}`);

  // Add funds
  await request('POST', `/billing/users/${userId}/add-funds`, {
    amount: 100,
    description: 'Test deposit',
  });

  // Get balance again
  await request('GET', `/billing/users/${userId}`);

  // Get transactions
  await request('GET', `/billing/users/${userId}/transactions`);

  // List users
  await request('GET', '/billing/users?limit=5');

  return userId;
}

async function testExperts() {
  console.log('\n' + '='.repeat(60));
  console.log('👨‍⚕️ EXPERTS API');
  console.log('='.repeat(60));

  const timestamp = Date.now();
  const expertId = `test_expert_${timestamp}`;

  // Create expert
  const createResult = await request('POST', '/experts', {
    externalId: expertId,
    email: `expert${timestamp}@example.com`,
    profile: {
      firstName: 'Test',
      lastName: 'Expert',
      country: 'US',
    },
    rates: {
      perMinute: 5,
      currency: 'USD',
    },
  });

  if (createResult.error) {
    console.log('⚠️  Skipping remaining expert tests due to creation failure');
    return null;
  }

  // Get expert
  await request('GET', `/experts/${expertId}`);

  // Get earnings
  await request('GET', `/experts/${expertId}/earnings`);

  // List experts
  await request('GET', '/experts?limit=5');

  return expertId;
}

async function testCalls(userId: string | null, expertId: string | null) {
  console.log('\n' + '='.repeat(60));
  console.log('📞 CALLS API');
  console.log('='.repeat(60));

  if (!userId || !expertId) {
    console.log('⚠️  Skipping calls tests - need valid user and expert');
    return null;
  }

  // Create call
  const createResult = await request('POST', '/calls', {
    participants: [
      { externalId: userId, displayName: 'Test User', role: 'client' },
      { externalId: expertId, displayName: 'Test Expert', role: 'expert' },
    ],
    billing: {
      payerId: userId,
      ratePerMinute: 5,
      currency: 'USD',
    },
    config: {
      video: true,
      audio: true,
    },
  });

  if (createResult.error) {
    console.log('⚠️  Skipping remaining call tests due to creation failure');
    return null;
  }

  const callId = createResult.data?.id || createResult.data?.data?.id;
  if (!callId) {
    console.log('⚠️  No call ID returned');
    return null;
  }

  // Get call
  await request('GET', `/calls/${callId}`);

  // Start call
  await request('POST', `/calls/${callId}/start`);

  // Wait a moment to simulate call duration
  console.log('\n⏳ Simulating 2 second call...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // End call
  await request('POST', `/calls/${callId}/end`);

  // Get call again to see billing
  await request('GET', `/calls/${callId}`);

  // List calls
  await request('GET', '/calls?limit=5');

  return callId;
}

async function testChats(userId: string | null, expertId: string | null) {
  console.log('\n' + '='.repeat(60));
  console.log('💬 CHATS API');
  console.log('='.repeat(60));

  if (!userId || !expertId) {
    console.log('⚠️  Skipping chats tests - need valid user and expert');
    return null;
  }

  // Create chat
  const createResult = await request('POST', '/chats', {
    participants: [
      { externalId: userId, displayName: 'Test User', role: 'client' },
      { externalId: expertId, displayName: 'Test Expert', role: 'expert' },
    ],
    billing: {
      payerId: userId,
      ratePerMinute: 2,
    },
  });

  if (createResult.error) {
    console.log('⚠️  Skipping remaining chat tests due to creation failure');
    return null;
  }

  const chatId = createResult.data?.id || createResult.data?.data?.id;
  if (!chatId) {
    console.log('⚠️  No chat ID returned');
    return null;
  }

  // Get chat
  await request('GET', `/chats/${chatId}`);

  // Send messages
  await request('POST', `/chats/${chatId}/messages`, {
    senderExternalId: userId,
    content: 'Hello, I have a question about my health.',
  });

  await request('POST', `/chats/${chatId}/messages`, {
    senderExternalId: expertId,
    content: 'Hello! I\'d be happy to help. What\'s your question?',
  });

  // Get messages
  await request('GET', `/chats/${chatId}/messages`);

  // End chat
  await request('POST', `/chats/${chatId}/end`);

  // List chats
  await request('GET', '/chats?limit=5');

  return chatId;
}

async function testSummaries(callId: string | null, chatId: string | null) {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 AI SUMMARIES API');
  console.log('='.repeat(60));

  if (callId) {
    // Generate call summary
    await request('POST', `/summaries/calls/${callId}`, {
      type: 'brief',
    });

    // Get call summary
    await request('GET', `/summaries/calls/${callId}`);
  } else {
    console.log('⚠️  Skipping call summary - no call ID');
  }

  if (chatId) {
    // Generate chat summary
    await request('POST', `/summaries/chats/${chatId}`, {
      type: 'brief',
    });

    // Get chat summary
    await request('GET', `/summaries/chats/${chatId}`);
  } else {
    console.log('⚠️  Skipping chat summary - no chat ID');
  }
}

async function testOrganization() {
  console.log('\n' + '='.repeat(60));
  console.log('🏢 ORGANIZATION API');
  console.log('='.repeat(60));

  // Get organization
  await request('GET', '/organization');

  // Get usage
  await request('GET', '/organization/usage');

  // Get plans
  await request('GET', '/organization/plans');

  // Get webhooks
  await request('GET', '/organization/webhooks');

  // Get invoices
  await request('GET', '/organization/invoices');
}

async function runAllTests() {
  console.log('🚀 CallPayMin API Test Suite');
  console.log('============================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('');

  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('❌ ERROR: Please set CALLPAYMIN_API_KEY environment variable');
    console.log('   Example: CALLPAYMIN_API_KEY=cpm_live_xxx npx ts-node test-api.ts');
    process.exit(1);
  }

  try {
    // Health check
    await testHealthCheck();

    // Users
    const userId = await testUsers();

    // Experts
    const expertId = await testExperts();

    // Calls
    const callId = await testCalls(userId, expertId);

    // Chats
    const chatId = await testChats(userId, expertId);

    // Summaries
    await testSummaries(callId, chatId);

    // Organization
    await testOrganization();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Run tests
runAllTests();
