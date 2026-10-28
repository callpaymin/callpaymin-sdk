// One listener-side connection. The original call track is borrowed, never stopped.
export const AUDIO_TRANSLATION_LANGUAGES = ['en','es','pt','fr','de','it','ja','ko','zh','hi','id','vi','ru'];

// Display a short current segment rather than an ever-growing call transcript.
// Transcript deltas have no word playback timestamps; boundaries are visual only.
export class LiveTranslationCaption {
  private text = '';
  private lastDeltaAt = 0;

  push(delta: string, now = Date.now()): string {
    if (!delta.trim()) { if (this.text) this.text += delta; return this.text; }
    if (now - this.lastDeltaAt > 1800 || /[.!?。！？।][”’"')\]]*\s*$/.test(this.text)) {
      this.text = '';
    }
    this.lastDeltaAt = now;
    this.text = (this.text + delta).trimStart();
    const chars = Array.from(this.text);
    if (chars.length > 220) {
      // Keep the latest readable segment, including languages without spaces.
      const tail = chars.slice(-180).join('');
      const space = tail.indexOf(' ');
      this.text = space >= 0 && space < 40 ? tail.slice(space + 1) : tail;
    }
    return this.text;
  }
}

export class RealtimeAudioTranslation {
  private peer: any = null;
  private controller: AbortController | null = null;
  private generation = 0;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private outputTracks: any[] = [];
  private cleanupPlayback: (() => void) | null = null;

  constructor(private dependencies: {
    PeerConnection: any;
    fetch?: typeof fetch;
    play: (stream: any, track: any) => Promise<(() => void) | void>;
  }) {}

