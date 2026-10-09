/// <reference types="node" />
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { ClientOverviewComponent } from './client-overview.component';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';

// Batch 7 regression: the "AI Insights" card on the client dashboard used to
// be fully static markup — a hardcoded "96%" and a fixed Arabic sentence,
// with zero signal/backend behind it (client-overview.component.html). It
// now renders dashboardStore.dashboardData()?.priceFairnessInsight, a real
// deterministic aggregate of the client's own proposals' AI price-fairness
// tags. These tests lock in that the fake "96%" never reappears and that
// both the real-data and no-data-yet states render honestly.
function baseDashboardData(overrides: any = {}) {
	return {
		summary: {
			activeProjectsCount: 1,
			newOffersCount: 0,
			totalEscrowAmount: 0,
			totalSpent: 0,
			aiRating: null,
			humanRating: 4.5,
			profileCompletionPercent: 100,
			currentLevel: 'مستكشف',
			pointsToNextLevel: 50,
			currentPoints: 10,
		},
		topSteps: { step1_escrowRequiredCount: 0, step2_pendingApprovalCount: 0, step3_pendingProposalsCount: 0 },
		latestProjects: [],
		latestProposals: [],
		activeContract: null,
		priceFairnessInsight: null,
		...overrides,
	};
}

describe('ClientOverviewComponent — AI Insights card', () => {
	function setup(dashboardDataOverrides: any) {
		const dashboardData = baseDashboardData(dashboardDataOverrides);
		const fakeStore: Partial<DashboardStore> = {
			dashboardData: (() => dashboardData) as any,
			activeContract: (() => null) as any,
			isLoadingDashboard: (() => false) as any,
			error: (() => null) as any,
			totalActiveRequestsCount: (() => 0) as any,
			fetchDashboardStats: async () => {},
		};
		const fakeAuthStore: Partial<AuthStore> = { currentUser: (() => null) as any };

		TestBed.configureTestingModule({
			imports: [ClientOverviewComponent],
			providers: [
				provideRouter([]),
				{ provide: DashboardStore, useValue: fakeStore },
				{ provide: AuthStore, useValue: fakeAuthStore },
			],
		});
		const fixture = TestBed.createComponent(ClientOverviewComponent);
		fixture.detectChanges();
		return fixture;
	}

	it('never renders the old fabricated static "96%" AI Insights card', () => {
		const fixture = setup({ priceFairnessInsight: null });
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('96%');
		expect(text).not.toContain('الأسعار المقدمة في العروض الحالية متوافقة تماماً مع متوسط أسعار السوق');
	});

	it('renders the real percentage and summary when priceFairnessInsight is present', () => {
		const fixture = setup({
			priceFairnessInsight: { fairPricePercentage: 75, evaluatedOffersCount: 4, summaryText: '75% من عروضك المقيَّمة بالذكاء الاصطناعي ضمن النطاق العادل لأسعار السوق' },
		});
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('75%');
		expect(text).toContain('عروضك المقيَّمة بالذكاء الاصطناعي');
		expect(text).toContain('4 عرض مُقيَّم');
	});

	it('shows an honest "not enough data yet" message instead of any percentage when priceFairnessInsight is null', () => {
		const fixture = setup({ priceFairnessInsight: null });
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لا تتوفر تحليلات كافية بعد');
	});
});

