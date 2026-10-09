/// <reference types="node" />
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CreateRequest, resetCreateRequestPageLoadState } from './create-request';

const META = { success: true, data: { categories: [
	{ id: 'c-dev', name: 'برمجة وتطوير', icon: 'code', totalProviders: 5, specialties: [{ id: 's-fe', name: 'تطوير الواجهات الأمامية' }, { id: 's-ios', name: 'تطوير تطبيقات iOS' }, { id: 's-and', name: 'تطوير تطبيقات أندرويد' }] },
	{ id: 'c-des', name: 'تصميم وإبداع', icon: 'design', totalProviders: 2, specialties: [{ id: 's-logo', name: 'شعارات وهوية بصرية' }] },
] } };
const rec = (o: any = {}) => ({ hasRecommendation: true, source: 'text_match', reason: 'TEXT_MATCH', message: 'ما كتبته يطابق «برمجة وتطوير».', categoryId: 'c-dev', categoryName: 'برمجة وتطوير', specialtyIds: ['s-ios', 's-and'], specialtyNames: ['تطوير تطبيقات iOS', 'تطوير تطبيقات أندرويد'], confidence: 1, ...o });

describe('create-request step 1: the specialty suggestion is real or absent', () => {
	let c: CreateRequest;
	let fixture: any;
	let posts: Array<{ url: string; body: any }>;
	let recImpl: (body: any) => any;

	async function mount(impl: (body: any) => any) {
		posts = []; recImpl = impl;
		sessionStorage.clear(); resetCreateRequestPageLoadState();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: {
				get: (url: string) => of(/\/meta$/.test(String(url)) ? META : { success: false }),
				post: (url: string, body: any) => { posts.push({ url: String(url), body }); return /specialty-recommendations/.test(String(url)) ? recImpl(body) : of({ success: true, data: {} }); },
			} }],
		}).compileComponents();
		fixture = TestBed.createComponent(CreateRequest);
		c = fixture.componentInstance;
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	const recPosts = () => posts.filter(p => /specialty-recommendations/.test(p.url));
	afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('the page asks the real endpoint on open (no text yet)', async () => {
		await mount(() => of({ success: true, data: rec({ source: 'client_history', message: 'أرسلتَ طلبًا سابقًا واحدًا في «برمجة وتطوير».' }) }));
		expect(recPosts().length).toBe(1);
		expect(recPosts()[0].url).toMatch(/\/client\/requests\/specialty-recommendations$/);
		expect(recPosts()[0].body).toEqual({});
	});

	it('no recommendation (none / failure): no banner, no apply button, no toast, manual choice still works', async () => {
		const el = await mount(() => of({ success: true, data: { hasRecommendation: false, source: 'none', reason: 'NO_DATA', message: '', categoryId: null, specialtyIds: [], specialtyNames: [] } }));
		expect(el.querySelector('[data-testid=rec-banner]')).toBeNull();
		expect(el.querySelector('[data-testid=rec-apply]')).toBeNull();
		TestBed.resetTestingModule();
		const el2 = await mount(() => throwError(() => new Error('500')));
		expect(el2.querySelector('[data-testid=rec-banner]')).toBeNull();
		expect(c.toast()).toBeNull();
		c.selectSpec('c-des'); c.toggleSub('شعارات وهوية بصرية');
		expect(c.selectedSpec()).toBe('c-des');
		expect(c.selectedSubs().has('شعارات وهوية بصرية')).toBe(true);
	});

	it('the text under the banner follows the source: history says previous requests only for client_history; popular is a generic "شائع" suggestion', async () => {
		let el = await mount(() => of({ success: true, data: rec({ source: 'client_history', message: 'أرسلتَ 2 طلبات سابقة في «برمجة وتطوير».' }) }));
		expect(el.querySelector('[data-testid=rec-message]')?.textContent).toContain('طلبات سابقة');
		expect(el.querySelector('[data-testid=rec-title]')?.textContent?.trim()).toBe('اقتراح لك');
		TestBed.resetTestingModule();
		el = await mount(() => of({ success: true, data: rec({ source: 'popular', message: '«برمجة وتطوير» هو الأكثر طلبًا على المنصة حاليًا (5 طلبات مفتوحة).' }) }));
		expect(el.querySelector('[data-testid=rec-title]')?.textContent?.trim()).toBe('اقتراح شائع');
		const t = el.querySelector('[data-testid=rec-banner]')!.textContent!;
		expect(t).toContain('الأكثر طلبًا على المنصة');
		expect(t).not.toContain('سابق');
	});

	it('a rule-based suggestion never shows the AI word or mark', async () => {
		const el = await mount(() => of({ success: true, data: rec() }));
		const banner = el.querySelector('[data-testid=rec-banner]')!;
		expect(banner.textContent).not.toMatch(/AI|ذكاء|وسيط/);
		expect(banner.innerHTML).not.toContain('r="1.5"');
		expect(banner.innerHTML).not.toContain('#i-ai');
	});

	it('Apply selects the category and the suggested specialties in the page only: no step change, no submit, no extra request', async () => {
		const el = await mount(() => of({ success: true, data: rec() }));
		const before = posts.length;
		(el.querySelector('[data-testid=rec-apply]') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(c.selectedSpec()).toBe('c-dev');
		expect(Array.from(c.selectedSubs()).sort()).toEqual(['تطوير تطبيقات iOS', 'تطوير تطبيقات أندرويد'].sort());
		expect(c.currentStep()).toBe(1);
		expect(posts.length).toBe(before);
	});

	it('a recommendation for a category that is not in the catalog is not shown', async () => {
		const el = await mount(() => of({ success: true, data: rec({ categoryId: 'c-gone' }) }));
		expect(el.querySelector('[data-testid=rec-banner]')).toBeNull();
	});

	it('typing asks again after a debounce with the typed text; while typing only a text_match suggestion may show', async () => {
		let el = await mount((body: any) => of({ success: true, data: body?.query ? rec() : rec({ source: 'popular', message: '«برمجة وتطوير» هو الأكثر طلبًا على المنصة حاليًا (5 طلبات مفتوحة).' }) }));
		expect(el.querySelector('[data-testid=rec-title]')?.textContent?.trim()).toBe('اقتراح شائع');
		vi.useFakeTimers();
		c.onSearchInput('برمجة موقع'); fixture.detectChanges();
		// the old popular suggestion must not stay while the client is searching
		expect(fixture.nativeElement.querySelector('[data-testid=rec-banner]')).toBeNull();
		vi.advanceTimersByTime(499); expect(recPosts().length).toBe(1);
		vi.advanceTimersByTime(2);
		expect(recPosts().length).toBe(2);
		expect(recPosts()[1].body).toEqual({ query: 'برمجة موقع' });
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-testid=rec-message]')?.textContent).toContain('يطابق');
	});

	it('the old generate-from-scratch button is still gone', async () => {
		const el = await mount(() => of({ success: true, data: rec() }));
		expect(el.textContent).not.toContain('اقترح لي');
		const src = readFileSync(join(__dirname, 'create-request.ts'), 'utf8');
		expect(src).not.toContain('applyAISuggestion');
		expect(src).not.toContain('/ai-suggest');
	});

	it('the sub-specialties counter reads selected / max (left-to-right isolated): 4 / 5', async () => {
		const el = await mount(() => of({ success: true, data: rec() }));
		c.selectSpec('c-dev');
		for (const n of ['تطوير الواجهات الأمامية', 'تطوير تطبيقات iOS', 'تطوير تطبيقات أندرويد']) c.toggleSub(n);
		c.selectedSubs.update(s => new Set([...s, 'x']));
		fixture.detectChanges();
		const counter = el.querySelector('#subs-count') as HTMLElement;
		expect(counter.textContent?.trim()).toBe('4 / 5');
		expect(counter.getAttribute('dir')).toBe('ltr');
	});
});
