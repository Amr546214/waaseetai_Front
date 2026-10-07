import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Market } from './market';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// marketNotice (backend PR-E): a published service kept off the market is shown to its owner as "under review" with the backend's Arabic reason,
// exactly as received. Nothing is composed here; a qualifying service shows no notice.
const KYC_NOTICE = 'لا تظهر هذه الخدمة في السوق لأن توثيق هويتك لم يكتمل بعد. تظهر تلقائيًا بعد اعتماد التوثيق.';
const model = (over: any) => ({ id: 'm1', title: 'خدمة', category: 'تصميم', categorySlug: 'design', createdAtFormatted: '1 يناير', viewsCount: 0, offersCount: 0, rating: 0, reviewsCount: 0, aiScore: 0, tags: [], status: 'PUBLISHED', marketVisible: true, marketNotice: null, ...over });

describe('Market (provider models) — marketNotice', () => {
	function render(models: any[]) {
		const data = { models, groups: [{ title: 'تصميم', slug: 'design', count: models.length, views: 0, models }], modificationRequests: [], filterTabs: [{ id: 'all', name: 'الكل', count: models.length }], stats: { totalModels: models.length, totalViews: 0 } };
		TestBed.configureTestingModule({
			imports: [Market],
			providers: [provideRouter([]), { provide: NewProjectService, useValue: { getMyMarketModels: () => of({ success: true, data }) } }, { provide: AuthStore, useValue: { currentUser: () => null } }],
		});
		const fixture = TestBed.createComponent(Market);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	beforeEach(() => {
		(window as any).matchMedia = vi.fn(() => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
	});
	afterEach(() => TestBed.resetTestingModule());

	it('an UNDER_REVIEW service shows the "قيد المراجعة" badge and the backend notice verbatim', () => {
		const el = render([model({ status: 'UNDER_REVIEW', marketVisible: false, marketNotice: KYC_NOTICE })]);
		const notice = el.querySelector('[data-testid="market-notice"]');
		expect(notice?.textContent?.trim()).toBe(KYC_NOTICE);
		expect(el.textContent).toContain('قيد المراجعة');
		expect(el.querySelector('.mkt-card')?.textContent).not.toContain('منشور');
	});

	it('a qualifying published service shows "منشور" and no notice', () => {
		const el = render([model({})]);
		expect(el.querySelector('[data-testid="market-notice"]')).toBeNull();
		expect(el.querySelector('.mkt-card')?.textContent).toContain('منشور');
	});

	it('a service without any rating shows "—", never a default 5.0', () => {
		const el = render([model({ rating: 0 })]);
		expect(el.textContent).toContain('★ —');
		expect(el.textContent).not.toContain('5.0');
	});
});
