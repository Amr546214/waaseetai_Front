import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SignContract, readProviderContract, milestoneMeta } from './sign-contract';
import { AuthStore } from '../../../../../core/store/auth.store';

// The provider's sign-contract page shows ONLY what the contract really holds: price, duration, phases and the milestones of its saved terms.
// No fixed "3 مراحل" / "30 يوم ضمان" / ownership / package clauses, no numbers when there is no contract.
const MS = [
	{ order: 1, title: 'مسودة الشعار', description: 'ثلاث مقترحات', days: 5, percentage: 40, amount: 380 },
	{ order: 2, title: 'التسليم النهائي', description: null, days: 7, percentage: 60, amount: 570 }
];
const CONTRACT = (over: Record<string, unknown> = {}) => ({ id: 'ctr-1', status: 'PENDING_PROVIDER_SIGNATURE', termsVersion: 1, price: 950, currency: 'USD', durationDays: 12, phasesCount: 2, milestones: MS, escrow: { amount: 950, status: 'HELD' }, ...over });
const OFFER = (contract: unknown) => ({ offerId: 'o1', id: 'o1', projectTitle: 'تصميم هوية', title: 'تصميم هوية', projectRef: '#ORD-1', clientName: 'سارة علي', offeredPrice: 1000, price: '1,000 $', status: contract ? 'PENDING_SIGNATURE' : 'PENDING_CLIENT_SIGNATURE', duration: '14 يوم', phases: '1 مراحل', contract });
const FORBIDDEN = [/3 مراحل/, /30 يوم/, /30 يوما/, /الملكية الفكرية/, /تنتقل ملكية/, /تعديلات حسب الباقة/, /ضمان الجودة/];

describe('provider sign-contract: real contract terms only', () => {
	async function setup(item: unknown, opts: { error?: boolean } = {}) {
		const post = vi.fn(() => of({ success: true }));
		const get = vi.fn(() => (opts.error ? throwError(() => ({ status: 500 })) : of({ success: true, data: [item] })));
		await TestBed.configureTestingModule({ imports: [SignContract], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get, post } },
			{ provide: AuthStore, useValue: { currentUser: signal({ firstName: 'مزود', lastName: 'تجربة', accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'o1' })), snapshot: { paramMap: convertToParamMap({ id: 'o1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(SignContract); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement; const q = (id: string) => el.querySelector(`[data-testid="${id}"]`);
		return { f, c: f.componentInstance, el, q, post, text: () => el.textContent || '', signBtn: () => el.querySelector('.actions-row .btn-primary') as HTMLButtonElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('a signable offer shows the contract\'s price, duration, phase count, its saved milestones and the funded escrow', async () => {
		const s = await setup(OFFER(CONTRACT()));
		expect(s.q('contract-price')!.textContent).toContain('950');
		expect(s.q('contract-duration')!.textContent).toContain('12 يوم');
		expect(s.q('contract-phases')!.textContent!.trim()).toBe('2');
		const ms = s.q('contract-milestones')!.textContent!;
		expect(ms).toContain('مسودة الشعار'); expect(ms).toContain('التسليم النهائي'); expect(ms).toContain('5 يوم'); expect(ms).toContain('40%'); expect(ms).toContain('ثلاث مقترحات');
		expect(s.q('contract-escrow')!.textContent).toContain('950');
		expect(s.text()).not.toContain('1,000'); // not the list's price: the contract's own
		expect(s.q('contract-not-ready')).toBeNull();
		expect(s.signBtn().disabled).toBe(false);
		for (const re of FORBIDDEN) expect(s.text()).not.toMatch(re);
	});

	it('no milestones in the saved terms: shows the real phase count and says details are not saved — no invented stages', async () => {
		const s = await setup(OFFER(CONTRACT({ milestones: [], phasesCount: 1 })));
		expect(s.q('contract-phases')!.textContent!.trim()).toBe('1');
		expect(s.q('contract-milestones')).toBeNull();
		expect(s.q('contract-no-milestones')!.textContent).toContain('غير محفوظة');
		for (const re of FORBIDDEN) expect(s.text()).not.toMatch(re);
	});

	it('no contract (client has not signed / funded): no price, duration, phases or terms at all, only the "not ready" notice, and signing is unavailable', async () => {
		const s = await setup(OFFER(null));
		expect(s.q('contract-not-ready')!.textContent).toContain('غير جاهز');
		for (const id of ['contract-price', 'contract-duration', 'contract-phases', 'contract-terms', 'contract-milestones', 'contract-escrow']) expect(s.q(id)).toBeNull();
		expect(s.text()).not.toContain('14 يوم'); // the list's fallback duration
		expect(s.text()).not.toMatch(/1 مراحل/);
		for (const re of FORBIDDEN) expect(s.text()).not.toMatch(re);
		expect(s.signBtn().disabled).toBe(true);
		s.c.isAgreed = true; s.c.signContract();
		expect(s.post).not.toHaveBeenCalled();
	});

	it('a malformed contract object counts as "no contract" instead of breaking or inventing values', async () => {
		for (const bad of [{ price: 'free', durationDays: 3, phasesCount: 1 }, { price: 10 }, 'x', 5, [], { price: 10, durationDays: NaN, phasesCount: 1 }]) {
			expect(readProviderContract(bad)).toBeNull();
		}
		const s = await setup(OFFER({ price: 'free' }));
		expect(s.q('contract-not-ready')).not.toBeNull();
	});

	it('signing itself is unchanged: with a ready contract and the agreement ticked it posts {accepted:true} to the same endpoint', async () => {
		const s = await setup(OFFER(CONTRACT()));
		s.c.isAgreed = true; s.c.signContract();
		expect(s.post).toHaveBeenCalledTimes(1);
		const call = s.post.mock.calls[0] as unknown as [string, unknown];
		expect(call[0]).toContain('/provider/offers/o1/sign');
		expect(call[1]).toEqual({ agreedTerms: { accepted: true } });
	});

	it('API failure keeps the existing protected error state (signing disabled), no contract shown', async () => {
		const s = await setup(null, { error: true });
		expect(s.c.loadError()).toContain('تعذر تحميل');
		expect(s.q('contract-terms')).toBeNull();
	});

	it('milestone detail text only mentions the fields that exist', () => {
		expect(milestoneMeta({ order: 1, title: 'a', description: null, days: 5, percentage: 40, amount: 1380 })).toBe('5 يوم · 40% · 1,380 $');
		expect(milestoneMeta({ order: 1, title: 'a', description: null, days: null, percentage: null, amount: null })).toBe('');
		expect(milestoneMeta({ order: 1, title: 'a', description: null, days: 3, percentage: null, amount: null })).toBe('3 يوم');
	});

	it('static check: the page source has none of the fixed clauses and no fallback numbers', () => {
		const html = readFileSync(join(__dirname, 'sign-contract.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'sign-contract.ts'), 'utf8');
		for (const re of [...FORBIDDEN, /فض النزاع/]) { expect(html).not.toMatch(re); }
		expect(html).not.toMatch(/\{\{\s*(duration|phases)\(\)\s*\}\}/);
		expect(ts).not.toMatch(/item\.(duration|phases|milestones)\b/);
		expect(html).toContain('العميل</div><div class="od-meta-val">{{ providerName() }}');
	});
});
