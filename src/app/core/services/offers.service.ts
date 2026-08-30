import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class OffersService {
	private http = inject(HttpClient);

	/**
	 * Fetch all offers for the provider with optional filtering params
	 */
	getOffers(params?: any): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/offers`, { params });
	}

	/**
	 * Fetch a specific offer by ID
	 * Note: As the backend currently lacks a dedicated endpoint for specific offers,
	 * this simulates it by fetching the list and filtering locally.
	 */
	getOfferById(id: string): Observable<any> {
		return this.getOffers().pipe(
			map(res => {
				if (res && res.data) {
					const item = res.data.find((o: any) => (o.offerId || o.id) === id);
					if (item) return item;
				}
				throw new Error(`Offer with id ${id} not found.`);
			})
		);
	}

	/**
	 * Sign the contract and deposit escrow
	 */
	signContract(offerId: string, agreedTerms?: any): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/offers/${offerId}/sign`, { agreedTerms });
	}
}
