// Stop retries always retain the original call/consent ID. Late responses must
// not stop a newer translation session on the same call.
export async function stopTranslationReliably(
  api: (action: string, extra?: Record<string, any>) => Promise<any>,
  identity: { callId: string | null | undefined; requestId?: string | null },
) {
  const stopRequestedAt = Date.now();
  let requestId = identity.requestId;
  const bounded = async (action: string, extra: Record<string, any>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([api(action, extra), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Translation stop confirmation timed out')), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!requestId) {
        const status: any = await bounded('status', { callId: identity.callId });
        if (['off','stopped','declined'].includes(status.status)) return status;
        requestId = status.requestId;
        if (!requestId) throw new Error('Translation request is not ready');
      }
      return await bounded('stop', { callId: identity.callId, requestId, stopRequestedAt });
    } catch (error: any) {
      // The original session no longer exists. Never retry against its replacement.
      if (error?.code === 'TRANSLATION_SESSION_CHANGED') return { status: 'stopped' };
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 500));
    }
  }
  throw lastError;
}
