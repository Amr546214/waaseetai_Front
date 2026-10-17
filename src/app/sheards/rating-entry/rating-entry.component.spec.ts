import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RatingEntry, StageRatingEntry } from './rating-entry.component';
import { RatingApiService } from '../../core/services/rating-api.service';

const st = (over: any = {}) => ({ projectId: 'p1', requestId: null, actor: 'client', canRate: true, reason: null, message: '', adminSettled: null, review: null, ...over });
const saved = { id: 'r', rating: 4, comment: null, tags: [], createdAt: '2026-10-14T19:58:51.834Z' };

function mount<T>(cmp: new (...a: any[]) => T, api: any, inputs: Record<string, unknown>) {
	const navigate = vi.fn();
	TestBed.configureTestingModule({ providers: [{ provide: RatingApiService, useValue: api }, { provide: Router, useValue: { navigate } }] });
	const f = TestBed.createComponent(cmp);
	for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
	f.detectChanges();
	return { f, el: f.nativeElement as HTMLElement, navigate };
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('app-rating-entry (project)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('eligible: «قيّم المشروع» opens the right page for each side', () => {
		const c = mount(RatingEntry, { getRatingStatus: vi.fn(() => of(st())) }, { side: 'client', key: 'p1' });
		expect(q(c.el, 'rating-entry-rate')?.textContent).toContain('قيّم المشروع');
		q(c.el, 'rating-entry-rate')!.click();
		expect(c.navigate).toHaveBeenCalledWith(['/client-overview/projects', 'p1', 'rating']);
		TestBed.resetTestingModule();
		const p = mount(RatingEntry, { getRatingStatus: vi.fn(() => of(st({ actor: 'provider' }))) }, { side: 'provider', key: 'p1' });
		q(p.el, 'rating-entry-rate')!.click();
		expect(p.navigate).toHaveBeenCalledWith(['/provider-overview/projects', 'p1', 'rating']);
	});

	it('a review exists: «عرض تقييمك» and no «قيّم المشروع»', () => {
		const c = mount(RatingEntry, { getRatingStatus: vi.fn(() => of(st({ canRate: false, reason: 'ALREADY_RATED', review: saved }))) }, { side: 'client', key: 'p1' });
		expect(q(c.el, 'rating-entry-view')?.textContent).toContain('عرض تقييمك');
		expect(q(c.el, 'rating-entry-rate')).toBeNull();
	});

	it('ineligible / settled: no button, the server reason as a tooltip (visually hidden unless showReason)', () => {
		const c = mount(RatingEntry, { getRatingStatus: vi.fn(() => of(st({ canRate: false, reason: 'ADMIN_SETTLED', message: 'x', adminSettled: { disputeId: 'd', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع', distribution: null } }))) }, { side: 'client', key: 'p1' });
		expect(c.el.querySelector('button')).toBeNull();
		const r = q(c.el, 'rating-entry-reason')!;
		expect(r.getAttribute('title')).toContain('أُغلق المشروع بتسوية نزاع');
		expect(r.classList.contains('re-sr')).toBe(true);
		TestBed.resetTestingModule();
		const n = mount(RatingEntry, { getRatingStatus: vi.fn(() => of(st({ canRate: false, reason: 'NOT_COMPLETED', message: 'يمكن التقييم بعد اكتمال المشروع' }))) }, { side: 'client', key: 'p1', showReason: true });
		expect(q(n.el, 'rating-entry-reason')?.classList.contains('re-sr')).toBe(false);
		expect(n.el.textContent).toContain('يمكن التقييم بعد اكتمال المشروع');
	});

	it('loading shows nothing (no flash); an error shows a small retry, never a rate button, and the retry re-reads', () => {
		const pending = new Subject<any>();
		const l = mount(RatingEntry, { getRatingStatus: vi.fn(() => pending) }, { side: 'client', key: 'p1' });
		expect(l.el.querySelector('button')).toBeNull(); expect(l.el.textContent!.trim()).toBe('');
		TestBed.resetTestingModule();
		const get = vi.fn().mockReturnValueOnce(throwError(() => new Error('x'))).mockReturnValueOnce(of(st({ canRate: false, reason: 'ALREADY_RATED', review: saved })));
		const e = mount(RatingEntry, { getRatingStatus: get }, { side: 'client', key: 'p1' });
		expect(q(e.el, 'rating-entry-rate')).toBeNull(); expect(q(e.el, 'rating-entry-retry')).not.toBeNull();
		q(e.el, 'rating-entry-retry')!.click(); e.f.detectChanges();
		expect(get).toHaveBeenCalledTimes(2); expect(q(e.el, 'rating-entry-view')).not.toBeNull();
	});
});

describe('app-stage-rating-entry', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('reads the STAGE status and opens the stage rating page', () => {
		const getStageRatingStatus = vi.fn(() => of(st({ scope: 'STAGE', stageId: 's1' })));
		const c = mount(StageRatingEntry, { getStageRatingStatus }, { key: 'p1', stageId: 's1' });
		expect(getStageRatingStatus).toHaveBeenCalledWith('p1', 's1');
		expect(q(c.el, 'rating-entry-rate')?.textContent).toContain('قيّم المرحلة');
		q(c.el, 'rating-entry-rate')!.click();
		expect(c.navigate).toHaveBeenCalledWith(['/client-overview/projects', 'p1', 'stages', 's1', 'rating']);
	});

	it('saved -> «عرض تقييمك»; a stage that is not approved -> no button, reason only', () => {
		const a = mount(StageRatingEntry, { getStageRatingStatus: vi.fn(() => of(st({ canRate: false, reason: 'ALREADY_RATED', review: saved }))) }, { key: 'p1', stageId: 's1' });
		expect(q(a.el, 'rating-entry-view')?.textContent).toContain('عرض تقييمك');
		TestBed.resetTestingModule();
		const b = mount(StageRatingEntry, { getStageRatingStatus: vi.fn(() => of(st({ canRate: false, reason: 'STAGE_NOT_APPROVED', message: 'يمكن تقييم المرحلة بعد اعتمادها فقط' }))) }, { key: 'p1', stageId: 's1' });
		expect(b.el.querySelector('button')).toBeNull();
		expect(q(b.el, 'rating-entry-reason')?.getAttribute('title')).toContain('بعد اعتمادها');
	});
});
