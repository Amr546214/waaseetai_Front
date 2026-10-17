import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RatingPage } from './rating-page';
import { RatingApiService } from '../../../../../core/services/rating-api.service';

const WORKSPACE = { success: true, data: { title: 'QA Final Service', providerName: 'provider testter', price: 20, stages: [{ id: 's1', title: 'المرحلة الأولى' }] } };
const saved = { id: 'r1', rating: 4, comment: 'عمل جيد جدًا', tags: ['جودة عالية'], createdAt: '2026-10-14T19:58:51.834Z' };
const status = (over: any = {}) => ({ projectId: 'p1', requestId: null, actor: 'client', canRate: true, reason: null, message: '', adminSettled: null, review: null, ...over });

function setup(statuses: any[], opts: { rate?: () => any; stageId?: string } = {}) {
	const queue = [...statuses];
	const api = {
		getRatingStatus: vi.fn(() => { const next = queue.length > 1 ? queue.shift() : queue[0]; return next instanceof Error ? throwError(() => next) : of(next); }),
		rateProvider: vi.fn(opts.rate ?? (() => of({ success: true }))),
		getStageRatingStatus: vi.fn(() => { const next = queue.length > 1 ? queue.shift() : queue[0]; return next instanceof Error ? throwError(() => next) : of(next); }),
		rateStage: vi.fn(opts.rate ?? (() => of({ success: true }))),
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
		expect(api.rateProvider).toHaveBeenCalledWith('p1', { rating: 4, comment: 'عمل جيد جدًا', tags: ['جودة عالية'], publish: true });
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

	it('the publish choice is explained BEFORE submit with both outcomes spelled out, and unchecking it sends publish=false', () => {
		const { f, c, el, api } = setup([status(), status({ canRate: false, reason: 'ALREADY_RATED', review: { ...saved, isPublic: false } })]);
		const txt = el.querySelector('[data-testid="publish-explain"]')!.textContent!;
		expect(txt).toContain('منشور: يظهر تقييمك ونصه ووسومه واسمك في الملف العام لمقدّم الخدمة');
		expect(txt).toContain('غير منشور: يبقى لك وللطرف الآخر وللإدارة فقط');
		const cb = el.querySelector('[data-testid="publish-checkbox"]') as HTMLInputElement;
		expect(cb.checked).toBe(true);
		cb.checked = false; cb.dispatchEvent(new Event('change')); f.detectChanges();
		c.selectRating(4); c.submit(); f.detectChanges();
		expect(api.rateProvider).toHaveBeenCalledWith('p1', { rating: 4, publish: false });
	});

	it('the default (checkbox untouched) sends publish=true', () => {
		const { c, api } = setup([status(), status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		c.selectRating(5); c.submit();
		expect(api.rateProvider).toHaveBeenCalledWith('p1', { rating: 5, publish: true });
	});

	it('the saved card shows the visibility state of the review', () => {
		const pub = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: { ...saved, isPublic: true } })]);
		expect(pub.el.querySelector('[data-testid="saved-rating-visibility"]')?.textContent).toContain('منشور للعامة');
		TestBed.resetTestingModule();
		const hid = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: { ...saved, isPublic: false } })]);
		expect(hid.el.querySelector('[data-testid="saved-rating-visibility"]')?.textContent).toContain('غير منشور: مرئي لك وللطرف الآخر وللإدارة فقط');
	});

	it('the publish checkbox is not part of the read-only saved view', () => {
		const { el } = setup([status({ canRate: false, reason: 'ALREADY_RATED', review: saved })]);
		expect(has(el, 'input[type="checkbox"]')).toBe(false);
	});
});

describe('client rating page in STAGE mode (same component)', () => {
	afterEach(() => TestBed.resetTestingModule());
	const stageStatus = (over: any = {}) => status({ scope: 'STAGE', stageId: 's1', ...over });

	it('reads the STAGE status first (not the project one) and shows the form with tags + publish', () => {
		const { el, api } = setup([stageStatus()], { stageId: 's1' });
		expect(api.getStageRatingStatus).toHaveBeenCalledWith('p1', 's1');
		expect(api.getRatingStatus).not.toHaveBeenCalled();
		expect(has(el, '.rp-stars')).toBe(true); expect(has(el, '.rp-rchip')).toBe(true); expect(has(el, '[data-testid="publish-choice"]')).toBe(true);
		expect(el.querySelector('.rp-hd-ttl')?.textContent).toContain('قيّم هذه المرحلة');
	});

	it('saves through rateStage with tags and publish, then switches to the saved stage card (no redirect, no form)', () => {
		const { f, c, el, api } = setup([stageStatus(), stageStatus({ canRate: false, reason: 'ALREADY_RATED', review: { ...saved, isPublic: false } })], { stageId: 's1' });
		c.selectRating(4); c.toggleChip('احترافية'); c.publish = false; c.submit(); f.detectChanges();
		expect(api.rateStage).toHaveBeenCalledWith('p1', 's1', { rating: 4, tags: ['احترافية'], publish: false });
		expect(has(el, '[data-testid="saved-rating-card"]')).toBe(true); expect(has(el, '.rp-stars')).toBe(false);
		expect(el.querySelector('[data-testid="saved-rating-visibility"]')?.textContent).toContain('غير منشور');
		expect(el.textContent).not.toContain('تخطّي');
	});

	it('a saved stage review opens read-only from the start; a stage not yet approved shows the blocked reason and no form', () => {
		const a = setup([stageStatus({ canRate: false, reason: 'ALREADY_RATED', review: saved })], { stageId: 's1' });
		expect(has(a.el, '[data-testid="saved-rating-card"]')).toBe(true); expect(has(a.el, 'textarea')).toBe(false);
		TestBed.resetTestingModule();
		const b = setup([stageStatus({ canRate: false, reason: 'STAGE_NOT_APPROVED', message: 'يمكن تقييم المرحلة بعد اعتمادها فقط' })], { stageId: 's1' });
		expect(b.el.querySelector('[data-testid="rating-blocked-reason"]')?.textContent).toContain('يمكن تقييم المرحلة بعد اعتمادها فقط');
		expect(has(b.el, '.rp-stars')).toBe(false);
	});

	it('409 on the stage reloads the stage status; a status read failure is an error with a retry', () => {
		const first = stageStatus(); const after = stageStatus({ canRate: false, reason: 'ALREADY_RATED', review: saved });
		const a = setup([first, after], { stageId: 's1', rate: () => throwError(() => ({ status: 409 })) });
		a.c.selectRating(3); a.c.submit(); a.f.detectChanges();
		expect(a.api.getStageRatingStatus).toHaveBeenCalledTimes(2);
		expect(has(a.el, '[data-testid="saved-rating-card"]')).toBe(true);
		TestBed.resetTestingModule();
		const b = setup([new Error('x')], { stageId: 's1' });
		expect(has(b.el, '.rp-state-error')).toBe(true); expect(has(b.el, '.rp-stars')).toBe(false);
	});
});
