import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CartService } from './cart.service';
import { CheckoutApiService, CheckoutOrderPayload, PaymentInitPayload, PaymentConfirmPayload, ResendPaymentOtpPayload } from './checkout-api.service';
import { mapOrder, BackendOrderResponse } from './checkout-mappers';
import { Order, OrderStatus, PaymentMethod } from '../models/checkout.model';

/**
 * Smallest compatible typed contract for the backend's wallet-insufficient
 * 402 response ({ success:false, message, errors:[{required,available,shortfall}] }
 * — see waseetai-backend's error.middleware.ts / cart-checkout.service.ts).
 * Only these three numbers are ever surfaced — never any other backend/error
 * internal detail (no raw error object, no stack, no message beyond the
 * fixed one already in `message`).
 */
export interface InsufficientBalanceInfo {
	required: number;
	available: number;
	shortfall: number;
}

/**
 * Structured classification of a checkout failure, derived ONLY from the
 * real HTTP status code the backend returned — never from string-matching
 * the Arabic `message`, which is free-form business copy and must stay
 * decoupled from routing/display decisions.
 *
 * - INSUFFICIENT_BALANCE (402): the one case with its own dedicated UI
 *   (required/available/shortfall + Add Funds) — never a "failure" at all.
 * - CONFLICT (409): a real, safe backend business message (e.g. "you
 *   already have an active request for this service") — must be shown
 *   inline, never as a payment failure, never via /checkout/failure.
 * - VALIDATION (400): a real, safe backend business-validation message —
 *   same treatment as CONFLICT.
 * - UNEXPECTED: anything else (5xx, network failure, an unrecognized
 *   shape) — the only case that may fall back to the neutral
 *   /checkout/failure screen.
 */
export type CheckoutErrorKind = 'INSUFFICIENT_BALANCE' | 'CONFLICT' | 'VALIDATION' | 'UNEXPECTED';

export interface CheckoutResult {
	success: boolean;
	message: string;
	data?: any;
	/** Present ONLY when the failure was specifically a 402 wallet-insufficient-balance response — never set for any other failure. */
	insufficientBalance?: InsufficientBalanceInfo;
	/** Present ONLY when success is false — see CheckoutErrorKind. */
	errorKind?: CheckoutErrorKind;
}

/**
 * Narrow, defensive extraction of the 402 insufficient-balance shape from a
 * raw Angular HttpErrorResponse — never trusts anything beyond `status` and
 * the three expected numeric fields; any other 402/4xx/5xx shape safely
 * yields undefined, falling through to the existing generic failure
 * handling untouched.
 */
function extractInsufficientBalance(err: any): InsufficientBalanceInfo | undefined {
	if (err?.status !== 402) return undefined;
	const detail = err?.error?.errors?.[0];
	if (
		detail &&
		typeof detail.required === 'number' &&
		typeof detail.available === 'number' &&
		typeof detail.shortfall === 'number'
	) {
		return { required: detail.required, available: detail.available, shortfall: detail.shortfall };
	}
	return undefined;
}

/** Classifies a failed HttpErrorResponse by its real status code only. */
function classifyCheckoutError(err: any): CheckoutErrorKind {
	const status = err?.status;
	if (status === 402) return 'INSUFFICIENT_BALANCE';
	if (status === 409) return 'CONFLICT';
	if (status === 400) return 'VALIDATION';
	return 'UNEXPECTED';
}

@Injectable({
	providedIn: 'root'
})
export class CheckoutService {
	private cartService = inject(CartService);
	private checkoutApi = inject(CheckoutApiService);

	private readonly _currentOrder = signal<Order | null>(null);
	private readonly _paymentMethod = signal<PaymentMethod | null>(null);
	private readonly _paymentReference = signal<string | null>(null);
	private readonly _otpSentTo = signal<string | null>(null);
	private readonly _isProcessing = signal(false);
	private readonly _error = signal<string | null>(null);

	readonly currentOrder = this._currentOrder.asReadonly();
	readonly paymentMethod = this._paymentMethod.asReadonly();
	readonly paymentReference = this._paymentReference.asReadonly();
	readonly otpSentTo = this._otpSentTo.asReadonly();
	readonly maskedPhone = this._otpSentTo.asReadonly();
	readonly isProcessing = this._isProcessing.asReadonly();
	readonly error = this._error.asReadonly();

	createOrder(): Observable<CheckoutResult> {
		const items = this.cartService.items().filter(i => !i.savedForLater);
		if (items.length === 0) {
			this._error.set('السلة فارغة، لا يمكن إنشاء طلب');
			return of({ success: false, message: 'السلة فارغة، لا يمكن إنشاء طلب' });
		}

		this._error.set(null);
		this._isProcessing.set(true);

		const payload: CheckoutOrderPayload = {
			items: items.map(i => ({ modelId: i.modelId, packageId: i.packageId })),
			couponCode: this.cartService.coupon()?.code ?? null,
		};

		return this.checkoutApi.createOrder(payload).pipe(
			map((res: any) => {
				const data = res?.data ?? res;
				const order = mapOrder(data as BackendOrderResponse);
				this._currentOrder.set(order);
				this._isProcessing.set(false);
				return { success: true, message: 'تم إنشاء الطلب', data: order } as CheckoutResult;
			}),
			catchError((err: any) => {
				console.error('[CheckoutService] createOrder failed:', err);
				this._isProcessing.set(false);
				const errBody = err?.error;
				const msg = errBody?.message || errBody?.error || err?.message || 'فشل إنشاء الطلب';
				this._error.set(msg);
				return of({ success: false, message: msg, errorKind: classifyCheckoutError(err) } as CheckoutResult);
			})
		);
	}

