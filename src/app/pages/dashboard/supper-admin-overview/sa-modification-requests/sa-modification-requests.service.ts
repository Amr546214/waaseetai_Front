import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProfileAiReview } from '../../../../core/models/ai-result.model';
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

/** A provider's or a client's governed-field request (profile_modification_requests), as the admin queue returns it. */
export interface ProfileModificationRequestRow {
	id: string;
	fieldName: string;
	fieldLabel: string;
	currentValue: string | null;
	requestedValue: string;
	category: string;
	status: 'PENDING_OTP' | 'IN_AI_REVIEW' | 'PENDING_HUMAN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
	/** advisory AI pre-review; null when none ran. Legacy aiRecommendation / aiConfidence columns are not displayed. */
	aiReview?: ProfileAiReview | null;
	rejectionReason?: string | null;
	appliedAt?: string | null;
	createdAt: string;
	provider: { firstName: string; lastName: string; email: string; accountType: string };
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
	// Provider + client requests live in ProfileModificationRequest; their admin endpoints sit under the provider-profile router.
	private readonly profileUrl = `${environment.url_api}/provider/profile`;

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

	/** Provider + client requests: the queue and (with status=ALL) the decided history. */
	listProfileRequests(status: string = 'ALL'): Observable<ApiResponse<ProfileModificationRequestRow[]>> {
		return this.http.get<ApiResponse<ProfileModificationRequestRow[]>>(`${this.profileUrl}/admin/pending-reviews`, { params: new HttpParams().set('status', status) });
	}

	reviewProfileRequest(id: string, approved: boolean, rejectionReason?: string): Observable<ApiResponse<ProfileModificationRequestRow>> {
		return this.http.post<ApiResponse<ProfileModificationRequestRow>>(`${this.profileUrl}/requests/${id}/review`, { approved, ...(rejectionReason ? { rejectionReason } : {}) });
	}
}
