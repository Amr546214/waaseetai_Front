/// <reference types="node" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fakeSocket = { connected: false, on: vi.fn(), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Specialties } from './specialties';

const CATEGORIES = [
	{ id: 'c-web', nameAr: 'البرمجة والتقنية', specialties: [{ id: 's-front', nameAr: 'تطوير الواجهات الأمامية' }, { id: 's-back', nameAr: 'تطوير الواجهات الخلفية' }, { id: 's-mob', nameAr: 'تطبيقات الجوال' }] },
	{ id: 'c-des', nameAr: 'التصميم', specialties: [{ id: 's-ui', nameAr: 'تصميم واجهات المستخدم' }] },
];
const rec = (o: any = {}) => ({ hasRecommendation: true, source: 'provider_history', reason: 'PROPOSAL_HISTORY', message: 'قدّمت 3 عروض على طلبات في «البرمجة والتقنية» ولم تسجّل تخصصًا فيه بعد.', categoryId: 'c-web', categoryName: 'البرمجة والتقنية', specialtyIds: ['s-front', 's-back'], specialtyNames: ['تطوير الواجهات الأمامية', 'تطوير الواجهات الخلفية'], ...o });

describe('provider specialties: the suggestion banner is real or absent', () => {
	let fixture: ComponentFixture<Specialties>;
	let c: Specialties;

	async function mount(recResponse: any) {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		const get = vi.fn((url: string) => {
			if (String(url).includes('/specialties/categories')) return of({ success: true, data: CATEGORIES });
			if (String(url).includes('/provider/specialties/recommendations')) return recResponse instanceof Error ? throwError(() => recResponse) : of(recResponse);
			return of({ success: false });
		});
		await TestBed.configureTestingModule({ imports: [Specialties], providers: [{ provide: HttpClient, useValue: { get, post: vi.fn(() => of({ success: true })) } }] }).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		c = fixture.componentInstance;
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		return { el: fixture.nativeElement as HTMLElement, get };
	}
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('the hard-coded "اقتراح AI / بناء على طلباتك السابقة / dead طبق الاقتراح" banner is gone from the template', () => {
		const html = readFileSync(join(__dirname, 'specialties.html'), 'utf8');
		expect(html).not.toContain('بناء على طلباتك السابقة');
		expect(html).not.toContain('اقتراح AI');
		expect(html).not.toContain('طبق\n');
	});

	it('it asks the real endpoint on open', async () => {
		const { get } = await mount({ success: true, data: rec() });
		expect(get.mock.calls.some(([u]) => String(u).endsWith('/provider/specialties/recommendations'))).toBe(true);
	});

	it('with a real recommendation: shows the backend message and the apply button', async () => {
		const { el } = await mount({ success: true, data: rec() });
		expect(el.querySelector('[data-testid=rec-banner]')).toBeTruthy();
		expect(el.querySelector('[data-testid=rec-message]')?.textContent).toContain('قدّمت 3 عروض');
		expect(el.querySelector('[data-testid=rec-apply]')).toBeTruthy();
	});

	it('"previous requests" wording only ever comes from the backend message (history); a profile/popular message says what it is', async () => {
		const { el } = await mount({ success: true, data: rec({ source: 'popular', reason: 'OPEN_DEMAND', message: '«البرمجة والتقنية» هو القسم الأكثر طلبات مفتوحة حاليًا على المنصة (8 طلبات).' }) });
		const t = el.textContent ?? '';
		expect(t).toContain('الأكثر طلبات مفتوحة');
		expect(t).not.toContain('طلباتك السابقة');
	});

	it('hasRecommendation=false: no banner and no apply button', async () => {
		const { el } = await mount({ success: true, data: { hasRecommendation: false, source: 'none', reason: 'NO_DATA', message: '', categoryId: null, categoryName: null, specialtyIds: [] } });
		expect(el.querySelector('[data-testid=rec-banner]')).toBeNull();
		expect(el.querySelector('[data-testid=rec-apply]')).toBeNull();
		expect(el.querySelector('[data-testid=rec-loading]')).toBeNull();
	});

	it('a recommendation for a category that is not in the catalog is not shown', async () => {
		const { el } = await mount({ success: true, data: rec({ categoryId: 'c-gone' }) });
		expect(el.querySelector('[data-testid=rec-banner]')).toBeNull();
	});

	it('endpoint failure: banner hidden, loading skeleton gone, no error text/toast, the page still works manually', async () => {
		const { el } = await mount(new Error('500'));
		expect(el.querySelector('[data-testid=rec-banner]')).toBeNull();
		expect(el.querySelector('[data-testid=rec-loading]')).toBeNull();
		expect(el.textContent).not.toContain('تعذر');
		c.selectSpec('c-des'); c.toggleSub('تصميم واجهات المستخدم');
		expect(c.canProceedToStep2()).toBe(true);
	});

	it('Apply selects the suggested category and exactly the suggested specialties in the page, without saving', async () => {
		const { el } = await mount({ success: true, data: rec() });
		(el.querySelector('[data-testid=rec-apply]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(c.selectedSpecId()).toBe('c-web');
		expect(Array.from(c.selectedSubs()).sort()).toEqual(['تطوير الواجهات الأمامية', 'تطوير الواجهات الخلفية'].sort());
		expect(c.currentStep()).toBe(1); // nothing is submitted: the provider continues from here
		expect(c.canProceedToStep2()).toBe(true);
	});

	it('Apply with a category-only recommendation selects the category and leaves the specialties to the provider', async () => {
		const { el } = await mount({ success: true, data: rec({ source: 'profile', reason: 'PROFILE_MATCH', message: 'ذكرتَ «التصميم» في ملفك ولم تسجّل تخصصًا فيه بعد.', categoryId: 'c-des', specialtyIds: [] }) });
		(el.querySelector('[data-testid=rec-apply]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(c.selectedSpecId()).toBe('c-des');
		expect(c.selectedSubs().size).toBe(0);
		expect(c.canProceedToStep2()).toBe(false);
	});

	it('the banner never uses the AI mark: it is a rule-based suggestion', async () => {
		const { el } = await mount({ success: true, data: rec() });
		const banner = el.querySelector('[data-testid=rec-banner]')!;
		expect(banner.textContent).not.toContain('AI');
		expect(banner.innerHTML).not.toContain('r="1.5"');
	});

	it('a manual choice works exactly as before with or without a recommendation', async () => {
		const { el } = await mount({ success: true, data: rec() });
		c.selectSpec('c-des'); c.toggleSub('تصميم واجهات المستخدم'); fixture.detectChanges();
		expect(c.selectedSpecId()).toBe('c-des');
		expect(c.canProceedToStep2()).toBe(true);
		expect(el.querySelector('[data-testid=rec-banner]')).toBeTruthy(); // still just a suggestion; nothing was auto-selected
	});
});
