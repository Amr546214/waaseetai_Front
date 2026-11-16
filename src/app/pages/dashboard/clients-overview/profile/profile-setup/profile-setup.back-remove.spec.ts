import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The stored back side (optional) can be removed by its owner: a «حذف» button next to the stored-document link sends removeBackId through the identity gate.
const dir = join(process.cwd(), 'src/app/pages/dashboard/clients-overview/profile/profile-setup');
describe('client setup: removing the stored back side', () => {
	it('the stored-document row has a remove button wired to removeStoredBack()', () => {
		const html = readFileSync(join(dir, 'profile-setup.html'), 'utf8');
		expect(html).toMatch(/client_back_id[\s\S]{0,200}data-testid="remove-stored-back"/);
		expect(html).toContain('(click)="removeStoredBack()"');
	});
	it('removeStoredBack sends removeBackId (and no picture) and clears the stored entry on success', () => {
		const ts = readFileSync(join(dir, 'profile-setup.ts'), 'utf8');
		expect(ts).toContain('removeBackId: true');
		expect(ts).toContain('this.storedDocs.update(s => ({ ...s, backId: null }))');
		expect(ts).toMatch(/removeStoredBack\(\) \{[\s\S]{0,400}sendIdentity\(\{ removeBack: true \}\)/);
	});
});

describe('identity check status line', () => {
	it('the status icon is drawn once (the message text carries no ⏳ of its own)', () => {
		for (const f of ['pages/dashboard/clients-overview/profile/profile-setup/profile-setup.ts', 'pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts']) {
			expect(readFileSync(join(process.cwd(), 'src/app', f), 'utf8')).not.toContain("message: '⏳");
		}
	});
	it('the identity save does not raise the app-wide loading overlay', () => {
		expect(readFileSync(join(process.cwd(), 'src/app/core/services/identity-gate.service.ts'), 'utf8')).toMatch(/put<[^>]*>\(this\.url, body, \{ context: new HttpContext\(\)\.set\(SKIP_LOADING, true\) \}\)/);
	});
});
