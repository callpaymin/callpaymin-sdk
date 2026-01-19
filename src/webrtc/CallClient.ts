/**
 * CallPayMin WebRTC Client
 * Handles WebRTC video/audio calls with TURN server support
 *
 * Works in browsers and React Native (with react-native-webrtc)
 */

import type { CallPayMin } from '../client';
import type { Call, CallCredentials } from '../types';

export interface CallClientConfig {
  /** CallPayMin SDK client instance */
  client: CallPayMin;
  /** Called when local stream is ready */
  onLocalStream?: (stream: MediaStream) => void;
  /** Called when remote stream is received */
  onRemoteStream?: (stream: MediaStream) => void;
  /** Called when call state changes */
  onStateChange?: (state: CallState) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when call ends with final billing info */
  onCallEnded?: (call: Call) => void;
}

export type CallState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export interface CallOptions {
  /** Enable video (default: true) */
  video?: boolean;
  /** Enable audio (default: true) */
  audio?: boolean;
  /** Video constraints */
  videoConstraints?: MediaTrackConstraints;
  /** Audio constraints */
  audioConstraints?: MediaTrackConstraints;
}

/**
 * WebRTC Call Client
 *
 * @example
 * ```typescript
 * import { CallPayMin, CallPayMinWebRTC } from '@callpaymin/sdk';
 *
 * const client = new CallPayMin({ apiKey: 'cpm_live_xxx' });
 *
 * const callClient = new CallPayMinWebRTC({
 *   client,
 *   onLocalStream: (stream) => {
 *     localVideo.srcObject = stream;
 *   },
 *   onRemoteStream: (stream) => {
 *     remoteVideo.srcObject = stream;
 *   },
 *   onStateChange: (state) => {
 *     console.log('Call state:', state);
 *   },
 *   onCallEnded: (call) => {
 *     console.log('Call ended. Duration:', call.duration, 'Cost:', call.billing?.totalCost);
 *   },
 * });
 *
 * // Start a call
 * const call = await callClient.startCall({
 *   participants: [
 *     { externalId: 'user_123', displayName: 'John', role: 'client' },
 *     { externalId: 'expert_456', displayName: 'Dr. Smith', role: 'expert' },
 *   ],
 *   billing: {
 *     payerId: 'user_123',
 *     ratePerMinute: 5,
 *   },
 * });
 *
 * // Later, end the call
 * await callClient.endCall();
 * ```
 */
export class CallPayMinWebRTC {
  private config: CallClientConfig;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCall: Call | null = null;
  private state: CallState = 'idle';
  private credentials: CallCredentials | null = null;

  constructor(config: CallClientConfig) {
    this.config = config;
  }

  /**
   * Get current call state
   */
  getState(): CallState {
    return this.state;
  }

  /**
   * Get current call info
   */
  getCurrentCall(): Call | null {
    return this.currentCall;
  }

  /**
   * Start a new call
   */
  async startCall(
    params: {
      participants: Array<{
        externalId: string;
        displayName: string;
        role: 'client' | 'expert';
      }>;
      billing: {
        payerId: string;
        ratePerMinute: number;
        freeTier?: { minutes?: number };
      };
      metadata?: Record<string, unknown>;
    },
    options: CallOptions = {}
  ): Promise<Call> {
    try {
      this.setState('connecting');

      // 1. Create call via API
      const call = await this.config.client.calls.create(params);
      this.currentCall = call;

      // 2. Get TURN credentials
      this.credentials = await this.config.client.calls.getCredentials(call.id);

      // 3. Get local media stream
      await this.setupLocalMedia(options);

      // 4. Create peer connection with TURN servers
      await this.createPeerConnection();

      // 5. Start the call via API
      await this.config.client.calls.start(call.id);

      this.setState('connected');
      return call;
    } catch (error) {
      this.setState('failed');
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Join an existing call (for the other participant)
   */
  async joinCall(callId: string, options: CallOptions = {}): Promise<Call> {
    try {
      this.setState('connecting');

      // 1. Get call details
      const call = await this.config.client.calls.get(callId);
      this.currentCall = call;

      // 2. Get TURN credentials
      this.credentials = await this.config.client.calls.getCredentials(callId);

      // 3. Get local media stream
      await this.setupLocalMedia(options);

      // 4. Create peer connection with TURN servers
      await this.createPeerConnection();

      this.setState('connected');
      return call;
    } catch (error) {
      this.setState('failed');
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * End the current call
   */
  async endCall(): Promise<Call | null> {
    if (!this.currentCall) {
      return null;
    }

    try {
      // End via API
      const endedCall = await this.config.client.calls.end(this.currentCall.id);
      this.currentCall = endedCall;

      // Cleanup
      this.cleanup();

      this.setState('ended');
      this.config.onCallEnded?.(endedCall);

      return endedCall;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Toggle local video on/off
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Toggle local audio on/off (mute/unmute)
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Switch camera (mobile)
   */
  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack && 'getCapabilities' in videoTrack) {
      // @ts-ignore - facingMode capability
      const capabilities = videoTrack.getCapabilities?.();
      if (capabilities?.facingMode) {
        const currentFacing = videoTrack.getSettings().facingMode;
        const newFacing = currentFacing === 'user' ? 'environment' : 'user';
        await videoTrack.applyConstraints({ facingMode: newFacing });
      }
    }
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote media stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // ============================================
  // Private Methods
  // ============================================

  private setState(state: CallState): void {
    this.state = state;
    this.config.onStateChange?.(state);
  }

  private handleError(error: Error): void {
    console.error('[CallPayMinWebRTC]', error);
    this.config.onError?.(error);
  }

  private async setupLocalMedia(options: CallOptions): Promise<void> {
    const constraints: MediaStreamConstraints = {
      video: options.video !== false ? (options.videoConstraints || true) : false,
      audio: options.audio !== false ? (options.audioConstraints || true) : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.config.onLocalStream?.(this.localStream);
    } catch (error) {
      throw new Error(`Failed to access media devices: ${(error as Error).message}`);
    }
  }

  private async createPeerConnection(): Promise<void> {
    if (!this.credentials) {
      throw new Error('No TURN credentials available');
    }

    const iceServers: RTCIceServer[] = [
      // STUN servers (free, for direct connections)
      { urls: 'stun:stun.l.google.com:19302' },
      // TURN servers (from CallPayMin)
      {
        urls: this.credentials.turnServers.map((s: { url: string }) => s.url),
        username: this.credentials.turnServers[0]?.username,
        credential: this.credentials.turnServers[0]?.credential,
      },
    ];

    this.peerConnection = new RTCPeerConnection({ iceServers });

    // Add local tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming remote tracks
    this.peerConnection.ontrack = (event) => {
      if (event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.config.onRemoteStream?.(this.remoteStream);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'disconnected' || state === 'failed') {
        this.setState('reconnecting');
      } else if (state === 'connected') {
        this.setState('connected');
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'disconnected') {
        this.setState('reconnecting');
      } else if (state === 'failed') {
        this.setState('failed');
      }
    };
  }

  private cleanup(): void {
    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.credentials = null;
  }
}
