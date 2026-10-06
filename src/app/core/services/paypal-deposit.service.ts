import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientWalletData } from './client-finance.service';

// PayPal Sandbox wallet deposit (the only wallet deposit rail)
// (ClientFinanceService), calling its own backend routes under the same
// authenticated /client/finance base path.

export interface PaypalOrderCreateResponse {
	paypalOrderId: string;
}

@Injectable({
	providedIn: 'root'
})
export class PaypalDepositService {
	private http = inject(HttpClient);
	private baseUrl = `${environment.url_api}/client/finance/paypal`;

	createOrder(amount: number): Observable<{ success: boolean; data: PaypalOrderCreateResponse }> {
		return this.http.post<{ success: boolean; data: PaypalOrderCreateResponse }>(`${this.baseUrl}/order/create`, { amount });
	}

	captureOrder(paypalOrderId: string): Observable<{ success: boolean; message: string; data: ClientWalletData }> {
		return this.http.post<{ success: boolean; message: string; data: ClientWalletData }>(`${this.baseUrl}/order/capture`, { paypalOrderId });
	}
}
