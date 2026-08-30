import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';

function getCookieSync(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export interface ProviderActivityItem {
	id: string;
	title?: string;
	projectTitle?: string;
	category?: string;
	specialty?: string;
	budget?: number;
	price?: number;
	status: string;
	type?: 'PROJECT' | 'PROPOSAL';
	createdAt: string | Date;
	updatedAt?: string | Date;
}

export interface ProviderStatsResponse {
	success: boolean;
	message: string;
	data: {
		summary: {
			activeProjectsCount: number;
			newOffersCount: number;
			pendingOffersCount: number;
			negotiationOffersCount: number;
			pendingClientApprovalCount: number;
			availableEarnings: number;
			monthlyEarnings: number;
			totalEscrowAmount: number;
			providerRating: number;
			humanRating: number;
			aiRating: number;
			profileCompletionPercent: number;
			profileSetupCompleted: boolean;
			setupTestCompleted: boolean;
			hasApprovedSpecialties: boolean;
			currentLevel: string;
			currentPoints: number;
			firstName: string;
			lastName: string;
		};
		latestProjects: ProviderActivityItem[];
		latestProposals: ProviderActivityItem[];
		aiMatchingProjects: Array<{
			id: string;
			title: string;
			specialty?: string;
			category?: string;
			budget: number;
			aiMatchScore: number;
			matchReasons?: string[];
			aiAnalysis?: string;
			deliveryDays?: number;
			clientName?: string;
			createdAt?: string | Date;
		}>;
	};
}

@Injectable({ providedIn: 'root' })
export class ProviderApiService {
	private http = inject(HttpClient);
	private authStore = inject(AuthStore);
	private platformId = inject(PLATFORM_ID);
	private apiUrl = `${environment.url_api}/provider`;
	private assistantUrl = `${environment.url_api}/assistant`;

	private hasToken(): boolean {
		if (!isPlatformBrowser(this.platformId)) {
			return false;
		}
		if (this.authStore.token()) return true;
		const token = getCookieSync('waseet_token') ||
		              localStorage.getItem('waseet_token') ||
		              localStorage.getItem('access_token') ||
		              localStorage.getItem('token');
		return !!token;
	}

	getProviderStatistics(): Observable<ProviderStatsResponse> {
		if (!this.hasToken()) {
			return of({
				success: false,
				message: 'No active session token',
				data: null as any
			});
		}
		return this.http.get<ProviderStatsResponse>(`${this.apiUrl}/statistics`).pipe(
			catchError((error) => {
				console.error('Error fetching provider statistics:', error);
				return of({
					success: false,
					message: error.status === 401 ? 'Unauthorized session' : 'Failed to fetch provider statistics',
					data: null as any
				});
			})
		);
	}

	getOverviewStats(): Observable<ProviderStatsResponse> {
		return this.getProviderStatistics();
	}

	getTopAiMatchingProjects(): Observable<any> {
		if (!this.hasToken()) {
			return of({ success: false, data: [] });
		}
		return this.http.get<any>(`${this.apiUrl}/ai-matching-projects`).pipe(
			catchError((error) => {
				console.error('Error fetching top AI matching projects:', error);
				return of({ success: false, data: [] });
			})
		);
	}

	getExploreRequests(params?: Record<string, any>): Observable<any> {
		if (!this.hasToken()) {
			return of({ success: false, data: [] });
		}
		return this.http.get<any>(`${this.apiUrl}/explore-requests`, { params }).pipe(
			catchError((error) => {
				console.error('Error fetching explore requests:', error);
				return of({ success: false, data: [] });
			})
		);
	}

	toggleSaveRequest(requestId: string | number): Observable<any> {
		if (!this.hasToken()) {
			return of({ success: false });
		}
		return this.http.post<any>(`${this.apiUrl}/explore-requests/${requestId}/toggle-save`, {}).pipe(
			catchError((error) => {
				console.error('Error toggling save request:', error);
				return of({ success: false });
			})
		);
	}

	analyzeProjectWithAi(projectId: string | number): Observable<any> {
		if (!this.hasToken()) {
			return of({ success: false });
		}
		return this.http.get<any>(`${this.assistantUrl}/analyze-project/${projectId}`).pipe(
			catchError((error) => {
				console.error('Error analyzing project with AI:', error);
				return of({ success: false });
			})
		);
	}

	getEligibleAccreditationSpecialties(): Observable<any> {
		if (!this.hasToken()) {
			return of([]);
		}
		return this.http.get<any>(`${this.apiUrl}/accreditation/eligible-specialties`).pipe(
			catchError((error) => {
				console.error('Error fetching eligible accreditation specialties:', error);
				return of([]);
			})
		);
	}

	getPassedSpecialties(): Observable<any> {
		if (!this.hasToken()) {
			return of([]);
		}
		return this.http.get<any>(`${this.apiUrl}/accreditation/passed-specialties`).pipe(
			catchError((error) => {
				console.error('Error fetching passed specialties:', error);
				return of([]);
			})
		);
	}

	submitAccreditationSample(payload: any): Observable<any> {
		return this.http.post<any>(`${this.apiUrl}/accreditation/submit`, payload).pipe(
			catchError((error) => {
				console.error('Error submitting accreditation sample:', error);
				return of({ success: false, message: error.error?.message || 'فشل في إرسال نموذج الاعتماد' });
			})
		);
	}

	getAccreditationSamples(): Observable<any> {
		return this.http.get<any>(`${this.apiUrl}/accreditation/samples`).pipe(
			catchError((error) => {
				console.error('Error fetching accreditation samples:', error);
				return of({ success: false, samples: [] });
			})
		);
	}

	getAccreditationSampleById(id: string): Observable<any> {
		return this.http.get<any>(`${this.apiUrl}/accreditation/samples/${id}`).pipe(
			catchError((error) => {
				console.error(`Error fetching accreditation sample ${id}:`, error);
				return of({ success: false, sample: null });
			})
		);
	}
}

export { ProviderApiService as ProviderService };
