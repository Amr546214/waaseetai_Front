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

	selectSpecialty(payload: { specialtyId: string; subSpecialties: string[]; isCustom?: boolean; customName?: string }): Observable<any> {
		return this.http.post(`${this.apiUrl}/specialties/provider/specialties/step1-select`, payload);
	}

	uploadSamples(payload: any): Observable<any> {
		return this.http.post(`${this.apiUrl}/specialties/provider/specialties/step2-upload`, payload);
	}

	runAiAudit(payload: { providerSpecialtyId: string }): Observable<any> {
		return this.http.post(`${this.apiUrl}/specialties/provider/specialties/step3-audit`, payload);
	}

	// Autonomous AI Verification Engine Endpoints
	submitProof(formData: FormData): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/specialties/submit-proof`, formData, {
			observe: 'events',
			reportProgress: true
		});
	}

	aiEvaluate(providerSpecialtyId: string): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/ai-evaluate`, {});
	}

	getSpecialtyStatus(providerSpecialtyId: string): Observable<any> {
		return this.http.get(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/status`);
	}

	initQuiz(providerSpecialtyId: string): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/quiz/init`, {});
	}

	submitQuizAnswers(providerSpecialtyId: string, payload: { sessionId: string; answers: any[]; isTimeout?: boolean }): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/quiz/submit`, payload);
	}

	getQuizStatus(providerSpecialtyId: string): Observable<any> {
		return this.http.get(`${this.apiUrl}/provider/specialties/${providerSpecialtyId}/quiz/status`);
	}

	getTest(specialtyId: string): Observable<any> {
		return this.http.get(`${this.apiUrl}/specialties/provider/specialties/step4-test/${specialtyId}`);
	}

	submitTest(payload: { providerSpecialtyId: string; testId: string; answers: any[] }): Observable<any> {
		return this.http.post(`${this.apiUrl}/specialties/provider/specialties/step4-submit`, payload);
	}

	// Enterprise OpenAI Assessment Engine Endpoints
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
