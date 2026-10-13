import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The offer card never states a warranty period the offer does not carry (it used to print "ضمان 14 يوما" on every offer that was not the best match).
describe('request details: no invented warranty', () => {
	const html = readFileSync(join(__dirname, 'request-details.html'), 'utf8');
	it('has no fixed warranty days', () => {
		expect(html).not.toMatch(/ضمان\s*\d+\s*يوم/);
		expect(html).toContain('مدة الضمان غير متاحة');
	});
});
