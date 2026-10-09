/// <reference types="node" />

// AI Cleanup Batch 3 (super-admin truthfulness): static-content regression guards.
// Each assertion pins the removal of a hardcoded / hash-seeded / random value or a
// local-only action that pretended to succeed on a Super Admin screen. Real
// bindings and real admin controls that sit next to them are asserted to still be
// present, so the cleanup cannot silently drop real data.
// Same raw-source approach as ai-cleanup-batch1/2.static.spec.ts.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SA = 'supper-admin-overview/';

function readSrc(relativePath: string): string {
	return readFileSync(join(__dirname, SA + relativePath), 'utf-8');
}

const aiDashTs = readSrc('ai/sa-ai-dashboard/sa-ai-dashboard.ts');
const aiDashHtml = readSrc('ai/sa-ai-dashboard/sa-ai-dashboard.html');
const matchTs = readSrc('ai/sa-match-engine/sa-match-engine.ts');
const matchHtml = readSrc('ai/sa-match-engine/sa-match-engine.html');
const aiAuditTs = readSrc('ai/sa-ai-audit/sa-ai-audit.ts');
const aiAuditHtml = readSrc('ai/sa-ai-audit/sa-ai-audit.html');

const wdDetailTs = readSrc('sa-withdrawals/sa-withdrawal-detail/sa-withdrawal-detail.ts');
const wdDetailHtml = readSrc('sa-withdrawals/sa-withdrawal-detail/sa-withdrawal-detail.html');

const reportsTs = readSrc('sa-reports/sa-reports.ts');
const reportsHtml = readSrc('sa-reports/sa-reports.html');
const reportDetailTs = readSrc('sa-reports/sa-report-detail/sa-report-detail.ts');
const reportDetailHtml = readSrc('sa-reports/sa-report-detail/sa-report-detail.html');

const usersTs = readSrc('sa-users/sa-users.ts');
const usersHtml = readSrc('sa-users/sa-users.html');
const usersServiceTs = readSrc('sa-users/sa-users.service.ts');
const userDetailTs = readSrc('sa-users/sa-user-detail/sa-user-detail.ts');
const userDetailHtml = readSrc('sa-users/sa-user-detail/sa-user-detail.html');

const serversTs = readSrc('it/sa-servers/sa-servers.ts');
const serversHtml = readSrc('it/sa-servers/sa-servers.html');

describe('AI Cleanup Batch 3 — fully-mock AI admin pages show an honest unavailable state', () => {
	it('AI dashboard: no invented models, accuracy %, volumes, or dead export/retrain buttons', () => {
		for (const v of ['94.2%', '96.2', '98.1', '89.4', '91.8', '284k', 'AI Fraud Detection', 'AI Risk Score']) {
			expect(aiDashTs + aiDashHtml).not.toContain(v);
		}
		expect(aiDashHtml).not.toContain('>إعادة تدريب</button>');
		expect(aiDashHtml).not.toContain('>تصدير تقرير</button>');
		expect(aiDashHtml).not.toContain('كل النماذج سليمة');
		expect(aiDashHtml).not.toContain('<button');
		expect(aiDashHtml).toContain('na-card');
	});

	it('Match engine: no invented scores, model name, training size, decisions or weight controls', () => {
		for (const v of ['94.8', 'Gradient Boosting', '2.4M', '97.2', 'نورة السهلي', 'أحمد الزهراني']) {
			expect(matchTs + matchHtml).not.toContain(v);
		}
		expect(matchHtml).not.toContain('ضبط الأوزان');
		expect(matchHtml).not.toContain('<button');
		expect(matchHtml).toContain('na-card');
	});

	it('AI audit: no invented KPIs, audit rows, or dead export/accuracy buttons', () => {
		for (const v of ['42k', '42M', '89.4%', 'T-9118', 'هيثم القرني', 'مخاطرة منخفضة']) {
			expect(aiAuditTs + aiAuditHtml).not.toContain(v);
		}
		expect(aiAuditHtml).not.toContain('تصدير Audit Log');
		expect(aiAuditHtml).not.toContain('<button');
		expect(aiAuditHtml).toContain('na-card');
	});
});

