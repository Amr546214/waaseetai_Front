import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RequestDetails } from './request-details';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ChatService } from '../../../../../core/services/chat.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const lastToast = () => TestBed.inject(UiNotificationService).toasts().at(-1)?.message ?? '';

function makeOffer(overrides: Partial<any> = {}): any {
	return {
		id: overrides['id'] ?? 'o1',
		status: 'PENDING',
		providerName: overrides['providerName'] ?? 'مقدم الخدمة',
		providerInitials: 'مخ',
		providerLevel: 'مستوى 3',
		levelColor: '#2BD4C7',
		specialty: 'تطوير',
		projectsCount: 4,
		rating: null,
		matchScore: null,
		price: '1,000 $',
		duration: '5 أيام',
		description: 'وصف العرض',
		plan: 'خطة العمل',
		files: [],
		aiAnalysis: {
			fairPrice: null,
			priceNote: null,
			priceNoteType: 'fair',
			fairDuration: null,
			durationNote: null,
			durationNoteType: 'fair',
			verdict: null,
			verdictType: 'fair'
		},
		...overrides
	};
}

describe('RequestDetails — Compare Offers', () => {
	let component: RequestDetails;
	let fixture: ComponentFixture<RequestDetails>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RequestDetails],
			providers: [
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
				{ provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
				{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: false }) } },
				{ provide: ThemeService, useValue: { theme: () => 'dark' } },
				{ provide: ChatService, useValue: {} }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(RequestDetails);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('hides the compare button when there are 0 offers', async () => {
		component.offers.set([]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).not.toContain('مقارنة العروض');
	});

	it('hides the compare button when there is only 1 offer', async () => {
		component.offers.set([makeOffer({ id: 'o1' })]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).not.toContain('مقارنة العروض');
	});

	it('shows the compare button when there are 2 or more offers', async () => {
		component.offers.set([makeOffer({ id: 'o1' }), makeOffer({ id: 'o2', providerName: 'مقدم 2' })]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('مقارنة العروض');
	});

	it('does not enter compare mode selection state until toggled', () => {
		expect(component.isCompareMode()).toBe(false);
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('toggleCompare flips compare mode and clears selection on exit', () => {
		component.toggleCompare();
		expect(component.isCompareMode()).toBe(true);

		component.selectedForCompare.set(['مقدم 1']);
		component.toggleCompare();
		expect(component.isCompareMode()).toBe(false);
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('cannot select offers while compare mode is off', () => {
		component.toggleSelectOffer('مقدم 1');
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('toggles offer selection on and off while in compare mode', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		expect(component.selectedForCompare()).toEqual(['مقدم 1']);

		component.toggleSelectOffer('مقدم 1');
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('enforces a maximum of 3 selected offers', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.toggleSelectOffer('مقدم 2');
		component.toggleSelectOffer('مقدم 3');
		component.toggleSelectOffer('مقدم 4');

		expect(component.selectedForCompare()).toEqual(['مقدم 1', 'مقدم 2', 'مقدم 3']);
		expect(component.selectedForCompare().length).toBe(3);
	});

	it('confirmCompare requires at least 2 selected offers before opening the comparison view', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.confirmCompare();
		expect(component.showComparisonView()).toBe(false);

		component.toggleSelectOffer('مقدم 2');
		component.confirmCompare();
		expect(component.showComparisonView()).toBe(true);
	});

	it('closeComparisonView hides the comparison view', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.toggleSelectOffer('مقدم 2');
		component.confirmCompare();
		expect(component.showComparisonView()).toBe(true);

		component.closeComparisonView();
		expect(component.showComparisonView()).toBe(false);
	});

	it('cancelCompare exits compare mode and clears the selection', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.cancelCompare();
		expect(component.isCompareMode()).toBe(false);
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('comparisonOffers derives only the selected offers, in the same shape as offers()', () => {
		const offerA = makeOffer({ id: 'a', providerName: 'مقدم أ' });
		const offerB = makeOffer({ id: 'b', providerName: 'مقدم ب' });
		const offerC = makeOffer({ id: 'c', providerName: 'مقدم ج' });
		component.offers.set([offerA, offerB, offerC]);

		component.toggleCompare();
		component.toggleSelectOffer('مقدم أ');
		component.toggleSelectOffer('مقدم ج');

		const result = component.comparisonOffers();
		expect(result.map(o => o.id)).toEqual(['a', 'c']);
	});

	it('renders "غير متاح" instead of a fabricated value for null rating, matchScore and AI analysis fields', async () => {
		const offerA = makeOffer({ id: 'a', providerName: 'مقدم أ' });
		const offerB = makeOffer({ id: 'b', providerName: 'مقدم ب' });
		component.offers.set([offerA, offerB]);
		component.selectedForCompare.set(['مقدم أ', 'مقدم ب']);
		component.showComparisonView.set(true);
		fixture.detectChanges();
		await fixture.whenStable();

		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('غير متاح');
		expect(html).not.toContain('null%');
		expect(html).not.toContain('دقة 95%');
	});

	it('never displays a hardcoded fake AI confidence score', async () => {
		const offerA = makeOffer({ id: 'a', providerName: 'مقدم أ', matchScore: 42 });
		const offerB = makeOffer({ id: 'b', providerName: 'مقدم ب' });
		component.offers.set([offerA, offerB]);
		fixture.detectChanges();
		await fixture.whenStable();

		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('42%');
		expect(html).not.toContain('85%');
		expect(html).not.toContain('95%');
	});
	it('shows stored text-quality review separately from profile fit and constraints', async () => {
		const offer = makeOffer({
			aiAnalysis: { ...makeOffer().aiAnalysis, qualityTag: 'قوي', qualitySummary: 'عرض قوي بخطة واضحة على ثلاث مراحل.' }
		});
		component.offers.set([offer]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('تقييم جودة العرض');
		expect(html).toContain('عرض قوي بخطة واضحة على ثلاث مراحل.');
		expect(html).toContain('تقييم جودة النص مستقل عن ملاءمة الملف للطلب');
		// No fabricated fairness rows for a proposal that carries no such judgement.
		expect(html).not.toContain('السعر العادل');
		expect(html).not.toContain('المدة العادلة');
	});

	it('shows no quality review block (and no fairness placeholders) when nothing was evaluated', async () => {
		component.offers.set([makeOffer()]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).not.toContain('تقييم جودة العرض');
		expect(html).not.toContain('السعر العادل');
	});

	it('still shows the price/duration fairness rows for older proposals that stored them', async () => {
		const offer = makeOffer({ aiAnalysis: { ...makeOffer().aiAnalysis, fairPrice: '900 - 1200 $', priceNote: 'ضمن النطاق' } });
		component.offers.set([offer]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('السعر العادل');
		expect(html).toContain('900 - 1200 $');
	});

	it('translates known quality tags and leaves unknown ones as received', () => {
		expect(component.qualityTagAr('Strong')).toBe('قوي');
		expect(component.qualityTagAr('excellent')).toBe('ممتاز');
		expect(component.qualityTagAr('Mystery')).toBe('Mystery');
		expect(component.qualityTagAr(null)).toBeNull();
	});

});

// Batch 5 (truthfulness pass) — request-details used to read the
// accreditation `badge` field (`isAccredited ? 'معتمد' : 'محترف'` — note
// 'محترف' collides with a REAL gamification level title) into
// `providerLevel`, and derived `levelColor` from `badge === 'خبير'` (always
// false in practice, since badge is never 'خبير'). The backend
// (client-requests.service.ts::getRequestDetails) now returns a real
// `providerLevel` resolved via resolveProviderProgression(), and the
// frontend no longer reads `.badge` for level purposes at all.
function proposalFixture(overrides: Partial<{ id: string; providerName: string; providerLevel: string | null; badge: string }> = {}) {
	return {
		id: overrides.id ?? 'prop-1',
		status: 'SUBMITTED',
		totalPrice: 500,
		deliveryDays: 5,
		provider: {
			id: 'provider-1',
			name: overrides.providerName ?? 'مقدم الخدمة',
			badge: overrides.badge ?? 'معتمد',
			providerLevel: overrides.providerLevel === undefined ? 'خبير' : overrides.providerLevel,
			completedProjects: 10,
			rating: 4.5,
		},
	};
}

describe('RequestDetails — real provider level vs accreditation badge (Batch 5)', () => {
	async function setupWithProposals(proposals: ReturnType<typeof proposalFixture>[]) {
		const httpGetMock = () => of({ success: true, data: { status: 'OPEN', proposals } });
		await TestBed.configureTestingModule({
			imports: [RequestDetails],
			providers: [
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'req-1' } } } },
				{ provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
				{ provide: HttpClient, useValue: { get: httpGetMock, post: () => of({ success: false }) } },
				{ provide: ThemeService, useValue: { theme: () => 'dark' } },
				{ provide: ChatService, useValue: {} },
			],
		}).compileComponents();
		const fixture: ComponentFixture<RequestDetails> = TestBed.createComponent(RequestDetails);
		const component = fixture.componentInstance;
		component.fetchRequestDetails('req-1');
		fixture.detectChanges();
		return { fixture, component };
	}

	it('1) maps the real providerLevel field from the backend proposal, not the accreditation badge', async () => {
		const { component } = await setupWithProposals([proposalFixture({ providerLevel: 'خبير', badge: 'معتمد' })]);
		expect(component.offers()[0].providerLevel).toBe('خبير');
	});

	it('2) provider.badge cannot drive the displayed providerLevel text, even when badge looks like a level title', async () => {
		// badge intentionally set to 'محترف' — a REAL level title string — to
		// prove it is never read into providerLevel regardless of collision.
		const { component } = await setupWithProposals([proposalFixture({ providerLevel: 'خبير', badge: 'محترف' })]);
		expect(component.offers()[0].providerLevel).toBe('خبير');
		expect(component.offers()[0].providerLevel).not.toBe('محترف');
	});

	it('3) provider.badge cannot drive levelColor — a null providerLevel never produces the old badge===\'خبير\' green, it uses the canonical neutral default', async () => {
		const { component } = await setupWithProposals([proposalFixture({ providerLevel: null, badge: 'خبير' })]);
		// Old broken logic: `badge === 'خبير' ? '#2ECC8A' : '#0EA5E9'` — badge
		// here IS 'خبير', so the old code would have produced '#2ECC8A'. The
		// real fix must ignore badge entirely and fall back to the shared
		// helper's neutral default for a null level.
		expect(component.offers()[0].levelColor).toBe('#2BD4C7');
		expect(component.offers()[0].levelColor).not.toBe('#2ECC8A');
	});

	it('4) a null providerLevel does not fabricate a level — no level badge span renders', async () => {
		const { fixture } = await setupWithProposals([proposalFixture({ providerLevel: null })]);
		const host = fixture.nativeElement as HTMLElement;
		expect(host.querySelector('.v1-nm ws-level-badge')).toBeNull();
	});

	it('5) a real providerLevel renders through the shared level badge', async () => {
		const { fixture, component } = await setupWithProposals([proposalFixture({ providerLevel: 'خبير' })]);
		expect(component.offers()[0].levelColor).toBe('#070D24');
		const badge = (fixture.nativeElement as HTMLElement).querySelector('.v1-nm ws-level-badge') as HTMLElement;
		expect(badge?.textContent?.trim()).toContain('خبير');
	});

	it('6) accreditation data (badge) is not surfaced as, or confused with, provider level anywhere in the mapped offer', async () => {
		const { component } = await setupWithProposals([proposalFixture({ providerLevel: 'أخصائي', badge: 'معتمد' })]);
		const offer = component.offers()[0] as any;
		expect(offer.providerLevel).toBe('أخصائي');
		expect(offer.badge).toBeUndefined();
		expect(Object.values(offer)).not.toContain('معتمد');
	});

	it('7) existing request-details behavior (offer mapping for price/status) is preserved alongside the level fix', async () => {
		const { component } = await setupWithProposals([proposalFixture({ id: 'prop-9', providerName: 'شركة التطوير' })]);
		const offer = component.offers()[0];
		expect(offer.id).toBe('prop-9');
		expect(offer.providerName).toBe('شركة التطوير');
		expect(offer.status).toBe('SUBMITTED');
		expect(offer.price).toBe('500 $');
	});
});

// AI Cleanup Batch 5 — the backend returns proposals createdAt desc
// (client-requests.service.ts getRequestDetails) and this page never re-sorts
// them, so it must not claim the list is AI-ranked. The per-offer score is
// the stored proposal score (Gemini proposal-quality blended with price
// closeness), labeled "تقييم العرض" rather than an AI "match"/"best fit".
describe('RequestDetails — offer ordering & score labels (AI Cleanup Batch 5)', () => {
	function scoredProposal(id: string, aiMatchScore: number | null, createdAt: string) {
		return { ...proposalFixture({ id, providerName: `مقدم ${id}` }), aiMatchScore, createdAt };
	}

	async function setup(proposals: any[]) {
		await TestBed.configureTestingModule({
			imports: [RequestDetails],
			providers: [
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'req-1' } } } },
				{ provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
				{ provide: HttpClient, useValue: { get: () => of({ success: true, data: { status: 'OPEN', proposals } }), post: () => of({ success: false }) } },
				{ provide: ThemeService, useValue: { theme: () => 'dark' } },
				{ provide: ChatService, useValue: {} },
			],
		}).compileComponents();
		const fixture: ComponentFixture<RequestDetails> = TestBed.createComponent(RequestDetails);
		fixture.componentInstance.fetchRequestDetails('req-1');
		fixture.detectChanges();
		await fixture.whenStable();
		return fixture;
	}

	it('keeps the backend (newest-first) order exactly — a higher score never moves an offer up', async () => {
		const fixture = await setup([
			scoredProposal('newest', 40, '2026-03-01T00:00:00Z'),
			scoredProposal('middle', 99, '2026-02-01T00:00:00Z'),
			scoredProposal('oldest', null, '2026-01-01T00:00:00Z'),
		]);
		expect(fixture.componentInstance.offers().map(o => o.id)).toEqual(['newest', 'middle', 'oldest']);
	});

	it('no longer claims the offers are ranked by AI, and states the real order', async () => {
		const fixture = await setup([scoredProposal('a', 95, '2026-01-01T00:00:00Z'), scoredProposal('b', 50, '2026-01-01T00:00:00Z')]);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('مرتبة بتطابق الذكاء');
		expect(text).not.toContain('AI رتب العروض');
		expect(text).not.toContain('الأنسب لمشروعك');
		expect(text).toContain('مرتبة من الأحدث');
	});

	it('renders the real score as "تقييم العرض" and no percentage when there is none', async () => {
		const fixture = await setup([scoredProposal('a', 73, '2026-01-01T00:00:00Z'), scoredProposal('b', null, '2026-01-01T00:00:00Z')]);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('تقييم سابق 73%');
		expect(text).toContain('جودة النص غير متاحة');
		expect(text).not.toContain('null%');
	});
});

