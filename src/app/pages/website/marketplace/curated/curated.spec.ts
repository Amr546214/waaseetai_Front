import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { CuratedComponent } from './curated';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';
import { AuthStore } from '../../../../core/store/auth.store';

// Regression coverage (Batch 4) — same eligibility contract as
// marketplace.ts/slug.ts/card.ts (see marketplace-service.service.ts
// getMarketplaceModels). curated.html renders its own inline card markup
// (top-rated/most-ordered/featured/exclusive/newest) rather than reusing
// <app-card>, so the same hasActivePurchase()/cardLink() pair is kept here
// too and exercised independently.

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
		imports: [CuratedComponent],
		providers: [
			provideRouter([]),
			{ provide: MarketplaceService, useValue: { getPublishedModels: () => of({ success: true, data: { models: [] } }) } },
			{ provide: AuthStore, useValue: { isAuthenticated: signal(false), currentUser: signal(null) } },
		],
	});
	const fixture: ComponentFixture<CuratedComponent> = TestBed.createComponent(CuratedComponent);
	return { fixture, component: fixture.componentInstance };
}

describe('CuratedComponent (top-rated/most-ordered/featured/exclusive/newest) — active-purchase eligibility', () => {
	it('2) an eligible service keeps the normal offer/buy link', () => {
		const { component } = setup();
		const model = baseModel({ eligibility: { hasActivePurchase: false, activeProjectId: null } });

		expect(component.hasActivePurchase(model)).toBe(false);
		expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
	});

	it('2) a service with an active purchase links to the real project id', () => {
		const { component } = setup();
		const model = baseModel({ eligibility: { hasActivePurchase: true, activeProjectId: 'proj-9' } });

		expect(component.hasActivePurchase(model)).toBe(true);
		expect(component.cardLink(model)).toEqual(['/client-overview/projects', 'proj-9']);
	});

	it('5) never fabricates a destination when activeProjectId is missing', () => {
		const { component } = setup();
		const model = baseModel({ eligibility: { hasActivePurchase: true, activeProjectId: null } });

		expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
	});

	it('6) a model with no `eligibility` field (guest/other role) behaves exactly as before this batch', () => {
		const { component } = setup();
		const model = baseModel();

		expect(component.hasActivePurchase(model)).toBe(false);
		expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
	});
});
