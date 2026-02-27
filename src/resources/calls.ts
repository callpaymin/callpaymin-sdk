/**
 * Calls Resource
 * Manage WebRTC video/audio calls
 */

import type { CallPayMin } from '../client';
import type {
  Call,
  CreateCallParams,
  PaginatedResponse,
  RecordingInfo,
  TranscriptionInfo,
  CallCredentials,
  CallBillingIncrementResult,
  CallHeartbeatResult,
} from '../types';

export class Calls {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Create a new call session
   *
   * @example
   * ```typescript
   * const call = await client.calls.create({
   *   participants: [
   *     { externalId: 'user_123', displayName: 'John', role: 'client' },
   *     { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
   *   ],
   *   billing: { payerId: 'user_123', ratePerMinute: 5 },
   *   config: { video: true, audio: true },
   * });
   *
   * // Use call.webrtc for WebRTC connection
   * console.log(call.webrtc.roomId);
   * console.log(call.webrtc.turnServers);
   * ```
   */
  async create(params: CreateCallParams): Promise<Call> {
    return this.client.request<Call>('POST', '/calls', params);
  }

  /**
   * List calls with optional filters
   *
   * @example
   * ```typescript
   * // List active calls
   * const { data: calls } = await client.calls.list({ status: 'active' });
   *
   * // Paginate through all calls
   * let cursor: string | undefined;
   * do {
   *   const result = await client.calls.list({ cursor, limit: 50 });
   *   console.log(result.data);
   *   cursor = result.pagination.hasMore ? result.pagination.cursor : undefined;
   * } while (cursor);
   * ```
   */
  async list(options?: {
    status?: 'pending' | 'active' | 'ended';
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Call>> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Call>>(
      'GET',
      `/calls${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get call details by ID
   */
  async get(callId: string): Promise<Call> {
    return this.client.request<Call>('GET', `/calls/${callId}`);
  }

  /**
   * Start a call (begins billing)
   * Call this when both participants have joined
   */
  async start(callId: string): Promise<Call> {
    return this.client.request<Call>('POST', `/calls/${callId}/start`);
  }

  /**
   * End a call (finalizes billing)
   * Returns the final call with cost breakdown
   *
   * @example
   * ```typescript
   * const endedCall = await client.calls.end(callId);
   * console.log(`Call duration: ${endedCall.duration?.totalSeconds}s`);
   * console.log(`Total cost: $${endedCall.cost?.total}`);
   * ```
   */
  async end(callId: string): Promise<Call> {
    return this.client.request<Call>('POST', `/calls/${callId}/end`);
  }

  /**
   * Get TURN/STUN credentials for WebRTC connection
   *
   * @example
   * ```typescript
   * const credentials = await client.calls.getCredentials(callId);
   * // Use with RTCPeerConnection
   * const pc = new RTCPeerConnection({
   *   iceServers: credentials.turnServers.map(s => ({
   *     urls: s.urls || [s.url],
   *     username: s.username,
   *     credential: s.credential,
   *   }))
   * });
   * ```
   */
  async getCredentials(callId: string): Promise<CallCredentials> {
    return this.client.request<CallCredentials>('GET', `/calls/${callId}/credentials`);
  }

  /**
   * Get recording info for a call
   */
  async getRecording(callId: string): Promise<RecordingInfo> {
    return this.client.request<RecordingInfo>('GET', `/calls/${callId}/recording`);
  }

  /**
   * Upload a recording for a call
   * Use this if you're handling recording client-side
   */
  async uploadRecording(
    callId: string,
    params: {
      fileUrl: string;
      durationSeconds: number;
      fileSize?: number;
      format?: 'webm' | 'mp4' | 'mp3';
    }
  ): Promise<RecordingInfo> {
    return this.client.request<RecordingInfo>(
      'POST',
      `/calls/${callId}/recording`,
      params
    );
  }

  /**
   * Get transcription for a call
   */
  async getTranscription(callId: string): Promise<TranscriptionInfo> {
    return this.client.request<TranscriptionInfo>(
      'GET',
      `/calls/${callId}/transcription`
    );
  }

  /**
   * Generate transcription for a call
   * Requires a recording to be available
   *
   * @example
   * ```typescript
   * const transcription = await client.calls.generateTranscription(callId);
   * console.log(transcription.content);
   *
   * // With segments for speaker diarization
   * transcription.segments?.forEach(seg => {
   *   console.log(`[${seg.speaker}] ${seg.text}`);
   * });
   * ```
   */
  async generateTranscription(callId: string): Promise<TranscriptionInfo> {
    return this.client.request<TranscriptionInfo>(
      'POST',
      `/calls/${callId}/transcription`
    );
  }

  /**
   * Send heartbeat (30-second liveness ping)
   * Should be called every 30 seconds while call is active
   * Returns balance lock status so client can end call if needed
   */
  async heartbeat(callId: string, payerExternalId: string): Promise<CallHeartbeatResult> {
    return this.client.request<CallHeartbeatResult>(
      'POST',
      `/calls/${callId}/heartbeat`,
      { payerExternalId }
    );
  }

  /**
   * Process billing increment (~every 5 minutes)
   * Deducts from payer's balance incrementally during active call
   *
   * @example
   * ```typescript
   * const result = await client.calls.billingIncrement(callId);
   * if (result.shouldEndCall) {
   *   await client.calls.end(callId);
   * }
   * ```
   */
  async billingIncrement(callId: string): Promise<CallBillingIncrementResult> {
    return this.client.request<CallBillingIncrementResult>(
      'POST',
      `/calls/${callId}/billing-increment`
    );
  }
}
