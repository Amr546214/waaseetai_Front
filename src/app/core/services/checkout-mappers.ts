import { CartItem, Order, OrderItem } from '../models/checkout.model';

export interface BackendCartItemResponse {
	id: string;
	modelId: string;
	title: string;
	category: string;
	categorySlug?: string;
	specializationSlug?: string;
	totalAmount: number;
	totalDays: number;
	aiScore?: number | null;
	level?: string;
	provider: {
		id: string;
		name: string;
		avatar?: string;
		initials?: string;
		isVerified?: boolean;
	};
	packageName?: string;
	addedAt: string;
	savedForLater?: boolean;
}

export interface BackendCartResponse {
	id: string;
	items: BackendCartItemResponse[];
}

export interface BackendOrderItemResponse {
	id?: string;
	modelId: string;
	title: string;
	provider: { id: string; name: string };
	packageName?: string;
	price: number;
	deliveryDays: number;
	aiScore?: number | null;
}

export interface BackendOrderResponse {
	id: string;
	orderId?: string;
	orderNumber: string;
	status: string;
	items: BackendOrderItemResponse[];
	subtotal: number;
	discount: number;
	total: number;
	couponCode?: string | null;
	createdAt: string;
}

export function mapCartItem(item: BackendCartItemResponse): CartItem {
	return {
		id: item.id,
		modelId: item.modelId,
		title: item.title,
		category: item.category,
		categorySlug: item.categorySlug,
		specializationSlug: item.specializationSlug,
		totalAmount: item.totalAmount,
		totalDays: item.totalDays,
		aiScore: item.aiScore,
		level: item.level,
		provider: {
			id: item.provider.id,
			name: item.provider.name,
			avatar: item.provider.avatar,
			initials: item.provider.initials || item.provider.name.slice(0, 2),
			isVerified: item.provider.isVerified,
		},
		packageName: item.packageName,
		addedAt: item.addedAt,
		savedForLater: item.savedForLater,
	};
}

export function mapCartResponse(cart: BackendCartResponse): CartItem[] {
	return (cart.items || []).map(mapCartItem);
}

export function mapOrderItem(item: BackendOrderItemResponse): OrderItem {
	return {
		id: item.id,
		modelId: item.modelId,
		title: item.title,
		totalAmount: item.price,
		totalDays: item.deliveryDays,
		provider: { id: item.provider.id, name: item.provider.name },
		packageName: item.packageName,
		aiScore: item.aiScore,
	};
}

export function mapOrder(order: BackendOrderResponse): Order {
	return {
		id: order.id,
		orderId: order.orderId,
		orderNumber: order.orderNumber,
		status: order.status as Order['status'],
		items: (order.items || []).map(mapOrderItem),
		subtotal: order.subtotal,
		discount: order.discount,
		total: order.total,
		couponCode: order.couponCode ?? undefined,
		createdAt: order.createdAt,
	};
}
