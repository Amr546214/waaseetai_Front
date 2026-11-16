import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A submitted identity under review is decided first: no new upload and no removal until the decision (after a rejection the owner uploads again).
const dir = join(process.cwd(), 'src/app/pages/dashboard/clients-overview/profile/profile-setup');
describe('client setup: identity documents are locked while under review', () => {
	const html = readFileSync(join(dir, 'profile-setup.html'), 'utf8'), ts = readFileSync(join(dir, 'profile-setup.ts'), 'utf8');
	it('both file inputs are disabled while locked and the remove button is hidden', () => {
		expect(html).toContain('id="frontIdFile" [disabled]="identityLocked()"');
		expect(html).toContain('id="backIdFile" [disabled]="identityLocked()"');
		expect(html).toMatch(/@if \(!identityLocked\(\)\) \{ <button[^>]*remove-stored-back/);
	});
	it('the lock follows the server state and also stops a drop / programmatic change', () => {
		expect(ts).toContain("identityLocked(): boolean { return this.gate.status() === 'UNDER_REVIEW'; }");
		expect(ts).toContain("if (groupName === 'identity' && this.identityLocked()) { input.value = ''; return; }");
	});
});
