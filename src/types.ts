/**
 * CallPayMin SDK Types
 */

// ============================================
// Configuration
// ============================================

export interface CallPayMinConfig {
  /** Your API key (cpm_live_xxx or cpm_test_xxx) */
  apiKey: string;
  /** Base URL (defaults to https://api.callpaymin.io/v1) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

// ============================================
// Users & Billing
// ============================================

export interface User {
  id: string;
  externalId: string;
  email: string;
  displayName: string;
  phone?: string;
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  autoRecharge?: {
    enabled: boolean;
    threshold: number;
    amount: number;
  };
  stripe?: {
    customerId?: string;
    defaultPaymentMethodId?: string;
  };
  stats: {
    totalDeposited: number;
    totalSpent: number;
    callCount: number;
    chatCount: number;
  };
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface CreateUserParams {
  externalId: string;
  email: string;
  displayName: string;
  phone?: string;
  initialBalance?: number;
  currency?: string;
  autoRecharge?: {
    enabled: boolean;
    threshold: number;
    amount: number;
    webhookUrl?: string;
  };
  metadata?: Record<string, any>;
}

export interface Transaction {
  id: string;
  userId: string;
  expertId?: string;
  type: 'credit' | 'debit' | 'refund';
  category: 'deposit' | 'call' | 'chat' | 'summary' | 'refund';
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  reference?: {
    type: string;
    id: string;
  };
  split?: RevenueSplit;
  paymentMode: 'self_managed' | 'managed';
  description: string;
  status: 'completed' | 'failed';
  createdAt: string;
}

export interface RevenueSplit {
  gross: number;
  platformFee: number;
  expertShare: number;
  businessShare: number;
  expertNet: number;
  businessNet: number;
  callpayminProfit: number;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
  createdAt: string;
}

// ============================================
// Experts
// ============================================

export interface Expert {
  id: string;
  externalId: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    country: string;
  };
  rates: {
    perMinute: number;
    perMessage?: number;
    currency: string;
  };
  revenueShare?: {
    expert: number;
    platform: number;
  };
  stripe?: {
    accountId?: string;
    status: 'pending' | 'verified' | 'restricted';
    payoutsEnabled: boolean;
  };
  earnings: {
    lifetime: { gross: number; net: number };
    pendingPayout: number;
    lastPayoutAt?: string;
  };
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface CreateExpertParams {
  externalId: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    country: string;
  };
  rates: {
    perMinute: number;
    perMessage?: number;
    currency?: string;
  };
  revenueShare?: {
    expert: number;
    platform: number;
  };
  metadata?: Record<string, any>;
}

// ============================================
// Calls
// ============================================

export interface Call {
  id: string;
  participants: CallParticipant[];
  webrtc: WebRTCConfig;
  billing: {
    payerId: string;
    expertId?: string;
    ratePerMinute: number;
    currency: string;
  };
  duration?: {
    startedAt: string;
    endedAt?: string;
    totalSeconds: number;
    billableSeconds: number;
  };
  cost?: {
    total: number;
    breakdown: {
      callMinutes: number;
      recording?: number;
      transcription?: number;
      aiSummary?: number;
    };
  };
  recording?: RecordingInfo;
  transcription?: TranscriptionInfo;
  aiSummary?: AISummaryInfo;
  status: 'pending' | 'active' | 'ended' | 'failed';
  endReason?: 'completed' | 'insufficient_funds' | 'error';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CallParticipant {
  id: string;
  externalId: string;
  displayName: string;
  role: 'client' | 'expert';
  joinedAt?: string;
}

export interface WebRTCConfig {
  roomId: string;
  signalingUrl: string;
  turnServers: TurnServer[];
}

export interface TurnServer {
  urls: string[];
  username: string;
  credential: string;
}

export interface CreateCallParams {
  participants: {
    externalId: string;
    displayName: string;
    role: 'client' | 'expert';
  }[];
  billing: {
    payerId: string;
    ratePerMinute: number;
    currency?: string;
  };
  config?: {
    video?: boolean;
    audio?: boolean;
    recordingEnabled?: boolean;
    aiSummaryEnabled?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface RecordingInfo {
  enabled: boolean;
  status: 'pending' | 'recording' | 'processing' | 'completed' | 'failed';
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  fileUrl?: string;
  fileSize?: number;
  format?: 'webm' | 'mp4' | 'mp3';
}

export interface TranscriptionInfo {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  content?: string;
  segments?: TranscriptSegment[];
  language?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

export interface AISummaryInfo {
  enabled: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  content?: string;
  generatedAt?: string;
}

// ============================================
// Chats
// ============================================

export interface Chat {
  id: string;
  participants: ChatParticipant[];
  billing: {
    payerId: string;
    expertId: string;
    ratePerMinute: number;
    ratePerMessage: number;
    currency: string;
    freeTier: { messages: number; minutes: number };
  };
  usage: {
    messageCount: number;
    freeTierUsed: number;
    totalBilled: number;
  };
  aiSummary?: AISummaryInfo;
  status: 'active' | 'ended';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ChatParticipant {
  id: string;
  externalId: string;
  displayName: string;
  role: 'client' | 'expert';
  ratePerMinute?: number;
}

export interface CreateChatParams {
  participants: {
    externalId: string;
    displayName: string;
    role: 'client' | 'expert';
    ratePerMinute?: number;
  }[];
  billing: {
    payerId: string;
    ratePerMinute?: number;
    freeTier?: { messages: number };
  };
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderExternalId: string;
  content: string;
  contentType: 'text' | 'image' | 'file';
  billing?: {
    charged: boolean;
    amount: number;
  };
  createdAt: string;
}

// ============================================
// Summaries
// ============================================

export interface Summary {
  id: string;
  callId?: string;
  chatId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  content?: string;
  generatedAt?: string;
  billing?: {
    cost: number;
    billed: boolean;
  };
}

// ============================================
// Organization
// ============================================

export interface OrganizationInfo {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'payg' | 'starter' | 'growth' | 'enterprise';
  payments: {
    mode: 'self_managed' | 'managed';
    revenueShare?: { expert: number; platform: number };
  };
  earnings?: {
    lifetime: { gross: number; net: number };
    pendingPayout: number;
    callpayminFeesTotal: number;
  };
  status: 'active' | 'suspended';
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: string;
  priceAnnual?: string;
  limits: {
    callMinutes: string;
    chatMessages: string;
    aiSummaries: string;
    requestsPerMinute: number;
    recordingMinutes: string;
    transcriptionMinutes: string;
  };
  overageRates?: {
    callMinutes: string;
    chatMessages: string;
    aiSummaries: string;
    recordingMinutes: string;
    transcriptionMinutes: string;
  };
  features: string[];
  recommended: boolean;
  subscribable: boolean;
}

// ============================================
// Meeting Rooms
// ============================================

export interface Room {
  id: string;
  expertExternalId: string;
  expertId: string;
  name: string;
  description?: string;
  status: 'scheduled' | 'active' | 'closed';
  isActive: boolean;
  maxParticipants: number;
  participants: RoomParticipant[];
  activeBillingSessions: Record<string, RoomBillingSession>;
  expertRate: number;
  scheduledTime?: string;
  scheduledEndTime?: string;
  meetingLink?: string;
  settings?: Record<string, any>;
  stats?: {
    totalSessions: number;
    totalRevenue: number;
    totalEarnings: number;
    totalDuration: number;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface RoomParticipant {
  id: string;
  externalId: string;
  displayName?: string;
  role: 'host' | 'participant';
  joinedAt: string;
}

export interface RoomBillingSession {
  participantExternalId: string;
  participantName?: string;
  startTimestamp: string;
  lastBilledTimestamp: string;
  lastHeartbeat: string;
  expertRate: number;
  amountChargedSoFar: number;
  balanceAtStart: number;
  status: 'active' | 'ended';
}

export interface CreateRoomParams {
  expertExternalId: string;
  name: string;
  description?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  maxParticipants?: number;
  meetingBaseUrl?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface JoinRoomParams {
  participantExternalId: string;
  participantName?: string;
}

export interface JoinRoomResult {
  roomId: string;
  participantId: string;
  sfuProvider: string;
  sfuToken: string;
  mediasoupUrl?: string;
  balance: number;
  expertRate: number;
  affordableMinutes: number;
}

export interface RoomBillingIncrementResult {
  success: boolean;
  skipped?: boolean;
  minutesBilled: number;
  actualCharge: number;
  newBalance: number;
  totalCharged: number;
  shouldDisconnect?: boolean;
  insufficientBalance?: boolean;
  reason?: string;
}

// ============================================
// Work Sessions
// ============================================

export interface WorkSession {
  id: string;
  jobId: string;
  questerId: string;
  workerId: string;
  workerExternalId: string;
  questerExternalId: string;
  status: 'active' | 'completed' | 'paused' | 'disconnected';
  billingStatus: 'pending' | 'active' | 'completed';
  startTime: string;
  endTime?: string;
  duration?: number;
  ratePerMinute: number;
  amountBilledSoFar: number;
  lastBilledAt?: string;
  totalCost?: number;
  organizationId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CreateWorkSessionParams {
  jobId: string;
  questerId: string;
  workerId: string;
  ratePerMinute?: number;
  metadata?: Record<string, any>;
}

export interface WorkSessionIncrementResult {
  success: boolean;
  minutesBilled: number;
  actualCharge: number;
  newBalance: number;
  totalCharged: number;
  shouldEndSession: boolean;
  insufficientBalance: boolean;
}

// ============================================
// Call Billing
// ============================================

export interface CallBillingIncrementResult {
  success: boolean;
  skipped?: boolean;
  minutesBilled: number;
  actualCharge: number;
  newBalance: number;
  totalCharged: number;
  shouldEndCall: boolean;
  insufficientBalance: boolean;
}

export interface CallHeartbeatResult {
  ok: boolean;
  shouldDisconnect?: boolean;
  balanceLocked?: boolean;
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    cursor?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// ============================================
// API Keys
// ============================================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: 'active' | 'revoked';
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

// ============================================
// Webhooks
// ============================================

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: 'success' | 'failed';
}

// ============================================
// WebRTC Credentials
// ============================================

export interface CallCredentials {
  roomId: string;
  signalingUrl: string;
  turnServers: Array<{
    url: string;
    urls?: string[];
    username: string;
    credential: string;
  }>;
  expiresAt: string;
}
