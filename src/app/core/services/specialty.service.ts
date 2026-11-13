import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { SKIP_RATE_LIMIT_TOAST } from '../interceptors/rate-limit.interceptor';
import { SKIP_GET_CACHE } from '../interceptors/get-cache.interceptor';
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

	/** Improves the user's own sample text; never uploads or fabricates proof files. */
	suggestSampleDraft(body: { specialtyName: string; subSpecialties: string[]; title: string; description: string; technologiesUsed: string[] }): Observable<any> {
		return this.http.post(`${this.apiUrl}/provider/accreditation/ai-suggest`, body);
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

	/** Background calls of a live test (state, autosave, events): never the global loader, never a rate-limit toast, never cached. */
	private readonly silent = () => new HttpContext().set(SKIP_LOADING, true).set(SKIP_RATE_LIMIT_TOAST, true).set(SKIP_GET_CACHE, true);

	/** Which exam mode the server runs and whether this browser is a verified Safe Exam Browser (restricted mode). */
	getExamEnvironment(): Observable<any> {
		return this.http.get(`${this.apiUrl}/assessments/exam-environment`, { context: this.silent() });
	}
	/** The signed-in provider's live attempt (key-less questions, saved answers, SERVER remaining time) after a reload / reconnect; data = null when none. */
	getActiveAttempt(): Observable<any> {
		return this.http.get(`${this.apiUrl}/assessments/active`, { context: this.silent() });
	}
	/** Silent autosave of the answers so far. `seq` is a monotonic counter: the server applies an answer only if this request is newer than the one that last wrote it. */
	saveAttemptAnswers(attemptId: string, answers: Record<string, string>, seq: number): Observable<any> {
		return this.http.put(`${this.apiUrl}/assessments/${attemptId}/answers`, { answers, seq }, { context: this.silent() });
	}
	/**
	 * Last-chance save while the page is going away (tab closed, reload, navigation): `fetch` with keepalive outlives the page, a normal XHR does not. Fire-and-forget; the caller treats the answers
	 * as UNCONFIRMED until a later read says otherwise.
	 */
	saveAttemptAnswersKeepalive(attemptId: string, answers: Record<string, string>, seq: number): void {
		if (typeof fetch !== 'function') return;
		let token = '';
		try { token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token') || ''; } catch { /* storage blocked */ }
		if (!token && typeof document !== 'undefined') token = document.cookie.match(/(?:^|;\s*)waseet_token=([^;]+)/)?.[1] || '';
		try {
			void fetch(`${this.apiUrl}/assessments/${attemptId}/answers`, { method: 'PUT', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token.replace(/^"|"$/g, '')}` } : {}) }, body: JSON.stringify({ answers, seq }) }).catch(() => undefined);
		} catch { /* nothing more can be done while leaving */ }
	}
	/** A page / exam-mode event for the reviewers (information only). */
	logAttemptEvent(attemptId: string, type: string): Observable<any> {
		return this.http.post(`${this.apiUrl}/assessments/${attemptId}/events`, { type }, { context: this.silent() });
	}
}
