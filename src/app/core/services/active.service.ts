import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class ActiveProjectsService {
	private http = inject(HttpClient);

	getActiveProjects(): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/projects/active`);
	}

	getArchivedProjects(): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/projects/archived`);
	}

	getProjectProgress(projectId: string): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/projects/${projectId}/progress`);
	}

	submitDelivery(projectId: string, stageId: string, payload: { note: string; files: string[] }): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/projects/${projectId}/stages/${stageId}/deliveries`, payload);
	}

	// Batch 8 — advisory-only Gemini project health analysis. On-demand only
	// (not called automatically on page load); real result replaces the
	// honest aiInsights placeholder in the UI, real failure shows an honest
	// unavailable state — see progress.ts::analyzeProjectHealth().
	// Advisory-only delivery review of a stage's submitted delivery (never approves or releases money). 503 when the LLM is not configured.
	getDeliveryAiReview(projectId: string, stageId: string): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/projects/${projectId}/stages/${stageId}/ai-review`, {});
	}

	getProjectHealthAnalysis(projectId: string): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/projects/${projectId}/health`, {});
	}
}
