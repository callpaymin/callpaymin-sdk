/**
 * Rooms Resource
 * Manage meeting rooms with per-participant billing
 */

import type { CallPayMin } from '../client';
import type {
  Room,
  CreateRoomParams,
  JoinRoomParams,
  JoinRoomResult,
  RoomBillingIncrementResult,
  PaginatedResponse,
} from '../types';

export class Rooms {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Create a new meeting room
   *
   * @example
   * ```typescript
   * const room = await client.rooms.create({
   *   expertExternalId: 'expert_456',
   *   name: 'Consultation Room',
   *   maxParticipants: 5,
   * });
   * ```
   */
  async create(params: CreateRoomParams): Promise<Room> {
    return this.client.request<Room>('POST', '/rooms', params);
  }

  /**
   * List rooms with optional filters
   *
   * @example
   * ```typescript
   * const { data: rooms } = await client.rooms.list({ status: 'active' });
   * ```
   */
  async list(options?: {
    status?: 'scheduled' | 'active' | 'closed';
    expertExternalId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Room>> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.expertExternalId) params.set('expertExternalId', options.expertExternalId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Room>>(
      'GET',
      `/rooms${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get room details by ID
   */
  async get(roomId: string): Promise<Room> {
    return this.client.request<Room>('GET', `/rooms/${roomId}`);
  }

  /**
   * Delete a scheduled room (only works for rooms in 'scheduled' status)
   */
  async delete(roomId: string, expertExternalId: string): Promise<{ deleted: boolean }> {
    return this.client.request<{ deleted: boolean }>(
      'DELETE',
      `/rooms/${roomId}`,
      { expertExternalId }
    );
  }

  /**
   * Start a scheduled room (transitions from 'scheduled' to 'active')
   */
  async start(roomId: string, expertExternalId: string): Promise<Room> {
    return this.client.request<Room>(
      'POST',
      `/rooms/${roomId}/start`,
      { expertExternalId }
    );
  }

  /**
   * Join a room as a participant
   * Returns SFU credentials for media connection
   *
   * @example
   * ```typescript
   * const result = await client.rooms.join(roomId, {
   *   participantExternalId: 'user_123',
   *   participantName: 'John Doe',
   * });
   *
   * console.log(result.sfuToken);
   * console.log(result.affordableMinutes);
   * ```
   */
  async join(roomId: string, params: JoinRoomParams): Promise<JoinRoomResult> {
    return this.client.request<JoinRoomResult>(
      'POST',
      `/rooms/${roomId}/join`,
      params
    );
  }

  /**
   * Leave a room (finalizes billing for the participant)
   */
  async leave(
    roomId: string,
    params: { participantExternalId: string; reason?: string }
  ): Promise<any> {
    return this.client.request<any>(
      'POST',
      `/rooms/${roomId}/leave`,
      params
    );
  }

  /**
   * Close a room (expert only, finalizes billing for all participants)
   */
  async close(roomId: string, expertExternalId: string): Promise<any> {
    return this.client.request<any>(
      'POST',
      `/rooms/${roomId}/close`,
      { expertExternalId }
    );
  }

  /**
   * Send heartbeat (30-second liveness ping)
   * Should be called every 30 seconds while participant is in the room
   */
  async heartbeat(
    roomId: string,
    participantExternalId: string
  ): Promise<{ ok: boolean }> {
    return this.client.request<{ ok: boolean }>(
      'POST',
      `/rooms/${roomId}/heartbeat`,
      { participantExternalId }
    );
  }

  /**
   * Process billing increment (~every 5 minutes)
   * Deducts from participant's balance incrementally
   *
   * @example
   * ```typescript
   * const result = await client.rooms.billingIncrement(roomId, 'user_123');
   * if (result.shouldDisconnect) {
   *   // Remove participant - insufficient balance
   * }
   * ```
   */
  async billingIncrement(
    roomId: string,
    participantExternalId: string
  ): Promise<RoomBillingIncrementResult> {
    return this.client.request<RoomBillingIncrementResult>(
      'POST',
      `/rooms/${roomId}/billing-increment`,
      { participantExternalId }
    );
  }

  /**
   * Remove a participant from the room (expert only)
   * Finalizes billing for the removed participant
   */
  async removeParticipant(
    roomId: string,
    expertExternalId: string,
    participantExternalId: string
  ): Promise<any> {
    return this.client.request<any>(
      'POST',
      `/rooms/${roomId}/remove-participant`,
      { expertExternalId, participantExternalId }
    );
  }
}
