import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReviewWaitComponent, REVIEW_POLL_MS } from './review-wait';
import { ClientOnboardingStateService } from '../../../../core/services/client-onboarding-state.service';

describe('ReviewWaitComponent', () => {
	afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });
	function mount() {
		vi.useFakeTimers();
		const reviewing = signal(true);
		const load = vi.fn(() => of(null));
		TestBed.configureTestingModule({ imports: [ReviewWaitComponent], providers: [provideRouter([]), { provide: ClientOnboardingStateService, useValue: { reviewing, load } }] });
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const f = TestBed.createComponent(ReviewWaitComponent); f.detectChanges();
		return { f, reviewing, load, nav, el: f.nativeElement as HTMLElement };
	}
	it('shows the review message, a spinner and one button to the support contact page', () => {
		const { el } = mount();
		expect(el.textContent).toContain('حسابك قيد المراجعة');
		expect(el.querySelector('.rw-spin')).toBeTruthy();
		const a = el.querySelector('[data-testid="review-wait-support"]') as HTMLAnchorElement;
		expect(a.textContent).toContain('تواصل مع الدعم'); expect(a.getAttribute('href')).toBe('/client-overview/help/tickets/new');
	});
	it('polls the server; opens the dashboard once the review is over', () => {
		const { reviewing, load, nav } = mount();
		vi.advanceTimersByTime(REVIEW_POLL_MS); expect(load).toHaveBeenCalledWith(true); expect(nav).not.toHaveBeenCalled();
		reviewing.set(false); vi.advanceTimersByTime(REVIEW_POLL_MS); expect(nav).toHaveBeenCalledWith('/client-overview');
	});
});
