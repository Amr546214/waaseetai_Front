import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pages whose full component test is heavy (profile setup wizard, marketer data page, client profile edit, super-admin settings): the contract is checked in their source.
const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');

describe('optional e-mail platform switch is wired on every preferences page', () => {
	const pages: Array<[string, string, string]> = [
		['provider profile setup', 'provider-overview/profile/profile-setup/profile-setup.html', 'provider-overview/profile/profile-setup/profile-setup.ts'],
		['marketer data', 'marketer-overview/profile/data/data.html', 'marketer-overview/profile/data/data.ts'],
		['client profile edit', 'clients-overview/profile/profile-edit/profile-edit.html', 'clients-overview/profile/profile-edit/profile-edit.ts'],
	];
	for (const [name, html, ts] of pages) {
		it(`${name}: disabled state with the exact message, the always-on note and the 409 handler`, () => {
			const h = read(html), t = read(ts);
			expect(h).toContain('data-testid="email-platform-disabled"');
			expect(h).toContain('data-testid="code-mail-note"');
			expect(t).toContain('EMAIL_DISABLED_BY_PLATFORM');
			expect(t).toContain('isEmailDisabledError');
		});
	}
	it('provider setup never sends an e-mail channel the provider had not stored while the platform has it off', () => {
		const t = read('provider-overview/profile/profile-setup/profile-setup.ts');
		expect(t).toContain('d.emailEnabledByPlatform === false');
		expect(t).toContain('this.emailDisabledByPlatform() && !this.storedEmailChannel');
		expect(t).toContain("if (channel === 'email' && this.emailDisabledByPlatform()) return;");
	});
	it('marketer page does not send the read-only platform flag back (the settings DTO is strict)', () => {
		expect(read('marketer-overview/profile/data/data.ts')).toContain('const { emailEnabledByPlatform, ...stored } = res.data;');
	});
	it('super-admin settings notifications tab explains the switch and the independent code channel', () => {
		const h = read('supper-admin-overview/sa-system-settings/sa-system-settings.html');
		expect(h).toContain('data-testid="email-channel-note"');
		expect(h).toContain('معطّلًا «بواسطة إدارة المنصة»');
		// owner decision 3: the switch governs every optional mail and no preference overrides it; operation receipts / contract invitations / codes are the stated exception
		expect(h).toContain('ولا يتجاوزه تفضيل أي مستخدم');
		expect(h).toContain('data-testid="email-channel-transactional-note"');
		expect(h).toContain('إيصال إيداع الضمان');
		expect(h).toContain('دعوة المزوّد لتوقيع العقد');
	});
});
