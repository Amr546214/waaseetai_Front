/// <reference types="node" />

// Static guard: every bio / "نبذة" textarea (all roles, setup + edit + data screens) must use the shared
// BioFieldDirective, which gives it dir="auto" + unicode-bidi: plaintext (English text no longer shows its
// full stop at the start of the line in an RTL page) and the live "N / MAX حرف" counter.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;

function walk(dir: string, ext: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, ext, out);
		else if (full.endsWith(ext)) out.push(full);
	}
	return out;
}

/** A textarea is a bio field when it is bound to `bio` / `portfolioBio`. */
const isBioTextarea = (tag: string) => /formControlName="bio"|ngModel\)?\]?="portfolioBio"|\[\(ngModel\)\]="portfolioBio"/.test(tag);

describe('bio textareas use the shared directive', () => {
	const templates = walk(APP, '.html');
	const bioTags: { file: string; tag: string }[] = [];
	for (const f of templates) {
		const html = readFileSync(f, 'utf-8');
		for (const m of html.matchAll(/<textarea[\s\S]*?>/g)) {
			if (isBioTextarea(m[0])) bioTags.push({ file: relative(APP, f), tag: m[0] });
		}
	}

	it('finds the bio textareas of every role (guard is not vacuous)', () => {
		const files = new Set(bioTags.map((b) => b.file));
		for (const expected of [
			'pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html',
			'pages/dashboard/provider-overview/profile/data/data.html',
			'pages/dashboard/clients-overview/profile/profile-edit/profile-edit.html',
			'pages/dashboard/marketer-overview/profile/data/data.html',
			'pages/dashboard/marketer-overview/profile/profile-setup/profile-setup.html',
		]) expect([...files], expected).toContain(expected);
	});

	it('every bio textarea has [appBioField]="<limit>" (dir=auto + bidi + live counter)', () => {
		const offenders = bioTags.filter((b) => !/\[appBioField\]="\d+"/.test(b.tag)).map((b) => b.file);
		expect(offenders).toEqual([]);
	});

	it('a bio textarea\'s maxlength (when present) equals its counter limit', () => {
		for (const b of bioTags) {
			const max = b.tag.match(/maxlength="(\d+)"/)?.[1];
			const limit = b.tag.match(/\[appBioField\]="(\d+)"/)?.[1];
			if (max) expect(limit, b.file).toBe(max);
		}
	});

	it('no hand-written "/ 500 حرف" counters are left next to bio fields', () => {
		const offenders = templates
			.filter((f) => /class="char-counter"[^>]*>\s*\{\{[^}]*(bio|Bio)[^}]*\}\}\s*\/\s*\d+\s*حرف/.test(readFileSync(f, 'utf-8')))
			.map((f) => relative(APP, f));
		expect(offenders).toEqual([]);
	});

	it('the shared stylesheet keeps the bidi rule', () => {
		const css = readFileSync(join(APP, '..', 'styles.css'), 'utf-8');
		expect(css).toMatch(/\.bio-field\{[^}]*unicode-bidi:\s*plaintext/);
	});
});
