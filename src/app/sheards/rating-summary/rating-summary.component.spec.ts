import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RatingSummary } from './rating-summary.component';
import { RatingApiService } from '../../core/services/rating-api.service';

const rev = (over: any = {}) => ({ id: 'r', rating: 4, comment: 'تعليق', tags: ['جودة عالية'], isPublic: true, createdAt: '2026-10-14T19:58:51.834Z', ...over });
const st = (over: any = {}) => ({ projectId: 'p1', requestId: null, actor: 'client', canRate: false, reason: null, message: '', adminSettled: null, review: null, counterpart: null, ...over });
function mount(api: any, inputs: Record<string, unknown>) {
	TestBed.configureTestingModule({ providers: [{ provide: RatingApiService, useValue: api }] });
	const f = TestBed.createComponent(RatingSummary);
	for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
	f.detectChanges();
	return { f, el: f.nativeElement as HTMLElement };
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

describe('app-rating-summary', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('final scope: my review and the counterpart\'s are two separate read-only cards, labelled per side', () => {
		const api = { getRatingStatus: vi.fn(() => of(st({ review: rev({ rating: 5 }), counterpart: rev({ rating: 2, comment: 'ملاحظة', isPublic: false, reviewerRole: 'PROVIDER' }) }))) };
		const { el } = mount(api, { side: 'client', key: 'p1' });
		expect(api.getRatingStatus).toHaveBeenCalledWith('client', 'p1');
		expect(q(el, 'rs-final-mine')?.textContent).toContain('5 / 5');
		const other = q(el, 'rs-final-counterpart')!;
		expect(other.textContent).toContain('2 / 5'); expect(other.textContent).toContain('تقييم مقدّم الخدمة لك'); expect(other.textContent).toContain('غير منشور');
		expect(el.querySelector('button, input, textarea')).toBeNull(); // read-only: no form, no action
	});
	it('provider side: only the client\'s review exists -> only the counterpart card', () => {
		const { el } = mount({ getRatingStatus: vi.fn(() => of(st({ actor: 'provider', counterpart: rev({ rating: 3 }) }))) }, { side: 'provider', key: 'p1' });
		expect(q(el, 'rs-final-mine')).toBeNull(); expect(q(el, 'rs-final-counterpart')?.textContent).toContain('تقييم العميل لك');
	});
	it('nothing saved: nothing is drawn (no empty box, no default stars)', () => {
		const { el } = mount({ getRatingStatus: vi.fn(() => of(st())) }, { side: 'client', key: 'p1' });
		expect(el.textContent?.trim()).toBe('');
		expect(el.querySelector('app-rating-saved-card')).toBeNull();
	});
	it('stage scope (provider): reads the provider stage endpoint and shows the client\'s stage review, never the final slots', () => {
		const api = { getProviderStageRatingStatus: vi.fn(() => of(st({ scope: 'STAGE', actor: 'provider', reason: 'NOT_RATER', counterpart: rev({ rating: 1 }) }))), getRatingStatus: vi.fn() };
		const { el } = mount(api, { side: 'provider', key: 'p1', stageId: 's1' });
		expect(api.getProviderStageRatingStatus).toHaveBeenCalledWith('p1', 's1'); expect(api.getRatingStatus).not.toHaveBeenCalled();
		expect(q(el, 'rs-stage-counterpart')?.textContent).toContain('1 / 5'); expect(q(el, 'rs-final-counterpart')).toBeNull();
	});
	it('stage scope (client): its own stage review', () => {
		const api = { getStageRatingStatus: vi.fn(() => of(st({ scope: 'STAGE', review: rev({ rating: 4 }) }))) };
		const { el } = mount(api, { side: 'client', key: 'p1', stageId: 's1' });
		expect(q(el, 'rs-stage-mine')?.textContent).toContain('4 / 5');
	});
	it('a failed read shows a retry (never "no rating") and the retry reads again', () => {
		const get = vi.fn().mockReturnValueOnce(throwError(() => new Error('500'))).mockReturnValueOnce(of(st({ review: rev() })));
		const { f, el } = mount({ getRatingStatus: get }, { side: 'client', key: 'p1' });
		(q(el, 'rating-summary-retry') as HTMLElement).click(); f.detectChanges();
		expect(get).toHaveBeenCalledTimes(2); expect(q(el, 'rs-final-mine')).not.toBeNull(); expect(q(el, 'rating-summary-retry')).toBeNull();
	});
});
