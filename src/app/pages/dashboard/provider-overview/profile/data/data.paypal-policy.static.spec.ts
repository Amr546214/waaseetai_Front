import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AUD-FND-000064: a PayPal email change is OTP-confirmed and immediate, with a 24-hour withdrawal freeze. It is NOT a human-review flow,
// and the page must not say it is.
const html = readFileSync(join(process.cwd(), 'src/app/pages/dashboard/provider-overview/profile/data/data.html'), 'utf8');
const panel = html.slice(html.indexOf('id="prof-panel-payout"'), html.indexOf('id="prof-panel-security"'));
const tabButton = html.slice(html.indexOf("setTab('payout')"), html.indexOf("setTab('docs')"));

describe('provider data page: PayPal change wording', () => {
	it('the PayPal tab and panel carry no manual-review wording or "بمراجعة" badge', () => {
		const NEGATION = 'لا يحتاج تغيير بريد PayPal إلى مراجعة يدوية'; // the one allowed mention: it says there is NO manual review
		for (const part of [panel.replace(NEGATION, ''), tabButton]) {
			expect(part).not.toContain('مراجعة يدوية');
			expect(part).not.toContain('تخضع لمراجعة');
			expect(part).not.toContain('بمراجعة');
		}
		expect(tabButton).toContain('برمز تحقق');
	});

	it('the panel says: OTP to the account email, 24h withdrawal freeze, no manual review', () => {
		expect(panel).toContain('يتم تأكيد تغيير بريد PayPal برمز تحقق يُرسل إلى بريد حسابك');
		expect(panel).toContain('بعد التأكيد، يتوقف السحب لمدة 24 ساعة لحماية الحساب');
		expect(panel).toContain('لا يحتاج تغيير بريد PayPal إلى مراجعة يدوية');
	});

	it('the page banner / legend only attach manual review to documents; contact + PayPal are "برمز تحقق"', () => {
		expect(html).toContain('وتغيير بريد التواصل وبريد PayPal يُؤكَّد برمز تحقق بدون مراجعة يدوية، أما المستندات فتخضع لمراجعة يدوية');
		expect(html).toContain('(المستندات)');
		expect(html).toContain('يُؤكَّد برمز يُرسل إلى بريد حسابك ويُطبَّق فورًا دون مراجعة يدوية (التواصل وPayPal)');
	});

	it('the confirmation step also states the 24-hour freeze', () => {
		const c = readFileSync(join(process.cwd(), 'src/app/shared/forms/paypal-email-confirm.component.ts'), 'utf8');
		expect(c).toContain('بعد التأكيد يتوقف السحب عبر PayPal لمدة 24 ساعة');
	});
});
