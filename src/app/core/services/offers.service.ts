import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** What the provider may do on one offer right now (GET /provider/offers/:id/negotiation or /provider/projects/:projectId/negotiation). */
export interface OfferNegotiationState {
	offerId: string;
	projectId: string;
	status: string;
	canWithdraw: boolean;
	canCounter: boolean;
	canReject: boolean;
	counterPending: boolean;
	/** The client's newest unanswered request; numbers are null when the client typed free text. */
	request: { messageId: string; price: number | null; deliveryDays: number | null; notes: string; clear: boolean; createdAt: string } | null;
	/** Why the request cannot be acted on automatically (free text), otherwise null. */
	counter: { messageId: string; price: number | null; deliveryDays: number | null; notes: string; createdAt: string } | null;
	hint: string | null;
}

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

	/** Negotiation state of an offer (read only). */
	getNegotiation(offerId: string): Observable<OfferNegotiationState> {
		return this.http.get<{ data: OfferNegotiationState }>(`${environment.url_api}/provider/offers/${offerId}/negotiation`).pipe(map(res => res.data));
	}

	/** Same state keyed by the project (the messages page knows the project, not the offer). */
	getNegotiationByProject(projectId: string): Observable<OfferNegotiationState> {
		return this.http.get<{ data: OfferNegotiationState }>(`${environment.url_api}/provider/projects/${projectId}/negotiation`).pipe(map(res => res.data));
	}

	/** Withdraw the offer (it becomes CANCELLED). */
	withdrawOffer(offerId: string): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/offers/${offerId}/withdraw`, {});
	}

	/** A counter offer: recorded as a structured message and waits for the client; it changes nothing on the offer itself. */
	counterOffer(offerId: string, payload: { price: number; deliveryDays: number; note?: string }): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/offers/${offerId}/counter`, payload);
	}

	/** Decline the client's newest (clear) negotiation request: the offer returns to SUBMITTED with its original values. */
	rejectNegotiation(offerId: string, messageId: string): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/offers/${offerId}/negotiation/reject`, { messageId });
	}
}
