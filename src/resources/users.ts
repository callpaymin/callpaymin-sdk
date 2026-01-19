/**
 * Users Resource
 * Manage end-users and their billing
 */

import type { CallPayMin } from '../client';
import type {
  User,
  CreateUserParams,
  PaginatedResponse,
  Transaction,
  PaymentMethod,
} from '../types';

export class Users {
  private client: CallPayMin;

  constructor(client: CallPayMin) {
    this.client = client;
  }

  /**
   * Create a new user
   *
   * @example
   * ```typescript
   * const user = await client.users.create({
   *   externalId: 'user_123',
   *   displayName: 'John Doe',
   *   email: 'john@example.com',
   *   metadata: { plan: 'premium' },
   * });
   * ```
   */
  async create(params: CreateUserParams): Promise<User> {
    return this.client.request<User>('POST', '/users', params);
  }

  /**
   * List users with optional filters
   */
  async list(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.client.request<PaginatedResponse<User>>(
      'GET',
      `/users${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get user by external ID
   */
  async get(externalId: string): Promise<User> {
    return this.client.request<User>('GET', `/users/${externalId}`);
  }

  /**
   * Update user details
   */
  async update(
    externalId: string,
    params: Partial<Omit<CreateUserParams, 'externalId'>>
  ): Promise<User> {
    return this.client.request<User>('PATCH', `/users/${externalId}`, params);
  }

  /**
   * Get user's current balance
   */
  async getBalance(externalId: string): Promise<{ balance: number; currency: string }> {
    return this.client.request<{ balance: number; currency: string }>(
      'GET',
      `/users/${externalId}/balance`
    );
  }

  /**
   * Add funds to user's balance (self-managed mode)
   *
   * @example
   * ```typescript
   * const result = await client.users.addFunds('user_123', {
   *   amount: 50,
   *   description: 'Initial deposit',
   * });
   * ```
   */
  async addFunds(
    externalId: string,
    params: {
      amount: number;
      description?: string;
    }
  ): Promise<{ balance: number; transaction: Transaction }> {
    return this.client.request<{ balance: number; transaction: Transaction }>(
      'POST',
      `/users/${externalId}/add-funds`,
      params
    );
  }

  /**
   * Charge user's saved card (managed mode only)
   *
   * @example
   * ```typescript
   * const result = await client.users.charge('user_123', {
   *   amount: 25,
   *   description: 'Consultation fee',
   * });
   * ```
   */
  async charge(
    externalId: string,
    params: {
      amount: number;
      paymentMethodId?: string;
      description?: string;
      passStripeFeeToUser?: boolean;
    }
  ): Promise<{ success: boolean; transaction: Transaction }> {
    return this.client.request<{ success: boolean; transaction: Transaction }>(
      'POST',
      `/billing/users/${externalId}/charge`,
      params
    );
  }

  /**
   * Get transaction history for a user
   */
  async getTransactions(
    externalId: string,
    options?: {
      limit?: number;
      cursor?: string;
      type?: 'credit' | 'debit';
    }
  ): Promise<PaginatedResponse<Transaction>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.type) params.set('type', options.type);

    const query = params.toString();
    return this.client.request<PaginatedResponse<Transaction>>(
      'GET',
      `/users/${externalId}/transactions${query ? `?${query}` : ''}`
    );
  }

  // ============================================
  // Payment Methods (Managed Mode)
  // ============================================

  /**
   * Create a Stripe SetupIntent for collecting payment details
   * Use this with Stripe.js on your frontend to securely collect card info
   *
   * @example
   * ```typescript
   * // Backend: Get the client secret
   * const { clientSecret } = await client.users.createSetupIntent('user_123');
   *
   * // Frontend: Use with Stripe.js
   * const stripe = Stripe('pk_...');
   * const { error } = await stripe.confirmSetup({
   *   elements,
   *   clientSecret,
   *   confirmParams: { return_url: 'https://yourapp.com/payment-complete' },
   * });
   * ```
   */
  async createSetupIntent(externalId: string): Promise<{ clientSecret: string }> {
    return this.client.request<{ clientSecret: string }>(
      'POST',
      `/billing/users/${externalId}/setup-intent`
    );
  }

  /**
   * List user's saved payment methods
   */
  async getPaymentMethods(externalId: string): Promise<{ data: PaymentMethod[]; count: number }> {
    return this.client.request<{ data: PaymentMethod[]; count: number }>(
      'GET',
      `/billing/users/${externalId}/payment-methods`
    );
  }

  /**
   * Save a payment method after SetupIntent confirmation
   *
   * @example
   * ```typescript
   * // After Stripe.js confirms the SetupIntent, save the payment method
   * await client.users.savePaymentMethod('user_123', {
   *   paymentMethodId: 'pm_...',
   *   setAsDefault: true,
   * });
   * ```
   */
  async savePaymentMethod(
    externalId: string,
    params: {
      paymentMethodId: string;
      setAsDefault?: boolean;
    }
  ): Promise<{ success: boolean; paymentMethod: PaymentMethod }> {
    return this.client.request<{ success: boolean; paymentMethod: PaymentMethod }>(
      'POST',
      `/billing/users/${externalId}/payment-methods`,
      params
    );
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(
    externalId: string,
    paymentMethodId: string
  ): Promise<{ success: boolean }> {
    return this.client.request<{ success: boolean }>(
      'DELETE',
      `/billing/users/${externalId}/payment-methods/${paymentMethodId}`
    );
  }
}
