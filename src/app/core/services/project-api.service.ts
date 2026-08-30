import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, ClientRequestAiSuggestPayload, ClientRequestPayload } from '../models/api.model';

export interface UploadedAttachment {
	fileName: string;
	fileUrl: string;
	mimeType?: string;
	size?: number;
}

export interface ClientRequestListItem {
	id: string;
	title: string;
	description?: string;
	status?: string;
}

@Injectable({
	providedIn: 'root'
})
export class ProjectApiService {
	private apiUrl = `${environment.url_api}/client/requests`;

	constructor(private http: HttpClient) { }

	/**
	 * Get metadata (Categories, Specialties, Sub-specialties with provider counts)
	 */
	getMeta(): Observable<ApiResponse<unknown>> {
		return this.http.get<ApiResponse<unknown>>(`${this.apiUrl}/meta`);
	}

	/**
	 * Get AI-powered suggestions for client request draft
	 */
	aiSuggest(payload: ClientRequestAiSuggestPayload): Observable<ApiResponse<unknown>> {
		return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/ai-suggest`, payload);
	}

	/**
	 * Upload files/attachments via multipart FormData
	 */
	uploadAttachments(files: File[]): Observable<ApiResponse<UploadedAttachment[]>> {
		const formData = new FormData();
		files.forEach(file => {
			formData.append('attachments', file, file.name);
		});
		return this.http.post<ApiResponse<UploadedAttachment[]>>(`${this.apiUrl}/upload`, formData);
	}

	/**
	 * Create a new client request / project
	 */
	createProject(projectData: ClientRequestPayload): Observable<ApiResponse<ClientRequestListItem>> {
		return this.http.post<ApiResponse<ClientRequestListItem>>(this.apiUrl, projectData);
	}

	/**
	 * Get user's requests
	 */
	getMyRequests(): Observable<any> {
		// The API historically returns either a wrapped list or a legacy array.
		// Keep this compatibility boundary typed loosely until the backend
		// response contract is unified.
		return this.http.get<any>(`${this.apiUrl}/my-requests`);
	}

	/**
	 * Get request details by ID
	 */
	getRequestDetails(id: string): Observable<ApiResponse<ClientRequestListItem>> {
		return this.http.get<ApiResponse<ClientRequestListItem>>(`${this.apiUrl}/${id}`);
	}
}
