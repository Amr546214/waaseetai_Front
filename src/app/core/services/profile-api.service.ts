import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientProfileInput, ProfileResponse, ProviderProfileInput } from '../models/profile.model';
import { AuthStore } from '../store/auth.store';
import { UserStatus } from '../models/auth.model';

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
  public saveClientProfileSetup(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.url_api}/client/profile/setup`, payload);
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
  public saveProviderProfileSetup(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.url_api}/provider/profile/setup`, payload);
  }
}
