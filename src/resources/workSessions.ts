/**
 * Work Sessions Resource
 * Manage expert work sessions with incremental billing
 */

import type { CallPayMin } from '../client';
import type {
  WorkSession,
  CreateWorkSessionParams,
  WorkSessionIncrementResult,
  PaginatedResponse,
} from '../types';

export class WorkSessions {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Create and start a new work session
   *
   * @example
   * ```typescript
   * const session = await client.workSessions.create({
   *   jobId: 'job_789',
   *   questerId: 'user_123',
   *   workerId: 'expert_456',
   *   ratePerMinute: 0.50,
   * });
   * ```
   */
  async create(params: CreateWorkSessionParams): Promise<WorkSession> {
    return this.client.request<WorkSession>('POST', '/work-sessions', params);
  }

  /**
   * List work sessions with optional filters
   *
   * @example
   * ```typescript
   * const { data: sessions } = await client.workSessions.list({
   *   status: 'active',
   *   workerId: 'expert_456',
   * });
   * ```
   */
  async list(options?: {
    status?: 'active' | 'completed' | 'paused' | 'disconnected';
    workerId?: string;
    questerId?: string;
    jobId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<WorkSession>> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.workerId) params.set('workerId', options.workerId);
    if (options?.questerId) params.set('questerId', options.questerId);
    if (options?.jobId) params.set('jobId', options.jobId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<WorkSession>>(
      'GET',
      `/work-sessions${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get work session details
   *
   * @param sessionId - Work session ID
   * @param questerId - External ID of the quester (for access control)
   */
  async get(sessionId: string, questerId: string): Promise<WorkSession> {
    return this.client.request<WorkSession>(
      'GET',
      `/work-sessions/${sessionId}?questerId=${encodeURIComponent(questerId)}`
    );
  }

  /**
   * End a work session (finalizes billing)
   *
   * @example
   * ```typescript
   * const session = await client.workSessions.end(sessionId, questerId);
   * console.log(`Duration: ${session.duration} minutes`);
   * console.log(`Total cost: $${session.totalCost}`);
   * ```
   */
  async end(
    sessionId: string,
    questerId: string,
    options?: { endReason?: string }
  ): Promise<WorkSession> {
    return this.client.request<WorkSession>(
      'POST',
      `/work-sessions/${sessionId}/end?questerId=${encodeURIComponent(questerId)}`,
      options || {}
    );
  }

  /**
   * Handle expert disconnect (browser crash/close)
   * Called via sendBeacon - bills remaining unbilled time and ends session
   */
  async disconnect(sessionId: string, questerId: string): Promise<any> {
    return this.client.request<any>(
      'POST',
      `/work-sessions/${sessionId}/disconnect`,
      { questerId }
    );
  }

  /**
   * Process billing increment (~every 5 minutes)
   * Deducts from quester's balance incrementally
   *
   * @example
   * ```typescript
   * const result = await client.workSessions.processIncrement(sessionId, questerId);
   * if (result.shouldEndSession) {
   *   // End session - insufficient balance
   * }
   * ```
   */
  async processIncrement(
    sessionId: string,
    questerId: string,
    options?: { videoCallActive?: boolean }
  ): Promise<WorkSessionIncrementResult> {
    return this.client.request<WorkSessionIncrementResult>(
      'POST',
      `/work-sessions/${sessionId}/process-increment`,
      { questerId, ...options }
    );
  }
}
