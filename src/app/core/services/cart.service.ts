import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem, CouponData } from '../models/checkout.model';

const STORAGE_KEY = 'waseet_cart';
const COUPON_KEY = 'waseet_cart_coupon';

interface CouponResult {
	success: boolean;
	message: string;
	coupon?: CouponData;
}

const MOCK_COUPONS: Record<string, { discountType: 'percentage' | 'fixed'; discountValue: number }> = {
	WASEET10: { discountType: 'percentage', discountValue: 10 },
};

@Injectable({
	providedIn: 'root'
})
export class CartService {
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);

	private readonly _items = signal<CartItem[]>([]);
	private readonly _coupon = signal<CouponData | null>(null);

	readonly items = this._items.asReadonly();
	readonly coupon = this._coupon.asReadonly();

	readonly itemCount = computed(() => this._items().filter(i => !i.savedForLater).length);
	readonly subtotal = computed(() =>
		this._items()
			.filter(i => !i.savedForLater)
			.reduce((sum, i) => sum + i.totalAmount, 0)
	);
	readonly discount = computed(() => {
		const c = this._coupon();
		if (!c) return 0;
		const sub = this.subtotal();
		if (c.discountType === 'percentage') {
			return Math.round((sub * c.discountValue) / 100 * 100) / 100;
		}
		return Math.min(c.discountValue, sub);
	});
	readonly total = computed(() => Math.max(0, this.subtotal() - this.discount()));

	constructor() {
		this.loadCart();
	}

	addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): void {
		const existing = this._items().find(i => i.modelId === item.modelId && i.packageId === item.packageId && !i.savedForLater);
		if (existing) {
			return;
		}
		const newItem: CartItem = {
			...item,
			id: this.generateId(),
			addedAt: new Date().toISOString(),
		};
		this._items.update(items => [...items, newItem]);
		this.persist();
	}

	removeFromCart(itemId: string): void {
		this._items.update(items => items.filter(i => i.id !== itemId));
		this.persist();
	}

	clearCart(): void {
		this._items.set([]);
		this._coupon.set(null);
		this.persist();
		this.persistCoupon();
	}

	saveForLater(itemId: string): void {
		this._items.update(items =>
			items.map(i => (i.id === itemId ? { ...i, savedForLater: !i.savedForLater } : i))
		);
		this.persist();
	}

	loadCart(): void {
		if (!this.isBrowser) return;
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
	}

	applyCoupon(code: string): CouponResult {
		const upper = code.trim().toUpperCase();
		const mock = MOCK_COUPONS[upper];
		if (!mock) {
			this._coupon.set(null);
			this.persistCoupon();
			return { success: false, message: 'كوبون غير صالح' };
		}
		const sub = this.subtotal();
		const discountAmount =
			mock.discountType === 'percentage'
				? Math.round((sub * mock.discountValue) / 100 * 100) / 100
				: Math.min(mock.discountValue, sub);
		const coupon: CouponData = {
			code: upper,
			discountType: mock.discountType,
			discountValue: mock.discountValue,
			discountAmount,
		};
		this._coupon.set(coupon);
		this.persistCoupon();
		return { success: true, message: 'تم تطبيق الكوبون', coupon };
	}

	removeCoupon(): void {
		this._coupon.set(null);
		this.persistCoupon();
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
