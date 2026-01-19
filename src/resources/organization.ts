/**
 * Organization Resource
 * Manage organization settings, API keys, and webhooks
 */

import type { CallPayMin } from '../client';
import type { ApiKey, WebhookConfig } from '../types';

export class Organization {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Get organization details
   */
  async get(): Promise<{
    id: string;
    name: string;
    slug: string;
    paymentMode: 'self_managed' | 'managed';
    revenueShare: {
      expertPercentage: number;
      platformPercentage: number;
    };
    createdAt: string;
  }> {
    return this.client.request<{
      id: string;
      name: string;
      slug: string;
      paymentMode: 'self_managed' | 'managed';
      revenueShare: {
        expertPercentage: number;
        platformPercentage: number;
      };
      createdAt: string;
    }>('GET', '/organization');
  }

  /**
   * Update organization settings
   */
  async update(params: {
    name?: string;
    revenueShare?: {
      expertPercentage: number;
      platformPercentage: number;
    };
  }): Promise<{ success: boolean }> {
    return this.client.request<{ success: boolean }>(
      'PATCH',
      '/organization',
      params
    );
  }

  // ============================================
  // Usage & Billing
  // ============================================

  /**
   * Get current usage and quota information
   *
   * @example
   * ```typescript
   * const usage = await client.organization.getUsage();
   * console.log(`Call minutes used: ${usage.callMinutes.used}/${usage.callMinutes.limit}`);
   * ```
   */
  async getUsage(): Promise<{
    period: { start: string; end: string };
    callMinutes: { used: number; limit: number };
    chatMessages: { used: number; limit: number };
    aiSummaries: { used: number; limit: number };
    apiRequests: { used: number; limit: number };
  }> {
    return this.client.request<{
      period: { start: string; end: string };
      callMinutes: { used: number; limit: number };
      chatMessages: { used: number; limit: number };
      aiSummaries: { used: number; limit: number };
      apiRequests: { used: number; limit: number };
    }>('GET', '/billing/usage');
  }

  /**
   * Get organization earnings (from platform fees)
   */
  async getEarnings(options?: {
    period?: 'day' | 'week' | 'month' | 'year';
  }): Promise<{
    totalEarnings: number;
    pendingPayout: number;
    lastPayout: { amount: number; date: string } | null;
    breakdown: {
      callFees: number;
      chatFees: number;
      summaryFees: number;
    };
  }> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);

    const query = params.toString();
    return this.client.request<{
      totalEarnings: number;
      pendingPayout: number;
      lastPayout: { amount: number; date: string } | null;
      breakdown: {
        callFees: number;
        chatFees: number;
        summaryFees: number;
      };
    }>('GET', `/billing/earnings${query ? `?${query}` : ''}`);
  }

  // ============================================
  // API Keys
  // ============================================

  /**
   * List API keys
   */
  async listApiKeys(): Promise<{
    data: ApiKey[];
    count: number;
  }> {
    return this.client.request<{ data: ApiKey[]; count: number }>(
      'GET',
      '/organization/api-keys'
    );
  }

  /**
   * Create a new API key
   *
   * @example
   * ```typescript
   * const { apiKey, key } = await client.organization.createApiKey({
   *   name: 'Production Server',
   *   scopes: ['calls:write', 'users:read', 'summaries:write'],
   * });
   *
   * // IMPORTANT: Store the key securely - it won't be shown again!
   * console.log('New API Key:', key);
   * ```
   */
  async createApiKey(params: {
    name: string;
    scopes: string[];
    expiresAt?: string;
  }): Promise<{
    apiKey: ApiKey;
    key: string; // Only returned once at creation
  }> {
    return this.client.request<{ apiKey: ApiKey; key: string }>(
      'POST',
      '/organization/api-keys',
      params
    );
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
    return this.client.request<{ success: boolean }>(
      'DELETE',
      `/organization/api-keys/${keyId}`
    );
  }

  // ============================================
  // Webhooks
  // ============================================

  /**
   * Get webhook configuration
   */
  async getWebhooks(): Promise<WebhookConfig> {
    return this.client.request<WebhookConfig>('GET', '/organization/webhooks');
  }

  /**
   * Configure webhooks
   *
   * @example
   * ```typescript
   * await client.organization.configureWebhooks({
   *   url: 'https://yourapp.com/webhooks/callpaymin',
   *   events: ['call.started', 'call.ended', 'summary.completed'],
   *   secret: 'whsec_your_signing_secret',
   * });
   * ```
   */
  async configureWebhooks(config: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<WebhookConfig> {
    return this.client.request<WebhookConfig>(
      'PUT',
      '/organization/webhooks',
      config
    );
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(): Promise<{
    success: boolean;
    statusCode: number;
    responseTime: number;
  }> {
    return this.client.request<{
      success: boolean;
      statusCode: number;
      responseTime: number;
    }>('POST', '/organization/webhooks/test');
  }

  /**
   * List available webhook event types
   */
  async listWebhookEvents(): Promise<{
    events: Array<{
      name: string;
      description: string;
      payload: Record<string, unknown>;
    }>;
  }> {
    return this.client.request<{
      events: Array<{
        name: string;
        description: string;
        payload: Record<string, unknown>;
      }>;
    }>('GET', '/organization/webhooks/events');
  }
}
