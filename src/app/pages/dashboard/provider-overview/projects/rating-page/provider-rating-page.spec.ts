import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProviderRatingPage } from './provider-rating-page';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { ActiveProjectsService } from '../../../../../core/services/active.service';

const saved = { id: 'r2', rating: 5, comment: 'عميل متعاون', tags: ['تعاون ممتاز', 'ردود سريعة'], createdAt: '2026-10-14T19:59:07.328Z' };
const status = (over: any = {}) => ({ projectId: 'p1', requestId: null, actor: 'provider', canRate: true, reason: null, message: '', adminSettled: null, review: null, ...over });

function setup(statuses: any[], rate?: () => any) {
	const queue = [...statuses];
	const api = {
		getRatingStatus: vi.fn(() => { const next = queue.length > 1 ? queue.shift() : queue[0]; return next instanceof Error ? throwError(() => next) : of(next); }),
		rateClient: vi.fn(rate ?? (() => of({ success: true }))),
	};
	TestBed.configureTestingModule({
		providers: [
			provideRouter([]),
			{ provide: RatingApiService, useValue: api },
			{ provide: ActiveProjectsService, useValue: { getProjectProgress: () => of({ success: true, data: { title: 'QA Final Service', clientName: 'client test', price: 20, providerClientRating: { hasRated: false } } }) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
		],
	});
	const f = TestBed.createComponent(ProviderRatingPage);
	f.detectChanges();
	return { f, c: f.componentInstance, api, el: f.nativeElement as HTMLElement };
}
const has = (el: HTMLElement, sel: string) => !!el.querySelector(sel);

describe('provider rating page reads the server state before showing anything', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('eligible and not rated: the form is shown', () => {
		const { el } = setup([status()]);
		expect(has(el, '.rp-stars')).toBe(true); expect(el.textContent).toContain('إرسال التقييم');
	});

	it('already rated: only the saved read-only card (stars, tags, comment, date); no submit / skip / edit', () => {
		const { el, api } = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true);
		expect(el.querySelectorAll('[data-testid="saved-rating-stars"] svg.on').length).toBe(5);
		expect(el.querySelector('[data-testid="saved-rating-tags"]')?.textContent).toContain('تعاون ممتاز');
		expect(has(el, '.rp-stars')).toBe(false); expect(has(el, 'textarea')).toBe(false);
		expect(el.textContent).not.toContain('إرسال التقييم'); expect(el.textContent).not.toContain('تخطّي'); expect(el.textContent).not.toContain('تعديل التقييم');
		expect(api.rateClient).not.toHaveBeenCalled();
	});

	it('a status read failure is an error with a retry, not a form', () => {
		const { el } = setup([new Error('boom')]);
		expect(has(el, '.rp-state-error')).toBe(true); expect(has(el, '.rp-stars')).toBe(false);
	});

	it('409 from another window: reload and show the saved review', () => {
		const { f, c, el, api } = setup([status(), status({ canRate: false, reason: 'ALREADY_RATED', review: saved })], () => throwError(() => ({ status: 409, error: { message: 'تم تقييم هذا الطلب مسبقاً' } })));
		c.selectRating(5); c.submit(); f.detectChanges();
		expect(api.getRatingStatus).toHaveBeenCalledTimes(2);
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true); expect(has(el, '.rp-err')).toBe(false);
	});

	it('success sends stars, comment and tags, then shows the saved review', () => {
		const { f, c, el, api } = setup([status(), status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		c.selectRating(5); c.toggleChip('تعاون ممتاز'); c.comment = 'عميل متعاون'; c.submit(); f.detectChanges();
		expect(api.rateClient).toHaveBeenCalledWith('p1', { rating: 5, comment: 'عميل متعاون', tags: ['تعاون ممتاز'] });
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true);
	});

	it('settled project: reason shown, no form', () => {
		const { el } = setup([status({ canRate: false, reason: 'ADMIN_SETTLED', adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع', distribution: { outcome: 'SPLIT', refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } } })]);
		expect(el.querySelector('[data-testid="rating-blocked"]')?.textContent).toContain('أُغلق المشروع بتسوية نزاع، ولا يتاح تقييمه');
		expect(has(el, '.rp-stars')).toBe(false);
		expect(el.querySelector('.rp-hd-ttl')?.textContent).toContain('أُغلق بتسوية نزاع');
		expect(el.textContent).not.toContain('اكتمل المشروع بنجاح'); expect(el.textContent).not.toMatch(/أُفرِج كامل المبلغ/);
		const sum = el.querySelector('[data-testid="settlement-summary"]')!.textContent!;
		expect(sum).toContain('10.00 $'); expect(sum).toContain('15.00 $'); expect(sum).toContain('1.86 $'); expect(sum).toContain('13.14 $');
	});
});

describe('provider: settled project that already had a saved review', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('shows the settlement title + distribution above the read-only history, and no form', () => {
		const { el } = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: saved, adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع', distribution: { outcome: 'SPLIT', refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } } })]);
		expect(el.querySelector('.rp-hd-ttl')?.textContent).toContain('أُغلق بتسوية نزاع');
		expect(has(el, '[data-testid="settlement-summary"]')).toBe(true); expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true);
		expect(has(el, '.rp-stars')).toBe(false); expect(has(el, 'textarea')).toBe(false);
	});
});
