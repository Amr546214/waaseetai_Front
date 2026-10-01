import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
	CreateClientTeamMemberPayload,
	DeleteClientTeamMemberApiResponse,
	ClientTeamMemberApiResponse,
	ClientTeamMemberListApiResponse,
	UpdateClientTeamMemberPayload,
} from '../models/client-company-team.model';

/**
 * Client Company employee roster CRUD (CLIENT_COMPANY accounts only).
 * Batch 6 — base: /api/client/company/team
 */
@Injectable({
	providedIn: 'root',
})
export class ClientCompanyTeamService {
	private http = inject(HttpClient);
	private readonly baseUrl = `${environment.url_api}/client/company/team`;

	/** GET /api/client/company/team */
	list(): Observable<ClientTeamMemberListApiResponse> {
		return this.http.get<ClientTeamMemberListApiResponse>(this.baseUrl);
	}

	/** POST /api/client/company/team */
	create(payload: CreateClientTeamMemberPayload): Observable<ClientTeamMemberApiResponse> {
		return this.http.post<ClientTeamMemberApiResponse>(this.baseUrl, payload);
	}

	/** PUT /api/client/company/team/:id */
	update(id: string, payload: UpdateClientTeamMemberPayload): Observable<ClientTeamMemberApiResponse> {
		return this.http.put<ClientTeamMemberApiResponse>(`${this.baseUrl}/${id}`, payload);
	}

	/** DELETE /api/client/company/team/:id */
	remove(id: string): Observable<DeleteClientTeamMemberApiResponse> {
		return this.http.delete<DeleteClientTeamMemberApiResponse>(`${this.baseUrl}/${id}`);
	}
}
