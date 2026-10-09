import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';

import { CompareServicesComponent } from './compare-services';
import { MarketplaceService } from '../../../../core/services/marketplace.service';

// AI Cleanup Batch 5 — the compare page's "winner" is simply the highest
// stored AI quality score among the selected services (no AI comparison call
// exists). It must never crown a card when nobody has a real score (the old
// `|| 0` sort declared the first card "الأعلى توافقاً" with "AI 0"), nor pick
// one arbitrarily on a tie, and it is labeled as an AI score, not a match.
describe('CompareServicesComponent — AI-score winner (Batch 5)', () => {
	function create() {
		TestBed.configureTestingModule({
			imports: [CompareServicesComponent],
			providers: [
				provideRouter([]),
				{ provide: ActivatedRoute, useValue: { queryParams: of({}) } },
				{ provide: MarketplaceService, useValue: {} },
			],
		});
		const fixture = TestBed.createComponent(CompareServicesComponent);
		return fixture;
	}
	const m = (id: string, aiScore: number | null | undefined): any => ({ id, title: id, aiScore, totalAmount: 100, totalDays: 3, provider: { name: id } });

	it('picks the highest real score, regardless of input order', () => {
		const c = create().componentInstance;
		c.models.set([m('a', 70), m('b', 92), m('c', 81)]);
		expect(c.winnerId()).toBe('b');
	});

	it('declares no winner when no service has a real score', () => {
		const c = create().componentInstance;
		c.models.set([m('a', undefined), m('b', null)]);
		expect(c.winnerId()).toBeNull();
	});

	it('a real score of 0 is a score (it can win over an unscored service); null is not', () => {
		const c = create().componentInstance;
		c.models.set([m('a', null), m('b', 0)]);
		expect(c.winnerId()).toBe('b');
	});

	it('declares no winner on a tied top score instead of picking one arbitrarily', () => {
		const c = create().componentInstance;
		c.models.set([m('a', 90), m('b', 90), m('c', 50)]);
		expect(c.winnerId()).toBeNull();
	});

	it('labels the winner as the highest AI score, never "الأعلى توافقاً"', () => {
		const fixture = create();
		fixture.detectChanges(); // ngOnInit (empty ids) runs first
		fixture.componentInstance.models.set([m('a', 70), m('b', 92)]);
		fixture.componentInstance.loading.set(false);
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('الأعلى توافقاً');
		expect(text).toContain('الأعلى في جودة AI');
	});
});
