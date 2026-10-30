# Organization live audio translation and captions

The organization API supports two-person **active calls**, across browser, Android and iOS clients. It reuses the main app's microphone-to-gateway audio path. This is separate from post-call transcription and AI summaries. Meetings/rooms and group calls are not supported by this endpoint.

## Endpoint and authentication

`GET /api/v1/calls/{callId}/translation` reads status; `GET ...?action=capabilities` returns current configuration and language codes. `POST` performs the actions below. All requests require an organization API key with `calls:write`. Successful responses return the result object directly; errors use `{ error: { code, message } }`.

Keep the API key on your backend. Authenticate your end user, verify they own the asserted **internal participant ID** from `call.participants[].id`, and proxy only permitted actions. Never let a client choose another participant ID. The API verifies the call belongs to the key's organization and the participant belongs to that call. It cannot verify your application's end-user identity for you.

| Action | Required fields beyond `action`, `participantId` | Result |
| --- | --- | --- |
| `request` | `mode`: `audio` or `captions`, `targetLanguage` | Pending consent; save `requestId` |
| `accept` | `requestId`, `targetLanguage` | Other participant accepts and chooses their own output language |
| `decline` | `requestId` | Other participant declines |
| `status` | none | Status, languages, latest incoming caption, total charged |
| `audio-client-secret` | `requestId` | Short-lived participant credential and gateway configuration |
| `audio-ready` | `requestId` | Mark this participant ready after `translation.ready` |
| `caption` | `requestId`, `audioBase64` | Transcribe own microphone chunk and translate for the peer |
| `bill` | `requestId` | Idempotent cumulative settlement / heartbeat |
| `stop` | `requestId` | Settle and revoke translation; original call continues |

Every mutation after `request` must include the current `requestId`. Old consent, credentials and late caption results cannot affect a replacement session. Get status with `?participantId=part_...`. Target languages are ISO language codes returned by capabilities; do not hard-code the selector. The supported output list currently includes **42 languages**: Bulgarian (`bg`), Bengali (`bn`), Catalan (`ca`), Czech (`cs`), Danish (`da`), German (`de`), Greek (`el`), English (`en`), Spanish (`es`), Estonian (`et`), Finnish (`fi`), French (`fr`), Gujarati (`gu`), Hindi (`hi`), Croatian (`hr`), Hungarian (`hu`), Indonesian (`id`), Italian (`it`), Japanese (`ja`), Kannada (`kn`), Korean (`ko`), Lithuanian (`lt`), Latvian (`lv`), Marathi (`mr`), Malay (`ms`), Dutch (`nl`), Norwegian (`no`), Polish (`pl`), Portuguese (`pt`), Romanian (`ro`), Russian (`ru`), Slovak (`sk`), Slovenian (`sl`), Swedish (`sv`), Tamil (`ta`), Telugu (`te`), Filipino (`tl`), Turkish (`tr`), Ukrainian (`uk`), Urdu (`ur`), Vietnamese (`vi`), Chinese (`zh`). Always call `?action=capabilities` for the authoritative live list — this doc is a snapshot. This does not guarantee equally accurate source recognition for every language, accent or mixed-language utterance.

## Audio + captions client flow

1. Start the original call normally. Request microphone permission through the original call UI.
2. Participant A requests `mode: "audio"` and their preferred **listening** language. Show participant B consent and the $0.10/min fee; B accepts with their listening language.
3. Both clients request their own `audio-client-secret` through your authenticated backend. Only return that participant's grant. Never expose provider/API keys.
4. Use `RealtimeAudioTranslation` (exported by the updated SDK) on each client. Pass **that client's local microphone stream**, not the received remote stream. Pass `getSecret` that calls your backend. The returned configuration already contains a namespaced gateway call ID: pass it unchanged.
5. `onReady` must proxy `audio-ready` for that participant. Replace the current caption on each `onCaption` callback. Keep a `bill` heartbeat every 10 seconds while active.
6. Once translated playback succeeds, mute original remote playback elements (not microphone or track). Restore them on stop/error. Browser playback may require a user gesture; offer a tap-to-enable-audio control when autoplay is blocked.
7. On disconnect, reject, navigation or call end, invoke `stop` and `service.stop()`. Keep the underlying call connected if translation fails.

