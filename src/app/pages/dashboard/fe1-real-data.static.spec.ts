/// <reference types="node" />

// FE-1: static guards — no invented numeric fallbacks, no AI claims in manual-review state, no simulated support replies,
// and HR / live-support really bound to their backend services.

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

describe('FE-1 real data', () => {
	it('no invented numeric fallbacks "|| 20" / "|| 12" anywhere in production code', () => {
		for (const f of productionFiles) {
			const t = readFileSync(f, 'utf-8');
			expect(/\|\|\s*20\b/.test(t), `${f}: || 20`).toBe(false);
			expect(/\|\|\s*12\b/.test(t), `${f}: || 12`).toBe(false);
		}
	});

	it('accreditation manual-review state makes no AI claim', () => {
		const files = [
			'pages/dashboard/supper-admin-overview/sa-accreditations/sa-accreditations.html',
			'pages/dashboard/supper-admin-overview/sa-accreditations/sa-accreditations.ts',
			'pages/dashboard/supper-admin-overview/sa-accreditations/sa-accreditation-detail/sa-accreditation-detail.ts',
			'pages/dashboard/provider-overview/company/company-models/company-models.html',
			'pages/dashboard/provider-overview/business-models/new-project/components/step2-specialty/step2-specialty.component.html'
		];
		for (const f of files) expect(read(f), f).not.toContain('قيد الفحص الآلي');
		expect(read('pages/dashboard/provider-overview/business-models/new-project/components/step2-specialty/step2-specialty.component.html')).toContain('يراجع فريق وسيط نماذج أعمالك');
	});

	it('live-support is bound to /provider/tickets and has no simulated agent', () => {
		const ts = read('pages/dashboard/provider-overview/help/live-support/live-support.ts');
		for (const m of ['listTickets(', 'createTicket(', 'getTicket(', 'replyToTicket(', 'closeTicket(']) expect(ts, m).toContain(m);
		for (const x of ['setTimeout(() => {\n\t\t\tthis.isTyping', 'تم استلام رسالتك، سأتحقق', 'عبدالله المطيري', 'سارة', 'isTyping']) expect(ts, x).not.toContain(x);
		const html = read('pages/dashboard/provider-overview/help/live-support/live-support.html');
		for (const x of ['متصل الآن', 'أقل من دقيقتين', 'دقيقتان متوسط الانتظار']) expect(html, x).not.toContain(x);
		expect(html).toContain('ticketNumber');
	});

	it('provider-hr is bound to CompanyTeamService (list/create/update/remove) with no static catalogs', () => {
		const ts = read('pages/dashboard/provider-overview/hr/provider-hr.component.ts');
		for (const m of ['teamApi.list()', 'teamApi.create(', 'teamApi.update(', 'teamApi.remove(']) expect(ts, m).toContain(m);
		for (const x of ['p-view-requests', 's-fe-react', 'permissionCategories', 'pushActivity']) expect(ts, x).not.toContain(x);
		const html = read('pages/dashboard/provider-overview/hr/provider-hr.component.html');
		expect(html).toContain('لا توجد بيانات بعد');
		expect(html).toContain('loadError()');
	});

	it('step1-details keeps the draft and offers retry when the AI stream ends with an error', () => {
		const ts = read('core/services/new-project.service.ts');
		expect(ts).toContain('error');
		const c = read('pages/dashboard/provider-overview/business-models/new-project/components/step1-details/step1-details.component.html');
		expect(c).toContain('إعادة المحاولة');
	});
});
