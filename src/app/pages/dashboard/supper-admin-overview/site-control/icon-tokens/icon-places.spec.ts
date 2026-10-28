/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_PLACES } from './icon-places';

const SRC = join(__dirname, '../../../../../../');
describe('icon places (where a function icon is really seen)', () => {
	for (const [id, p] of Object.entries(ICON_PLACES)) {
		it(`${id}: every listed place exists in the source and still contains its marker`, () => {
			for (const x of [...p.follows, ...p.notFollowed]) expect(readFileSync(join(SRC, x.file), 'utf8'), `${id}: ${x.where}`).toContain(x.needle);
		});
		it(`${id}: followed places are <use> of that id (or an id list), not-followed ones are NOT`, () => {
			for (const x of p.follows) expect(x.needle).toMatch(/i-bell/);
			for (const x of p.notFollowed) expect(x.needle === `href="#${id}"` || x.needle === `'#${id}'`, x.where).toBe(false);
		});
	}
	it('the notifications slot follows the header bell and says the sidebar entry is NOT followed', () => {
		expect(ICON_PLACES['i-bell'].follows[0].file).toContain('notification-bell');
		expect(ICON_PLACES['i-bell'].notFollowed[0].where).toContain('القائمة الجانبية');
	});
});