```ts
import { RealtimeAudioTranslation } from '@callpaymin/sdk';
// Browser example. proxyTranslation authenticates the user on YOUR backend.
const audio = new Audio();
const translation = new RealtimeAudioTranslation({
  PeerConnection: RTCPeerConnection,
  play: async (stream, track) => {
    audio.srcObject = stream || new MediaStream([track]);
    await audio.play();
    const wasMuted = remoteAudioElement.muted;
    remoteAudioElement.muted = true;
    return () => {
      remoteAudioElement.muted = wasMuted;
      audio.pause(); audio.srcObject = null;
    };
  },
});
await translation.start({
  stream: null,
  microphoneStream: localMicrophoneStream,
  getSecret: () => proxyTranslation('audio-client-secret', { requestId }),
  onReady: () => proxyTranslation('audio-ready', { requestId }),
  onCaption: text => renderCurrentCaption(text),
  onError: error => { restoreOriginalAudio(); showTranslationError(error); },
});
```

For React Native, inject its `RTCPeerConnection` and the app's audio-output adapter into the same client. The existing CallPayMin mobile implementation demonstrates native playback and audio focus. WebRTC integration is required; adding the REST endpoint alone does not play translated audio. Browser-to-browser, browser-to-mobile and mobile-to-mobile use the same gateway protocol.

Grants expire after two hours, are restricted to one org/call/participant/consent request, and are revalidated by the gateway every five seconds. Reconnect with a fresh grant before expiry for longer calls. Stopping, ending the call or exhausting credit revokes access. Do not log grants. Expired grant documents can be cleaned up by an operational retention job.

## Captions only

Request `mode: "captions"`, get both participants' consent, and send short, independently decodable chunks of **your own microphone** to `caption` (base64, maximum decoded size 1.5 MB; no more than one chunk per participant every 1.5 seconds). WAV, CAF, WebM and MP4/M4A are normalized using the same main-app format handling. The server chooses the peer's accepted language, ignoring client overrides, and publishes the latest caption for that peer. Poll status to render your incoming caption. Caption mode does not create a gateway audio connection. Send `bill` every 10 seconds and `stop` on exit.

## Billing and isolation

The translation fee is **$0.10/min per call**, separate from the expert's call rate, debited from the organization's call payer's **USD customer wallet**, not the main app's wallet. Both participants share one cumulative charge; concurrent heartbeats do not double-charge. Audio timing starts only after both clients report ready. Caption timing starts on acceptance. Charges are rounded up to cents and recorded as `live_translation` transactions. Translation fees do not enter the expert revenue-share calculation. Both participants must confirm activity. Ongoing fees stop at their last mutually confirmed activity; a missing heartbeat expires the session after a 45-second timeout; clients must send `stop` for final settlement even after the original call ends. The original call's usual billing lifecycle remains required.

## Deployment

Set these server-side in each CallPayMin API deployment:

```ini
LIVE_AUDIO_TRANSLATION_ENABLED=true
LIVE_AUDIO_TRANSLATION_PROVIDER=deepgram
LIVE_TRANSLATION_GATEWAY_URL=https://translate.callpaymin.io
LIVE_TRANSLATION_TENANT=callpaymin-dev
OPENAI_API_KEY=<server-only caption provider key>
```

Use `callpaymin` in production. Keep gateway Deepgram/OpenAI and TURN credentials on the gateway. Existing `TRANSLATION_TENANTS` entries must point to the updated CallPayMin API deployments. No gateway protocol change or new tenant is required: its existing authorization callback now accepts restricted org grants. Deploy both new org endpoints/services and the updated `/api/call/translation-session` callback together. Publish the rebuilt SDK separately before consumers install the new export.

## Verification checklist

Test two different organization participants in both translation modes; several language pairs across different scripts (e.g. English↔Spanish, German↔Polish, Hindi↔Japanese, Arabic-script via Urdu↔Vietnamese); browser autoplay recovery; Android/iOS audio focus; cross-platform speech in both directions; replacing captions; stop/restart; revoked and expired grants; another organization's key; an outsider participant; zero credit; duplicate ready/bill requests; call end and final settlement. Source code/type checks do not replace this staging call test.


Translation stop hardening: retry stop with the original call/participant/requestId and stopRequestedAt (Unix milliseconds). Never retry against a replacement request. Close the translation connection immediately and prevent stale status responses from restarting it. The SDK exports stopTranslationReliably for bounded confirmation retries.
