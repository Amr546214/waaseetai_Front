import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  OnboardingQuery,
  OnboardingListApiResponse,
  OnboardingApiResponse,
  ApprovePayload,
  RejectPayload,
  KycProviderQuery,
  KycProviderListApiResponse,
  KycProviderApiResponse,
  ActionApiResponse,
} from '../../../../core/models/onboarding.model';

@Injectable({ providedIn: 'root' })
export class SaKycService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  // ── Client Onboarding ───────────────────────────────────────────────

  getOnboardingRequests(query?: OnboardingQuery): Observable<OnboardingListApiResponse> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    if (query?.status) params = params.set('status', query.status);
    return this.http.get<OnboardingListApiResponse>(`${this.baseUrl}/admin/onboarding`, { params });
  }

  getOnboardingRequest(id: string): Observable<OnboardingApiResponse> {
    return this.http.get<OnboardingApiResponse>(`${this.baseUrl}/admin/onboarding/${id}`);
  }

  approveOnboarding(id: string, payload?: ApprovePayload): Observable<ActionApiResponse> {
    return this.http.post<ActionApiResponse>(`${this.baseUrl}/admin/onboarding/${id}/approve`, payload ?? {});
  }

  rejectOnboarding(id: string, payload: RejectPayload): Observable<ActionApiResponse> {
    return this.http.post<ActionApiResponse>(`${this.baseUrl}/admin/onboarding/${id}/reject`, payload);
  }

  // ── Provider KYC ────────────────────────────────────────────────────

  getKycProviders(query?: KycProviderQuery): Observable<KycProviderListApiResponse> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    if (query?.status) params = params.set('status', query.status);
    return this.http.get<KycProviderListApiResponse>(`${this.baseUrl}/admin/onboarding/kyc/providers`, { params });
  }

  approveKycProvider(userId: string, payload?: ApprovePayload): Observable<ActionApiResponse> {
    return this.http.post<ActionApiResponse>(`${this.baseUrl}/admin/onboarding/kyc/providers/${userId}/approve`, payload ?? {});
  }

  rejectKycProvider(userId: string, payload: RejectPayload): Observable<ActionApiResponse> {
    return this.http.post<ActionApiResponse>(`${this.baseUrl}/admin/onboarding/kyc/providers/${userId}/reject`, payload);
  }
}
