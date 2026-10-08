import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { NavigationSkipped, NavigationSkippedCode, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { CreateRequest, resetCreateRequestPageLoadState } from './create-request';

// A new request starts empty: the sessionStorage draft only resumes a refresh / back-forward, never an in-app arrival
// (menu "إنشاء طلب", "طلب جديد", dashboard shortcuts). Budget fields start empty (no 0 / 500 / 1500 prefilled).
const DRAFT_KEY = 'waseetai:create-request:draft:v1';
const staleDraft = () => ({
	version: 1, currentStep: 4,
	step1: { selectedSpec: 'sp1', selectedSubs: ['ويب'], otherText: '' },
	step2: { ndaType: 'standard', ipRights: 'client', provLevel: '', provRating: '4', provLang: 'ar', provLocation: 'sa', customConditions: '' },
	step3: { title: 'طلب قديم', description: 'وصف طلب قديم طويل', requirements: ['a'], outputs: '', deliveryDays: 20 },
	step4: { budgetType: 'range', budgetMin: 500, budgetMax: 1500, budgetFixed: 8000, budgetHourly: 40, allowNegotiation: true, splitMilestones: false, milestones: [] },
});

describe('create-request: fresh start vs resume', () => {
	let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	let router: Router;

	// `inApp`: a navigation already completed in this page load (the wizard is reached from the menu / a button). `popstate`: browser back/forward.
	// `landing`: how this page load itself started (the document navigation entry): a reload on the wizard, or a reload on another page.
	async function mount(opts: { inApp: boolean; popstate?: boolean; landing?: 'reload-on-wizard' | 'reload-on-dashboard' }): Promise<CreateRequest> {
		resetCreateRequestPageLoadState();
		vi.spyOn(performance, 'getEntriesByType').mockReturnValue(opts.landing
			? [{ type: 'reload', name: `https://dev.example.test${opts.landing === 'reload-on-wizard' ? '/client-overview/create-request' : '/client-overview'}` } as any]
			: [{ type: 'navigate', name: 'https://dev.example.test/client-overview' } as any]);
		Object.defineProperty(router, 'lastSuccessfulNavigation', { configurable: true, get: () => signal(opts.inApp ? ({ id: 2 } as any) : null) });
		Object.defineProperty(router, 'currentNavigation', { configurable: true, value: signal(opts.popstate ? ({ id: 3, trigger: 'popstate' } as any) : null) });
		const f = TestBed.createComponent(CreateRequest);
		await f.whenStable();
		return f.componentInstance;
	}

	beforeEach(async () => {
		sessionStorage.clear();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		postSpy = vi.fn(() => of({ success: true, data: { id: 'new-request-id' } }));
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...a: any[]) => postSpy(...a) } }],
		}).compileComponents();
		router = TestBed.inject(Router);
	});
	afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('arriving by an in-app navigation (menu / "طلب جديد") ignores and clears the earlier attempt: step 1, no 500/1500, nothing from the old request', async () => {
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(staleDraft()));
		const c = await mount({ inApp: true });
		expect(c.currentStep()).toBe(1);
		expect(c.selectedSpec()).toBeNull();
		expect(c.title()).toBe('');
		expect(c.budgetMin()).toBeNull();
		expect(c.budgetMax()).toBeNull();
		expect(c.budgetFixed()).toBeNull();
		expect(c.budgetHourly()).toBeNull();
		const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null');
		expect(JSON.stringify(saved ?? {})).not.toMatch(/500|1500|طلب قديم/);
	});

	it('a page refresh on the wizard resumes the draft (even though the router already completed a navigation: the landing entry says reload on this URL)', async () => {
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(staleDraft()));
		const c = await mount({ inApp: true, landing: 'reload-on-wizard' });
		expect(c.currentStep()).toBe(4);
		expect(c.budgetMin()).toBe(500);
		expect(c.budgetMax()).toBe(1500);
		expect(c.title()).toBe('طلب قديم');
	});

	it('browser back / forward (popstate) resumes the draft', async () => {
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(staleDraft()));
		expect((await mount({ inApp: true, popstate: true })).budgetMin()).toBe(500);
		TestBed.resetTestingModule();
	});

	it('"طلب جديد" a second time: after typing a budget, leaving and arriving again from the menu starts clean', async () => {
		const first = await mount({ inApp: true });
		first.budgetMin.set(500);
		first.budgetMax.set(1500);
		first.title.set('محاولة أولى');
		await Promise.resolve();
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...a: any[]) => postSpy(...a) } }],
		}).compileComponents();
		router = TestBed.inject(Router);
		const second = await mount({ inApp: true });
		expect(second.budgetMin()).toBeNull();
		expect(second.budgetMax()).toBeNull();
		expect(second.title()).toBe('');
		expect(second.currentStep()).toBe(1);
	});

	it('the page was reloaded on the dashboard and the user then opens "إنشاء طلب": a new request, the old draft is not resumed', async () => {
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(staleDraft()));
		const c = await mount({ inApp: true, landing: 'reload-on-dashboard' });
		expect(c.currentStep()).toBe(1);
		expect(c.budgetMin()).toBeNull();
	});

	it('after a reload on the wizard only the FIRST creation resumes; opening the wizard again from the menu starts clean', async () => {
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(staleDraft()));
		resetCreateRequestPageLoadState();
		vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'reload', name: 'https://dev.example.test/client-overview/create-request' } as any]);
		Object.defineProperty(router, 'lastSuccessfulNavigation', { configurable: true, get: () => signal({ id: 2 } as any) });
		Object.defineProperty(router, 'currentNavigation', { configurable: true, value: signal(null) });
		const first = TestBed.createComponent(CreateRequest); await first.whenStable();
		expect(first.componentInstance.budgetMin()).toBe(500);
		first.destroy();
		const second = TestBed.createComponent(CreateRequest); await second.whenStable();
		expect(second.componentInstance.budgetMin()).toBeNull();
		expect(second.componentInstance.currentStep()).toBe(1);
	});

	it('"إنشاء طلب" clicked while already on the wizard (same URL, router skips it) resets everything, including the success screen', async () => {
		const c = await mount({ inApp: true });
		c.selectedSpec.set('sp1'); c.title.set('محاولة'); c.currentStep.set(4);
		c.budgetMin.set(500); c.budgetMax.set(1500); c.budgetFixed.set(8000); c.budgetHourly.set(40); c.budgetType.set('hourly');
		c.showSuccessOverlay.set(true);
		(router.events as any).next(new NavigationSkipped(
			{ id: 9, url: '/client-overview/create-request' } as any, '/client-overview/create-request', 'x', NavigationSkippedCode.IgnoredSameUrlNavigation));
		expect(c.currentStep()).toBe(1);
		expect(c.selectedSpec()).toBeNull();
		expect(c.title()).toBe('');
		expect([c.budgetMin(), c.budgetMax(), c.budgetFixed(), c.budgetHourly()]).toEqual([null, null, null, null]);
		expect(c.budgetType()).toBe('range');
		expect(c.showSuccessOverlay()).toBe(false);
		await Promise.resolve();
		expect(JSON.stringify(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}'))).not.toMatch(/500|1500|محاولة/);
	});

	it('a skipped same-URL navigation to another page does not reset the wizard', async () => {
		const c = await mount({ inApp: true });
		c.title.set('محاولة');
		(router.events as any).next(new NavigationSkipped(
			{ id: 9, url: '/client-overview/my-requests' } as any, '/client-overview/my-requests', 'x', NavigationSkippedCode.IgnoredSameUrlNavigation));
		expect(c.title()).toBe('محاولة');
	});

	it('step 4 only renders the inputs of the selected budget type, and a fresh wizard shows them empty', async () => {
		const f = TestBed.createComponent(CreateRequest);
		await f.whenStable();
		const c = f.componentInstance;
		c.currentStep.set(4);
		const q = (id: string) => (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#' + id);
		for (const [type, shown] of [['range', ['f-budget-from', 'f-budget-to']], ['fixed', ['f-budget-fixed']], ['hourly', ['f-budget-hourly']]] as const) {
			c.budgetType.set(type);
			f.detectChanges(); await f.whenStable();
			for (const id of ['f-budget-from', 'f-budget-to', 'f-budget-fixed', 'f-budget-hourly']) {
				expect(!!q(id), `${type}:${id}`).toBe((shown as readonly string[]).includes(id));
				if (q(id)) expect(q(id)!.value, `${type}:${id}`).toBe('');
			}
		}
	});

	it('every budget type submits only its own amount (the fields of the other types are never sent)', async () => {
		const c = await mount({ inApp: true });
		c.selectedSpec.set('sp1');
		c.budgetMin.set(500); c.budgetMax.set(1500); c.budgetFixed.set(8000); c.budgetHourly.set(40);
		const cases: [string, number, number][] = [['range', 500, 1500], ['fixed', 8000, 8000], ['hourly', 40, 40]];
		for (const [type, min, max] of cases) {
			postSpy.mockClear();
			c.budgetType.set(type);
			await c.submitRequest();
			const body = postSpy.mock.calls[0]?.[1];
			expect(body?.budgetType, type).toBe(type.toUpperCase());
			expect(body?.minBudget, type).toBe(min);
			expect(body?.maxBudget, type).toBe(max);
		}
	});
});
