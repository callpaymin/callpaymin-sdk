/**
 * Summaries Resource
 * AI-powered call and chat summarization
 */

import type { CallPayMin } from '../client';
import type { Summary, PaginatedResponse } from '../types';

export class Summaries {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Generate an AI summary for a call
   *
   * @example
   * ```typescript
   * const summary = await client.summaries.generateForCall('call_abc123', {
   *   type: 'detailed',
   *   includeActionItems: true,
   * });
   *
   * console.log(summary.content);
   * console.log(summary.actionItems);
   * ```
   */
  async generateForCall(
    callId: string,
    options?: {
      type?: 'brief' | 'detailed' | 'medical' | 'legal';
      includeActionItems?: boolean;
      includeKeyPoints?: boolean;
      language?: string;
    }
  ): Promise<Summary> {
    return this.client.request<Summary>(
      'POST',
      `/calls/${callId}/summary`,
      options || {}
    );
  }

  /**
   * Get an existing summary for a call
   */
  async getForCall(callId: string): Promise<Summary> {
    return this.client.request<Summary>('GET', `/calls/${callId}/summary`);
  }

  /**
   * Generate an AI summary for a chat session
   *
   * @example
   * ```typescript
   * const summary = await client.summaries.generateForChat('chat_xyz789', {
   *   type: 'brief',
   * });
   * ```
   */
  async generateForChat(
    chatId: string,
    options?: {
      type?: 'brief' | 'detailed' | 'medical' | 'legal';
      includeActionItems?: boolean;
      includeKeyPoints?: boolean;
      language?: string;
    }
  ): Promise<Summary> {
    return this.client.request<Summary>(
      'POST',
      `/chats/${chatId}/summary`,
      options || {}
    );
  }

  /**
   * Get an existing summary for a chat
   */
  async getForChat(chatId: string): Promise<Summary> {
    return this.client.request<Summary>('GET', `/chats/${chatId}/summary`);
  }

  /**
   * List all summaries with optional filters
   */
  async list(options?: {
    type?: 'call' | 'chat';
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Summary>> {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Summary>>(
      'GET',
      `/summaries${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a summary by ID
   */
  async get(summaryId: string): Promise<Summary> {
    return this.client.request<Summary>('GET', `/summaries/${summaryId}`);
  }

  /**
   * Regenerate a summary with different options
   *
   * @example
   * ```typescript
   * // Regenerate with more detail
   * const newSummary = await client.summaries.regenerate('sum_123', {
   *   type: 'detailed',
   *   includeActionItems: true,
   * });
   * ```
   */
  async regenerate(
    summaryId: string,
    options?: {
      type?: 'brief' | 'detailed' | 'medical' | 'legal';
      includeActionItems?: boolean;
      includeKeyPoints?: boolean;
      language?: string;
    }
  ): Promise<Summary> {
    return this.client.request<Summary>(
      'POST',
      `/summaries/${summaryId}/regenerate`,
      options || {}
    );
  }

  /**
   * Get summary usage and billing for the organization
   */
  async getUsage(options?: {
    period?: 'day' | 'week' | 'month' | 'year';
  }): Promise<{
    totalSummaries: number;
    totalTokens: number;
    totalCost: number;
    byModel: Record<string, { count: number; tokens: number; cost: number }>;
  }> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);

    const query = params.toString();
    return this.client.request<{
      totalSummaries: number;
      totalTokens: number;
      totalCost: number;
      byModel: Record<string, { count: number; tokens: number; cost: number }>;
    }>('GET', `/summaries/usage${query ? `?${query}` : ''}`);
  }
}
