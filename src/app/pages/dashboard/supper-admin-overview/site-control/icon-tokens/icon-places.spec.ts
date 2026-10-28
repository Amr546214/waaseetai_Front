/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BELL_FAMILY_IDS, ICON_PLACES } from './icon-places';

const SRC = join(__dirname, '../../../../../../');
const REAL = JSON.parse(readFileSync(join(SRC, '../public/assets/site-control/real-icons.json'), 'utf8')).icons as Record<string, unknown>;
describe('icon places (where a function icon is really seen)', () => {
	for (const [id, p] of Object.entries(ICON_PLACES)) {
		it(`${id}: every listed place exists in the source and still contains its marker`, () => {
			for (const x of [...p.follows, ...p.separate]) expect(readFileSync(join(SRC, x.file), 'utf8'), `${id}: ${x.where}`).toContain(x.needle);
		});
		it(`${id}: there is NO «not followed» bucket any more: every place either follows or is a separate, editable key`, () => {
			expect(Object.keys(p).sort()).toEqual(['follows', 'separate']);
			for (const s of p.separate) expect(REAL[s.id], `${s.id} must be a real symbol with its own key`).toBeTruthy();
		});
	}
	it('the family ids are real symbols', () => { for (const id of BELL_FAMILY_IDS) expect(REAL[id], id).toBeTruthy(); });
	it('every bell drawing in the source is accounted for (a new bell copy fails here until it is classified)', async () => {
		const { readdirSync, statSync } = await import('node:fs');
		const listed = new Set([...ICON_PLACES['i-bell'].follows, ...ICON_PLACES['i-bell'].separate].map(x => x.file));
		const known = new Set(['app/layouts/dashboard-layout/dashboard-layout.ts']); // navLinks / getIconSvg: dead code, not rendered anywhere
		const hits: string[] = [];
		const walk = (d: string) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(html|ts)$/.test(e) && !/\.spec\.ts$/.test(e) && !p.includes('/site-control/')) { const t = readFileSync(p, 'utf8'); if (/M18 8A6 6 0 ?0 ?0 ?6 8|M15 17h5l-1\.405|M14\.857 17\.082/.test(t) && !/<symbol\b[^>]*id="(i|ic|ws|hwp|spa-i)-bell2?"/.test(t) || /data-ws-icon|ws: 'i-bell'/.test(t)) hits.push(p.slice(SRC.length)); } } };
		walk(join(SRC, 'app'));
		const missing = hits.filter(h => !listed.has(h) && !known.has(h) && !/identity-icon-symbols|settings-section|sidebar\.html|favorite\.html/.test(h));
		expect(missing, 'unclassified bell copies').toEqual([]);
	});
});
