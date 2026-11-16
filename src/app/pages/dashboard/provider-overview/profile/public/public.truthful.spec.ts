/// <reference types="node" />
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from './public';
import { AccountLogsService } from '../../../../../core/services/account-logs.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { SpecialtyService } from '../../../../../core/services/specialty.service';

// The provider's own public-profile page must show only what GET /provider/profile/public returns
// (backend provider-profile.service.ts getPublicProfile): no invented numbers, no static badges.
const html = readFileSync(join(__dirname, 'public.html'), 'utf-8');
const ts = readFileSync(join(__dirname, 'public.ts'), 'utf-8');

const spec = (o: any = {}) => ({
	id: 's1', specialtyName: 'تطوير الويب', status: 'APPROVED', isPassed: true, hasTakenAssessment: true, latestScore: 80,
	subSpecialties: ['Angular'], aiMetrics: { aiScore: 0, feasibilityScore: 0, clarityScore: 0 },
	assessmentDetails: { totalQuestions: 20, timeTakenMinutes: 15, score: 80, feedbackAr: '', strengths: [], weaknesses: [], completedAt: null },
	samples: [], ...o,
});
const data = (o: any = {}) => ({
	header: { fullName: 'مزود اختبار', isVerified: false, levelInfo: { levelName: 'منجز', points: 60, completionPercentage: 40, missingHint: 'x' }, stats: { completedProjects: 0, publishedServices: 0, clientRating: 0 } },
	basicInfo: { headline: '', bio: '' }, specialties: [], services: [], skills: [], aiMetrics: { averageTestScore: 0, codeMatchingIndex: 0 }, ...o,
});

let logsResponse: any = { success: true, data: { items: [] } };
async function render(d: any, company = false) {
	await TestBed.configureTestingModule({
		imports: [Public],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { currentUser: () => (company ? { accountType: 'PROVIDER_COMPANY', firstName: 'ش', lastName: 'ك' } : null) } },
			{ provide: SpecialtyService, useValue: { getPublicSpecialties: () => of({ success: true, data: [{ id: 'sp1', nameAr: 'أنظمة الويب' }] }) } },
			{ provide: AccountLogsService, useValue: { getUserLogs: () => (logsResponse instanceof Error ? throwError(() => logsResponse) : of(logsResponse)) } },
			{ provide: ProviderProfileService, useValue: { getPublicProfile: () => of({ success: true, data: d }) } }],
	}).compileComponents();
	const f = TestBed.createComponent(Public);
	f.detectChanges();
	return f;
}
const text = (f: any) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

