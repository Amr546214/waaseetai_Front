import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CartService, GUEST_COUPON_MESSAGE } from './cart.service';
import { AuthStore } from '../store/auth.store';
import { CheckoutApiService } from './checkout-api.service';
import { CartApiService } from './cart-api.service';

// Coupons are the BACKEND's: a guest gets no discount (and no mock coupon exists); a signed-in user's discount is the server's discountAmount;
// a stored coupon is validated again after login / any cart change and dropped (with a clear message) when the server refuses it.
const mem: Record<string, string> = {};
vi.stubGlobal('localStorage', { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: (k: string) => { delete mem[k]; } });

const ITEM = (id: string, amount: number) => ({ id, modelId: 'm-' + id, title: 't', category: 'c', categorySlug: 'c', coverImage: '', totalAmount: amount, totalDays: 5, level: 'x', provider: { id: 'p', name: 'n' }, addedAt: '', savedForLater: false });
const COUPON = (amount: number, o: object = {}) => ({ code: 'SAVE', discountType: 'percentage', discountValue: 50, discountAmount: amount, ...o });

describe('CartService coupons', () => {
	const token = signal<string | null>(null);
	let validate: any;
	function make(opts: { stored?: object; items?: any[]; authed?: boolean } = {}) {
		for (const k of Object.keys(mem)) delete mem[k];
		if (opts.items) mem['waseet_cart'] = JSON.stringify(opts.items);
		if (opts.stored) mem['waseet_cart_coupon'] = JSON.stringify(opts.stored);
		token.set(opts.authed === false ? null : 'tok');
		TestBed.configureTestingModule({ providers: [
			{ provide: AuthStore, useValue: { isAuthenticated: computed(() => !!token()), canPurchase: computed(() => true) } },
			{ provide: CheckoutApiService, useValue: { validateCoupon: (...a: any[]) => validate(...a) } },
			{ provide: CartApiService, useValue: { addItem: () => of({}), removeItem: () => of({}), updateItem: () => of({}), getCart: () => throwError(() => ({ status: 0 })), syncCart: () => throwError(() => ({ status: 0 })) } },
		] });
		const svc = TestBed.inject(CartService);
		TestBed.tick();
		return svc;
	}
	beforeEach(() => { validate = vi.fn(() => of({ data: COUPON(10) })); });
	afterEach(() => TestBed.resetTestingModule());

	it('there is no local/guest coupon in the source: no WASEET10, no GUEST_MOCK_COUPONS', () => {
		const ts = readFileSync(join(__dirname, 'cart.service.ts'), 'utf8');
		expect(ts).not.toContain('WASEET10');
		expect(ts).not.toContain('GUEST_MOCK_COUPONS');
		expect(ts).not.toMatch(/discountValue\) \/ 100|discountValue \/ 100/); // no local percentage maths
	});

	it('a guest applying a coupon (even WASEET10) gets «سجّل الدخول لتطبيق الكوبون» and NO discount, and nothing is stored', async () => {
		const svc = make({ items: [ITEM('a', 1000)], authed: false });
		for (const code of ['WASEET10', 'ANYTHING']) {
			const r = await new Promise<any>(res => svc.applyCoupon(code).subscribe(res));
			expect(r).toEqual({ success: false, message: GUEST_COUPON_MESSAGE });
		}
		expect(GUEST_COUPON_MESSAGE).toBe('سجّل الدخول لتطبيق الكوبون');
		expect(svc.coupon()).toBeNull(); expect(svc.discount()).toBe(0); expect(svc.total()).toBe(1000);
		expect(validate).not.toHaveBeenCalled();
		expect(mem['waseet_cart_coupon']).toBeUndefined();
	});

	it('a coupon left over from an old guest session (even a valid-looking one) gives a guest no discount and is removed', () => {
		const svc = make({ items: [ITEM('a', 1000)], authed: false, stored: COUPON(100, { code: 'WASEET10', discountValue: 10 }) });
		expect(svc.discount()).toBe(0); expect(svc.total()).toBe(1000);
		expect(svc.coupon()).toBeNull();
		expect(mem['waseet_cart_coupon']).toBeUndefined();
	});

	it('signed in: the discount is the SERVER\'s discountAmount, not discountValue% of the whole cart (scoped coupon / max-discount cap)', async () => {
		validate = vi.fn(() => of({ data: COUPON(30) })); // 50% type, but the server says 30 (capped / only some services)
		const svc = make({ items: [ITEM('a', 1000), ITEM('b', 500)] });
		const r = await new Promise<any>(res => svc.applyCoupon('save').subscribe(res));
		expect(r.success).toBe(true);
		expect(validate.mock.calls.at(-1)![0]).toEqual({ code: 'SAVE', items: [{ modelId: 'm-a', totalAmount: 1000 }, { modelId: 'm-b', totalAmount: 500 }] });
		expect(svc.discount()).toBe(30); // never 750
		expect(svc.total()).toBe(1470);
	});

	it('the discount never exceeds the subtotal', () => {
		validate = vi.fn(() => of({ data: COUPON(500) }));
		const svc = make({ items: [ITEM('a', 100)], stored: COUPON(500) });
		expect(svc.discount()).toBe(100);
		expect(svc.total()).toBe(0);
	});

	it('a missing / invalid server amount is 0 — there is no local percentage guess', () => {
		validate = vi.fn(() => of({ data: { code: 'X', discountType: 'percentage', discountValue: 50 } }));
		const svc = make({ items: [ITEM('a', 100)], stored: COUPON(10, { code: 'X' }) });
		expect(svc.discount()).toBe(0);
		expect(svc.total()).toBe(100);
	});

	it('after login a stored coupon is validated again and refreshed with the server amount', () => {
		validate = vi.fn(() => of({ data: COUPON(42) }));
		const svc = make({ items: [ITEM('a', 1000)], stored: COUPON(999) });
		expect(validate).toHaveBeenCalledTimes(1);
		expect(svc.discount()).toBe(42);
		expect(svc.couponNotice()).toBeNull();
	});

	it('a stored coupon the server refuses (4xx) is dropped with a clear message; discount 0', () => {
		validate = vi.fn(() => throwError(() => ({ status: 400, error: { message: 'كوبون غير صالح' } })));
		const svc = make({ items: [ITEM('a', 1000)], stored: COUPON(100, { code: 'WASEET10' }) });
		expect(svc.coupon()).toBeNull();
		expect(svc.discount()).toBe(0);
		expect(svc.couponNotice()).toBe('أُزيل الكوبون WASEET10: كوبون غير صالح');
		expect(mem['waseet_cart_coupon']).toBeUndefined();
	});

	it('a network/server hiccup (5xx / offline) does not throw the coupon away', () => {
		validate = vi.fn(() => throwError(() => ({ status: 503, error: {} })));
		const svc = make({ items: [ITEM('a', 1000)], stored: COUPON(100) });
		expect(svc.coupon()).not.toBeNull();
		expect(svc.couponNotice()).toBeNull();
	});

	it('an empty cart drops the coupon (with a message) without asking the server', () => {
		const svc = make({ items: [], stored: COUPON(100) });
		expect(svc.coupon()).toBeNull();
		expect(svc.couponNotice()).toContain('السلة فارغة');
		expect(validate).not.toHaveBeenCalled();
	});

	it('a change of the cart validates the coupon again with the new items', () => {
		const svc = make({ items: [ITEM('a', 1000)], stored: COUPON(10) });
		validate.mockClear();
		validate.mockReturnValue(of({ data: COUPON(7) }));
		(svc as any)._items.set([ITEM('a', 1000), ITEM('b', 200)]);
		TestBed.tick();
		expect(validate).toHaveBeenCalledTimes(1);
		expect(validate.mock.calls[0][0].items).toHaveLength(2);
		expect(svc.discount()).toBe(7);
	});

	it('a rejected apply for a signed-in user shows the server message and stores nothing', async () => {
		validate = vi.fn(() => throwError(() => ({ status: 400, error: { message: 'كوبون غير صالح' } })));
		const svc = make({ items: [ITEM('a', 1000)] });
		const r = await new Promise<any>(res => svc.applyCoupon('WASEET10').subscribe(res));
		expect(r).toEqual({ success: false, message: 'كوبون غير صالح' });
		expect(svc.coupon()).toBeNull(); expect(svc.discount()).toBe(0);
	});
});
