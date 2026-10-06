/// <reference types="node" />

// FE-2: static guards against hard-coded numbers / invented presence / mock identities coming back.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(APP, p), 'utf-8');

describe('FE-2 real data', () => {
	it('level.html (company mode) has no hard-coded KPI numbers or "|| N" fallbacks', () => {
		const h = read('pages/dashboard/provider-overview/profile/level/level.html');
		for (const x of ['|| 89', '|| 320', '|| 2680', '|| 4.7', '>98%<', '[style.width.%]="94"', '[style.width.%]="88"', '[style.width.%]="76"', '[style.width.%]="92"', '>88%<', '>76%<', '>92%<', 'أكمل 3 مشاريع إضافية']) {
			expect(h, x).not.toContain(x);
		}
		expect(/\|\|\s*\d/.test(h), 'no "|| <number>" fallback').toBe(false);
	});

	it('provider reports are bound to GET /provider/reports (range) with "—" / empty states', () => {
		const ts = read('pages/dashboard/provider-overview/reports/reports.ts');
		expect(ts).toContain('getProviderReports(');
		const api = read('core/services/provider-api.service.ts');
		expect(api).toContain('`${this.apiUrl}/reports`');
		const h = read('pages/dashboard/provider-overview/reports/reports.html');
		expect(h).toContain('لا توجد بيانات بعد');
		expect(h).not.toContain('﷼');
		expect(h).not.toContain('ريال سعودي');
	});

	it('profile-setup shows the stored setupTestScore / status ("—" when absent)', () => {
		const ts = read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts');
		expect(ts).toContain('setupTestScore');
		expect(ts).toContain('setupTestStatus');
		expect(read('pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html')).toContain('storedSetupTestScore()');
	});

	it('sa-messages ships no invented conversations or fake online flag', () => {
		const ts = read('pages/dashboard/supper-admin-overview/sa-messages/sa-messages.ts');
		for (const x of ['أحمد الغامدي', 'شركة التقنية المتقدمة', 'محمد الحربي', 'سارة الزهراني', 'فهد العتيبي', 'نورة القحطاني', 'online: true']) expect(ts, x).not.toContain(x);
		expect(ts).toContain('conversations = signal<Conversation[]>([])');
	});

	it('the "متصل الآن" label in the three real messages pages only renders behind the real presence flag', () => {
		for (const f of ['provider-overview', 'clients-overview', 'marketer-overview']) {
			const h = read(`pages/dashboard/${f}/messages/messages.html`);
			expect(h).toMatch(/@if \(conv\.online\) \{\s*<span class="odot"><\/span>متصل الآن/);
		}
	});

	it('sa-dispute-detail uses the real parties and carries no mock names, amounts or cases', () => {
		const ts = read('pages/dashboard/supper-admin-overview/sa-disputes/sa-dispute-detail/sa-dispute-detail.ts');
		for (const x of ['mockClaimantNames', 'mockRespondentNames', 'mockRespondentDefenses', 'mockSimilarCases', 'mockDisputeAmount', 'similarCases(']) expect(ts, x).not.toContain(x);
		expect(ts).toContain('d.openedBy');
		expect(ts).toContain('d.againstUser');
		const h = read('pages/dashboard/supper-admin-overview/sa-disputes/sa-dispute-detail/sa-dispute-detail.html');
		for (const x of ['dp-mock-notice', 'تجريبي', 'ر.س']) expect(h, x).not.toContain(x);
	});
});
