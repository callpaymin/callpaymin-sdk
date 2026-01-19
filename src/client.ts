/**
 * CallPayMin API Client
 */

import { CallPayMinConfig, ApiError } from './types';
import { Calls } from './resources/calls';
import { Chats } from './resources/chats';
import { Users } from './resources/users';
import { Experts } from './resources/experts';
import { Summaries } from './resources/summaries';
import { Organization } from './resources/organization';

export class CallPayMin {
  private config: Required<CallPayMinConfig>;

  /** Call management */
  public calls: Calls;
  /** Chat management */
  public chats: Chats;
  /** User billing management */
  public users: Users;
  /** Expert management */
  public experts: Experts;
  /** AI summaries */
  public summaries: Summaries;
  /** Organization settings */
  public organization: Organization;

  constructor(config: CallPayMinConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.callpaymin.io/v1',
      timeout: config.timeout || 30000,
    };

    // Initialize resources
    this.calls = new Calls(this);
    this.chats = new Chats(this);
    this.users = new Users(this);
    this.experts = new Experts(this);
    this.summaries = new Summaries(this);
    this.organization = new Organization(this);
  }

  /**
   * Make an API request
   * @internal
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok) {
        const error = json as ApiError;
        throw new CallPayMinError(
          error.error?.message || 'API request failed',
          error.error?.code || 'UNKNOWN_ERROR',
          response.status,
          error.error?.details
        );
      }

      return json as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error instanceof CallPayMinError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new CallPayMinError('Request timeout', 'TIMEOUT', 408);
      }

      throw new CallPayMinError(
        error.message || 'Network error',
        'NETWORK_ERROR',
        0
      );
    }
  }
}

/**
 * CallPayMin API Error
 */
export class CallPayMinError extends Error {
  public code: string;
  public status: number;
  public details?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CallPayMinError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