  async start(options: {
    stream: any;
    microphoneStream?: any;
    getSecret: () => Promise<{clientSecret: string; provider?: string; sessionUrl?: string; callId?: string; tenant?: string}>;
    onCaption: (text: string) => void;
    onReady: () => void;
    onError: (error: Error) => void;
  }) {
    this.stop();
    const generation = this.generation;
    const active = () => this.generation === generation;
    const fail = (error: Error) => {
      if (!active()) return;
      this.stop();
      options.onError(error);
    };
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.watchdog = setTimeout(() => fail(new Error('Audio translation connection timed out. Your original call is still connected.')), 20000);
    try {
      const secret = await options.getSecret();
      if (!active()) return;
      if (!secret.clientSecret) throw new Error('Translation credentials are unavailable.');
      const deepgram = secret.provider === 'deepgram';
      let iceServers: any[] = [];
      if (deepgram) {
        if (!secret.sessionUrl) throw new Error('Deepgram streaming gateway is unavailable.');
        if (this.watchdog) clearTimeout(this.watchdog);
        this.watchdog = setTimeout(() => fail(new Error('Audio translation connection timed out. Your original call is still connected.')), 35000);
        const iceResponse = await (this.dependencies.fetch || fetch)(new URL('/ice', secret.sessionUrl).href, {
          method: 'POST', signal,
          headers: {Authorization: `Bearer ${secret.clientSecret}`, 'Content-Type': 'application/json'},
          body: JSON.stringify({callId: secret.callId, tenant: secret.tenant}),
        });
        if (!iceResponse.ok) throw new Error('Translation relay unavailable. Deploy the updated gateway and check TURN configuration.');
        const ice = await iceResponse.json();
        if (!Array.isArray(ice.iceServers) || !ice.iceServers.length) throw new Error('The translation gateway has no TURN servers configured.');
        iceServers = ice.iceServers;
        if (!active()) return;
      }
      const inputStream = deepgram ? options.microphoneStream : options.stream;
      const inputTrack = inputStream?.getAudioTracks?.().find((t: any) => t.readyState !== 'ended');
      if (!inputTrack) throw new Error('Your microphone is not ready for audio translation.');
      const peer = new this.dependencies.PeerConnection({iceServers});
      this.peer = peer;
      peer.addTrack(inputTrack, inputStream);
      const caption = new LiveTranslationCaption();
      let providerReady = secret.provider !== 'deepgram';
      let announcedReady = false;
      const notifyReady = () => {
        if (!active() || announcedReady || !providerReady || peer.connectionState !== 'connected') return;
        announcedReady = true;
        if (this.watchdog) clearTimeout(this.watchdog);
        this.watchdog = null;
        options.onReady();
      };
      const channel = peer.createDataChannel('oai-events');
      channel.onmessage = (event: any) => {
        if (!active()) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'translation.ready') { providerReady = true; notifyReady(); }
          if (message.type === 'translation.caption') options.onCaption(String(message.text || ''));
          if (message.type === 'error') fail(new Error(message.error?.message || 'Audio translation failed.'));
          if (message.type === 'session.output_transcript.delta') {
            options.onCaption(caption.push(String(message.delta || '')));
          }
        } catch { /* Ignore non-JSON transport messages. */ }
      };
      peer.ontrack = async (event: any) => {
        if (!active() || event.track?.kind !== 'audio') return;
        this.outputTracks.push(event.track);
        try {
          const cleanup = await this.dependencies.play(event.streams?.[0], event.track);
          if (!active()) { if (typeof cleanup === 'function') cleanup(); return; }
          this.cleanupPlayback = cleanup || null;
        } catch { fail(new Error('Translated audio could not play. Tap Translate to try again.')); }
      };
      peer.onconnectionstatechange = () => {
        if (!active()) return;
        if (peer.connectionState === 'connected') {
          if (announcedReady && this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
          notifyReady();
        } else if (['failed','closed'].includes(peer.connectionState)) {
          fail(new Error('Audio translation disconnected. Your original call is still connected.'));
        } else if (peer.connectionState === 'disconnected' && !this.watchdog) {
          this.watchdog = setTimeout(() => fail(new Error('Audio translation lost its connection.')), 10000);
        }
      };
      const offer = await peer.createOffer();
      if (!active()) return;
      await peer.setLocalDescription(offer);
      if (!active()) return;
      if (deepgram) {
        // Signalling is not trickled: send candidates collected in localDescription.
        await new Promise<void>(resolve => {
          if (peer.iceGatheringState === 'complete') return resolve();
          let settle: ReturnType<typeof setTimeout> | undefined;
          const done = () => { clearTimeout(timer); clearTimeout(settle); peer.onicecandidate = null; peer.onicegatheringstatechange = null; signal.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, 5000);
          peer.onicegatheringstatechange = () => { if (peer.iceGatheringState === 'complete') done(); };
          peer.onicecandidate = (event: any) => { if (!settle && / typ relay /.test(event.candidate?.candidate || '')) settle = setTimeout(done, 300); };
          signal.addEventListener('abort', done, {once: true});
        });
        if (!active()) return;
      }
      if (deepgram && !secret.sessionUrl) throw new Error('Deepgram streaming gateway is unavailable.');
      const response = await (this.dependencies.fetch || fetch)(deepgram ? secret.sessionUrl! : 'https://api.openai.com/v1/realtime/translations/calls', {
        method: 'POST', signal,
        headers: {Authorization: `Bearer ${secret.clientSecret}`, 'Content-Type': deepgram ? 'application/json' : 'application/sdp'},
        body: deepgram ? JSON.stringify({sdp: peer.localDescription?.sdp || offer.sdp, callId: secret.callId, tenant: secret.tenant, inputMode: 'microphone'}) : offer.sdp,
      });
      if (!response.ok) throw new Error(response.status === 409 ? 'Update both apps and restart translation.' : 'The audio translation provider could not connect.');
      const sdp = await response.text();
      if (active()) await peer.setRemoteDescription({type: 'answer', sdp});
    } catch (error: any) {
      if (active()) { this.stop(); throw error; }
    }
  }

  stop() {
    ++this.generation;
    this.controller?.abort();
    this.controller = null;
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
    this.cleanupPlayback?.();
    this.cleanupPlayback = null;
    const peer = this.peer;
    this.peer = null;
    if (peer) {
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      try { peer.close(); } catch {}
    }
    for (const track of this.outputTracks) { try { track.stop(); } catch {} }
    this.outputTracks = [];
  }
}

// A room/profile ID is not a call ID. Prefer the shared invite over a locally
// derived billing-log ID while Firestore call setup is still catching up.
export function resolveTranslationCallId(roomId: unknown, ...candidates: unknown[]): string | null {
  return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0 && value !== roomId) || null;
}

export function selectAudioStream(...streams: any[]): any {
  return streams.find(stream => stream?.getAudioTracks?.().some((track: any) => track.readyState !== 'ended')) || null;
}
