/// <reference types="node" />

// PR-A: nothing that reaches a real user may be invented. Static source scan.
//  - dispute details read GET /provider/disputes/:id (dispute-api.service getProviderDispute), never a mock array
//  - client notifications: honest error / empty state, never demo items
//  - live-support / reports / HR / new-ticket carry no invented ticket ids, people, orders or counts

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(APP, p), 'utf-8');

function walk(dir: string, out: string[] = []): string[] {
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		if (statSync(p).isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}
const productionFiles = walk(APP).filter(f => /\.(ts|html)$/.test(f) && !/\.spec\.ts$/.test(f) && !/test-fixtures/.test(f));

describe('real data only (PR-A)', () => {
	it('no production file reads the disputes mock fixtures', () => {
		for (const f of productionFiles) {
			const t = readFileSync(f, 'utf-8');
			expect(t.includes('DISPUTES_MOCK'), `${f}: DISPUTES_MOCK`).toBe(false);
			expect(/disputes\.(mock|test-fixtures)/.test(t), `${f}: disputes mock import`).toBe(false);
		}
	});

	it('dispute-details reads the real provider dispute endpoint and offers a retryable error', () => {
		const ts = read('pages/dashboard/provider-overview/disputes/dispute-details/dispute-details.ts');
		expect(ts).toContain('getProviderDispute(id)');
		expect(ts).toContain('loadError');
		const html = read('pages/dashboard/provider-overview/disputes/dispute-details/dispute-details.html');
		expect(html).toContain('تعذّر تحميل تفاصيل النزاع');
		expect(html).toContain('إعادة المحاولة');
		expect(read('pages/dashboard/provider-overview/disputes/disputes.mapper.ts')).toContain('التفاصيل الكاملة غير متاحة');
	});

	it('client notifications never fall back to demo items', () => {
		const t = read('pages/dashboard/clients-overview/notifications/notifications-center/notifications-center.ts');
		expect(t).not.toContain('getDemoNotifications');
		expect(t).not.toContain('كاش باك جديد');
		expect(t).not.toContain('توصية من الذكاء');
		expect(t).not.toMatch(/demo-\d/);
		expect(t).toContain('this.hasError.set(true)');
		expect(read('pages/dashboard/clients-overview/notifications/notifications-center/notifications-center.html')).toContain('تعذر تحميل الإشعارات');
	});

	it('provider-overview strip says what it shows (profile completion), not revenue vs a goal', () => {
		const t = read('pages/dashboard/provider-overview/provider-overview/provider-overview.html');
		expect(t).not.toContain('إيرادات الشركة هذا الشهر');
		expect(t).not.toContain('من هدف');
		expect(t).toContain('اكتمال الملف المهني');
	});

	it('live-support shows no invented ticket / project', () => {
		const h = read('pages/dashboard/provider-overview/help/live-support/live-support.html');
		const ts = read('pages/dashboard/provider-overview/help/live-support/live-support.ts');
		for (const x of ['PRJ-3091', '2026-0188', 'أمر تغيير معتمد']) expect(h, x).not.toContain(x);
		expect(ts).not.toContain('TKT-2026-0188');
		expect(h).toContain('ticketNumber');
	});

	it('reports page has no invented KPIs, orders, specialties or counts', () => {
		const h = read('pages/dashboard/provider-overview/reports/reports.html');
		for (const x of ['47.2K', '#ORD-2026', '15,000 ﷼', '85%', 'قيد التطوير', 'قريباً', '▲ 3 هذا الشهر', '▲ 0.3 عن السابق']) expect(h, x).not.toContain(x);
		expect(h).toContain('لا توجد بيانات بعد');
		const ts = read('pages/dashboard/provider-overview/reports/reports.ts');
		expect(ts).not.toMatch(/count:\s*\d/);
		expect(ts).toContain('getProviderStatistics()');
	});

	it('HR page and new-ticket forms are not seeded with invented people / projects', () => {
		const hr = read('pages/dashboard/provider-overview/hr/provider-hr.component.ts');
		for (const x of ['nora@company.com', 'm.harbi@freelancer.com', 'Safari على جهاز iPhone', 'قبل يومين']) expect(hr, x).not.toContain(x);
		expect(hr).toContain('members = signal<CompanyTeamMember[]>([]);');
		expect(hr).toContain('this.teamApi.list()');
		const nt = read('pages/dashboard/clients-overview/help/new-ticket/new-ticket.ts');
		for (const x of ['ORD-3092', 'ORD-3093', 'ORD-3094', 'سلطان العتيبي', 'خالد المطيري', 'نورة القحطاني', 'فهد الغامدي']) expect(nt, x).not.toContain(x);
	});
});
