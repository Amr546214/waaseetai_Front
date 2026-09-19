import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface AffiliateChangeRequest {
	id: string;
	requestNumber: string;
	fieldType: string;
	fieldLabel: string;
	currentValue: string | null;
	requestedValue: string;
	status: 'PENDING_AI_REVIEW' | 'PENDING_HUMAN_APPROVAL' | 'APPROVED_AND_APPLIED' | 'REJECTED' | 'WITHDRAWN';
	aiRecommendation?: string;
	aiConfidenceScore?: number;
	rejectionReason?: string;
	reviewedBy?: string;
	appliedAt?: string;
	createdAt: string;
	affiliateProfile: {
		id: string;
		referralSlug: string | null;
		user: { id: string; firstName: string; lastName: string; email: string };
	};
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	message?: string;
}

@Injectable({ providedIn: 'root' })
export class SaModificationRequestsService {
	private http = inject(HttpClient);
	private readonly baseUrl = `${environment.url_api}/admin/affiliate-requests`;

	list(status?: string): Observable<ApiResponse<AffiliateChangeRequest[]>> {
		let params = new HttpParams();
		if (status) params = params.set('status', status);
		return this.http.get<ApiResponse<AffiliateChangeRequest[]>>(this.baseUrl, { params });
	}

	approve(id: string): Observable<ApiResponse<AffiliateChangeRequest>> {
		return this.http.post<ApiResponse<AffiliateChangeRequest>>(`${this.baseUrl}/${id}/approve`, {});
	}

	reject(id: string, rejectionReason: string): Observable<ApiResponse<AffiliateChangeRequest>> {
		return this.http.post<ApiResponse<AffiliateChangeRequest>>(`${this.baseUrl}/${id}/reject`, { rejectionReason });
	}
}
