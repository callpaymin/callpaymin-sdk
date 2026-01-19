/**
 * Chats Resource
 * Manage chat messaging sessions
 */

import type { CallPayMin } from '../client';
import type {
  Chat,
  CreateChatParams,
  ChatMessage,
  PaginatedResponse,
} from '../types';

export class Chats {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Create a new chat session
   *
   * @example
   * ```typescript
   * const chat = await client.chats.create({
   *   participants: [
   *     { externalId: 'user_123', displayName: 'John', role: 'client' },
   *     { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
   *   ],
   *   billing: {
   *     payerId: 'user_123',
   *     ratePerMinute: 2,
   *     freeTier: { messages: 10 },
   *   },
   * });
   * ```
   */
  async create(params: CreateChatParams): Promise<Chat> {
    return this.client.request<Chat>('POST', '/chats', params);
  }

  /**
   * List chats with optional filters
   */
  async list(options?: {
    status?: 'active' | 'ended';
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Chat>> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Chat>>(
      'GET',
      `/chats${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get chat details by ID
   */
  async get(chatId: string): Promise<Chat> {
    return this.client.request<Chat>('GET', `/chats/${chatId}`);
  }

  /**
   * Send a message in a chat
   *
   * @example
   * ```typescript
   * const message = await client.chats.sendMessage(chatId, {
   *   senderExternalId: 'user_123',
   *   content: 'Hello, I have a question about...',
   * });
   *
   * // Check if message was billed
   * if (message.billing?.charged) {
   *   console.log(`Charged: $${message.billing.amount}`);
   * }
   * ```
   */
  async sendMessage(
    chatId: string,
    params: {
      senderExternalId: string;
      content: string;
      contentType?: 'text' | 'image' | 'file';
    }
  ): Promise<ChatMessage> {
    return this.client.request<ChatMessage>(
      'POST',
      `/chats/${chatId}/messages`,
      params
    );
  }

  /**
   * Get messages in a chat
   */
  async getMessages(
    chatId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    }
  ): Promise<PaginatedResponse<ChatMessage>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    if (options?.after) params.set('after', options.after);

    const query = params.toString();
    return this.client.request<PaginatedResponse<ChatMessage>>(
      'GET',
      `/chats/${chatId}/messages${query ? `?${query}` : ''}`
    );
  }

  /**
   * End a chat session
   */
  async end(chatId: string): Promise<Chat> {
    return this.client.request<Chat>('POST', `/chats/${chatId}/end`);
  }
}
