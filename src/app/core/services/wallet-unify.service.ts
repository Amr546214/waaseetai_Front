import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WalletBreakdown, WalletCard, WalletPagination } from '../models/wallet-unify.model';

export type WalletRole = 'client' | 'provider' | 'marketer';

/** One line of a full-history page (any role): the stored row fields the backend returns plus its breakdown. */
export interface WalletHistoryItem {
	id: string;
	type?: string;
	category?: string;
	direction?: 'in' | 'out';
	amount: number;
	currency?: string;
	status?: string;
	title?: string;
	description?: string;
	projectId?: string;
	projectTitle?: string;
	createdAt: string;
	breakdown?: WalletBreakdown;
	[key: string]: unknown;
}

export interface WalletHistoryPage {
	items: WalletHistoryItem[];
	pagination: WalletPagination;
	summary?: { cards?: Record<string, WalletCard>; [key: string]: unknown };
}

@Injectable({ providedIn: 'root' })
export class WalletUnifyService {
	private http = inject(HttpClient);
	private api = environment.url_api;

	private historyUrl(role: WalletRole): string {
		return role === 'client' ? `${this.api}/client/finance/wallet/history`
			: role === 'provider' ? `${this.api}/provider/finance/history`
			: `${this.api}/marketer-overview/wallet/history`;
	}

	history(role: WalletRole, page: number, limit: number, type?: string): Observable<{ success: boolean; data: WalletHistoryPage }> {
		let params = new HttpParams().set('page', page).set('limit', limit);
		if (type && type !== 'all') params = params.set('type', type);
		return this.http.get<{ success: boolean; data: WalletHistoryPage }>(this.historyUrl(role), { params });
	}

	/** One record, owner only: the server answers 404 for another account's record exactly like for an unknown id. */
	detail(role: 'provider' | 'marketer', id: string): Observable<{ success: boolean; data: any }> {
		const url = role === 'provider' ? `${this.api}/provider/finance/transactions/${encodeURIComponent(id)}` : `${this.historyUrl('marketer')}/${encodeURIComponent(id)}`;
		return this.http.get<{ success: boolean; data: any }>(url);
	}
}
