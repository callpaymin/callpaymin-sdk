/**
 * Experts Resource
 * Manage experts/professionals and their earnings
 */

import type { CallPayMin } from '../client';
import type {
  Expert,
  CreateExpertParams,
  PaginatedResponse,
  Transaction,
} from '../types';

export class Experts {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Create a new expert
   *
   * @example
   * ```typescript
   * const expert = await client.experts.create({
   *   externalId: 'expert_456',
   *   displayName: 'Dr. Smith',
   *   email: 'smith@example.com',
   *   specialties: ['cardiology', 'internal-medicine'],
   *   ratePerMinute: 5,
   * });
   * ```
   */
  async create(params: CreateExpertParams): Promise<Expert> {
    return this.client.request<Expert>('POST', '/experts', params);
  }

  /**
   * List experts with optional filters
   */
  async list(options?: {
    status?: 'available' | 'busy' | 'offline';
    specialty?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Expert>> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.specialty) params.set('specialty', options.specialty);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Expert>>(
      'GET',
      `/experts${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get expert by external ID
   */
  async get(externalId: string): Promise<Expert> {
    return this.client.request<Expert>('GET', `/experts/${externalId}`);
  }

  /**
   * Update expert details
   */
  async update(
    externalId: string,
    params: Partial<Omit<CreateExpertParams, 'externalId'>>
  ): Promise<Expert> {
    return this.client.request<Expert>('PATCH', `/experts/${externalId}`, params);
  }

  /**
   * Set expert availability status
   *
   * @example
   * ```typescript
   * await client.experts.setStatus('expert_456', 'available');
   * ```
   */
  async setStatus(
    externalId: string,
    status: 'available' | 'busy' | 'offline'
  ): Promise<Expert> {
    return this.client.request<Expert>(
      'PATCH',
      `/experts/${externalId}/status`,
      { status }
    );
  }

  /**
   * Get expert's current earnings balance
   */
  async getEarnings(externalId: string): Promise<{
    balance: number;
    pendingPayout: number;
    totalEarned: number;
    currency: string;
  }> {
    return this.client.request<{
      balance: number;
      pendingPayout: number;
      totalEarned: number;
      currency: string;
    }>('GET', `/experts/${externalId}/earnings`);
  }

  /**
   * Get transaction history for an expert
   */
  async getTransactions(
    externalId: string,
    options?: {
      limit?: number;
      cursor?: string;
      type?: 'earning' | 'payout';
    }
  ): Promise<PaginatedResponse<Transaction>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.type) params.set('type', options.type);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Transaction>>(
      'GET',
      `/experts/${externalId}/transactions${query ? `?${query}` : ''}`
    );
  }

  /**
   * Request payout for expert earnings
   *
   * @example
   * ```typescript
   * const payout = await client.experts.requestPayout('expert_456', {
   *   amount: 100, // Optional, defaults to full balance
   * });
   * ```
   */
  async requestPayout(
    externalId: string,
    params?: {
      amount?: number;
    }
  ): Promise<{
    success: boolean;
    payoutId: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed';
  }> {
    return this.client.request<{
      success: boolean;
      payoutId: string;
      amount: number;
      status: 'pending' | 'processing' | 'completed';
    }>('POST', `/experts/${externalId}/payouts`, params || {});
  }

  /**
   * Get expert's call statistics
   */
  async getStats(
    externalId: string,
    options?: {
      period?: 'day' | 'week' | 'month' | 'year' | 'all';
    }
  ): Promise<{
    totalCalls: number;
    totalMinutes: number;
    totalEarnings: number;
    averageRating: number;
    completionRate: number;
  }> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);

    const query = params.toString();
    return this.client.request<{
      totalCalls: number;
      totalMinutes: number;
      totalEarnings: number;
      averageRating: number;
      completionRate: number;
    }>('GET', `/experts/${externalId}/stats${query ? `?${query}` : ''}`);
  }
}
