import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalDecisionPayload,
  CreateSpecialOfferPayload,
  SpecialOfferApiResponse,
  SpecialOfferListApiResponse,
  SpecialOfferStatsApiResponse,
  SpecialOffersSummaryApiResponse,
  UpdateSpecialOfferPayload,
} from '../models/marketing.model';

/**
 * Provider special offers — bundles and direct discounts (individual + company).
 * Base: /api/provider/special-offers
 */
@Injectable({
  providedIn: 'root',
})
export class ProviderSpecialOfferService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.url_api}/provider/special-offers`;

  /** GET /api/provider/special-offers */
  list(): Observable<SpecialOfferListApiResponse> {
    return this.http.get<SpecialOfferListApiResponse>(this.baseUrl);
  }

  /** GET /api/provider/special-offers/:id */
  get(id: string): Observable<SpecialOfferApiResponse> {
    return this.http.get<SpecialOfferApiResponse>(`${this.baseUrl}/${id}`);
  }

  /** GET /api/provider/special-offers/summary — list KPIs (bundle extra revenue). */
  getSummary(): Observable<SpecialOffersSummaryApiResponse> {
    return this.http.get<SpecialOffersSummaryApiResponse>(`${this.baseUrl}/summary`);
  }

  /** GET /api/provider/special-offers/:id/stats — usage stats + paginated orders (+ bundle conversion). */
  getStats(id: string, page = 1, pageSize = 10): Observable<SpecialOfferStatsApiResponse> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<SpecialOfferStatsApiResponse>(`${this.baseUrl}/${id}/stats`, { params });
  }

  /** POST /api/provider/special-offers */
  create(payload: CreateSpecialOfferPayload): Observable<SpecialOfferApiResponse> {
    return this.http.post<SpecialOfferApiResponse>(this.baseUrl, payload);
  }

  /** PUT /api/provider/special-offers/:id */
  update(id: string, payload: UpdateSpecialOfferPayload): Observable<SpecialOfferApiResponse> {
    return this.http.put<SpecialOfferApiResponse>(`${this.baseUrl}/${id}`, payload);
  }

  /** PUT /api/provider/special-offers/:id with `{ active }` — activate / pause. */
  setActive(id: string, active: boolean): Observable<SpecialOfferApiResponse> {
    return this.update(id, { active });
  }

  /** PATCH /api/provider/special-offers/:id/approval (company accounts only). */
  decideApproval(id: string, payload: ApprovalDecisionPayload): Observable<SpecialOfferApiResponse> {
    return this.http.patch<SpecialOfferApiResponse>(`${this.baseUrl}/${id}/approval`, payload);
  }
}