describe('provider public profile shows only real data', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('template no longer contains invented fallbacks, static badges or unproven claims', () => {
		for (const banned of ['|| 6 ', '|| 12 ', '|| 47', '|| 98', '|| 8 ', 'Tier A', 'مطابق بنسبة 100%', 'مفحوصة الأكواد', 'سرعة دقيقة',
			'موثّقة ومعتمدة', 'موثّق\n\t\t\t\t\t\t\tبالذكاء', 'تخصص معتمد ومفحوص بالذكاء الاصطناعي', 'يُحلّل الذكاء اكتمال', 'نظام إدارة المخزون السحابي', 'فهد العتيبي', 'AI Accredited Code Samples'])
			expect(html, banned).not.toContain(banned);
		expect(html).not.toMatch(/stats\?\.(approvedSpecialties|approvedModels|completionRate|teamMembers|rating)/);
	});

	it('individual mode: no company wording anywhere (tab, about heading, activity), and no invented activity rows', async () => {
		const f = await render(data({ basicInfo: { headline: '', bio: 'مطور واجهات' } }));
		f.detectChanges();
		let t = text(f);
		expect(t).toContain('بيانات المقدم');
		expect(t).toContain('نبذة مهنية');
		expect(t).not.toMatch(/شركة|الشركة|شركات|الشركات/);
		f.componentInstance.setTab('activity');
		f.detectChanges();
		t = text(f);
		expect(t).toContain('لا توجد بيانات بعد');
		expect(t).not.toMatch(/شركة|الشركة|B2B|تطوير تطبيق إدارة مشاريع/);
	});

	it('individual mode, empty data: real zeros / honest placeholders, no invented values', async () => {
		const f = await render(data({ specialties: [spec({ status: 'PENDING_TEST', isPassed: false, assessmentDetails: null })] }));
		f.componentInstance.setTab('skills');
		f.detectChanges();
		const t = text(f);
		expect(t).toContain('0 تخصص معتمد');
		expect(t).toContain('بانتظار إجراء الاختبار');
		expect(t).not.toContain('مفحوص بالذكاء');
	});

	it('approved specialty: honest status label, level from the profile, stored AI score only when > 0, no fake scorecard values', async () => {
		const f = await render(data({ specialties: [spec()] }));
		f.componentInstance.setTab('skills');
		f.detectChanges();
		let t = text(f);
		expect(t).toContain('1 تخصص معتمد');
		expect(t).toContain('موثّق باختبار AI');
		expect(t).toContain('تخصص معتمد · اجتاز اختبار AI');
		expect(t).not.toContain('اجتاز اختبار التخصص');
		expect(t).toContain('مستوى المقدّم');
		expect(t).toContain('منجز');
		expect(t).toContain('لم يُجرَ تدقيق بعد');
		expect(t).toContain('لا يوجد تقييم بعد');
		expect(t).not.toContain('Tier A');
		expect(t).not.toContain('تقييم AI 0%');
		f.componentInstance.profileData.set(data({ specialties: [spec({ aiMetrics: { aiScore: 77 }, assessmentDetails: { totalQuestions: 20, timeTakenMinutes: 15, score: 80, feedbackAr: 'تقييم حقيقي', strengths: [], weaknesses: [] } })] }));
		f.detectChanges();
		t = text(f);
		expect(t).toContain('تقييم AI 77%');
		expect(t).toContain('مُقيَّم بدرجة 77%');
		expect(t).toContain('تقييم حقيقي');
	});

	it('work samples: "تقييم AI N%" only for aiScore > 0, otherwise "لم يُقيَّم بعد"; heading no longer claims code scanning', async () => {
		const sample = (o: any) => ({ id: 'a', title: 'نموذج', description: 'د', technologiesUsed: [], imageUrl: null, aiScore: 0, aiQualityRating: 'PENDING', aiFeedbackAr: '', ...o });
		const f = await render(data({ specialties: [spec({ samples: [sample({ id: 'a', title: 'بلا تقييم' }), sample({ id: 'b', title: 'بتقييم', aiScore: 88, aiFeedbackAr: 'ملاحظة' })] })] }));
		f.componentInstance.setTab('skills');
		f.detectChanges();
		const t = text(f);
		expect(t).toContain('نماذج الأعمال المعتمدة');
		expect(t).not.toContain('مفحوصة الأكواد');
		expect(t).toContain('لم يُقيَّم بعد');
		expect(t).toContain('تقييم AI 88%');
		expect(t).toContain('ملاحظة');
		expect(t).not.toContain('تقييم AI 0%');
	});

	it('company mode: real header stats, real specialties/services, "لا توجد بيانات بعد" instead of demo rows', async () => {
		const f = await render(data({ header: { fullName: 'شركة حقيقية', isVerified: true, levelInfo: { levelName: 'محترف' }, stats: { completedProjects: 3, publishedServices: 2, clientRating: 91, reviewsCount: 5 } }, specialties: [spec({ specialtyName: 'الجوال' })], services: [{ id: 'm1', title: 'خدمتي', specialtyId: 'sp1', status: 'PUBLISHED', salesCount: 4 }, { id: 'm2', title: 'خدمة بلا تخصص', specialtyId: 'unknown', status: 'PUBLISHED', salesCount: 0 }] }), true);
		let t = text(f);
		expect(t).toContain('شركة حقيقية');
		expect(t).toContain('3 مشروع مكتمل');
		expect(t).toContain('91%');
		expect(t).toContain('الجوال');
		expect(t).toContain('خدمتي');
		expect(t).toContain('منشور');
		expect(t).toContain('أنظمة الويب');
		for (const demo of ['47', 'نظام إدارة المخزون السحابي', 'فهد العتيبي', 'تطوير تطبيقات الجوال', '4.7']) expect(t, demo).not.toContain(demo);
		f.componentInstance.profileData.set(data({}));
		f.detectChanges();
		t = text(f);
		expect(t).toContain('لا توجد بيانات بعد');
		expect(t).toContain('لم يكتمل التوثيق بعد');
		expect(t).not.toContain('موثّقة ومعتمدة');
	});

	it('company/individual attribution helpers live in the component (no AI attribution for APPROVED)', () => {
		expect(ts).toContain("case 'APPROVED'");
		expect(ts).not.toMatch(/بالذكاء/);
	});

	it('a specialty whose test was not taken shows NO score and NO tick (not 0% and a check mark), and says so', async () => {
		const f = await render(data({ specialties: [spec({ status: 'PENDING_PROOF', isPassed: false, hasTakenAssessment: false, latestScore: null, assessmentDetails: null })] }));
		f.componentInstance.setTab('skills');
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="spec-score"]')).toBeNull();
		expect(el.querySelector('[data-testid="spec-passed-tick"]')).toBeNull();
		expect(el.querySelector('[data-testid="spec-score-none"]')?.textContent).toContain('لم تُجرِ الاختبار بعد');
		expect(el.querySelector('[data-testid="spec-status-label"]')?.textContent).toContain('لم تُجرِ الاختبار بعد');
		expect(el.querySelector('[data-testid="spec-score-box"]')?.textContent).not.toContain('0%');
	});

	it('a passed and scored specialty keeps its real score and the tick; a failed score shows without the tick', async () => {
		let f = await render(data({ specialties: [spec({ latestScore: 80, isPassed: true, hasTakenAssessment: true })] }));
		f.componentInstance.setTab('skills');
		f.detectChanges();
		let el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="spec-score"]')?.textContent).toContain('80%');
		expect(el.querySelector('[data-testid="spec-passed-tick"]')).toBeTruthy();
		TestBed.resetTestingModule();
		f = await render(data({ specialties: [spec({ status: 'REJECTED', latestScore: 20, isPassed: false, hasTakenAssessment: true, assessmentDetails: null })] }));
		f.componentInstance.setTab('skills');
		f.detectChanges();
		el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="spec-score"]')?.textContent).toContain('20%');
		expect(el.querySelector('[data-testid="spec-passed-tick"]')).toBeNull();
	});

	it('activity tab: the real log entries are listed (with a link to the full log); empty and error are honest', async () => {
		logsResponse = { success: true, data: { items: [{ id: 'l1', title: 'تحديث الملف', summary: 'تم تحديث بيانات الملف', statusText: 'مكتمل', createdAt: '2026-11-15T10:30:00Z' }] } };
		let f = await render(data());
		f.componentInstance.setTab('activity'); f.detectChanges();
		let el = f.nativeElement as HTMLElement;
		expect(el.querySelectorAll('[data-testid="activity-row"]').length).toBe(1);
		expect(el.querySelector('[data-testid="activity-row"]')?.textContent).toContain('تم تحديث بيانات الملف');
		expect(el.querySelector('[data-testid="activity-all"]')?.getAttribute('href')).toBe('/provider-overview/profile/logs');
		TestBed.resetTestingModule();
		logsResponse = new Error('x');
		f = await render(data());
		f.componentInstance.setTab('activity'); f.detectChanges();
		el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="activity-error"]')).toBeTruthy();
		expect(el.querySelector('[data-testid="activity-empty"]')).toBeNull();
		logsResponse = { success: true, data: { items: [] } };
	});

	it('links tab: a button takes the provider straight to the page where the links are added', async () => {
		let f = await render(data());
		f.componentInstance.setTab('links'); f.detectChanges();
		let btn = (f.nativeElement as HTMLElement).querySelector('[data-testid="add-links-btn"]') as HTMLAnchorElement;
		expect(btn.getAttribute('href')).toBe('/provider-overview/profile/data');
		expect(btn.textContent).toContain('أضف روابطك');
		TestBed.resetTestingModule();
		f = await render(data({ socialLinks: { website: 'https://x.dev', linkedin: null, github: null } }));
		f.componentInstance.setTab('links'); f.detectChanges();
		btn = (f.nativeElement as HTMLElement).querySelector('[data-testid="add-links-btn"]') as HTMLAnchorElement;
		expect(btn.textContent).toContain('تعديل الروابط');
	});
});