// Batch 5 — "اخر العروض" (latest offers) cards used to render a per-provider
// level badge computed purely from the card's array index (getLevelBadgeStyle
// / getLevelColor / getLevelLabel — an index % N rotation), so the exact same
// provider could show a different level depending on sort order, and the
// badge never reflected any real provider data. The index-based methods were
// removed first (first Batch 5 pass); this completion pass wires the badge
// back up to the REAL `providerLevel` the backend now resolves via
// resolveProviderProgression()/PROVIDER_LEVEL_MATRIX (dashboard.service.ts
// ::getClientStats), rendered only when it is a real, non-null value.
describe('ClientOverviewComponent — latest offers level badge (Batch 5)', () => {
	function offersFixture(latestProposals: any[]) {
		const dashboardData = baseDashboardData({ latestProposals });
		const fakeStore: Partial<DashboardStore> = {
			dashboardData: (() => dashboardData) as any,
			activeContract: (() => null) as any,
			isLoadingDashboard: (() => false) as any,
			error: (() => null) as any,
			totalActiveRequestsCount: (() => 0) as any,
			fetchDashboardStats: async () => {},
		};
		const fakeAuthStore: Partial<AuthStore> = { currentUser: (() => null) as any };

		TestBed.configureTestingModule({
			imports: [ClientOverviewComponent],
			providers: [
				provideRouter([]),
				{ provide: DashboardStore, useValue: fakeStore },
				{ provide: AuthStore, useValue: fakeAuthStore },
			],
		});
		const fixture = TestBed.createComponent(ClientOverviewComponent);
		fixture.detectChanges();
		return fixture;
	}

	function makeOffer(overrides: any = {}) {
		return {
			id: 'p1',
			projectId: 'proj-1',
			projectTitle: 'استشارة تصميم',
			price: 500,
			deliveryDays: 5,
			aiMatchScore: 80,
			providerName: 'مزود الخدمة',
			status: 'pending',
			createdAt: new Date().toISOString(),
			...overrides,
		};
	}

	it('5) renders no level badge at all when providerLevel is null (missing provider progression) — never a fabricated one', () => {
		const fixture = offersFixture([makeOffer({ id: 'p1', providerLevel: null }), makeOffer({ id: 'p2', providerLevel: undefined }), makeOffer({ id: 'p3' })]);
		const host = fixture.nativeElement as HTMLElement;
		expect(host.querySelectorAll('.offer-card .ws-level-tag').length).toBe(0);
	});

	it('1) renders the real providerLevel text when present', () => {
		const fixture = offersFixture([makeOffer({ providerLevel: 'خبير' })]);
		const badge = (fixture.nativeElement as HTMLElement).querySelector('.offer-card .ws-level-tag');
		expect(badge?.textContent?.trim()).toBe('خبير');
	});

	it('2) uses resolveProviderLevelBadgeStyle() — a highlighted real level gets its canonical color', () => {
		const fixture = offersFixture([makeOffer({ providerLevel: 'خبير' })]);
		const badge = (fixture.nativeElement as HTMLElement).querySelector('.offer-card .ws-level-tag') as HTMLElement;
		expect(badge.style.color).toBe('rgb(224, 198, 255)'); // #E0C6FF — canonical خبير color
	});

	it('6) an unhighlighted-but-real level string gets the neutral default styling, not a fabricated per-level mapping', () => {
		const fixture = offersFixture([makeOffer({ providerLevel: 'مبتدئ' })]);
		const badge = (fixture.nativeElement as HTMLElement).querySelector('.offer-card .ws-level-tag') as HTMLElement;
		expect(badge.style.color).toBe('rgb(43, 212, 199)'); // #2BD4C7 — shared neutral default
	});

	it('7) the adjacent star/rating row does not depend on provider level — stays the fixed static color regardless of providerLevel', () => {
		// index 0 is the small avatar checkmark badge (also static, unrelated);
		// index 1 is the first real rating-row star.
		const ratingStarFill = (fixture: ReturnType<typeof offersFixture>) =>
			Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.offer-card svg.ws-star-svg[fill]'))[1]?.getAttribute('fill');

		const fixtureExpert = offersFixture([makeOffer({ providerLevel: 'خبير' })]);
		const expertFill = ratingStarFill(fixtureExpert);

		TestBed.resetTestingModule();
		const fixtureNull = offersFixture([makeOffer({ providerLevel: null })]);
		const nullFill = ratingStarFill(fixtureNull);

		expect(expertFill).toBe(nullFill);
		expect(expertFill).toBe('#2ECC8A');
	});

	it('removed the fake getLevelBadgeStyle/getLevelColor/getLevelLabel methods entirely', () => {
		const fixture = offersFixture([makeOffer()]);
		const instance = fixture.componentInstance as any;
		expect(instance.getLevelBadgeStyle).toBeUndefined();
		expect(instance.getLevelColor).toBeUndefined();
		expect(instance.getLevelLabel).toBeUndefined();
	});

	it('3/4) same provider (same providerLevel) renders identically (name + level badge) regardless of its position/index in the offers list', () => {
		// Only the name/level-adjacent markup is compared — the avatar gradient
		// (getAvatarStyle(idx)) is a deliberately index-tied cosmetic unrelated
		// to level and out of this batch's scope, so it is expected to differ.
		const sameProvider = () => makeOffer({ providerName: 'أحمد للتصميم', providerLevel: 'محترف' });
		const firstOrder = offersFixture([
			{ ...sameProvider(), id: 'a' },
			makeOffer({ id: 'b', providerName: 'آخر', providerLevel: 'أخصائي' }),
		]);
		const firstHtml = (firstOrder.nativeElement as HTMLElement).querySelector('.offer-prov > div:not([style])')?.outerHTML.replace(/_ngcontent-[^="]+="[^"]*"/g, '') || '';

		TestBed.resetTestingModule();
		const secondOrder = offersFixture([
			makeOffer({ id: 'b', providerName: 'آخر', providerLevel: 'أخصائي' }),
			{ ...sameProvider(), id: 'a' },
		]);
		const provWraps = (secondOrder.nativeElement as HTMLElement).querySelectorAll('.offer-prov > div:not([style])');
		const secondHtml = (provWraps[1] as HTMLElement)?.outerHTML.replace(/_ngcontent-[^="]+="[^"]*"/g, '') || '';

		expect(firstHtml).not.toBe('');
		expect(firstHtml).toContain('محترف');
		expect(firstHtml).toBe(secondHtml);
	});

	it('does not reorder or alter offer count when rendering (ranking/order untouched)', () => {
		const offers = [makeOffer({ id: 'x', providerName: 'س' }), makeOffer({ id: 'y', providerName: 'ص' }), makeOffer({ id: 'z', providerName: 'ع' })];
		const fixture = offersFixture(offers);
		const names = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.offer-name')).map(el => el.textContent?.trim());
		expect(names).toEqual(['س', 'ص', 'ع']);
	});

	// AI Cleanup Batch 5 — "اخر العروض" is a newest-first list (backend
	// createdAt desc, top 3). The per-offer score is the stored proposal score
	// (Gemini proposal-quality score blended with price closeness), so it is
	// labeled "تقييم العرض", never a bare "AI x%" match/ranking claim.
	it('Batch 5: labels the real per-offer score as "تقييم العرض", not a bare "AI x%"', () => {
		const fixture = offersFixture([makeOffer({ aiMatchScore: 77 })]);
		const chip = (fixture.nativeElement as HTMLElement).querySelector('.offer-ai-match');
		expect(chip?.textContent?.trim()).toBe('تقييم العرض 77%');
		expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('AI 77%');
	});

	it('Batch 5: shows no percentage at all when the offer has no stored score', () => {
		const fixture = offersFixture([makeOffer({ aiMatchScore: null })]);
		expect((fixture.nativeElement as HTMLElement).querySelector('.offer-ai-match')).toBeNull();
	});

	it('Batch 5: the offers section makes no AI-ranking claim', () => {
		const fixture = offersFixture([makeOffer()]);
		const section = (fixture.nativeElement as HTMLElement).querySelector('.offers-section');
		expect(section?.textContent).toContain('اخر العروض');
		expect(section?.textContent).not.toMatch(/مرتبة بتطابق|رتب(ها)? (ال)?AI|AI رتب/);
	});
});


// The stats row has FIVE cards (projects, offers, frozen amount, human rating, AI rating of the offers) in a matching 5-column grid:
// no spare column and no orphan cell at any width. The AI card shows the REAL average of the WaseetAI offer evaluations, or an honest empty state.
describe('ClientOverviewComponent — stats row (5 cards, AI offer rating)', () => {
	function mount(summary: any = {}, overrides: any = {}) {
		const dashboardData = baseDashboardData({ summary: { ...baseDashboardData().summary, ...summary }, ...overrides });
		const fakeStore: Partial<DashboardStore> = {
			dashboardData: (() => dashboardData) as any, activeContract: (() => null) as any, isLoadingDashboard: (() => false) as any,
			error: (() => null) as any, totalActiveRequestsCount: (() => 0) as any, fetchDashboardStats: async () => {},
		};
		TestBed.configureTestingModule({ imports: [ClientOverviewComponent], providers: [provideRouter([]), { provide: DashboardStore, useValue: fakeStore }, { provide: AuthStore, useValue: { currentUser: () => null } }] });
		const f = TestBed.createComponent(ClientOverviewComponent);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	const cardsOf = (el: HTMLElement) => Array.from(el.querySelectorAll('.stats-row .stat-card'));

	it('with an AI rating there are 5 filled cards and the AI card shows the API values (rating and rated-offers count)', () => {
		const el = mount({ aiRating: 4.7, aiRatedOffersCount: 2, aiRatingSource: 'waseet_ai_offer_quality', aiConfidence: null });
		const cards = cardsOf(el);
		expect(cards.length).toBe(5);
		for (const c of cards) {
			expect(c.querySelector('.stat-lbl')?.textContent?.trim()).toBeTruthy();
			expect(c.textContent?.trim().length).toBeGreaterThan(10);
		}
		expect(el.querySelector('[data-testid=ai-rating-value]')?.textContent?.trim()).toBe('4.7');
		expect(el.querySelector('[data-testid=ai-rating-sub]')?.textContent).toContain('2 عروض');
		expect(el.querySelector('[data-testid=ai-rating-sub]')?.textContent).not.toMatch(/دقة|%/);
	});

	it('a single rated offer is worded in the singular', () => {
		expect(mount({ aiRating: 4.0, aiRatedOffersCount: 1 }).querySelector('[data-testid=ai-rating-sub]')?.textContent).toContain('عرض واحد');
	});

	it('no AI data: the 5th card is an honest empty state ("لا يوجد تقييم بعد"), not a blank slot, not a number', () => {
		const el = mount({ aiRating: null, aiRatedOffersCount: 0, aiRatingSource: 'none' });
		const cards = cardsOf(el);
		expect(cards.length).toBe(5);
		const ai = el.querySelector('[data-testid=ai-rating-card]') as HTMLElement;
		expect(ai.textContent).toContain('لا يوجد تقييم بعد');
		expect(ai.textContent).toContain('يظهر بعد توفر بيانات كافية');
		expect(ai.querySelector('[data-testid=ai-rating-value]')).toBeNull();
		expect(cards.every(c => (c.textContent?.trim().length ?? 0) > 10)).toBe(true);
	});

	it('the empty-state sentence is styled as text (smaller than the numeric values)', async () => {
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		const css = readFileSync(join(__dirname, 'client-overview.component.css'), 'utf8');
		expect(css).toMatch(/\.stat-val\.stat-val-empty\{font-size:15px/);
	});

	it('an old/partial API response without the AI fields is handled as "no data"', () => {
		const el = mount({ aiRating: undefined });
		expect(el.querySelector('[data-testid=ai-rating-empty]')).toBeTruthy();
	});

	it('the card uses the official AI mark (it is a real WaseetAI evaluation) and never the design sample numbers', async () => {
		const el = mount({ aiRating: 4.7, aiRatedOffersCount: 2 });
		expect(el.querySelector('[data-testid=ai-rating-card] use')?.getAttribute('href')).toBe('#i-ai');
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		const src = readFileSync(join(__dirname, 'client-overview.component.html'), 'utf8') + readFileSync(join(__dirname, 'client-overview.component.ts'), 'utf8');
		expect(src).not.toMatch(/>\s*4\.9\s*</);
		expect(src.replace(/<!--[\s\S]*?-->/g, '')).not.toContain('96%'); // comments may mention it; no template/code value may
		expect(src).not.toContain('دقة 96');
	});

	it('the grid has one column per card on wide screens and fills every cell below that (no orphan gap at 1600 / 1100)', async () => {
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		const css = readFileSync(join(__dirname, 'client-overview.component.css'), 'utf8');
		expect(css).toMatch(/\.stats-row\{display:grid;grid-template-columns:repeat\(5,1fr\)/); // >= 1400px
		// 1280-1399: 6 tracks, first three span 2, the last two span 3 (3 + 2, no empty cell)
		expect(css).toMatch(/max-width:1399px\)\{[^@]*\.stats-row\{grid-template-columns:repeat\(6,1fr\)\}[^@]*span 2[^@]*nth-child\(n\+4\)\{grid-column:span 3\}/);
		// <= 1279: 2 columns and an odd last card takes the whole row
		expect(css).toMatch(/max-width:1279px\)\{[^@]*\.stats-row\{grid-template-columns:repeat\(2,1fr\)\}[^@]*last-child:nth-child\(odd\)\{grid-column:1\/-1\}/);
	});
});

// The "وسيط، ترتيب العروض / تُرتَّب العروض تلقائياً بناءً على مشاريع مشابهة" banner claimed AI ranking, but the dashboard only shows the 3 newest offers
// (backend orderBy createdAt desc, no sorting in the page): the claim and its AI mark are gone and must not come back without a real ranking.
describe('ClientOverviewComponent — no unsupported "offers ranking" AI claim', () => {
	function mount() {
		const dashboardData = baseDashboardData({ latestProposals: [] });
		const fakeStore: Partial<DashboardStore> = {
			dashboardData: (() => dashboardData) as any, activeContract: (() => null) as any, isLoadingDashboard: (() => false) as any,
			error: (() => null) as any, totalActiveRequestsCount: (() => 0) as any, fetchDashboardStats: async () => {},
		};
		TestBed.configureTestingModule({ imports: [ClientOverviewComponent], providers: [provideRouter([]), { provide: DashboardStore, useValue: fakeStore }, { provide: AuthStore, useValue: { currentUser: () => null } }] });
		const f = TestBed.createComponent(ClientOverviewComponent);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	}

	it('the page does not say offers are ranked / sorted automatically by similar projects', () => {
		const text = mount().textContent ?? '';
		expect(text).not.toContain('ترتيب العروض');
		expect(text).not.toContain('مشاريع مشابهة');
		expect(text).not.toContain('تُرتَّب العروض تلقائياً');
	});

	it('no AI-disclosure banner block is rendered', () => {
		const el = mount();
		expect(el.querySelector('.ai-disclosure')).toBeNull();
		expect(el.querySelector('[aria-label="إفصاح الذكاء الاصطناعي"]')).toBeNull();
	});

	it('the template source never brings the banner texts back', async () => {
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		const html = readFileSync(join(__dirname, 'client-overview.component.html'), 'utf8');
		expect(html).not.toContain('ترتيب العروض');
		expect(html).not.toContain('مشاريع مشابهة');
		expect(html).not.toContain('class="ai-disclosure"');
	});
});
