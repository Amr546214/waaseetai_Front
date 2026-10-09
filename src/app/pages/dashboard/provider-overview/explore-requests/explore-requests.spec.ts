import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { ExploreRequests } from './explore-requests';
import { ProviderApiService } from '../../../../core/services/provider-api.service';

// Batch 7 regression: this page previously showed a fully fictional
// "company mode" for PROVIDER_COMPANY accounts — a hardcoded team-member
// roster with fake per-member "AI match" percentages (companyTeamMembers:
// فهد العتيبي 94%, ريم الدوسري 78%, ...), fabricated tab counts
// (companyTabs: 47/34/9/4, unrelated to the real backend counts), and a
// static "47 طلب متاح — 91% متوسط تطابق الفريق" stats bar hardcoded
// directly in the template. There is no team-member/company-employee model
// anywhere in the backend, so none of it could ever be real. It has been
// removed entirely — company accounts now get the same real,
// fully-connected experience as individual providers.
describe('ExploreRequests', () => {
	function setup(responseData: any = { projects: [], counts: { all: 0, notApplied: 0, applied: 0, saved: 0 }, providerSpecialties: [] }) {
		const providerApiStub: Partial<ProviderApiService> = {
			getExploreRequests: () => of({ success: true, data: responseData }),
			toggleSaveRequest: () => of({ success: true, data: { isSaved: true, savedCount: 1 } }),
			analyzeProjectWithAi: () => of({ success: false }),
		};
		TestBed.configureTestingModule({
			imports: [ExploreRequests],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: providerApiStub },
			],
		});
		const fixture = TestBed.createComponent(ExploreRequests);
		fixture.detectChanges();
		return fixture;
	}

	it('has no fabricated company team-member roster or AI match percentages', () => {
		const fixture = setup();
		const component: any = fixture.componentInstance;
		expect(component.companyTeamMembers).toBeUndefined();
		expect(component.companyTabs).toBeUndefined();
		expect(component.isCompanyMode).toBeUndefined();
	});

	it('never renders the removed fictional company stats bar or fake candidate chips', () => {
		const fixture = setup({
			projects: [{ id: 'p1', title: 'مشروع', description: 'وصف', category: 'ويب', durationDays: 5, proposalsCount: 2, createdAtFormatted: 'اليوم', clientType: 'فرد', aiMatchScore: 90, isSaved: false, hasApplied: false }],
			counts: { all: 1, notApplied: 1, applied: 0, saved: 0 },
			providerSpecialties: [],
		});
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('مرشحو AI');
		expect(text).not.toContain('فهد العتيبي');
		expect(text).not.toContain('متوسط تطابق الفريق');
		expect(text).not.toContain('إدارة الإسناد');
		expect(text).not.toContain('لم يُسند');
	});

	// AI Cleanup Batch 5 — the per-card percentage was fabricated on the
	// backend (fixed base + hash of the request id). The card now shows no
	// percentage at all; only the real deterministic specialty-relevance
	// tier, as words. The user-triggered "تحليل AI" modal (a real Gemini
	// call) keeps its genuine matchPercent untouched.
	const baseProject = { title: 'مشروع', description: 'وصف', category: 'ويب', durationDays: 5, proposalsCount: 2, createdAtFormatted: 'اليوم', clientType: 'فرد', aiNote: 'ملاحظة', isSaved: false, hasApplied: false };

	it('Batch 5: renders no percentage on cards, even if a legacy aiMatchScore number were sent', () => {
		const fixture = setup({
			projects: [{ ...baseProject, id: 'p1', aiMatchScore: 91, specialtyRelevance: 'NONE' }],
			counts: { all: 1, notApplied: 1, applied: 0, saved: 0 }, providerSpecialties: [],
		});
		fixture.detectChanges();
		const card = (fixture.nativeElement as HTMLElement).querySelector('.req-card-ex') as HTMLElement;
		expect(card.textContent).not.toMatch(/\d+%/);
		expect(card.querySelector('.rc-ai-pct')).toBeNull();
		expect(card.querySelector('.rc-relevance')).toBeNull();
		expect((fixture.componentInstance as any).requests()[0].aiScore).toBeUndefined();
	});

	it('Batch 5: shows the real specialty-relevance tier in words, never as a percentage', () => {
		const fixture = setup({
			projects: [
				{ ...baseProject, id: 'p1', aiMatchScore: null, specialtyRelevance: 'REQUIREMENTS' },
				{ ...baseProject, id: 'p2', aiMatchScore: null, specialtyRelevance: 'SPECIALTY' },
			],
			counts: { all: 2, notApplied: 2, applied: 0, saved: 0 }, providerSpecialties: [],
		});
		fixture.detectChanges();
		const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.rc-relevance')).map(el => el.textContent?.trim());
		expect(labels).toEqual(['متطلباته تتقاطع مع تخصصاتك', 'ضمن تخصصاتك المسجلة']);
	});

	it('Batch 5: keeps the backend order exactly and makes no AI-ranking claim', () => {
		const fixture = setup({
			projects: [{ ...baseProject, id: 'b', title: 'ب' }, { ...baseProject, id: 'a', title: 'أ' }],
			counts: { all: 2, notApplied: 2, applied: 0, saved: 0 }, providerSpecialties: [],
		});
		fixture.detectChanges();
		const titles = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.rc-title')).map(el => el.textContent?.trim());
		expect(titles).toEqual(['ب', 'أ']);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('نظام الترتيب الذكي');
		expect(text).not.toContain('الأعلى تطابقاً');
		expect(text).toContain('دون');
	});

	const open = (res: any) => {
		const fixture = setup();
		const component: any = fixture.componentInstance;
		const api = TestBed.inject(ProviderApiService) as any;
		api.analyzeProjectWithAi = () => of(res);
		component.openAiAnalysis({ id: 'p1', title: 'مشروع', offersCount: 1 });
		fixture.detectChanges();
		return { fixture, component, text: (fixture.nativeElement as HTMLElement).textContent || '' };
	};

	it('project fit: real-shape success renders fit level, summary, matchPoints and gaps with no undefined', () => {
		const { text } = open({ success: true, data: { generationSource: 'LLM', insufficientData: false, inputsUsed: [], unavailableFields: [], analysis: {
			overallFit: 'HIGH', summary: 'ملخص حقيقي', matchPoints: [{ text: 'نقطة تطابق', basedOn: ['provider.skills'] }], gaps: [{ text: 'فجوة واحدة', basedOn: ['project.requirements'] }] } } });
		expect(text).toContain('ملاءمة عالية');
		expect(text).toContain('ملخص حقيقي');
		expect(text).toContain('نقطة تطابق');
		expect(text).toContain('فجوة واحدة');
		expect(text).not.toContain('undefined');
		expect(text).not.toContain('null');
		expect(text).not.toContain('%');
		expect(text).not.toContain('فرصة قوية');
		expect(text).not.toContain('استراتيجية الفوز');
	});

	it('project fit: insufficientData shows the honest empty state with no numbers', () => {
		const { component, text } = open({ success: true, data: { generationSource: null, insufficientData: true, analysis: null, inputsUsed: [], unavailableFields: [] } });
		expect(component.aiInsufficient()).toBe(true);
		expect(component.aiAnalysisData()).toBeNull();
		expect(text).toContain('لا تتوفر بيانات كافية');
		expect(text).not.toContain('undefined');
	});

	it('project fit: error response (503/NOT_CONFIGURED) shows the failure state with retry', () => {
		const { component, text } = open({ success: false });
		expect(component.aiUnavailable()).toBe(true);
		expect(text).toContain('تعذر إجراء التحليل');
		expect(text).toContain('إعادة المحاولة');
	});

	it('project fit: malformed success payload is treated as failure, not blanks', () => {
		const { component, text } = open({ success: true, data: { insufficientData: false, analysis: { overallFit: 'HIGH' } } });
		expect(component.aiUnavailable()).toBe(true);
		expect(text).not.toContain('undefined');
	});

	it('Batch 5: a failed AI analysis shows the honest unavailable state, never a fallback percentage', () => {
		const fixture = setup();
		const component: any = fixture.componentInstance;
		component.openAiAnalysis({ id: 'p1', title: 'مشروع', offersCount: 1 });
		fixture.detectChanges();
		expect(component.aiUnavailable()).toBe(true);
		expect(component.aiAnalysisData()).toBeNull();
	});
});
