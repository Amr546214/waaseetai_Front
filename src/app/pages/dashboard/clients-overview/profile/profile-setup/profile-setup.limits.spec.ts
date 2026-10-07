import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// #23 — one set of limits: the labels on the client wizard say what the code enforces (2 MB for the two ID sides, 3 MB for the supporting
// document: the three files travel as base64 in ONE JSON body and the backend accepts 10 MB per request). No leftover "5MB" label.
const dir = join(process.cwd(), 'src/app/pages/dashboard/clients-overview/profile/profile-setup');
const html = readFileSync(join(dir, 'profile-setup.html'), 'utf8');
const ts = readFileSync(join(dir, 'profile-setup.ts'), 'utf8');

describe('client profile-setup: upload limit labels match the enforced limits (#23)', () => {
	it('no label promises 5MB', () => {
		expect(html).not.toMatch(/5\s*MB/i);
		expect(html).not.toContain('5 ميغابايت');
	});
	it('the labels are 2, 2 and 3 megabytes, exactly like FILE_RULES', () => {
		expect(ts).toMatch(/frontId: \{ maxBytes: 2 \* MB/);
		expect(ts).toMatch(/backId: \{ maxBytes: 2 \* MB/);
		expect(ts).toMatch(/supportingDocs: \{ maxBytes: 3 \* MB/);
		expect((html.match(/حتى 2 ميغابايت/g) ?? []).length).toBeGreaterThanOrEqual(4);
		expect((html.match(/حتى 3 ميغابايت/g) ?? []).length).toBeGreaterThanOrEqual(1);
	});
});