describe('RequestDetails — stored suitability and independent comparison fields', () => {
	const fit = { source: 'LLM', overallFit: 'HIGH', summary: 'خبرة المقدم والعرض يغطيان متجر الملابس المطلوب.', matchPoints: [{ text: 'خبرة موثقة في تطوير المتاجر.', basedOn: ['provider.specialties', 'project.description'] }], gaps: [{ text: 'لم يوضح طريقة اختبار الدفع.', basedOn: ['proposal.message'] }] };
	async function setup(proposals: any[], description = '### المتطلبات\n**متجر ملابس**\n- إدارة المخزون') {
		const get = vi.fn(() => of({ success: true, data: { status: 'OPEN', description, proposals } }));
		const post = vi.fn(() => of({ success: false }));
		await TestBed.configureTestingModule({ imports: [RequestDetails], providers: [
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
			{ provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
			{ provide: HttpClient, useValue: { get, post } },
			{ provide: ThemeService, useValue: { theme: () => 'dark' } },
			{ provide: ChatService, useValue: {} },
		] }).compileComponents();
		const fixture = TestBed.createComponent(RequestDetails), component = fixture.componentInstance;
		component.fetchRequestDetails('req-1'); fixture.detectChanges(); await fixture.whenStable();
		return { fixture, component, get, post };
	}

	it('maps profile fit, pure quality and constraints independently; never promotes a high legacy blended score', async () => {
		const { fixture, component } = await setup([{ ...proposalFixture(), aiProviderFit: fit, aiQualityScore: 78, aiMatchScore: 96, aiRecommendationRank: 1,
			budgetSuitability: { status: 'BELOW_RANGE', summary: 'أقل من الحد المذكور؛ راجع شمول المتطلبات.' }, deadlineSuitability: { status: 'EXCEEDS_DEADLINE', summary: 'أطول من الموعد المطلوب.' }, aiRecommendationBasis: ['خبرة ملائمة للطلب', 'راجع الموعد قبل الاتفاق'] }]);
		const offer = component.offers()[0];
		expect(offer.qualityScore).toBe(78); expect(offer.providerFit?.overallFit).toBe('HIGH'); expect(offer.recommendationRank).toBe(1);
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('جودة النص 78/100'); expect(text).toContain('ملاءمة مرتفعة'); expect(text).toContain('خبرة موثقة في تطوير المتاجر.'); expect(text).toContain('لم يوضح طريقة اختبار الدفع.');
		expect(text).toContain('أقل من الميزانية'); expect(text).toContain('يتجاوز المدة المطلوبة'); expect(text).toContain('ترتيب استرشادي #1');
		expect(text).toContain('بناءً على: تخصصات المقدم المعتمدة، وصف الطلب'); expect(text).not.toContain('provider.specialties'); expect(text).not.toContain('project.description');
		expect(text).not.toContain('ضمان 14 يوما'); expect(text).not.toContain('90% فأكثر');
	});

	it('preserves newest order by default and only sorts after the user selects most suitable', async () => {
		const { fixture, component, get, post } = await setup([
			{ ...proposalFixture({ id: 'new', providerName: 'الأحدث' }), aiProviderFit: { ...fit, overallFit: 'MEDIUM' }, aiRecommendationRank: 2 },
			{ ...proposalFixture({ id: 'old', providerName: 'الأقدم' }), aiProviderFit: fit, aiRecommendationRank: 1 },
			{ ...proposalFixture({ id: 'unreviewed' }), aiQualityScore: null, aiProviderFit: null, aiRecommendationRank: null },
		]);
		expect(component.displayedOffers().map(offer => offer.id)).toEqual(['new', 'old', 'unreviewed']);
		const select = fixture.nativeElement.querySelector('select[aria-label="ترتيب العروض"]') as HTMLSelectElement;
		select.value = 'suitability'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
		expect(component.displayedOffers().map(offer => offer.id)).toEqual(['old', 'new', 'unreviewed']);
		expect(component.offers().map(offer => offer.id)).toEqual(['new', 'old', 'unreviewed']);
		expect(get).toHaveBeenCalledTimes(1); expect(post).not.toHaveBeenCalled();
	});

	it('shows zero offers clearly, without ranking controls or an invented recommendation', async () => {
		const { fixture, component, post } = await setup([]);
		expect(component.hasRecommendations()).toBe(false);
		expect(fixture.nativeElement.textContent).toContain('لم تصلك عروض بعد');
		expect(fixture.nativeElement.querySelector('select[aria-label="ترتيب العروض"]')).toBeNull();
		expect(fixture.nativeElement.querySelector('.fit-recommendation-basis')).toBeNull(); expect(post).not.toHaveBeenCalled();
	});

	it('unknown quality and missing fit stay unknown, and unsafe stored Markdown remains escaped', async () => {
		const { fixture, component } = await setup([{ ...proposalFixture(), aiQualityScore: null, aiMatchScore: null, aiProviderFit: { source: 'UNVERIFIED', overallFit: 'HIGH', summary: 'invented' }, aiRecommendationRank: 1 }], '### وصف المشروع\n**متجر**\n<img src=x onerror=alert(1)>\n[خطر](javascript:alert(1))');
		expect(component.offers()[0].providerFit).toBeNull(); expect(component.offers()[0].recommendationRank).toBeNull();
		expect(fixture.nativeElement.textContent).toContain('جودة النص غير متاحة'); expect(fixture.nativeElement.textContent).not.toContain('0/100');
		expect(fixture.nativeElement.querySelector('.req-description-markdown strong')?.textContent).toBe('متجر');
		expect(fixture.nativeElement.querySelector('.req-description-markdown img')).toBeNull(); expect(fixture.nativeElement.querySelector('a[href^="javascript:"]')).toBeNull();
	});

	it('comparison includes stored project-fit evidence, quality, budget and deadline separately', async () => {
		const { fixture, component } = await setup([{ ...proposalFixture({ id: 'a', providerName: 'مقدم أ' }), aiProviderFit: fit, aiQualityScore: 88, aiRecommendationRank: 1 }, { ...proposalFixture({ id: 'b', providerName: 'مقدم ب' }), aiProviderFit: null, aiQualityScore: null }]);
		component.selectedForCompare.set(['مقدم أ', 'مقدم ب']); component.showComparisonView.set(true); fixture.detectChanges();
		const comparison = fixture.nativeElement.querySelector('.cmp-page-table');
		expect(comparison.textContent).toContain('ملاءمة الملف للطلب'); expect(comparison.textContent).toContain('88/100'); expect(comparison.textContent).toContain('موافقة الميزانية'); expect(comparison.textContent).toContain('موافقة الموعد'); expect(comparison.textContent).toContain('لم يُراجع الملف بعد');
	});
});

describe('RequestDetails — negotiation guard', () => {
	let component: RequestDetails;
	let chat: { initiateConversation: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		chat = { initiateConversation: vi.fn() };
		await TestBed.configureTestingModule({
			imports: [RequestDetails],
			providers: [
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
				{ provide: Router, useValue: { navigate: vi.fn() } },
				{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: false }) } },
				{ provide: ThemeService, useValue: { theme: () => 'dark' } },
				{ provide: ChatService, useValue: chat }
			]
		}).compileComponents();
		component = TestBed.createComponent(RequestDetails).componentInstance;
	});

	it('gives a visible Arabic reason for every non-negotiable status and none for live offers', () => {
		for (const status of ['CANCELLED', 'REJECTED', 'ACCEPTED', 'PENDING_SIGNATURE', 'DRAFT']) {
			expect(component.negotiationBlockReason(makeOffer({ status }))).toContain('لا يمكن التفاوض');
		}
		expect(component.negotiationBlockReason(makeOffer({ status: 'CANCELLED' }))).toContain('سحبه');
		for (const status of ['SUBMITTED', 'PENDING', 'UNDER_NEGOTIATION']) {
			expect(component.negotiationBlockReason(makeOffer({ status }))).toBeNull();
		}
	});

	it('opening negotiation on a withdrawn offer shows the reason and does not open the modal', () => {
		component.openNegotiation(makeOffer({ status: 'CANCELLED' }));
		expect(component.showNegModal()).toBe(false);
		expect(lastToast()).toContain('سحبه');
	});

	it('a server refusal shows the server message and does not navigate to a fake room', () => {
		const router = TestBed.inject(Router) as any;
		chat.initiateConversation.mockReturnValue(throwError(() => ({ status: 409, error: { success: false, message: 'لا يمكن التفاوض على هذا العرض لأنه مرفوض' } })));
		component.openNegotiation(makeOffer({ status: 'PENDING' }));
		component.negPrice.set('4000'); // the price box starts empty now
		component.sendNegotiation();
		expect(component.negError()).toBe('لا يمكن التفاوض على هذا العرض لأنه مرفوض');
		expect(component.showNegModal()).toBe(true);
		expect(router.navigate).not.toHaveBeenCalled();
	});
});
