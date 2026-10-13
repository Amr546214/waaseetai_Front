import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PROVIDER_OVERVIEW_ROUTES } from './provider.routes';

// "Operate, don't delete" guards (FE package 1): nothing was removed — each fake/incomplete item was wired, redirected, reworded or disabled with a reason.
const root = __dirname;
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const route = (path: string) => PROVIDER_OVERVIEW_ROUTES.find(r => r.path === path);

describe('provider FE package 1 — operate, do not delete', () => {
	it('the three orphan routes still exist and lead to real screens', () => {
		const q = (queryParams: Record<string, string>) => ({ queryParams } as any);
		const neg = route('business-models/negotiation')!.redirectTo as (d: any) => string;
		expect(neg(q({}))).toBe('offers');
		expect(neg(q({ offerId: 'abc' }))).toBe('offers/abc/negotiate');
		const edit = route('business-models/service-edit')!.redirectTo as (d: any) => string;
		expect(edit(q({ edit: 's1' }))).toBe('business-models/new-project');
		expect(edit(q({}))).toBe('business-models/center');
		expect(route('business-models/customer-requests')!.redirectTo).toBe('offers');
	});
	it('help/live-support route is kept; it is labelled as tickets, not a live chat', () => {
		expect(route('help/live-support')).toBeTruthy();
		expect(read('help/live-support/live-support.html')).not.toContain('الدعم المباشر');
		expect(read('help/help.html')).toContain('تواصل مع الدعم عبر تذكرة');
		expect(read('help/help.html')).not.toContain('شات مباشر مع موظف');
	});
	it('wallet: the deposit slot is kept — company top-up modal, individual gets the payout-data link', () => {
		const h = read('finance/wallet/wallet.html');
		expect(h).toContain('data-testid="wallet-topup"');
		expect(h).toContain('data-testid="wallet-payout-data"');
	});
	it('invoices page keeps its KPI/tabs/table structure and has no sample rows', () => {
		const h = read('finance/invoices/invoices.html');
		const t = read('finance/invoices/invoices.ts');
		for (const k of ['inv-kpis', 'inv-tabs', 'tx-tbl', 'inv-empty']) expect(h).toContain(k);
		expect(t).not.toMatch(/INV-2026|نورة التصميم|رشا الكاتبة/);
	});
	it('reports: PDF and CSV buttons are kept and wired to real handlers', () => {
		const h = read('reports/reports.html');
		expect(h).toContain('exportCsv()');
		expect(h).toContain('printReport()');
		expect(h).not.toContain('جاري تصدير');
	});
	it('sign-contract: "edit terms via chat" is kept and opens the project conversation', () => {
		const h = read('offers/sign-contract/sign-contract.html');
		const t = read('offers/sign-contract/sign-contract.ts');
		expect(h).toContain('تعديل البنود عبر المحادثة');
		expect(h).toContain('openProjectConversation()');
		expect(t).toContain("messageContext: { type: 'PROJECT', projectId");
		expect(t).not.toContain('قاعدة البيانات');
	});
	it('profile-setup: preferences card is kept, disabled with a stated reason', () => {
		const h = read('profile/profile-setup/profile-setup.html');
		expect(h).toContain('التفضيلات');
		expect(h).toContain('data-testid="prefs-fieldset"');
		expect(h).toContain('حفظ التفضيلات غير مفعّل بعد');
		expect(h).not.toContain('30 يوم');
	});
	it('level roadmap: progress lines follow the real level (no fixed level-4 geometry)', () => {
		const h = read('profile/level/level.html');
		expect(h).toContain('level-done-line');
		expect(h).not.toContain('11/15');
	});
});
