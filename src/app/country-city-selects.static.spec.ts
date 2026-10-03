/// <reference types="node" />

// Static guard: country/city <select>s must use the shared data (src/app/shared/data/countries-cities.ts).
// This stops a hard-coded Saudi city list (the bug: picking Egypt still listed Riyadh/Jeddah/...) from
// coming back in any form or in a new one.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const SAUDI_CITY = /<option[^>]*>\s*(الرياض|جدة|مكة المكرمة|المدينة المنورة|الدمام|الخبر|تبوك|أبها)\s*<\/option>/;

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (full.endsWith('.html')) out.push(full);
	}
	return out;
}

describe('country/city selects use the shared data', () => {
	const files = walk(APP);

	it('no template hard-codes Saudi cities as <option>s', () => {
		const offenders = files
			.filter((f) => SAUDI_CITY.test(readFileSync(f, 'utf-8')))
			.map((f) => relative(APP, f));
		expect(offenders).toEqual([]);
	});

	it('every city select is fed by citiesOf(...) and every country select by the shared country list', () => {
		const bad: string[] = [];
		for (const f of files) {
			const html = readFileSync(f, 'utf-8');
			for (const m of html.matchAll(/<select[^>]*(?:formControlName|formControl)="(?:\$any\(\w+\.get\(')?(city|country)[\s\S]*?<\/select>/g)) {
				const block = m[0];
				const kind = /formControlName="city"|get\('city'\)/.test(block.slice(0, 300)) ? 'city' : 'country';
				if (kind === 'city' && !block.includes('citiesOf(')) bad.push(relative(APP, f) + ' (city)');
				if (kind === 'country' && !block.includes('countryNames')) bad.push(relative(APP, f) + ' (country)');
			}
		}
		expect(bad).toEqual([]);
	});
});
