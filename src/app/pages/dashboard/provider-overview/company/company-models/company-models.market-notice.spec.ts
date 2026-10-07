import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CompanyModels } from './company-models';
import { NewProjectService } from '../../../../../core/services/new-project.service';

// marketNotice on the company models page — same logic as the provider models page: a service kept off the market by the backend is shown as
// "under review" with the backend's Arabic reason (verbatim); a qualifying one shows "في السوق" and no notice; an owner-hidden one stays "غير معروض".
const KYC_NOTICE = 'لا تظهر هذه الخدمة في السوق لأن توثيق هويتك لم يكتمل بعد. تظهر تلقائيًا بعد اعتماد التوثيق.';
const SPECIALTY_NOTICE = 'لا تظهر هذه الخدمة في السوق لأن التخصص المرتبط بها غير معتمد بعد. تظهر تلقائيًا بعد اعتماد التخصص.';
const model = (over: any) => ({ id: 'm1', title: 'خدمة', category: 'تصميم', categorySlug: 'design', tags: [], aiScore: 0, rating: 0, reviewsCount: 0, viewsCount: 0, status: 'PUBLISHED', marketVisible: true, marketNotice: null, ...over });

describe('company models — marketNotice', () => {
	function render(models: any[]) {
		(window as any).matchMedia = vi.fn(() => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
		TestBed.configureTestingModule({
			imports: [CompanyModels],
			providers: [provideRouter([]), { provide: NewProjectService, useValue: { getMyMarketModels: () => of({ success: true, data: { models, filterTabs: [{ id: 'all', name: 'الكل', count: models.length }], stats: { totalModels: models.length } } }) } }],
		});
		const fixture = TestBed.createComponent(CompanyModels);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());
	const cards = (el: HTMLElement) => Array.from(el.querySelectorAll('.cml-card')) as HTMLElement[];

	it('UNDER_REVIEW: badge "قيد المراجعة", the backend notice verbatim, and the checklist does not claim it is live', () => {
		const el = render([model({ status: 'UNDER_REVIEW', marketVisible: false, marketNotice: KYC_NOTICE })]);
		const card = cards(el)[0];
		expect(card.querySelector('[data-testid="model-status"]')!.textContent!.trim()).toBe('قيد المراجعة');
		expect(card.querySelector('[data-testid="market-notice"]')!.textContent!.trim()).toBe(KYC_NOTICE);
		expect(card.textContent).not.toContain('منشور في السوق');
		expect(card.textContent).not.toContain('● في السوق');
	});

	it('a different backend reason (specialty not approved) is shown as received', () => {
		const el = render([model({ status: 'UNDER_REVIEW', marketVisible: false, marketNotice: SPECIALTY_NOTICE })]);
		expect(cards(el)[0].querySelector('[data-testid="market-notice"]')!.textContent!.trim()).toBe(SPECIALTY_NOTICE);
	});

	it('a qualifying service: "في السوق", no notice, checklist says published', () => {
		const el = render([model({})]);
		const card = cards(el)[0];
		expect(card.querySelector('[data-testid="model-status"]')!.textContent).toContain('في السوق');
		expect(card.querySelector('[data-testid="market-notice"]')).toBeNull();
		expect(card.textContent).toContain('منشور في السوق');
	});

	it('owner-hidden (ARCHIVED) keeps its own label and no notice', () => {
		const el = render([model({ status: 'ARCHIVED', marketVisible: false, marketNotice: null })]);
		const card = cards(el)[0];
		expect(card.querySelector('[data-testid="model-status"]')!.textContent!.trim()).toBe('غير معروض');
		expect(card.querySelector('[data-testid="market-notice"]')).toBeNull();
	});

	it('an older backend (no marketVisible / marketNotice fields) behaves exactly as before', () => {
		const el = render([{ id: 'x', title: 'قديم', category: 'تصميم', tags: [], aiScore: 0, rating: 0, viewsCount: 0, status: 'PUBLISHED' }]);
		const card = cards(el)[0];
		expect(card.querySelector('[data-testid="model-status"]')!.textContent).toContain('في السوق');
		expect(card.querySelector('[data-testid="market-notice"]')).toBeNull();
	});
});