	initiatePayment(method: PaymentMethod): Observable<CheckoutResult> {
		const order = this._currentOrder();
		if (!order) {
			this._error.set('لا يوجد طلب نشط');
			return of({ success: false, message: 'لا يوجد طلب نشط' });
		}

		this._error.set(null);
		this._isProcessing.set(true);
		this._paymentMethod.set(method);

		const payload: PaymentInitPayload = {
			orderId: order.id,
			paymentMethod: method,
		};

		return this.checkoutApi.initiatePayment(payload).pipe(
			map((res: any) => {
				const data = res?.data ?? res;
				this._paymentReference.set(data.paymentReference);
				this._otpSentTo.set(data.otpSentTo);
				this._isProcessing.set(false);
				return {
					success: true,
					message: 'تم إرسال رمز التحقق',
					data: {
						paymentReference: data.paymentReference,
						otpSentTo: data.otpSentTo,
						expiresAt: data.expiresAt,
					},
				} as CheckoutResult;
			}),
			catchError((err: any) => {
				console.error('[CheckoutService] initiatePayment failed:', err);
				this._isProcessing.set(false);
				const errBody = err?.error;
				const msg = errBody?.message || errBody?.error || err?.message || 'فشل بدء عملية الدفع';
				this._error.set(msg);
				const insufficientBalance = extractInsufficientBalance(err);
				return of({
					success: false,
					message: msg,
					errorKind: classifyCheckoutError(err),
					...(insufficientBalance && { insufficientBalance }),
				} as CheckoutResult);
			})
		);
	}

	confirmPayment(otp: string): Observable<CheckoutResult> {
		const order = this._currentOrder();
		if (!order) {
			this._error.set('لا يوجد طلب نشط');
			return of({ success: false, message: 'لا يوجد طلب نشط' });
		}

		if (!this._paymentReference()) {
			this._error.set('لم يتم بدء عملية الدفع');
			return of({ success: false, message: 'لم يتم بدء عملية الدفع' });
		}

		this._error.set(null);
		this._isProcessing.set(true);

		const payload: PaymentConfirmPayload = {
			orderId: order.id,
			otpCode: otp,
		};

		return this.checkoutApi.confirmPayment(payload).pipe(
			map((res: any) => {
				const data = res?.data ?? res;
				const updatedOrder: Order = { ...order, status: (data.status || 'paid') as OrderStatus };
				this._currentOrder.set(updatedOrder);
				this._isProcessing.set(false);
				this.cartService.clearCart();
				return {
					success: true,
					message: 'تم تأكيد الدفع بنجاح',
					data: {
						orderId: data.orderId || updatedOrder.id,
						orderNumber: data.orderNumber || updatedOrder.orderNumber,
						status: data.status || 'paid',
						total: data.total ?? updatedOrder.total,
						projectIds: data.projectIds || [],
					},
				} as CheckoutResult;
			}),
			catchError((err: any) => {
				console.error('[CheckoutService] confirmPayment failed:', err);
				this._isProcessing.set(false);
				const errBody = err?.error;
				const msg = errBody?.message || errBody?.error || err?.message || 'رمز التحقق غير صحيح';
				this._error.set(msg);
				const insufficientBalance = extractInsufficientBalance(err);
				return of({
					success: false,
					message: msg,
					errorKind: classifyCheckoutError(err),
					...(insufficientBalance && { insufficientBalance }),
				} as CheckoutResult);
			})
		);
	}

	resendOtp(): Observable<CheckoutResult> {
		const order = this._currentOrder();
		if (!order) {
			this._error.set('لا يوجد طلب نشط');
			return of({ success: false, message: 'لا يوجد طلب نشط' });
		}
		if (!this._paymentReference()) {
			this._error.set('لم يتم بدء عملية الدفع');
			return of({ success: false, message: 'لم يتم بدء عملية الدفع' });
		}
		this._error.set(null);

		const payload: ResendPaymentOtpPayload = { orderId: order.id };

		return this.checkoutApi.resendPaymentOtp(payload).pipe(
			map((res: any) => {
				const data = res?.data ?? res;
				if (data.paymentReference) {
					this._paymentReference.set(data.paymentReference);
				}
				if (data.otpSentTo) {
					this._otpSentTo.set(data.otpSentTo);
				}
				return { success: true, message: 'تم إعادة إرسال رمز التحقق' } as CheckoutResult;
			}),
			catchError((err: any) => {
				console.error('[CheckoutService] resendOtp failed:', err);
				const errBody = err?.error;
				const msg = errBody?.message || errBody?.error || err?.message || 'فشل إعادة إرسال الرمز';
				this._error.set(msg);
				return of({ success: false, message: msg } as CheckoutResult);
			})
		);
	}

	hydrateOrder(order: Order): void {
		this._currentOrder.set(order);
	}

	reset(): void {
		this._currentOrder.set(null);
		this._paymentMethod.set(null);
		this._paymentReference.set(null);
		this._otpSentTo.set(null);
		this._isProcessing.set(false);
		this._error.set(null);
	}
}
