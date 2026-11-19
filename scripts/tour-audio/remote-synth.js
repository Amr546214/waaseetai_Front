// Runs INSIDE the backend container (it already holds the signed credentials of the AI service). Reads {items:[{id,text}], voice, model, dialect, verify} from stdin,
// writes one JSON line per item to stdout: {id, wav:<base64>, stt?:<text>} or {id, error}. Nothing else leaves the container.
const { waseetAiClient } = require('/app/dist/services/ai/waseet-ai/waseet-ai.client');
let raw = '';
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', async () => {
  const { items, voice, model, dialect, verify, paceMs } = JSON.parse(raw);
  const actor = { userId: 'tour-audio-generator', role: 'system' };
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const wav = await waseetAiClient.synthesizeSpeech({ text: item.text, dialect, voice, model, speakingRate: 'normal', mimeType: 'audio/wav' }, { actor, timeoutMs: 120000 });
        const out = { id: item.id, wav: wav.toString('base64') };
        if (verify) {
          try { const r = await waseetAiClient.transcribe({ audioBase64: out.wav, mimeType: 'audio/wav', languageCodes: ['ar-SA'], mode: 'smart', classification: 'PERSONAL' }, { actor, timeoutMs: 120000 }); out.stt = String(r.text || ''); }
          catch (e) { out.sttError = String(e && e.message || e).slice(0, 120); }
        }
        process.stdout.write(JSON.stringify(out) + '\n');
        await new Promise(r => setTimeout(r, paceMs || 5000));
      } catch (e) { process.stdout.write(JSON.stringify({ id: item.id, error: String(e && e.message || e).slice(0, 200) }) + '\n'); }
    }
  };
  // strictly one at a time with a pause: a long list in parallel hit the TTS per-minute quota and the service answered 503 (AI_ROUTE_UNAVAILABLE) for the rest
  await worker();
  // wait until the pipe has been flushed: exiting right away cut off the big (base64 WAV) lines
  process.stdout.write('', () => process.exit(0));
});
