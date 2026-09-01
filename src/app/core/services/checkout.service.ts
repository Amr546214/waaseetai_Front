// Temporary frontend-only checkout/payment mock until real checkout backend endpoints are confirmed.
// Marketplace service data must come from real CartService items.
import { inject, Injectable, signal } from '@angular/core';
import { CartService } from './cart.service';
import { CartItem, Order, OrderItem, OrderStatus, PaymentMethod } from '../models/checkout.model';

interface CheckoutResult {
	success: boolean;
	message: string;
	data?: any;
}

const MOCK_OTP = '123456';
const MOCK_MASKED_PHONE = '+966 5• ••• ••42';

let orderCounter = 0;

@Injectable({
	providedIn: 'root'
})
export class CheckoutService {
	private cartService = inject(CartService);

	private readonly _currentOrder = signal<Order | null>(null);
	private readonly _paymentMethod = signal<PaymentMethod | null>(null);
	private readonly _paymentReference = signal<string | null>(null);
	private readonly _maskedPhone = signal<string | null>(null);
	private readonly _isProcessing = signal(false);
	private readonly _error = signal<string | null>(null);

	readonly currentOrder = this._currentOrder.asReadonly();
	readonly paymentMethod = this._paymentMethod.asReadonly();
	readonly paymentReference = this._paymentReference.asReadonly();
	readonly maskedPhone = this._maskedPhone.asReadonly();
	readonly isProcessing = this._isProcessing.asReadonly();
	readonly error = this._error.asReadonly();

	createOrder(): CheckoutResult {
		const items = this.cartService.items().filter(i => !i.savedForLater);
		if (items.length === 0) {
			this._error.set('السلة فارغة، لا يمكن إنشاء طلب');
			return { success: false, message: 'السلة فارغة، لا يمكن إنشاء طلب' };
		}

		this._error.set(null);
		orderCounter++;
		const year = new Date().getFullYear();
		const orderNumber = `WS-${year}-${String(orderCounter).padStart(6, '0')}`;
		const orderId = this.generateId();

		const orderItems: OrderItem[] = items.map((item: CartItem) => ({
			modelId: item.modelId,
			title: item.title,
			category: item.category,
			totalAmount: item.totalAmount,
			totalDays: item.totalDays,
			provider: { id: item.provider.id, name: item.provider.name },
			packageName: item.packageName,
			deliverables: [],
			milestones: [],
		}));

		const coupon = this.cartService.coupon();

		const order: Order = {
			id: orderId,
			orderNumber,
			status: 'pending_payment',
			items: orderItems,
			subtotal: this.cartService.subtotal(),
			discount: this.cartService.discount(),
			total: this.cartService.total(),
			couponCode: coupon?.code,
			createdAt: new Date().toISOString(),
		};

		this._currentOrder.set(order);
		return { success: true, message: 'تم إنشاء الطلب', data: order };
	}

	initiatePayment(method: PaymentMethod): CheckoutResult {
		const order = this._currentOrder();
		if (!order) {
			this._error.set('لا يوجد طلب نشط');
			return { success: false, message: 'لا يوجد طلب نشط' };
		}

		this._error.set(null);
		this._isProcessing.set(true);
		this._paymentMethod.set(method);

		const reference = `PAY-${Date.now().toString(36).toUpperCase()}`;
		this._paymentReference.set(reference);
		this._maskedPhone.set(MOCK_MASKED_PHONE);

		this._isProcessing.set(false);
		return {
			success: true,
			message: 'تم إرسال رمز التحقق',
			data: {
				paymentReference: reference,
				otpSentTo: MOCK_MASKED_PHONE,
				expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
			},
		};
	}

	confirmPayment(otp: string): CheckoutResult {
		const order = this._currentOrder();
		if (!order) {
			this._error.set('لا يوجد طلب نشط');
			return { success: false, message: 'لا يوجد طلب نشط' };
		}

		if (!this._paymentReference()) {
			this._error.set('لم يتم بدء عملية الدفع');
			return { success: false, message: 'لم يتم بدء عملية الدفع' };
		}

		this._error.set(null);
		this._isProcessing.set(true);

		if (otp === MOCK_OTP) {
			const updatedOrder: Order = { ...order, status: 'paid' };
			this._currentOrder.set(updatedOrder);
			this._isProcessing.set(false);
			return {
				success: true,
				message: 'تم تأكيد الدفع بنجاح',
				data: {
					orderId: updatedOrder.id,
					orderNumber: updatedOrder.orderNumber,
					status: 'paid' as OrderStatus,
					total: updatedOrder.total,
				},
			};
		}

		const failedOrder: Order = { ...order, status: 'failed' };
		this._currentOrder.set(failedOrder);
		this._isProcessing.set(false);
		this._error.set('رمز التحقق غير صحيح');
		return { success: false, message: 'رمز التحقق غير صحيح' };
	}

	resendOtp(): CheckoutResult {
		if (!this._paymentReference()) {
			this._error.set('لم يتم بدء عملية الدفع');
			return { success: false, message: 'لم يتم بدء عملية الدفع' };
		}
		this._error.set(null);
		return { success: true, message: 'تم إعادة إرسال رمز التحقق' };
	}

	getOrder(): Order | null {
		return this._currentOrder();
	}

	reset(): void {
		this._currentOrder.set(null);
		this._paymentMethod.set(null);
		this._paymentReference.set(null);
		this._maskedPhone.set(null);
		this._isProcessing.set(false);
		this._error.set(null);
	}

	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
	}
}
