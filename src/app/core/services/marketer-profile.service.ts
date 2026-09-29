import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export enum ChangeRequestStatus {
	PENDING_AI_REVIEW = 'PENDING_AI_REVIEW',
	PENDING_HUMAN_APPROVAL = 'PENDING_HUMAN_APPROVAL',
	APPROVED_AND_APPLIED = 'APPROVED_AND_APPLIED',
	REJECTED = 'REJECTED',
	WITHDRAWN = 'WITHDRAWN'
}

export interface ProfileChangeRequest {
	id: string;
	requestNumber: string;
	fieldType: string;
	fieldLabel: string;
	currentValue?: string;
	requestedValue: string;
	status: ChangeRequestStatus;
	aiRecommendation?: string;
	aiConfidenceScore?: number;
	rejectionReason?: string;
	reviewedBy?: string;
	appliedAt?: string;
	createdAt: string;
	updatedAt?: string;
}

// EMAIL is deliberately excluded — governed email changes are disabled for
// now (see the backend's profile-requests.dto.ts for the full reasoning:
// no email-ownership verification exists, and Google OAuth's existing-user
// lookup matches by email, so this could lock out a Google-authenticated
// affiliate with no password set).
export interface CreateIdentityRequestPayload {
	firstName?: string;
	lastName?: string;
	nationalId?: string;
	phoneNumber?: string;
}

export interface ProfileRequestsSummary {
	totalRequests: number;
	pendingAiCount: number;
	pendingHumanCount: number;
	approvedCount: number;
	rejectedCount: number;
	items: ProfileChangeRequest[];
}

export interface AffiliateChannelHandle {
	id: string;
	platform: string;
	handle: string;
	url?: string;
	createdAt: string;
}

export interface MarketerProfile {
	id: string;
	userId: string;
	user: {
		firstName: string;
		lastName: string;
		email: string;
		phoneNumber: string;
		phoneCountryCode: string;
		idNumber: string;
		avatarUrl: string;
	};
	referralSlug: string;
	currentLevel: string;
	commissionRatePercentage: number;
	avatarUrl?: string;
	bio?: string;
	marketingChannels: AffiliateChannelHandle[];
	bankName?: string;
	accountHolderName?: string;
	iban?: string;
	swiftCode?: string;
	identityVerified: boolean;
	kycDocumentUrl?: string;
	payoutMethod: string;
	minimumPayoutAmount: number;
	completionPercentage: number;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	message?: string;
	isPendingRequest?: boolean;
	requestId?: string;
}

@Injectable({
	providedIn: 'root'
})
export class MarketerProfileService {
	private http = inject(HttpClient);
	private apiUrl = `${environment.url_api}/marketer/profile`;

	getProfile(): Observable<ApiResponse<MarketerProfile>> {
		return this.http.get<ApiResponse<MarketerProfile>>(this.apiUrl);
	}

	updateMarketingInfo(data: { avatarUrl?: string; bio?: string }): Observable<ApiResponse<MarketerProfile>> {
		return this.http.patch<ApiResponse<MarketerProfile>>(`${this.apiUrl}/marketing-info`, data);
	}

	addChannel(data: { platform: string; handle: string; url?: string }): Observable<ApiResponse<AffiliateChannelHandle>> {
		return this.http.post<ApiResponse<AffiliateChannelHandle>>(`${this.apiUrl}/channels`, data);
	}

	removeChannel(id: string): Observable<ApiResponse<any>> {
		return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/channels/${id}`);
	}

	updateBankInfo(data: { bankName?: string; accountHolderName?: string; iban?: string; swiftCode?: string }): Observable<ApiResponse<MarketerProfile>> {
		return this.http.patch<ApiResponse<MarketerProfile>>(`${this.apiUrl}/bank-info`, data);
	}

	getRequests(): Observable<ApiResponse<ProfileRequestsSummary>> {
		return this.http.get<ApiResponse<ProfileRequestsSummary>>(`${this.apiUrl}/requests`);
	}

	createIdentityRequest(data: CreateIdentityRequestPayload): Observable<ApiResponse<ProfileChangeRequest[]>> {
		return this.http.post<ApiResponse<ProfileChangeRequest[]>>(`${this.apiUrl}/requests`, data);
	}

	withdrawRequest(requestId: string): Observable<ApiResponse<any>> {
		return this.http.post<ApiResponse<any>>(`${this.apiUrl}/requests/${requestId}/withdraw`, {});
	}

	// Role-agnostic endpoint (see backend routes/provider-profile.routes.ts) —
	// works for any authenticated user, not just providers, despite the path.
	changePassword(currentPassword: string, newPassword: string): Observable<ApiResponse<any>> {
		return this.http.put<ApiResponse<any>>(`${environment.url_api}/provider/profile/password`, { currentPassword, newPassword });
	}
}
