import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class SpecialtyService {
	private http = inject(HttpClient);
	private apiUrl = environment.url_api;

	getCategories(): Observable<any> {
		return this.http.get(`${this.apiUrl}/specialties/categories`);
	}

	getPublicSpecialties(categoryId?: string): Observable<any> {
		const param = categoryId && categoryId !== 'all' ? `?categoryId=${categoryId}` : '';
		return this.http.get(`${this.apiUrl}/specialties/public${param}`);
	}

	/** Rule-based suggestion from real data (proposal history / profile / open demand); never AI. */
	getRecommendation(): Observable<any> {
		return this.http.get(`${this.apiUrl}/provider/specialties/recommendations`);
	}

	selectSpecialty(payload: { specialtyId: string; subSpecialties: string[]; isCustom?: boolean; customName?: string }): Observable<any> {
		return this.http.post(`${this.apiUrl}/specialties/provider/specialties/step1-select`, payload);
	}

	uploadSamples(payload: any): Observable<any> {
		return this.http.post(`${this.apiUrl}/specialties/provider/specialties/step2-upload`, payload);
	}

	// Autonomous AI Verification Engine Endpoints
	submitProof(formData: FormData): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/specialties/submit-proof`, formData, {
			observe: 'events',
			reportProgress: true
		});
	}

	/** Advisory AI review of the specialty's portfolio samples (never changes the specialty's status). */
	aiEvaluate(providerSpecialtyId: string): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/ai-evaluate`, {});
	}

	/** The latest stored AI review of the specialty's portfolio (NOT_ENOUGH_DATA with nothing in it when there is none). */
	getAiEvaluation(providerSpecialtyId: string): Observable<any> {
		return this.http.get(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/ai-evaluation`);
	}

	getSpecialtyStatus(providerSpecialtyId: string): Observable<any> {
		return this.http.get(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/status`);
	}

	// Enterprise Gemini Assessment Engine Endpoints
	generateAiAssessment(providerSpecialtyId: string): Observable<any> {
		return this.http.post(`${this.apiUrl}/assessments/generate`, { providerSpecialtyId });
	}

	submitAiAssessment(attemptId: string, submittedAnswers: Record<string, string>): Observable<any> {
		return this.http.post(`${this.apiUrl}/assessments/${attemptId}/submit`, { submittedAnswers });
	}

	getAiAssessmentStatus(attemptId: string): Observable<any> {
		return this.http.get(`${this.apiUrl}/assessments/${attemptId}/status`);
	}
}
