export interface CartProvider {
	id: string;
	name: string;
	avatar?: string;
	initials: string;
	isVerified?: boolean;
}

export interface CartPackage {
	id: string;
	name: string;
	price: number;
	deliveryDays: number;
	deliverables: string[];
}

export interface CartItem {
	id: string;
	modelId: string;
	title: string;
	category: string;
	categorySlug?: string;
	specializationSlug?: string;
	coverImage?: string;
	totalAmount: number;
	totalDays: number;
	level?: string;
	aiScore?: number;
	provider: CartProvider;
	packageId?: string;
	packageName?: string;
	addedAt: string;
	savedForLater?: boolean;
}

export interface CouponData {
	code: string;
	discountType: 'percentage' | 'fixed';
	discountValue: number;
	discountAmount: number;
}

// Wallet-only internal purchasing: the WaseetAI Wallet is the ONLY accepted
// checkout payment method. PayPal is the wallet
// TOP-UP rails only (see the shared Add Funds deposit modal) — never a
// direct checkout payment method again.
export type PaymentMethod = 'wallet';

export type OrderStatus = 'pending_payment' | 'paid' | 'failed' | 'cancelled';

export interface OrderItem {
	id?: string;
	modelId: string;
	title: string;
	category?: string;
	totalAmount: number;
	totalDays: number;
	provider: { id: string; name: string };
	packageName?: string;
	aiScore?: number;
	deliverables?: string[];
	milestones?: { label: string; sub: string }[];
}

export interface Order {
	id: string;
	orderId?: string;
	orderNumber: string;
	status: OrderStatus;
	items: OrderItem[];
	subtotal: number;
	discount: number;
	total: number;
	couponCode?: string;
	createdAt: string;
}

export interface CheckoutTotals {
	subtotal: number;
	discount: number;
	total: number;
	itemCount: number;
}
