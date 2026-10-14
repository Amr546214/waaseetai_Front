import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AmendmentKind = 'SCOPE' | 'BUDGET' | 'DURATION' | 'MIXED';
export type AmendmentStatus = 'PENDING_OTHER_PARTY' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface ProviderAmendment {
	id: string; projectId: string; projectTitle: string; type: AmendmentKind; title: string; description: string | null;
	budgetDelta: number | null; durationDeltaDays: number | null; status: AmendmentStatus; requestedByRole: 'CLIENT' | 'PROVIDER';
	createdAt: string; respondedAt: string | null; conversationId: string | null;
	effect?: 'RECORD_ONLY'; effectNote?: string;
}
export interface CreateAmendmentPayload { type: AmendmentKind; title: string; description?: string; budgetDelta?: number; durationDeltaDays?: number }

export interface DeliveryFileDescriptor { name: string; url: string; type: string; size: number }

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

	/** One REAL upload of a delivery file (multipart field "files"); emits upload progress events, then the stored file descriptor. */
	uploadDeliveryFile(projectId: string, stageId: string, file: File): Observable<HttpEvent<{ success: boolean; data: { files: DeliveryFileDescriptor[] } }>> {
		const form = new FormData();
		form.append('files', file, file.name);
		return this.http.post<{ success: boolean; data: { files: DeliveryFileDescriptor[] } }>(
			`${environment.url_api}/provider/projects/${projectId}/stages/${stageId}/deliveries/files`, form, { observe: 'events', reportProgress: true });
	}

	/** `files` = uploaded-file descriptors returned by uploadDeliveryFile and/or https links. File names alone are refused by the server. */
	submitDelivery(projectId: string, stageId: string, payload: { note: string; files: Array<DeliveryFileDescriptor | string> }): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/projects/${projectId}/stages/${stageId}/deliveries`, payload);
	}

	/** The provider's own change requests for this project, with their status. */
	getAmendments(projectId: string): Observable<{ success: boolean; data: ProviderAmendment[] }> {
		return this.http.get<{ success: boolean; data: ProviderAmendment[] }>(`${environment.url_api}/provider/projects/${projectId}/amendments`);
	}

	/** A formal change request: it is only recorded and waits for the client; it never changes price / duration / escrow by itself. */
	createAmendment(projectId: string, payload: CreateAmendmentPayload): Observable<{ success: boolean; message?: string; data: ProviderAmendment }> {
		return this.http.post<{ success: boolean; message?: string; data: ProviderAmendment }>(`${environment.url_api}/provider/projects/${projectId}/amendments`, payload);
	}

	/** The provider answers a change request the CLIENT raised. The decision is only recorded; price / duration / escrow / stages never change. */
	respondAmendment(amendmentId: string, decision: 'approve' | 'reject'): Observable<{ success: boolean; message?: string; data: ProviderAmendment }> {
		return this.http.post<{ success: boolean; message?: string; data: ProviderAmendment }>(`${environment.url_api}/provider/amendments/${amendmentId}/respond`, { decision });
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
