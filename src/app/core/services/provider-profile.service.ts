import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { KycAccess } from '../models/kyc-document.model';

export interface ProfileSuggestionInput {
  jobTitle?: string;
  mainSpecialty?: string;
  experienceRange?: string;
  existingSkills?: string[];
}

/** One thing still needed to reach 100% (computed by the backend, so the percentage and this list always agree). */
export interface CompletionMissingItem {
  key: string;
  label: string;
  points: number;
  /** 'pending_review' = the provider submitted it and it waits for the human review (not "missing"). */
  status: 'missing' | 'pending_review' | 'rejected';
  /** Tab of the provider edit page that fixes it. */
  tab: 'profile' | 'contact' | 'payout' | 'docs';
  hint: string;
}

export interface ProviderProfile {
  id: string;
  userId: string;
  avatarUrl?: string | null;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    alternativePhone?: string | null;
    idDocumentUrl?: string | null;
    /** Present when the stored document is private (idDocumentUrl is then null) or a legacy public URL. */
    idDocumentUrlAccess?: KycAccess | null;
    commercialRegistration?: string | null;
    vatCertificateUrl?: string | null;
    vatCertificateUrlAccess?: KycAccess | null;
  };
  companyName: string | null;
  headline: string | null;
  bio: string | null;
  hourlyRate: number | null;
  yearsOfExperience: number | null;
  location: string | null;
  city: string | null;
  country: string | null;
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  completionPercentage: number;
  missingItems?: CompletionMissingItem[];
  mainSpecialty?: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  languages: string[];
  preferences?: Record<string, unknown> | null;
  rating: number;
  isVerified: boolean;
  skills: any[];
  portfolioItems: any[];
  educations: any[];
  certificates: any[];
  certUrls?: (string | null)[];
  certUrlsAccess?: (KycAccess | null)[];
  /** PayPal payout destination (the only supported payout method for now). */
  paypalPayoutEmail?: string | null;
}

/** Answer of the first step: emailSent is true only when the mail service accepted the message; emailHint is the masked ACCOUNT email. */
export interface PaypalChangeRequestResult { emailSent: boolean; emailHint: string; expiresInSeconds?: number; mode?: 'add' | 'change' }

@Injectable({ providedIn: 'root' })
export class ProviderProfileService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.url_api}/provider/profile`;

  suggestSkills(input: ProfileSuggestionInput): Observable<{ success: boolean; data: { suggestedSkills: string[] } }> {
    return this.http.post<{ success: boolean; data: { suggestedSkills: string[] } }>(`${this.apiUrl}/suggest-skills`, input);
  }

  /**
   * Saves the provider's PayPal payout email on the existing profile endpoint
   * (PUT /profiles/update, paypalPayoutEmail — provider role only; the setup endpoint ignores it).
   */
  savePaypalPayoutEmail(email: string): Observable<any> {
    return this.http.put<any>(`${environment.url_api}/profiles/update`, { paypalPayoutEmail: email.trim() });
  }

  /**
   * PayPal payout email change (finance #33): the email is no longer saved directly. Step 1 e-mails a code to the ACCOUNT email
   * (the new address stays pending), step 2 confirms it. After a confirmed change PayPal withdrawals are frozen for 24 hours.
   */
  requestPaypalEmailChange(email: string): Observable<PaypalChangeRequestResult> {
    return this.http.post<{ data: PaypalChangeRequestResult }>(`${environment.url_api}/profiles/paypal-email/change/request`, { paypalEmail: email.trim() }).pipe(map(r => r.data));
  }
  confirmPaypalEmailChange(code: string): Observable<{ paypalPayoutEmail: string }> {
    return this.http.post<{ data: { paypalPayoutEmail: string } }>(`${environment.url_api}/profiles/paypal-email/change/confirm`, { code }).pipe(map(r => r.data));
  }

  getProfile(): Observable<ProviderProfile> {
    return this.http.get<ProviderProfile>(`${this.apiUrl}/me`);
  }

  getPublicProfile(providerId?: string): Observable<any> {
    const url = providerId ? `${this.apiUrl}/public/${providerId}` : `${this.apiUrl}/public`;
    return this.http.get<any>(url);
  }

  getRequests(status: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/requests`, { params: { status } });
  }

  createRequest(data: { fieldName: string, fieldLabel: string, requestedValue: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests`, data);
  }

  cancelRequest(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/${id}/cancel`, {});
  }

  initiateSensitiveChange(category: 'CONTACT' | 'DOCUMENTS', changes: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sensitive-change`, { category, changes });
  }

  verifySensitiveChange(requestId: string, code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sensitive-change/verify`, { requestId, code });
  }

  /**
   * KYC / confidential documents are uploaded PRIVATE by default and the response carries a private reference (data.url) that is sent back
   * unchanged in the next request; it is never shown. Content shown publicly on the profile (avatar, portfolio files) passes visibility 'public'.
   */
  uploadDocument(file: File, options: { visibility?: 'public' } = {}): Observable<HttpEvent<any>> {
    const body = new FormData();
    if (options.visibility === 'public') body.append('visibility', 'public');
    body.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/documents/upload`, body, {
      observe: 'events',
      reportProgress: true
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/password`, { currentPassword, newPassword });
  }

  getActiveSessions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sessions`);
  }

  revokeSession(sessionId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/sessions/${sessionId}`);
  }

  updateBasicInfo(data: Partial<ProviderProfile> & { firstName?: string, lastName?: string, avatarUrl?: string | null }): Observable<ProviderProfile> {
    return this.http.put<ProviderProfile>(`${this.apiUrl}/basic-info`, data);
  }

  updateContactInfo(data: any): Observable<ProviderProfile> {
    return this.http.put<ProviderProfile>(`${this.apiUrl}/contact`, data);
  }

  updateDocsInfo(data: any): Observable<ProviderProfile> {
    return this.http.put<ProviderProfile>(`${this.apiUrl}/docs`, data);
  }

  getChangeRequests(tabName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/requests/${tabName}`);
  }

  updateSkills(skills: string[]): Observable<ProviderProfile> {
    return this.http.put<ProviderProfile>(`${this.apiUrl}/skills`, { skills });
  }

  addPortfolioItem(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/portfolio`, data);
  }

  updatePortfolioItem(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/portfolio/${id}`, data);
  }

  deletePortfolioItem(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/portfolio/${id}`);
  }
}
