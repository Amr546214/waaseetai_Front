import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CouponData, Order } from '../models/checkout.model';

export interface CouponValidationPayload {
	code: string;
	items: { modelId: string; totalAmount: number }[];
}

export interface CouponValidationResponse extends CouponData {}

export interface CheckoutOrderPayload {
	items: { modelId: string; packageId?: string }[];
	couponCode?: string | null;
}

export interface OrderResponse extends Order {}

export interface PaymentMethodItem {
	id: string;
	name: string;
	available: boolean;
	balance?: number;
	badge?: string;
}

export interface PaymentInitPayload {
	orderId: string;
	paymentMethod: 'card' | 'moyasar' | 'wallet';
}

export interface PaymentInitResponse {
	paymentReference: string;
	otpSentTo: string;
	expiresAt: string;
}

export interface PaymentConfirmPayload {
	orderId: string;
	otpCode: string;
}

export interface PaymentConfirmResponse {
	orderId: string;
	orderNumber: string;
	status: string;
	total: number;
	projectIds: string[];
}

export interface ResendPaymentOtpPayload {
	orderId: string;
}

@Injectable({
	providedIn: 'root',
})
export class CheckoutApiService {
	private http = inject(HttpClient);
	private baseUrl = `${environment.url_api}/checkout`;

	validateCoupon(payload: CouponValidationPayload): Observable<CouponValidationResponse> {
		return this.http.post<CouponValidationResponse>(this.baseUrl + '/coupon/validate', payload);
	}

	createOrder(payload: CheckoutOrderPayload): Observable<OrderResponse> {
		return this.http.post<OrderResponse>(this.baseUrl + '/order', payload);
	}

	getOrder(id: string): Observable<OrderResponse> {
		return this.http.get<OrderResponse>(`${this.baseUrl}/order/${id}`);
	}

	getPaymentMethods(): Observable<PaymentMethodItem[]> {
		return this.http.get<PaymentMethodItem[]>(this.baseUrl + '/payment/methods');
	}

	initiatePayment(payload: PaymentInitPayload): Observable<PaymentInitResponse> {
		return this.http.post<PaymentInitResponse>(this.baseUrl + '/payment/init', payload);
	}

	confirmPayment(payload: PaymentConfirmPayload): Observable<PaymentConfirmResponse> {
		return this.http.post<PaymentConfirmResponse>(this.baseUrl + '/payment/confirm', payload);
	}

	resendPaymentOtp(payload: ResendPaymentOtpPayload): Observable<PaymentInitResponse> {
		return this.http.post<PaymentInitResponse>(this.baseUrl + '/payment/resend-otp', payload);
	}
}
