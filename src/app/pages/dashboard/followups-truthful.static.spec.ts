/// <reference types="node" />

// Follow-up truthfulness batch: no invented fallbacks / loyalty-cashback percentages / personal names that reach real users.
//  - Backend has no cashback anywhere: REQUESTER_LEVEL_MATRIX.rate (progression-calculators.ts:45) is defined but never used or credited.
//  - Blog authors, company-reports team rows and new-ticket members were invented people.
// Static source scan, no TestBed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf-8');

describe('follow-ups stay truthful', () => {
	it('no hard-coded cashback percentages and no invented cashback amount', () => {
		for (const f of [
			'pages/dashboard/clients-overview/profile/profile.html',
			'pages/dashboard/clients-overview/profile/profile-level/profile-level.html',
			'pages/dashboard/clients-overview/client-overview/client-overview.component.html',
			'pages/dashboard/provider-overview/profile/public/public.html',
			'pages/dashboard/clients-overview/finance/wallet/wallet.html',
			'pages/dashboard/clients-overview/finance/wallet/wallet.ts',
		]) {
			const t = read(f);
			expect(t, `${f}: كاش باك 1.5%`).not.toContain('كاش باك 1.5%');
			expect(t, `${f}: كاش باك 3%`).not.toContain('كاش باك 3%');
			expect(t, `${f}: يصل إلى 5%`).not.toMatch(/كاش باك يصل\s*إلى 5%/);
		}
		expect(read('pages/dashboard/clients-overview/finance/wallet/wallet.ts')).not.toContain('avail * 0.03');
		expect(read('pages/dashboard/clients-overview/finance/wallet/wallet.html')).not.toContain('cashbackAmount()');
		expect(read('pages/dashboard/clients-overview/profile/profile-level/profile-level.html')).toContain('كاش باك الولاء حسب مستواك');
	});

	it('provider-overview revenue strip does not invent 61%', () => {
		const t = read('pages/dashboard/provider-overview/provider-overview/provider-overview.html');
		expect(t).not.toContain('|| 61');
		expect(t).toContain("profileCompletionPercent != null ? data.summary?.profileCompletionPercent + '%' : '—'");
	});

	it('specialty approval wording attributes the AI test only when a passed attempt exists', () => {
		const ts = read('pages/dashboard/provider-overview/profile/public/public.ts');
		expect(ts).not.toContain('اجتاز اختبار التخصص');
		expect(ts).toContain("spec?.isPassed && spec?.assessmentDetails ? 'تخصص معتمد · اجتاز اختبار AI' : 'تخصص معتمد'");
	});

	it('blog posts are signed by the team, not by invented people', () => {
		const t = read('pages/website/blog/blog-data.ts');
		for (const n of ['فهد العتيبي', 'نورة الشمري', 'منى الحربي', 'سعد القحطاني', 'ريم المالكي', 'لجين العمري', 'خالد البقمي', 'عبدالله الدوسري'])
			expect(t, n).not.toContain(n);
		expect(t.match(/authorName: 'فريق وسيط AI'/g)?.length).toBe(8);
	});

	it('company reports / new-ticket carry no invented team members or project ids', () => {
		const r = read('pages/dashboard/provider-overview/reports/reports.ts');
		for (const n of ['ريم الدوسري', 'سارة الزهراني', 'فهد العتيبي', 'خالد القحطاني', 'نواف الحربي', '69,920']) expect(r, n).not.toContain(n);
		expect(read('pages/dashboard/provider-overview/reports/reports.html')).toContain('لا توجد بيانات بعد');
		const n = read('pages/dashboard/provider-overview/help/new-ticket/new-ticket.ts');
		for (const x of ['فهد العتيبي', 'ريم الدوسري', 'محمد الشهري', 'نورة القحطاني', 'PRJ-3091', 'PRJ-3087', 'PRJ-3084']) expect(n, x).not.toContain(x);
	});
});
