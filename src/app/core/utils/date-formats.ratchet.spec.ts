/// <reference types="node" />
// ZERO TOLERANCE: a date is shown through the platform settings (time zone, date format, calendar). A screen with its own date pipe / Intl formatter ignores them, so changing the setting would not touch
// it. Allowed only inside the central formatters (wsDate / wsDateText in shared/ws-date, the regional helpers).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = join(__dirname, '..', '..');
const ALLOWED = [join('shared', 'ws-date', 'ws-date.pipe.ts'), join('core', 'utils', 'regional.ts'), join('core', 'services', 'provider-prefs.store.ts')];
const PATTERNS: Array<[string, RegExp]> = [['| date:', /\|\s*date\s*:/g], ['toLocaleDateString', /\.toLocaleDateString\(/g], ['toLocaleTimeString', /\.toLocaleTimeString\(/g], ['Intl.DateTimeFormat', /Intl\.DateTimeFormat\(/g], ['DatePipe', /\bDatePipe\b/g]];
const walk = (d: string, out: string[] = []): string[] => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const files = walk(APP).filter(f => /\.(ts|html)$/.test(f) && !/\.spec\.ts$|test-fixtures/.test(f) && !ALLOWED.some(a => f.endsWith(a)));

describe('date formats (zero tolerance)', () => {
	it('no production file formats a date on its own (Angular date pipe, toLocaleDateString, Intl.DateTimeFormat)', () => {
		const offenders: string[] = [];
		for (const f of files) { const t = readFileSync(f, 'utf-8'); const hits = PATTERNS.map(([n, re]) => [n, t.match(re)?.length ?? 0] as const).filter(([, c]) => c); if (hits.length) offenders.push(`${relative(APP, f)}: ${hits.map(([n, c]) => `${n}×${c}`).join(' ')}`); }
		expect(offenders, `use wsDate / wsDateText (platform zone, format, calendar):\n${offenders.join('\n')}`).toEqual([]);
	});
});
