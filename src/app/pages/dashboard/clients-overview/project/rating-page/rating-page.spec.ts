import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RatingPage } from './rating-page';
import { RatingApiService } from '../../../../../core/services/rating-api.service';

const WORKSPACE = { success: true, data: { title: 'QA Final Service', providerName: 'provider testter', price: 20, stages: [] } };
const saved = { id: 'r1', rating: 4, comment: 'عمل جيد جدًا', tags: ['جودة عالية'], createdAt: '2026-10-14T19:58:51.834Z' };
const status = (over: any = {}) => ({ projectId: 'p1', requestId: null, actor: 'client', canRate: true, reason: null, message: '', adminSettled: null, review: null, ...over });

function setup(statuses: any[], opts: { rate?: () => any; stageId?: string } = {}) {
	const queue = [...statuses];
	const api = {
		getRatingStatus: vi.fn(() => { const next = queue.length > 1 ? queue.shift() : queue[0]; return next instanceof Error ? throwError(() => next) : of(next); }),
		rateProvider: vi.fn(opts.rate ?? (() => of({ success: true }))),
		rateStage: vi.fn(() => of({ success: true })),
	};
	TestBed.configureTestingModule({
		providers: [
			provideRouter([]),
			{ provide: RatingApiService, useValue: api },
			{ provide: HttpClient, useValue: { get: vi.fn(() => of(WORKSPACE)) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1', ...(opts.stageId ? { stageId: opts.stageId } : {}) }) } } },
		],
	});
	const f = TestBed.createComponent(RatingPage);
	f.detectChanges();
	return { f, c: f.componentInstance, api, el: f.nativeElement as HTMLElement };
}
const has = (el: HTMLElement, sel: string) => !!el.querySelector(sel);

describe('client rating page reads the server state before showing anything', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('eligible and not rated: the form (stars, tags, comment, submit, skip) is shown', () => {
		const { el } = setup([status()]);
		expect(has(el, '.rp-stars')).toBe(true); expect(has(el, '.rp-rchip')).toBe(true); expect(has(el, 'textarea')).toBe(true);
		expect(el.textContent).toContain('إرسال التقييم'); expect(el.textContent).toContain('تخطّي');
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(false);
	});

	it('already rated: the saved review is shown read-only from the START — no form, no submit, no skip, no edit, no default stars', () => {
		const { el, api } = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true);
		expect(el.querySelectorAll('[data-testid="saved-rating-stars"] svg.on').length).toBe(4);
		expect(el.querySelector('[data-testid="saved-rating-comment"]')?.textContent).toContain('عمل جيد جدًا');
		expect(el.querySelector('[data-testid="saved-rating-tags"]')?.textContent).toContain('جودة عالية');
		expect(has(el, '.rp-stars')).toBe(false); expect(has(el, 'textarea')).toBe(false); expect(has(el, '.rp-rchip')).toBe(false);
		expect(el.textContent).not.toContain('إرسال التقييم'); expect(el.textContent).not.toContain('تخطّي'); expect(el.textContent).not.toContain('تعديل التقييم');
		expect(api.rateProvider).not.toHaveBeenCalled();
	});

	it('a status read failure is an error with a retry, never an assumption that the project was not rated; retry then shows the saved review', () => {
		const { f, c, el, api } = setup([new Error('boom')]);
		expect(has(el, '.rp-state-error')).toBe(true); expect(has(el, '.rp-stars')).toBe(false); expect(has(el, '[data-testid="saved-rating-card"]')).toBe(false);
		api.getRatingStatus.mockReturnValue(of(status({ canRate: false, reason: 'ALREADY_RATED', review: saved })) as any);
		c.retry(); f.detectChanges();
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true);
	});

	it('another window rated first: the 409 reloads the saved review and shows it instead of keeping the form with an error', async () => {
		const first = status();
		const after = status({ canRate: false, reason: 'ALREADY_RATED', review: saved });
		const { f, c, el, api } = setup([first, after], { rate: () => throwError(() => ({ status: 409, error: { message: 'تم تقييم هذا الطلب مسبقاً' } })) });
		c.selectRating(4); c.submit(); f.detectChanges();
		expect(api.getRatingStatus).toHaveBeenCalledTimes(2);
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true);
		expect(has(el, '.rp-err')).toBe(false); expect(has(el, '.rp-stars')).toBe(false);
	});

	it('after a successful submit the page switches to the saved review read from the server', () => {
		const { f, c, el, api } = setup([status(), status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		c.selectRating(4); c.toggleChip('جودة عالية'); c.comment = 'عمل جيد جدًا'; c.submit(); f.detectChanges();
		expect(api.rateProvider).toHaveBeenCalledWith('p1', { rating: 4, comment: 'عمل جيد جدًا', tags: ['جودة عالية'] });
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true); expect(has(el, '.rp-stars')).toBe(false);
	});

	it('a project closed by a dispute settlement offers no rating and says why', () => {
		const { el } = setup([status({ canRate: false, reason: 'ADMIN_SETTLED', adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع', distribution: { outcome: 'SPLIT', refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } } })]);
		expect(el.querySelector('[data-testid="rating-blocked"]')?.textContent).toContain('أُغلق المشروع بتسوية نزاع، ولا يتاح تقييمه');
		expect(has(el, '.rp-stars')).toBe(false); expect(has(el, 'textarea')).toBe(false);
		expect(el.textContent).not.toContain('إرسال التقييم');
		// title and amounts: the settlement and its REAL distribution, never "completed successfully / the whole amount released"
		expect(el.querySelector('.rp-hd-ttl')?.textContent).toContain('أُغلق بتسوية نزاع');
		expect(el.textContent).not.toContain('اكتمل المشروع بنجاح'); expect(el.textContent).not.toMatch(/أُفرِج كامل المبلغ/);
		const sum = el.querySelector('[data-testid="settlement-summary"]')!.textContent!;
		expect(sum).toContain('10.00 $'); expect(sum).toContain('15.00 $'); expect(sum).toContain('1.86 $'); expect(sum).toContain('13.14 $');
	});

	it('a settled project that had a rating BEFORE the settlement shows that history read-only plus the note, and still no new form', () => {
		const { el } = setup([status({ canRate: false, reason: 'ALREADY_RATED', adminSettled: { disputeId: 'd1', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع', distribution: { outcome: 'SPLIT', refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } }, review: saved })]);
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true); expect(has(el, '[data-testid="rating-settled-note"]')).toBe(true);
		expect(has(el, '.rp-stars')).toBe(false);
	});

	it('the publish checkbox is kept as it was (its real behaviour is an owner decision)', () => {
		const { el } = setup([status()]);
		expect(has(el, 'input[type="checkbox"]')).toBe(true);
	});

	it('the publish checkbox is not part of the read-only saved view', () => {
		const { el } = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		expect(has(el, 'input[type="checkbox"]')).toBe(false);
	});
});
