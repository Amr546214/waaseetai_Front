import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClientCounterState {
	offerId: string;
	legacyOfferId: string | null;
	status: string;
	counter: { messageId: string; price: number | null; deliveryDays: number | null; notes: string; createdAt: string; clear: boolean } | null;
	canAccept: boolean;
}

export interface ClientCounterAccepted {
	offerId: string;
	legacyOfferId: string | null;
	status: string;
	price: number;
	currency?: string;
	deliveryDays: number;
	messageId: string;
}

/** The client's side of a provider counter-offer: read the pending counter and accept it (the server re-checks owner, latest counter and offer state). */
@Injectable({ providedIn: 'root' })
export class ClientOfferCounterService {
	private http = inject(HttpClient);

	private base(requestId: string, offerId: string) {
		return `${environment.url_api}/client/my-requests/${encodeURIComponent(requestId)}/offers/${encodeURIComponent(offerId)}/counter`;
	}

	getCounter(requestId: string, offerId: string): Observable<ClientCounterState> {
		return this.http.get<{ data: ClientCounterState }>(this.base(requestId, offerId)).pipe(map(res => res.data));
	}

	/** Accepts the NEWEST pending counter (`messageId`); the offer then carries the counter's price and days. */
	acceptCounter(requestId: string, offerId: string, messageId: string): Observable<ClientCounterAccepted> {
		return this.http.post<{ data: ClientCounterAccepted }>(`${this.base(requestId, offerId)}/accept`, { messageId }).pipe(map(res => res.data));
	}

	/** Declines the NEWEST pending counter: the offer keeps its original terms (back to SUBMITTED). */
	declineCounter(requestId: string, offerId: string, messageId: string): Observable<{ offerId: string; status: string }> {
		return this.http.post<{ data: { offerId: string; status: string } }>(`${this.base(requestId, offerId)}/decline`, { messageId }).pipe(map(res => res.data));
	}
}
