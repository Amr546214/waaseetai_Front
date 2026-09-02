import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CartItem } from '../models/checkout.model';

export interface AddCartItemPayload {
	modelId: string;
	packageId?: string;
	savedForLater?: boolean;
}

export interface UpdateCartItemPayload {
	packageId?: string;
	savedForLater?: boolean;
}

export interface CartSyncPayload {
	items: AddCartItemPayload[];
}

export interface CartResponse {
	id: string;
	items: CartItem[];
}

@Injectable({
	providedIn: 'root',
})
export class CartApiService {
	private http = inject(HttpClient);
	private baseUrl = `${environment.url_api}/cart`;

	getCart(): Observable<CartResponse> {
		return this.http.get<CartResponse>(this.baseUrl);
	}

	addItem(payload: AddCartItemPayload): Observable<CartResponse> {
		return this.http.post<CartResponse>(this.baseUrl + '/items', payload);
	}

	updateItem(id: string, payload: UpdateCartItemPayload): Observable<CartResponse> {
		return this.http.put<CartResponse>(`${this.baseUrl}/items/${id}`, payload);
	}

	removeItem(id: string): Observable<CartResponse> {
		return this.http.delete<CartResponse>(`${this.baseUrl}/items/${id}`);
	}

	syncCart(payload: CartSyncPayload): Observable<CartResponse> {
		return this.http.post<CartResponse>(this.baseUrl + '/sync', payload);
	}
}
