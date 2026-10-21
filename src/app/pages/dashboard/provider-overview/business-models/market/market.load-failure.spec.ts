import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { Market } from './market';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// A failed LOAD is not an empty list; a hide / show failure or a lost answer is explained and never repeated blindly.
const data = (models: any[]) => ({ models, groups: [], modificationRequests: [], filterTabs: [], stats: {} });
const m = (over: any = {}) => ({ id: 'm1', title: 'خدمة', category: 'تصميم', categorySlug: 'design', createdAtFormatted: '1 يناير', viewsCount: 0, offersCount: 0, rating: 0, aiScore: null, tags: [], status: 'PUBLISHED', ...over });

describe('Market: load failure and visibility toggle', () => {
	function setup(svc: any) {
		(window as any).matchMedia = vi.fn(() => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
		TestBed.configureTestingModule({ imports: [Market], providers: [provideRouter([]), { provide: NewProjectService, useValue: svc }, { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } }] });
		const f = TestBed.createComponent(Market);
		f.detectChanges();
		return { f, c: f.componentInstance as any, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('503 on the list: the page says the load failed (with a retry) and does NOT claim "no services published"', () => {
		const { el } = setup({ getMyMarketModels: () => throwError(() => ({ status: 503, error: { success: false, message: 'الخدمة غير متاحة مؤقتًا' } })) });
		expect(el.querySelector('[data-testid="load-error"]')).not.toBeNull();
		expect(el.textContent).not.toContain('لا توجد خدمات منشورة في السوق حالياً');
		expect(el.textContent).not.toContain('ERR-PR-026');
	});

	it('retry reloads and shows the real list', () => {
		let fail = true;
		const { f, el } = setup({ getMyMarketModels: () => (fail ? throwError(() => ({ status: 0 })) : of({ success: true, data: data([m()]) })) });
		fail = false;
		(el.querySelector('[data-testid="load-error-retry"]') as HTMLButtonElement).click();
		f.detectChanges();
		expect(el.querySelector('[data-testid="load-error"]')).toBeNull();
	});

	it('hide answered by a lost reply: no second request while waiting; then the list is re-read and the card shows the real state', () => {
		const pending = new Subject<any>();
		const setVis = vi.fn(() => pending);
		const get = vi.fn(() => of({ success: true, data: data([m()]) }));
		const { c } = setup({ getMyMarketModels: get, setServiceVisibility: setVis });
		const before = get.mock.calls.length;
		c.onToggleVisibility(m());
		c.onToggleVisibility(m()); // a tap while the first is in flight is ignored
		expect(setVis).toHaveBeenCalledTimes(1);
		expect(c.togglingId()).toBe('m1');
		pending.error({ status: 0, error: null });
		expect(get.mock.calls.length).toBe(before + 1);
		expect(c.togglingId()).toBeNull();
	});
});
