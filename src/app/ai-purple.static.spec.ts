/// <reference types="node" />

// Static guard: purple + the official AI icon belong to REAL AI only.
//  1. Every AI-identity icon wrapper (ai-disc-ico, ai-bc-ico, ai-banner-ico, ai-insight-ico) must contain the official AI mark
//     (`#i-ai` / an AI-named symbol such as ws-trust-ai / inline node-network geometry) — never a shield, chart, doc…
//  2. A non-AI note (`ws-note`) never carries the AI icon or any AI-purple class / colour.
// "وسيط، …" alone does not make a banner AI: security / escrow / invoices / manual review banners use `ws-note`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;

function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.html$/.test(n)) out.push(p);
	}
	return out;
}
const FILES = walk(APP);

const AI_WRAPPERS = /class="[^"]*\b(ai-disc-ico|ai-bc-ico|ai-banner-ico|ai-insight-ico)\b[^"]*"/g;
const isOfficialAi = (html: string) =>
	/href="#(i-ai|[a-z-]*ai|ai)"/.test(html) || /M12 10V5M12 19v-5/.test(html) || /cx="12" cy="12" r="2"/.test(html);
const PURPLE = /rgba\(\s*123\s*,\s*47\s*,\s*190|#A56BE0|#7B2FBE|#6B27A5|\bai-disc|\bai-bc|\bai-insight|\bai-banner|txt-purple|text-(purple|violet|indigo)-|bg-(purple|violet|indigo)-/i;

describe('AI purple / AI icon rule', () => {
	it('an AI identity wrapper (ai-disc-ico / ai-bc-ico / ai-banner-ico / ai-insight-ico) always draws the official AI mark', () => {
		const bad: string[] = [];
		let n = 0;
		for (const f of FILES) {
			const s = readFileSync(f, 'utf8');
			for (const m of s.matchAll(AI_WRAPPERS)) {
				n++;
				// the wrapper's content: up to the closing tag of its element (first </div>)
				const end = s.indexOf('</div>', m.index!);
				const inner = s.slice(m.index!, end === -1 ? m.index! + 900 : end);
				if (!isOfficialAi(inner)) bad.push(`${f.replace(APP, '')}:${s.slice(0, m.index!).split('\n').length}`);
			}
		}
		expect(n).toBeGreaterThan(5);
		expect(bad).toEqual([]);
	});

	it('a ws-note (non-AI note) never uses the AI icon or an AI purple class / colour', () => {
		const bad: string[] = [];
		let n = 0;
		for (const f of FILES) {
			const s = readFileSync(f, 'utf8');
			for (const m of s.matchAll(/<div[^>]*class="[^"]*\bws-note\b[^"]*"[^>]*>/g)) {
				n++;
				const open = m[0];
				if (PURPLE.test(open)) bad.push(`${f.replace(APP, '')}:${s.slice(0, m.index!).split('\n').length} (purple class on the note)`);
				// the note body: up to 900 chars (a note is a small block)
				const body = s.slice(m.index! + open.length, m.index! + open.length + 900);
				const firstSvg = body.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? '';
				if (isOfficialAi(firstSvg)) bad.push(`${f.replace(APP, '')}:${s.slice(0, m.index!).split('\n').length} (AI icon on a non-AI note)`);
			}
		}
		expect(n).toBeGreaterThan(10);
		expect(bad).toEqual([]);
	});

	it('the shared ws-note component exists in the global stylesheet with its tones', () => {
		const css = readFileSync(join(APP, '..', 'styles.css'), 'utf8');
		for (const c of ['.ws-note{', '.ws-note--neutral', '.ws-note--warn', '.ws-note--success', '.ws-note-ico', '.ws-note-lbl', '.ws-note-txt']) expect(css).toContain(c);
	});
});
