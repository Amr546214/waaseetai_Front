import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CartService } from './cart.service';
import { AuthStore } from '../store/auth.store';
import { CheckoutApiService } from './checkout-api.service';
import { CartApiService } from './cart-api.service';

// A user acting as a provider has no purchase cart: the cart is never requested from the server (it would answer 403) and no coupon / sync call is made; once the CLIENT role is active it loads.
const mem: Record<string, string> = {};
vi.stubGlobal('localStorage', { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: (k: string) => { delete mem[k]; } });

describe('CartService while acting as a provider', () => {
	const canBuy = signal(false);
	const getCart = vi.fn(() => of({ data: { id: 'c1', items: [] } }));
	const syncCart = vi.fn(() => of({}));
	const validateCoupon = vi.fn(() => of({}));
	beforeEach(() => {
		for (const k of Object.keys(mem)) delete mem[k];
		getCart.mockClear(); syncCart.mockClear(); validateCoupon.mockClear();
		TestBed.configureTestingModule({ providers: [
			{ provide: AuthStore, useValue: { isAuthenticated: computed(() => true), canPurchase: computed(() => canBuy()) } },
			{ provide: CheckoutApiService, useValue: { validateCoupon } },
			{ provide: CartApiService, useValue: { addItem: () => of({}), removeItem: () => of({}), updateItem: () => of({}), getCart, syncCart } },
		] });
	});
	afterEach(() => TestBed.resetTestingModule());

	it('provider role: no cart request, no sync, no coupon validation; the cart is empty', () => {
		canBuy.set(false);
		const svc = TestBed.inject(CartService);
		TestBed.tick();
		expect(getCart).not.toHaveBeenCalled();
		expect(syncCart).not.toHaveBeenCalled();
		expect(validateCoupon).not.toHaveBeenCalled();
		expect(svc.itemCount()).toBe(0);
	});

	it('after switching to CLIENT the cart is loaded from the server', () => {
		canBuy.set(false);
		TestBed.inject(CartService);
		TestBed.tick();
		expect(getCart).not.toHaveBeenCalled();
		canBuy.set(true);
		TestBed.tick();
		expect(getCart).toHaveBeenCalled();
	});
});
