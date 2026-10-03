import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProfileSuggestionInput {
  jobTitle?: string;
  mainSpecialty?: string;
  experienceRange?: string;
  existingSkills?: string[];
}

export interface ProviderProfile {
  id: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    alternativePhone?: string | null;
    accountHolderName?: string | null;
    ibanNumber?: string | null;
    bankName?: string | null;
    idDocumentUrl?: string | null;
    commercialRegistration?: string | null;
    vatCertificateUrl?: string | null;
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
  certUrls?: string[];
  /** PayPal payout destination (the only supported payout method for now). */
  paypalPayoutEmail?: string | null;
}

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

  initiateSensitiveChange(category: 'CONTACT' | 'BANKING' | 'DOCUMENTS', changes: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sensitive-change`, { category, changes });
  }

  verifySensitiveChange(requestId: string, code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sensitive-change/verify`, { requestId, code });
  }

  uploadDocument(file: File): Observable<HttpEvent<any>> {
    const body = new FormData();
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

  updateBankingInfo(data: any): Observable<ProviderProfile> {
    return this.http.put<ProviderProfile>(`${this.apiUrl}/banking`, data);
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
