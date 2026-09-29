import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateTeamMemberPayload,
  DeleteTeamMemberApiResponse,
  TeamMemberApiResponse,
  TeamMemberListApiResponse,
  UpdateTeamMemberPayload,
} from '../models/company-team.model';

/**
 * Company team roster CRUD (PROVIDER_COMPANY accounts only).
 * Base: /api/provider/company/team
 */
@Injectable({
  providedIn: 'root',
})
export class CompanyTeamService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.url_api}/provider/company/team`;

  /** GET /api/provider/company/team */
  list(): Observable<TeamMemberListApiResponse> {
    return this.http.get<TeamMemberListApiResponse>(this.baseUrl);
  }

  /** GET /api/provider/company/team/:id */
  get(id: string): Observable<TeamMemberApiResponse> {
    return this.http.get<TeamMemberApiResponse>(`${this.baseUrl}/${id}`);
  }

  /** POST /api/provider/company/team */
  create(payload: CreateTeamMemberPayload): Observable<TeamMemberApiResponse> {
    return this.http.post<TeamMemberApiResponse>(this.baseUrl, payload);
  }

  /** PUT /api/provider/company/team/:id */
  update(id: string, payload: UpdateTeamMemberPayload): Observable<TeamMemberApiResponse> {
    return this.http.put<TeamMemberApiResponse>(`${this.baseUrl}/${id}`, payload);
  }

  /** DELETE /api/provider/company/team/:id */
  remove(id: string): Observable<DeleteTeamMemberApiResponse> {
    return this.http.delete<DeleteTeamMemberApiResponse>(`${this.baseUrl}/${id}`);
  }
}
