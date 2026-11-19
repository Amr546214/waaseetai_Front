/// <reference types="node" />

// Guard: the narration is pre-rendered, so a tour step whose text changed (or that is new) MUST have its audio re-rendered (`npm run tour:audio`).
// Fails when a step has no mp3, no manifest entry, or the manifest hash no longer matches the step's text / voice settings.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_TOURS } from './tours';

const AUDIO_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'assets', 'tour', 'ar');
const manifest = JSON.parse(readFileSync(join(AUDIO_DIR, 'manifest.json'), 'utf-8')) as { voice: string; model: string; dialect: string; entries: Record<string, { hash: string; bytes: number; seconds: number }> };
// the same recipe as scripts/tour-audio/generate.mts
const hashOf = (text: string) => createHash('sha256').update(JSON.stringify({ text, VOICE: manifest.voice, MODEL: manifest.model, DIALECT: manifest.dialect })).digest('hex').slice(0, 16);

describe('tour audio is in step with the tour texts', () => {
	const steps = ALL_TOURS.flatMap(t => t.steps);
	it('every step has an mp3 and an up-to-date manifest entry', () => {
		const stale: string[] = [];
		for (const s of steps) {
			const file = join(AUDIO_DIR, `${s.id}.mp3`);
			if (!existsSync(file) || statSync(file).size < 2000) { stale.push(`${s.id}: audio file missing`); continue; }
			const entry = manifest.entries[s.id];
			if (!entry) stale.push(`${s.id}: not in the manifest`);
			else if (entry.hash !== hashOf(s.text)) stale.push(`${s.id}: text changed after the audio was rendered`);
		}
		expect(stale, `run \`npm run tour:audio\`:\n${stale.join('\n')}`).toEqual([]);
	});
	it('no orphan audio: the manifest lists only existing steps', () => {
		const ids = new Set(steps.map(s => s.id));
		expect(Object.keys(manifest.entries).filter(id => !ids.has(id))).toEqual([]);
	});
});
