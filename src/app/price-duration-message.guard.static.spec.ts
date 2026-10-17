/// <reference types="node" />

// Guard: any "please set price / duration" validation text anywhere in src must be an error-styled message
// (global red .form-error, or a warning/error toast) - never a blue/info hint or a notify.info toast.
// Note: the exact owner-screenshot literal "يرجى تحديد السعر والمدة المطلوب" (no trailing taa marbuta) does not
// exist in FE or BE source; this guard covers every variant so a future blue one cannot slip in.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(html|ts)$/.test(n) && !/\.spec\.ts$/.test(n)) out.push(p);
	}
	return out;
}

const MSG = /يرجى\s+(تحديد|إدخال|ادخال|تحديد)\s+(ال)?(سعر|مدة)[^<'"`\n]*(والمدة|والسعر|المدة)/;

describe('price/duration validation messages are never blue/info', () => {
	const files = walk(join(__dirname));
	const hits: { file: string; line: string }[] = [];
	for (const f of files) {
		for (const line of readFileSync(f, 'utf8').split('\n')) if (MSG.test(line)) hits.push({ file: f, line });
	}

	it('finds the known messages', () => {
		expect(hits.length).toBeGreaterThanOrEqual(2);
	});

	it('every occurrence is error-styled', () => {
		for (const h of hits) {
			if (h.file.endsWith('.ts')) {
				expect(h.line, h.file).toMatch(/notify\.(warning|error)\(/);
				expect(h.line, h.file).not.toMatch(/notify\.info\(/);
			}
		}
	});

	it('html occurrences sit in a form-error element, not a blue hint', () => {
		for (const h of hits.filter(x => x.file.endsWith('.html'))) {
			const html = readFileSync(h.file, 'utf8');
			const i = html.indexOf(h.line.trim().slice(0, 30));
			const ctx = html.slice(Math.max(0, i - 400), i + 200);
			expect(ctx, h.file).toMatch(/form-error/);
			expect(ctx, h.file).not.toMatch(/ws-note--info|text-sky|text-blue|var\(--blue/);
		}
	});
});
