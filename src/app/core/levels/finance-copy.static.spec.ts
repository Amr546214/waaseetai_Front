import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Fee policy v2 copy guard: nothing in the UI may state the retired escrow charge (13% = VAT 7 + platform 5 + insurance 1), a "free" deposit,
// the invented provider "3% rewards" tile, the display-only 15% invoice VAT, or a provider withdrawal minimum the backend does not enforce.
const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('finance copy matches what the backend charges', () => {
	it('escrow page: only the contract value is charged at lock — no 7% / 1% / 5% rows, no tooltip range, total = price', () => {
		const html = read('pages/dashboard/clients-overview/my-request/escrow-deposit/escrow-deposit.html');
		const ts = read('pages/dashboard/clients-overview/my-request/escrow-deposit/escrow-deposit.ts');
		for (const old of ['عمولة النظام (7%)', 'رسم طالب الخدمة (1%)', 'رسوم تحويل (5%)', 'تتراوح بين 6% و7.25%']) expect(html, old).not.toContain(old);
		expect(html).toContain('escrow-no-fee-note');
		expect(ts).not.toMatch(/\b0\.07\b|\b0\.05\b|systemFee|clientFee|transferFee/);
		expect(ts).toContain('this.totalAmount.set(priceNum);');
	});
	it('contract signature page checks the wallet against the price (no ×1.13)', () => {
		const ts = read('pages/dashboard/clients-overview/my-request/contract-signature/contract-signature.ts');
		expect(ts).not.toContain('1.13');
		expect(ts).toContain('this.requiredAmount.set(Math.round(offerPrice * 100) / 100);');
	});
	it('provider wallet: the invented "performance rewards 3%" tile (and its literal 186) is gone', () => {
		const html = read('pages/dashboard/provider-overview/finance/wallet/wallet.html');
		expect(html).not.toContain('مكافآت الأداء');
		expect(html).not.toContain("'186'");
		expect(html).not.toContain('availableBalance * 0.03');
	});
	it('no "processing fee: free" label next to a PayPal deposit', () => {
		expect(read('pages/dashboard/provider-overview/finance/wallet/deposit-modal/deposit-modal.html')).not.toContain('مجاناً');
		expect(read('sheards/deposit-modal/deposit-modal.html')).not.toContain('مجاناً');
	});
	it('invoice: no 15% VAT line and no tax row at all (no tax is recorded; C2 removed the tax rows from the client invoice pages)', () => {
		const html = read('pages/dashboard/clients-overview/finance/invoice-details/invoice-details.html');
		expect(html).not.toContain('ضريبة القيمة المضافة (15%)');
		expect(html).not.toContain('invoice-tax-row');
		expect(html).not.toContain('invoice-no-tax');
	});
	it('legal + terms: no 1% client fee at escrow, no provider minimum of 500; the deposit fee and the commission-at-release are stated', () => {
		const legal = read('pages/website/legal/legal-page.component.ts');
		const terms = read('pages/website/terms/terms.component.html');
		expect(legal).not.toContain('رسوم إدارية ثابتة قدرها <strong>1%</strong>');
		expect(legal).not.toContain('حد سحب مقدم الخدمة: <strong>500</strong>');
		expect(legal).toContain('قيمة العقد فقط');
		expect(legal).toContain('عند تحريرها');
		expect(terms).not.toContain('رسوم طالب الخدمة الثابتة 1%');
		expect(terms).toContain('لا تُفرض رسوم على طالب الخدمة عند حجز الضمان');
	});
});
