import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { CreateRequest } from './create-request';

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
	async function mount(opts: { inApp: boolean; popstate?: boolean }): Promise<CreateRequest> {
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

	it('a page refresh on the wizard (no navigation completed yet in this page load) resumes the draft', async () => {
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(staleDraft()));
		const c = await mount({ inApp: false });
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
