import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CreateRequest, resetCreateRequestPageLoadState } from './clients-overview/create-request/create-request';
import { ApplayRequest } from './provider-overview/explore-requests/applay-request/applay-request';
import { ProjectApiService } from '../../core/services/project-api.service';
import { ProviderApiService } from '../../core/services/provider-api.service';
import { resolveCompatibleTtsVoice } from '../../core/services/assistant-tts.service';

describe('QA Round 2 Frontend Fixes', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
	});

	it('CreateRequest.triggerAiBudgetSuggest updates Step 4 budget & 100% milestones without altering Step 3 text fields', async () => {
		sessionStorage.clear();
		resetCreateRequestPageLoadState();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });

		const getAiBudgetSuggestion = vi.fn().mockReturnValue(
			of({
				success: true,
				data: {
					minBudget: 1200,
					maxBudget: 2400,
					expectedDurationDays: 21,
					milestones: [
						{ name: 'تحليل وتصميم قاعدة البيانات', pct: 30, days: 6, desc: 'تصميم الجداول' },
						{ name: 'بناء الواجهة الخلفية والربط', pct: 45, days: 9, desc: 'تطوير APIs' },
						{ name: 'الاختبار والتسليم النهائي', pct: 25, days: 6, desc: 'فحص شامل' },
					],
				},
			}),
		);

		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [
				provideRouter([]),
				{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: false }) } },
			],
		}).compileComponents();

		const projectApi = TestBed.inject(ProjectApiService);
		const spy = vi.spyOn(projectApi, 'getAiBudgetSuggestion').mockImplementation(getAiBudgetSuggestion);

		const fixture = TestBed.createComponent(CreateRequest);
		await fixture.whenStable();
		const c = fixture.componentInstance;

		c.setTitle('بناء منصة تجارة إلكترونية مخصصة');
		c.setDescription('أحتاج إلى تطوير متجر إلكتروني يدعم بوابات الدفع وإدارة المخزون وتقارير المبيعات التفصيلية.');
		c.setRequiredSkills(['Node.js', 'Angular']);
		c.requirements.set(['تسليم الكود المصدري كاملًا']);
		c.outputs.set('لوحة تحكم ومتجر متجاوب');

		c.triggerAiBudgetSuggest();

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0]).toMatchObject({ skills: ['Node.js', 'Angular'] });
		expect(spy.mock.calls[0][0]).not.toHaveProperty('requiredSkills');
		expect(c.deliveryDays()).toBe(21);
		// Step 3 fields remain untouched
		expect(c.title()).toBe('بناء منصة تجارة إلكترونية مخصصة');
		expect(c.description()).toBe('أحتاج إلى تطوير متجر إلكتروني يدعم بوابات الدفع وإدارة المخزون وتقارير المبيعات التفصيلية.');
		expect(c.requiredSkills()).toEqual(['Node.js', 'Angular']);
		expect(c.requirements()).toEqual(['تسليم الكود المصدري كاملًا']);
		expect(c.outputs()).toBe('لوحة تحكم ومتجر متجاوب');

		// Step 4 budget & milestones updated cleanly to 100%
		expect(c.budgetMin()).toBe(1200);
		expect(c.budgetMax()).toBe(2400);
		expect(c.splitMilestones()).toBe(true);
		expect(c.milestoneTotalPct).toBe(100);
		expect(c.milestones().length).toBe(3);
	});

	it('ApplayRequest.useAISuggest refines user draft text without overwriting totalBudget or milestones', async () => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });

		const postMock = vi.fn().mockReturnValue(
			of({
				success: true,
				data: {
					suggestedTitle: 'عرض تنفيذ متجر إلكتروني متكامل بأعلى معايير الأداء',
					suggestedMessage: 'تحية طيبة، يسعدني تنفيذ متجرك الإلكتروني بخبرة عملية في بناء المتاجر وربط بوابات الدفع.',
					suggestedAdvantages: ['تسليم الكود المصدري مع توثيق كامل'],
					suggestedOutputs: 'متجر متجاوب ولوحة إدارة متكاملة',
					suggestedTotalPrice: 9999,
					suggestedMilestones: [{ name: 'مرحلة مقترحة خارجية', pct: 100, days: 30, desc: 'وصف' }],
				},
			}),
		);

		await TestBed.configureTestingModule({
			imports: [ApplayRequest],
			providers: [
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							paramMap: { get: (k: string) => (k === 'id' ? 'proj-123' : null) },
							queryParamMap: { get: () => null },
						},
					},
				},
				{
					provide: HttpClient,
					useValue: {
						get: () => of({ data: { id: 'proj-123', title: 'متجر إلكتروني', budgetMin: 1000, budgetMax: 2000, deliveryDays: 10 } }),
						post: postMock,
					},
				},
				{ provide: ProviderApiService, useValue: { getAccreditationSamples: () => of({ samples: [] }) } },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(ApplayRequest);
		await fixture.whenStable();
		const comp = fixture.componentInstance;

		const customMilestones = [
			{ id: '1', name: 'المرحلة الأولى الخاصة بالمزود', days: 4, desc: 'تحليل وتصميم', pct: 40 },
			{ id: '2', name: 'المرحلة الثانية الخاصة بالمزود', days: 6, desc: 'تنفيذ وتسليم', pct: 60 },
		];
		comp.totalBudget.set(1500);
		comp.proposal.set({
			title: 'عرض لتنفيذ المتجر',
			message: 'أستطيع تنفيذ المتجر المطلوب بدقة عالية وخبرة سابقة في المتاجر المشابهة.',
			advantages: [],
			outputs: 'متجر إلكتروني جاهز',
			portfolioIds: [],
			milestones: customMilestones,
		});

		comp.useAISuggest();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(comp.proposal().title).toContain('عرض تنفيذ متجر إلكتروني متكامل');
		expect(comp.proposal().message).toContain('يسعدني تنفيذ متجرك الإلكتروني');
		// Price and provider milestones stay untouched
		expect(comp.totalBudget()).toBe(1500);
		expect(comp.proposal().milestones).toEqual(customMilestones);
	});

	it('resolveCompatibleTtsVoice normalizes unsupported Arabic Gemini voices while keeping Kore/Puck intact', () => {
		expect(resolveCompatibleTtsVoice('Callirrhoe', 'أهلًا بك في منصة وسيط', 'saudi')).toBe('Kore');
		expect(resolveCompatibleTtsVoice('Leda', 'مرحبًا كيف أساعدك', 'msa')).toBe('Kore');
		expect(resolveCompatibleTtsVoice('Zephyr', 'أهلًا يا صديقي', 'egyptian')).toBe('Puck');
		expect(resolveCompatibleTtsVoice('Orus', 'تم تحديث طلبك بنجاح', 'saudi')).toBe('Puck');
		expect(resolveCompatibleTtsVoice('Kore', 'مرحبا', 'saudi')).toBe('Kore');
		expect(resolveCompatibleTtsVoice('Puck', 'مرحبا', 'egyptian')).toBe('Puck');
		expect(resolveCompatibleTtsVoice('Callirrhoe', 'Welcome to Waseet AI', 'english')).toBe('Callirrhoe');
	});
});
