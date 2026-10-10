import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** NONE = nothing uploaded, PENDING = waiting for the admin, APPROVED = identity verified, REJECTED = the admin refused it (with the reason). */
export type MarketerKycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
export interface MarketerKycState { status: MarketerKycStatus; rejectionReason: string | null; reviewedAt: string | null }

export interface MarketerKycRequest {
	affiliateId: string;
	userId: string;
	referralSlug: string | null;
	name: string;
	email: string | null;
	submittedAt: string;
}
export interface MarketerKycRequestsPage {
	items: MarketerKycRequest[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Marketer identity document (backend PR #49): the marketer uploads and reads the status; an admin reviews. */
@Injectable({ providedIn: 'root' })
export class MarketerKycService {
	private readonly http = inject(HttpClient);
	private readonly marketerUrl = `${environment.url_api}/marketer/profile`;
	private readonly adminUrl = `${environment.url_api}/admin/brokers/kyc-requests`;

	getStatus(): Observable<MarketerKycState> {
		return this.http.get<{ data: Partial<MarketerKycState> & { status: MarketerKycStatus } }>(`${this.marketerUrl}/kyc-status`).pipe(
			map(r => ({ status: r.data.status, rejectionReason: r.data.rejectionReason ?? null, reviewedAt: r.data.reviewedAt ?? null })));
	}

	/** Multipart field "file". The response never carries the stored reference. */
	upload(file: File): Observable<{ status: MarketerKycStatus }> {
		const form = new FormData();
		form.append('file', file, file.name);
		return this.http.post<{ data: { status: MarketerKycStatus } }>(`${this.marketerUrl}/kyc-document`, form).pipe(map(r => r.data));
	}

	// ── admin ──
	listRequests(page = 1, limit = 20): Observable<MarketerKycRequestsPage> {
		const params = new HttpParams().set('page', page).set('limit', limit);
		return this.http.get<{ data: MarketerKycRequestsPage }>(this.adminUrl, { params }).pipe(map(r => r.data));
	}
	approve(affiliateId: string): Observable<unknown> {
		return this.http.post(`${this.adminUrl}/${encodeURIComponent(affiliateId)}/approve`, {});
	}
	reject(affiliateId: string, reason: string): Observable<unknown> {
		return this.http.post(`${this.adminUrl}/${encodeURIComponent(affiliateId)}/reject`, { reason });
	}
}
