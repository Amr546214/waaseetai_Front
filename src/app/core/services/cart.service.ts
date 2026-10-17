import { computed, effect, inject, Injectable, PLATFORM_ID, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem, CouponData } from '../models/checkout.model';
import { AuthStore } from '../store/auth.store';
import { CheckoutApiService, CouponValidationPayload } from './checkout-api.service';
import { CartApiService, AddCartItemPayload, UpdateCartItemPayload, CartSyncPayload } from './cart-api.service';
import { mapCartResponse, BackendCartResponse } from './checkout-mappers';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

const STORAGE_KEY = 'waseet_cart';
const COUPON_KEY = 'waseet_cart_coupon';

export interface CouponResult {
	success: boolean;
	message: string;
	coupon?: CouponData;
}

// Coupons are validated by the backend ONLY (POST /api/checkout/coupon/validate, which needs a login). There is no local/guest coupon: a guest gets no
// discount and is asked to sign in. The discount shown is the server's `discountAmount`, never a local computation.
export const GUEST_COUPON_MESSAGE = 'سجّل الدخول لتطبيق الكوبون';

@Injectable({
	providedIn: 'root'
})
export class CartService {
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);
	private authStore = inject(AuthStore);
	private checkoutApi = inject(CheckoutApiService);
	private cartApi = inject(CartApiService);

	private readonly _items = signal<CartItem[]>([]);
	private readonly _coupon = signal<CouponData | null>(null);

	private hasSyncedThisSession = false;
	private isLoadingServerCart = false;

	readonly items = this._items.asReadonly();
	readonly coupon = this._coupon.asReadonly();

	readonly itemCount = computed(() => this._items().filter(i => !i.savedForLater).length);
	readonly subtotal = computed(() =>
		this._items()
			.filter(i => !i.savedForLater)
			.reduce((sum, i) => sum + i.totalAmount, 0)
	);
	/** Why a stored coupon was dropped (shown to the user); null when nothing was dropped. */
	readonly couponNotice = signal<string | null>(null);
	/** The server's own discount for the validated coupon (never recomputed locally); 0 for a guest or when no coupon is validated. */
	readonly discount = computed(() => {
		const c = this._coupon();
		if (!c || !this.authStore.isAuthenticated()) return 0;
		const amount = Number(c.discountAmount);
		return Number.isFinite(amount) && amount > 0 ? Math.min(amount, this.subtotal()) : 0;
	});
	private readonly cartKey = computed(() =>
		this._items().filter(i => !i.savedForLater).map(i => `${i.modelId}:${i.totalAmount}`).sort().join('|'));
	private couponCheckSeq = 0;
	/** true once the cart (server or local) has been read, so an empty-but-still-loading cart is never mistaken for an empty one. */
	private readonly cartReady = signal(false);
	readonly total = computed(() => Math.max(0, this.subtotal() - this.discount()));

	constructor() {
		this.loadCart();

		if (this.isBrowser) {
			effect(() => {
				const authed = this.authStore.isAuthenticated();
				const canBuy = this.authStore.canPurchase(); // re-runs when the acting role is switched to CLIENT
				if (authed && canBuy) {
					untracked(() => { this.loadCart(); this.onLoginSync(); });
				}
			});

			// A stored coupon is never trusted: after a login or any change of the cart it is validated again by the backend, and dropped (with a clear
			// message) when it is no longer valid. A guest keeps no coupon at all.
			effect(() => {
				const authed = this.authStore.isAuthenticated();
				this.cartKey();
				if (!this.cartReady()) return;
				untracked(() => {
					if (!authed) {
						if (this._coupon()) { this._coupon.set(null); this.persistCoupon(); }
						return;
					}
					this.revalidateCoupon();
				});
			});
		}
	}

	addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): boolean {
		if (this.authStore.isAuthenticated()) {
			console.warn('[CartService] addToCart() called for authenticated user — use addToCart$() instead');
		}
		const existing = this._items().find(i =>
			i.modelId === item.modelId &&
			!i.savedForLater &&
			(item.packageId
				? i.packageId === item.packageId
				: item.packageName
					? i.packageName === item.packageName
					: true)
		);
		if (existing) {
			return false;
		}
		const newItem: CartItem = {
			...item,
			id: this.generateId(),
			addedAt: new Date().toISOString(),
		};
		this._items.update(items => [...items, newItem]);
		this.persist();
		return true;
	}

	addToCart$(item: Omit<CartItem, 'id' | 'addedAt'>): Observable<boolean> {
		if (!this.authStore.isAuthenticated()) {
			return of(this.addToCart(item));
		}

		const existing = this._items().find(i =>
			i.modelId === item.modelId &&
			!i.savedForLater &&
			(item.packageId
				? i.packageId === item.packageId
				: item.packageName
					? i.packageName === item.packageName
					: true)
		);
		if (existing) {
			return of(false);
		}

		const payload: AddCartItemPayload = {
			modelId: item.modelId,
			packageId: item.packageId,
			savedForLater: item.savedForLater ?? false,
		};

		return this.cartApi.addItem(payload).pipe(
			map((res: any) => {
				const data = res?.data ?? res;
				const items = mapCartResponse(data as BackendCartResponse);
				this._items.set(items);
				return true;
			}),
			catchError((err: any) => {
				console.error('[CartService] addToCart$ failed:', err);
				const message = err?.error?.message || err?.message || 'تعذر إضافة الخدمة إلى السلة';
				return throwError(() => ({ ...err, displayMessage: message }));
			})
		);
	}

	removeFromCart(itemId: string): void {
		this._items.update(items => items.filter(i => i.id !== itemId));
		this.persist();

		if (this.authStore.isAuthenticated()) {
			this.cartApi.removeItem(itemId).subscribe({
				next: (res: any) => {
					const data = res?.data ?? res;
					const items = mapCartResponse(data as BackendCartResponse);
					this._items.set(items);
				},
				error: (err: any) => console.error('[CartService] removeFromCart backend failed:', err),
			});
		}
	}

	clearCart(): void {
		if (this.authStore.isAuthenticated()) {
			const itemsToRemove = [...this._items()];
			this._items.set([]);
			this._coupon.set(null);
			this.persist();
			this.persistCoupon();

			for (const item of itemsToRemove) {
				this.cartApi.removeItem(item.id).subscribe({
					error: (err: any) => console.error('[CartService] clearCart backend delete failed:', err),
				});
			}
		} else {
			this._items.set([]);
			this._coupon.set(null);
			this.persist();
			this.persistCoupon();
		}
	}

	saveForLater(itemId: string): void {
		const item = this._items().find(i => i.id === itemId);
		if (!item) return;

		const newValue = !item.savedForLater;
		this._items.update(items =>
			items.map(i => (i.id === itemId ? { ...i, savedForLater: newValue } : i))
		);
		this.persist();

		if (this.authStore.isAuthenticated()) {
			const payload: UpdateCartItemPayload = { savedForLater: newValue };
			this.cartApi.updateItem(itemId, payload).subscribe({
				next: (res: any) => {
					const data = res?.data ?? res;
					const items = mapCartResponse(data as BackendCartResponse);
					this._items.set(items);
				},
				error: (err: any) => console.error('[CartService] saveForLater backend failed:', err),
			});
		}
	}

	loadCart(): void {
		if (!this.isBrowser) return;
		if (this.isLoadingServerCart) return;

		// A user acting as a provider has no purchase cart (the server answers 403): nothing is requested, the cart is simply empty until the CLIENT role is active.
		if (this.authStore.isAuthenticated() && !this.authStore.canPurchase()) {
			this._items.set([]);
			this.cartReady.set(true);
			return;
		}

		if (this.authStore.isAuthenticated()) {
			this.isLoadingServerCart = true;
			this.cartApi.getCart().subscribe({
				next: (res: any) => {
					const data = res?.data ?? res;
					const items = mapCartResponse(data as BackendCartResponse);
					this._items.set(items);
					this.isLoadingServerCart = false;
					this.cartReady.set(true);
				},
				error: (err: any) => {
					console.error('[CartService] loadCart backend failed:', err);
					this.isLoadingServerCart = false;
					this.loadGuestCart();
				},
			});
		} else {
			this.loadGuestCart();
		}
	}

	private loadGuestCart(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as CartItem[];
				if (Array.isArray(parsed)) {
					this._items.set(parsed);
				}
			}
			const couponRaw = localStorage.getItem(COUPON_KEY);
			if (couponRaw) {
				const coupon = JSON.parse(couponRaw) as CouponData;
				if (coupon && coupon.code) {
					this._coupon.set(coupon);
				}
			}
		} catch {
			this._items.set([]);
			this._coupon.set(null);
		}
		this.cartReady.set(true);
	}

	applyCoupon(code: string): Observable<CouponResult> {
		const upper = code.trim().toUpperCase();
		if (!upper) {
			return of({ success: false, message: 'أدخل كود الكوبون' });
		}

		// Authenticated: validate via backend API (no mock fallback).
		if (this.authStore.isAuthenticated()) {
			const items = this._items()
				.filter(i => !i.savedForLater)
				.map(i => ({ modelId: i.modelId, totalAmount: i.totalAmount }));

			if (items.length === 0) {
				return of({ success: false, message: 'السلة فارغة، لا يمكن تطبيق الكوبون' });
			}

			const payload: CouponValidationPayload = { code: upper, items };
			return this.checkoutApi.validateCoupon(payload).pipe(
				map((res: any) => {
					// Backend wraps responses in { success: true, data: { ... } }
					const data = res?.data ?? res;
					const coupon: CouponData = {
						code: data.code || upper,
						discountType: data.discountType,
						discountValue: data.discountValue,
						discountAmount: data.discountAmount,
					};
					this._coupon.set(coupon);
					this.couponNotice.set(null);
					this.persistCoupon();
					return { success: true, message: 'تم تطبيق الكوبون', coupon } as CouponResult;
				}),
				catchError((err: any) => {
					console.error('[CartService] Coupon validation failed:', err);
					this._coupon.set(null);
					this.persistCoupon();
					const errBody = err?.error;
					const msg = errBody?.message || errBody?.error || err?.message || 'كوبون غير صالح';
					return of({ success: false, message: msg } as CouponResult);
				})
			);
		}

		// Guest: no local coupon exists — the backend needs a login to validate one.
		return of({ success: false, message: GUEST_COUPON_MESSAGE });
	}

	private revalidateCoupon(): void {
		const stored = this._coupon();
		if (!stored || !this.authStore.isAuthenticated() || !this.authStore.canPurchase()) return;
		const items = this._items().filter(i => !i.savedForLater).map(i => ({ modelId: i.modelId, totalAmount: i.totalAmount }));
		if (items.length === 0) { this.dropCoupon(`أُزيل الكوبون ${stored.code} لأن السلة فارغة`); return; }
		const seq = ++this.couponCheckSeq;
		this.checkoutApi.validateCoupon({ code: stored.code, items }).subscribe({
			next: (res: any) => {
				if (seq !== this.couponCheckSeq) return;
				const data = res?.data ?? res;
				this._coupon.set({ code: data.code || stored.code, discountType: data.discountType, discountValue: data.discountValue, discountAmount: data.discountAmount });
				this.persistCoupon();
			},
			error: (err: any) => {
				if (seq !== this.couponCheckSeq) return;
				const status = Number(err?.status);
				// only a definite refusal (4xx) drops the coupon; a network/server hiccup keeps it (the backend re-checks it when the order is created)
				if (status >= 400 && status < 500) {
					const reason = err?.error?.message || 'كوبون غير صالح';
					this.dropCoupon(`أُزيل الكوبون ${stored.code}: ${reason}`);
				}
			},
		});
	}

	private dropCoupon(notice: string): void {
		this._coupon.set(null);
		this.couponNotice.set(notice);
		this.persistCoupon();
	}

	removeCoupon(): void {
		this.couponNotice.set(null);
		this._coupon.set(null);
		this.persistCoupon();
	}

	private onLoginSync(): void {
		if (!this.isBrowser) return;
		if (this.hasSyncedThisSession) return;
		if (!this.authStore.canPurchase()) return; // acting as a provider: no purchase cart to merge into

		const localItems = this._items().filter(i => !i.savedForLater);
		if (localItems.length === 0) {
			this.hasSyncedThisSession = true;
			return;
		}

		this.hasSyncedThisSession = true;

		const payload: CartSyncPayload = {
			items: localItems.map(i => ({
				modelId: i.modelId,
				packageId: i.packageId,
				savedForLater: false,
			})),
		};

		this.cartApi.syncCart(payload).subscribe({
			next: (res: any) => {
				const data = res?.data ?? res;
				const items = mapCartResponse(data as BackendCartResponse);
				this._items.set(items);
				this.clearLocalStorage();
			},
			error: (err: any) => {
				console.error('[CartService] syncCart failed, keeping localStorage:', err);
			},
		});
	}

	private clearLocalStorage(): void {
		if (!this.isBrowser) return;
		try {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(COUPON_KEY);
		} catch {}
	}

	private persist(): void {
		if (!this.isBrowser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items()));
		} catch {}
	}

	private persistCoupon(): void {
		if (!this.isBrowser) return;
		try {
			const c = this._coupon();
			if (c) {
				localStorage.setItem(COUPON_KEY, JSON.stringify(c));
			} else {
				localStorage.removeItem(COUPON_KEY);
			}
		} catch {}
	}

	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
	}
}
