import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientProfileInput, ProfileResponse, ProviderProfileInput } from '../models/profile.model';
import { AuthStore } from '../store/auth.store';
import { UserStatus } from '../models/auth.model';
import { ClientSetupPayload, ProviderSetupPayload } from '../models/onboarding-upload.model';

/** One thing still needed to reach 100% (computed by the backend, so the percentage and this list always agree). */
export interface CompletionMissingItem {
  key: string;
  label: string;
  points: number;
  status: 'missing' | 'pending_review' | 'rejected';
  /** Where it is fixed: an edit-page tab, or 'setup' (the profile-setup wizard). */
  tab: 'profile' | 'basics' | 'contact' | 'banking' | 'setup' | 'payout' | 'docs';
  hint: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileApiService {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  private readonly baseUrl = `${environment.url_api}/profiles`;

  /**
   * Fetch current user profile
   */
  public getMyProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.baseUrl}/me`);
  }

  /**
   * Update profile dynamically (Client or Provider)
   */
  public updateProfile(payload: ClientProfileInput | ProviderProfileInput): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(`${this.baseUrl}/update`, payload).pipe(
      tap((res) => {
        if (res.success && res.data?.status === UserStatus.ACTIVE) {
          this.authStore.updateUserStatus(UserStatus.ACTIVE);
        }
      })
    );
  }

  /**
   * Update specific profile tab
   */
  public updateTab(tabName: string, payload: any): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(`${this.baseUrl}/update/${tabName}`, payload);
  }

  /**
   * Get my profile change requests
   */
  public getMyChangeRequests(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/my-change-requests`);
  }

  /** A client's password change: a request an admin approves (the password does NOT change now). */
  public requestPasswordChange(body: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/password-change-request`, body);
  }

  /** Withdraw one of my own requests while it still waits for review. */
  public cancelMyChangeRequest(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/my-change-requests/${id}/cancel`, {});
  }

  /**
   * Setup initial profile
   */
  public setupProfile(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/setup`, payload);
  }

  /**
   * Get client profile setup data
   */
  public getClientProfileSetup(): Observable<any> {
    return this.http.get<any>(`${environment.url_api}/client/profile/setup`);
  }

  /**
   * Save client profile setup data
   */
  public saveClientProfileSetup(payload: ClientSetupPayload): Observable<any> {
    return this.http.post<any>(`${environment.url_api}/client/profile/setup`, payload);
  }

  /**
   * Store ONE client setup step as soon as the user moves on (1 details, 2 identity documents, 3 PayPal, 4 optional documents), so a refresh
   * resumes from what is saved in the database. The final submit (saveClientProfileSetup) still records the agreements.
   */
  public saveClientSetupStep(step: 1 | 2 | 3 | 4, body: Record<string, unknown>): Observable<any> {
    return this.http.put<any>(`${environment.url_api}/client/profile/setup/step/${step}`, body);
  }

  /**
   * Get provider profile setup data
   */
  public getProviderProfileSetup(): Observable<any> {
    return this.http.get<any>(`${environment.url_api}/provider/profile/setup`);
  }

  /**
   * Save provider profile setup data
   */
  public saveProviderProfileSetup(payload: ProviderSetupPayload): Observable<any> {
    return this.http.post<any>(`${environment.url_api}/provider/profile/setup`, payload);
  }
}