describe('AI Cleanup Batch 3 — withdrawal detail (financial decision screen)', () => {
	it('no hash-seeded AI risk recommendation / pseudo-random generator', () => {
		expect(wdDetailTs).not.toContain('hashSeed');
		expect(wdDetailTs).not.toContain('seededRandom');
		expect(wdDetailTs).not.toContain('riskInsights');
		expect(wdDetailTs).not.toContain('يُوصى بالموافقة');
		expect(wdDetailTs).not.toContain('لا نشاط مشبوه');
		expect(wdDetailHtml).not.toContain('riskInsights');
		expect(wdDetailHtml).not.toContain('wd-ai-panel');
		expect(wdDetailHtml).not.toContain('وسيط AI: تحليل الطلب');
	});

	it('no fabricated "IBAN verified" badge or invented balance-source project table', () => {
		expect(wdDetailTs).not.toContain('ibanVerified');
		expect(wdDetailHtml).not.toContain('IBAN محقق');
		expect(wdDetailTs).not.toContain('mockProjectPool');
		expect(wdDetailTs).not.toContain('balanceSource');
		expect(wdDetailHtml).not.toContain('مصدر الرصيد');
	});

	it('no local-only "request more information" action that toasted fake success', () => {
		expect(wdDetailTs).not.toContain('submitInfoRequest');
		expect(wdDetailTs).not.toContain('تم إرسال طلب المعلومات الإضافية');
		expect(wdDetailHtml).not.toContain('طلب معلومات إضافية');
	});

	it('available balance is not faked from the requested amount when the API omits it', () => {
		expect(wdDetailTs).not.toContain('w.availableBalance ?? (w.amount');
		expect(wdDetailTs).toContain('return w.availableBalance ?? null;');
	});

	it('real withdrawal data and real approve/reject controls are kept', () => {
		expect(wdDetailTs).toContain('this.withdrawalApi.getAdminWithdrawal(id)');
		expect(wdDetailTs).toContain('this.withdrawalApi.approveAdminWithdrawal(w.id, payload)');
		expect(wdDetailTs).toContain('this.withdrawalApi.rejectAdminWithdrawal(w.id, payload)');
		expect(wdDetailHtml).toContain(`(click)="openActionForm('approve')"`);
		expect(wdDetailHtml).toContain(`(click)="openActionForm('reject')"`);
		expect(wdDetailHtml).toContain('(click)="submitAction()"');
		expect(wdDetailHtml).toContain('formatAmount(w.amount, w.currency)');
		expect(wdDetailHtml).toContain('formatAmount(availableBalance(w), w.currency)');
		expect(wdDetailHtml).toContain('isLegacy(w)');
		expect(wdDetailHtml).toContain('w.paypalEmail');
		expect(wdDetailHtml).not.toMatch(/bankInfo|IBAN/);
		expect(wdDetailHtml).toContain('userDisplay(w)');
		expect(wdDetailHtml).toContain('timelineSteps(w)');
	});
});

