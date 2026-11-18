/**
 * Renders the tour narration to static audio files: one MP3 per tour step, from the step's own text (nothing is generated while a tour runs).
 *
 *   npm run tour:audio                 # only steps whose text / voice settings changed (or have no file yet)
 *   npm run tour:audio -- --force      # everything again
 *   npm run tour:audio -- --only=visitor-hero,visitor-ai
 *   npm run tour:audio -- --verify     # also transcribe each result back with the speech-to-text and flag mismatches
 *   npm run tour:audio -- --dry        # list what would be rendered, change nothing
 *
 * How: the text goes to the AI service's TTS through the backend container on the server (SSH + docker exec; the service credentials never leave the server),
 * the WAV comes back, ffmpeg turns it into a small mono MP3 in public/assets/tour/ar/<stepId>.mp3, and manifest.json records a hash of
 * (text + voice + model + dialect) per step so the next run renders only what changed. Files of steps that no longer exist are deleted.
 * Env: TOUR_AUDIO_SSH (default: root@46.202.173.40), TOUR_AUDIO_SSH_KEY (default: ~/.ssh/waseet_vps_ed25519).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TOURS } from '../../src/app/core/tour/tours/index.ts';

const VOICE = 'Puck';            // the same voice as the assistant's default
const MODEL = 'gemini-3.8-flash-tts';
const DIALECT = 'msa';           // Modern Standard Arabic
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'public/assets/tour/ar');
const manifestPath = join(outDir, 'manifest.json');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const only = (args.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);

interface Entry { hash: string; bytes: number; seconds: number }
const hashOf = (text: string) => createHash('sha256').update(JSON.stringify({ text, VOICE, MODEL, DIALECT })).digest('hex').slice(0, 16);
const steps = ALL_TOURS.flatMap(t => t.steps.map(s => ({ id: s.id, text: s.text })));
const ids = steps.map(s => s.id);
if (new Set(ids).size !== ids.length) throw new Error(`duplicate step ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);

const manifest: { voice: string; model: string; dialect: string; entries: Record<string, Entry> } =
	existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { voice: VOICE, model: MODEL, dialect: DIALECT, entries: {} };
manifest.voice = VOICE; manifest.model = MODEL; manifest.dialect = DIALECT;
mkdirSync(outDir, { recursive: true });

const todo = steps.filter(s => (only.length ? only.includes(s.id) : true) && (flag('force') || only.length || manifest.entries[s.id]?.hash !== hashOf(s.text) || !existsSync(join(outDir, `${s.id}.mp3`))));
const orphans = readdirSync(outDir).filter(f => f.endsWith('.mp3') && !ids.includes(f.slice(0, -4)));
console.log(`${steps.length} steps · ${todo.length} to render · ${orphans.length} orphan file(s)`);
for (const s of todo) console.log('  render', s.id);
if (flag('dry')) process.exit(0);
for (const f of orphans) { rmSync(join(outDir, f)); delete manifest.entries[f.slice(0, -4)]; console.log('  removed', f); }

const normalize = (t: string) => t.replace(/[ً-ٰٟـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^؀-ۿa-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const similarity = (a: string, b: string) => { const A = new Set(normalize(a).split(' ')), B = new Set(normalize(b).split(' ')); const inter = [...A].filter(w => B.has(w)).length; return A.size ? inter / A.size : 0; };

if (todo.length) {
	const ssh = process.env.TOUR_AUDIO_SSH ?? 'root@46.202.173.40';
	const key = process.env.TOUR_AUDIO_SSH_KEY ?? join(homedir(), '.ssh/waseet_vps_ed25519');
	const script = readFileSync(join(root, 'scripts/tour-audio/remote-synth.js'), 'utf8');
	const b64 = Buffer.from(script).toString('base64');
	const remote = `C=$(docker ps --format '{{.Names}}' | grep -E '^waseetai-backend-prod-[0-9a-f]{7}$' | head -1); docker exec -i $C node -e "eval(Buffer.from('${b64}','base64').toString())"`;
	const runRemote = async (items: typeof todo): Promise<any[]> => {
		const child = spawn('ssh', ['-i', key, '-o', 'IdentitiesOnly=yes', ssh, remote], { stdio: ['pipe', 'pipe', 'inherit'] });
		child.stdin.end(JSON.stringify({ items, voice: VOICE, model: MODEL, dialect: DIALECT, verify: flag('verify') }));
		let buffer = ''; const out: any[] = [];
		child.stdout.on('data', chunk => { buffer += chunk; let i; while ((i = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1); if (line.startsWith('{')) { try { out.push(JSON.parse(line)); } catch { /* partial / noise */ } } } });
		await new Promise<void>(res => child.on('close', () => res()));
		return out;
	};
	// the AI service answers 503 under load now and then: a step with no usable result is retried (twice) before it counts as failed
	const results: any[] = [];
	let pending = todo;
	for (let attempt = 1; attempt <= 3 && pending.length; attempt++) {
		if (attempt > 1) console.log(`  retry ${attempt - 1}: ${pending.map(p => p.id).join(', ')}`);
		for (const r of await runRemote(pending)) { if (r.error) console.log(`    ${r.id}: ${r.error}`); if (r.wav) { const i = results.findIndex(x => x.id === r.id); if (i >= 0) results.splice(i, 1); results.push(r); } }
		pending = todo.filter(s => !results.some(r => r.id === s.id));
	}

	let failed = 0;
	for (const s of todo) {
		const r = results.find(x => x.id === s.id);
		if (!r || r.error || !r.wav) { failed++; console.log(`  FAILED ${s.id}: ${r?.error ?? 'no result'}`); continue; }
		const wavPath = join(tmpdir(), `${s.id}.wav`), mp3 = join(outDir, `${s.id}.mp3`);
		writeFileSync(wavPath, Buffer.from(r.wav, 'base64'));
		const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-ar', '24000', '-b:a', '48k', mp3]);
		rmSync(wavPath, { force: true });
		if (enc.status !== 0) { failed++; console.log(`  FAILED ${s.id}: ffmpeg ${enc.stderr}`); continue; }
		const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp3]);
		const seconds = Math.round(parseFloat(String(probe.stdout)) * 10) / 10;
		const bytes = readFileSync(mp3).length;
		manifest.entries[s.id] = { hash: hashOf(s.text), bytes, seconds };
		let note = '';
		if (flag('verify')) { const sim = r.stt ? similarity(s.text, r.stt) : 0; note = r.sttError ? ` stt-error ${r.sttError}` : ` match ${(sim * 100).toFixed(0)}%${sim < 0.7 ? '  <-- LOW: listen to it' : ''}`; if (sim < 0.85 && r.stt) note += `\n      heard: ${r.stt.slice(0, 160)}`; }
		console.log(`  ok ${s.id}  ${seconds}s  ${(bytes / 1024).toFixed(0)}KB${note}`);
	}
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
	if (failed) { console.log(`${failed} step(s) failed; re-run to retry only those`); process.exit(1); }
} else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('done');
