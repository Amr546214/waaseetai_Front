import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { Card } from './card';
import { MarketplaceModel, MarketplaceService } from '../../core/services/marketplace.service';
import { AuthStore } from '../../core/store/auth.store';

// Regression coverage (Batch 4): a Client already having an active purchase
// for a service must not be offered a normal, actionable "buy again" card —
// the card must clearly indicate this and navigate to the real existing
// project instead, using ONLY the real activeProjectId the backend
// returned (never fabricated). model.eligibility is populated server-side
// (marketplace-service.service.ts getMarketplaceModels) exclusively for an
// authenticated Client — undefined for guests/other roles, who must see the
// exact same behavior as before this batch.

function baseModel(overrides: Partial<MarketplaceModel> = {}): MarketplaceModel {
	return {
		id: 'svc-1',
		title: 'خدمة تجريبية',
		category: 'تصميم',
		status: 'PUBLISHED',
		totalAmount: 500,
		totalDays: 5,
		aiScore: 80,
		rating: 4.5,
		provider: { id: 'p1', name: 'مزود', initials: 'م' },
		...overrides,
	};
}

function setup() {
	TestBed.configureTestingModule({
		imports: [Card],
		providers: [
			provideRouter([]),
			{ provide: MarketplaceService, useValue: { getFavorites: () => of({ success: true, data: [] }), setFavorite: () => of({ success: true }) } },
			{ provide: AuthStore, useValue: { isAuthenticated: signal(false) } },
		],
	});
	const fixture: ComponentFixture<Card> = TestBed.createComponent(Card);
	return { fixture, component: fixture.componentInstance };
}

describe('Card (shared marketplace card) — active-purchase eligibility', () => {
	it('2) a service the Client has not purchased keeps the normal offer/buy link', () => {
		const { component } = setup();
		const model = baseModel({ eligibility: { hasActivePurchase: false, activeProjectId: null } });

		expect(component.hasActivePurchase(model)).toBe(false);
		expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
	});

	it('2) a service with an active purchase links to the real existing project, not the offer page', () => {
		const { component } = setup();
		const model = baseModel({ eligibility: { hasActivePurchase: true, activeProjectId: 'proj-42' } });

		expect(component.hasActivePurchase(model)).toBe(true);
		expect(component.cardLink(model)).toEqual(['/client-overview/projects', 'proj-42']);
	});

	it('5) never fabricates a destination — an active purchase with no activeProjectId falls back to the offer page, not a broken route', () => {
		const { component } = setup();
		const model = baseModel({ eligibility: { hasActivePurchase: true, activeProjectId: null } });

		expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
	});

	it('6) a model with no `eligibility` field at all (guest, or a non-Client role) behaves exactly as before this batch', () => {
		const { component } = setup();
		const model = baseModel(); // no eligibility key

		expect(component.hasActivePurchase(model)).toBe(false);
		expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
	});

	it('4) the truthful-state badge/copy renders for an eligible-active card and the price footer is replaced, never showing a normal price alongside it', () => {
		const { fixture, component } = setup();
		fixture.componentRef.setInput('models', [baseModel({ eligibility: { hasActivePurchase: true, activeProjectId: 'proj-42' } })]);
		fixture.detectChanges();

		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لديك طلب نشط');
		expect(text).toContain('قيد التنفيذ');
		expect(text).not.toContain('500 $');
	});

	it('an eligible (non-active) card in the same list still shows its real price normally — the fix does not affect unrelated cards', () => {
		const { fixture, component } = setup();
		fixture.componentRef.setInput('models', [baseModel({ id: 'svc-2', totalAmount: 750, eligibility: { hasActivePurchase: false, activeProjectId: null } })]);
		fixture.detectChanges();

		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('750');
		expect(text).not.toContain('لديك طلب نشط');
	});

	it('7) listing rendering never triggers a per-card my-purchase request — eligibility comes only from model data already on hand', () => {
		const getFavoritesSpy = vi.fn(() => of({ success: true, data: [] }));
		TestBed.configureTestingModule({
			imports: [Card],
			providers: [
				provideRouter([]),
				{ provide: MarketplaceService, useValue: { getFavorites: getFavoritesSpy, setFavorite: () => of({ success: true }), getMyPurchaseStatus: vi.fn() } },
				{ provide: AuthStore, useValue: { isAuthenticated: signal(true) } },
			],
		});
		const fixture: ComponentFixture<Card> = TestBed.createComponent(Card);
		fixture.componentRef.setInput('models', [
			baseModel({ id: 's1', eligibility: { hasActivePurchase: true, activeProjectId: 'p1' } }),
			baseModel({ id: 's2', eligibility: { hasActivePurchase: false, activeProjectId: null } }),
			baseModel({ id: 's3', eligibility: { hasActivePurchase: false, activeProjectId: null } }),
		]);
		fixture.detectChanges();

		const marketplaceService = TestBed.inject(MarketplaceService) as any;
		expect(marketplaceService.getMyPurchaseStatus).not.toHaveBeenCalled();
	});
});

// Batch 5 — the shared card previously inlined its level badge color
// directly in the template (`model.levelBg || 'rgba(43,212,199,.6)'`) with
// no helper method at all. levelStyle() now routes through the same
// canonical mapping marketplace.ts/slug.ts/curated.ts use, even though this
// component is currently a dead/non-load-bearing component with no live
// consumers (Batch 4 finding) — fixed because the same small shared helper
// naturally covers it, not via any broader refactor.
describe('Card — canonical provider level styling (Batch 5)', () => {
	it('uses the canonical highlighted-level colors, matching marketplace/slug/curated', () => {
		const { component } = setup();
		expect(component.levelStyle(baseModel({ level: 'خبير' }))).toEqual({ bg: 'rgba(123,47,190,.85)', color: '#E0C6FF' });
	});

	it('falls back to the neutral default for an unhighlighted or unexpected level, never fabricating one', () => {
		const { component } = setup();
		expect(component.levelStyle(baseModel({ level: 'مبتدئ' }))).toEqual({ bg: 'rgba(43,212,199,.6)', color: '#2BD4C7' });
		expect(component.levelStyle(baseModel({ level: undefined }))).toEqual({ bg: 'rgba(43,212,199,.6)', color: '#2BD4C7' });
	});

	it('8) the Batch 4 active-purchase badge still takes priority over the level badge — unaffected by the Batch 5 styling change', () => {
		const { fixture } = setup();
		fixture.componentRef.setInput('models', [baseModel({ eligibility: { hasActivePurchase: true, activeProjectId: 'proj-42' }, level: 'خبير' })]);
		fixture.detectChanges();

		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لديك طلب نشط');
	});
});
