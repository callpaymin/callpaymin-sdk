/**
 * CallPayMin SDK
 * Official TypeScript/JavaScript SDK for CallPayMin API
 *
 * @example
 * ```typescript
 * import { CallPayMin } from '@callpaymin/sdk';
 *
 * const client = new CallPayMin({ apiKey: 'cpm_live_xxx' });
 *
 * // Create a call
 * const call = await client.calls.create({
 *   participants: [
 *     { externalId: 'user_123', displayName: 'John', role: 'client' },
 *     { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
 *   ],
 *   billing: { payerId: 'user_123', ratePerMinute: 5 },
 * });
 * ```
 */

export { CallPayMin } from './client';
export { CallPayMinWebRTC } from './webrtc/CallClient';

// Resource classes
export { Calls } from './resources/calls';
export { Chats } from './resources/chats';
export { Users } from './resources/users';
export { Experts } from './resources/experts';
export { Summaries } from './resources/summaries';
export { Organization } from './resources/organization';
export { Rooms } from './resources/rooms';
export { WorkSessions } from './resources/workSessions';

// Types
export * from './types';