describe('AI Cleanup Batch 3 — reports (fraud / moderation)', () => {
	it('the fabricated reports dataset is gone', () => {
		expect(existsSync(join(__dirname, SA + 'sa-reports/sa-reports.data.ts'))).toBe(false);
		expect(reportsTs).not.toContain('REPORTS');
		expect(reportDetailTs).not.toContain('REPORTS');
	});

	it('no AI fraud accusation, AI risk score, or AI-suggested punitive action', () => {
		for (const src of [reportsHtml, reportDetailHtml, reportsTs, reportDetailTs]) {
			expect(src).not.toContain('aiRiskScore');
			expect(src).not.toContain('aiSuggestion');
			expect(src).not.toContain('kpiAiDetected');
			expect(src).not.toContain('نمط احتيال محتمل');
			expect(src).not.toContain('AI اكتشف');
			expect(src).not.toContain('الإجراء المقترح');
			expect(src).not.toContain('درجة الخطورة');
		}
	});

	it('no local-only suspend / warn / dismiss actions that toasted fake success', () => {
		for (const src of [reportsTs, reportDetailTs]) {
			expect(src).not.toContain('suspendImmediately');
			expect(src).not.toContain('issueWarning');
			expect(src).not.toContain('تم تعليق الحساب');
		}
		expect(reportsHtml).toContain('na-card');
		expect(reportDetailHtml).toContain('na-card');
	});
});

describe('AI Cleanup Batch 3 — users AI risk', () => {
	it('users list: no "AI مخاطر" column, risk badge, or "Risk Score (AI)" filter', () => {
		expect(usersTs).not.toContain("'AI مخاطر'");
		expect(usersTs).not.toContain('selectedRiskLevel');
		expect(usersTs).not.toContain('setRiskFilter');
		expect(usersTs).not.toContain('riskLevel:');
		expect(usersHtml).not.toContain('Risk Score (AI)');
		expect(usersHtml).not.toContain('u.risk');
	});

	it('users service: risk fields are not typed for display', () => {
		expect(usersServiceTs).not.toMatch(/^\s*risk: string;/m);
		expect(usersServiceTs).not.toMatch(/^\s*aiRiskScore: number;/m);
		expect(usersServiceTs).not.toContain('riskBreakdown');
		expect(usersServiceTs).not.toContain('aiInsights');
		expect(usersServiceTs).not.toContain('riskLevel?');
	});

	it('user detail: no risk badge, risk-score breakdown, or AI account-analysis panel', () => {
		expect(userDetailHtml).not.toContain('u.risk');
		expect(userDetailHtml).not.toContain('Risk Score Breakdown');
		expect(userDetailHtml).not.toContain('u.aiInsights');
		expect(userDetailHtml).not.toContain('وسيط AI: تحليل الحساب');
		expect(userDetailTs).not.toContain('RL_MAP');
	});

	it('real user/account data and real admin controls are kept', () => {
		expect(usersTs).toContain('this.usersService.getUsers(params)');
		expect(usersHtml).toContain('(click)="toggleStatus(u)"');
		expect(usersHtml).toContain('(click)="openDeleteModal(u)"');
		expect(usersHtml).toContain(`setStatusFilter('SUSPENDED')`);
		expect(usersHtml).toContain(`setLastActiveFilter('ALL')`);
		expect(userDetailHtml).toContain('SL[u.statusOriginal]');
		expect(userDetailHtml).toContain('u.personalInfo.nationalIdVerified');
		expect(userDetailHtml).not.toMatch(/bankAccount|iban/i);
		expect(userDetailHtml).toContain('u.personalInfo.nationalIdVerified');
	});
});

describe('AI Cleanup Batch 3 — no random / fake-live metric refresh in super admin', () => {
	it('sa-servers: no Math.random jitter, fake refresh, or fake auto-refresh / live claims', () => {
		expect(serversTs).not.toContain('Math.random');
		expect(serversTs).not.toContain('refresh(');
		expect(serversHtml).not.toContain('refresh()');
		expect(serversHtml).not.toContain('تحديث تلقائي كل 30 ثانية');
		expect(serversHtml).not.toContain('99.98%');
		expect(serversHtml).not.toContain('في الوقت الفعلي');
		expect(serversHtml).toContain('na-card');
	});

	it('the Batch 3 screens contain no Math.random at all', () => {
		for (const src of [
			aiDashTs, matchTs, aiAuditTs, wdDetailTs, reportsTs, reportDetailTs, usersTs, userDetailTs, serversTs,
		]) {
			expect(src).not.toContain('Math.random');
		}
	});
});
