import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovalDecisionPayload,
  CouponApiResponse,
  CouponListApiResponse,
  CouponStatsApiResponse,
  CreateCouponPayload,
  UpdateCouponPayload,
} from '../models/marketing.model';

/**
 * Provider discount coupons (individual + company).
 * Base: /api/provider/coupons
 */
@Injectable({
  providedIn: 'root',
})
export class ProviderCouponService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.url_api}/provider/coupons`;

  /** GET /api/provider/coupons */
  list(): Observable<CouponListApiResponse> {
    return this.http.get<CouponListApiResponse>(this.baseUrl);
  }

  /** GET /api/provider/coupons/:id */
  get(id: string): Observable<CouponApiResponse> {
    return this.http.get<CouponApiResponse>(`${this.baseUrl}/${id}`);
  }

  /** GET /api/provider/coupons/:id/stats — usage stats + paginated redeeming orders. */
  getStats(id: string, page = 1, pageSize = 10): Observable<CouponStatsApiResponse> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<CouponStatsApiResponse>(`${this.baseUrl}/${id}/stats`, { params });
  }

  /** POST /api/provider/coupons */
  create(payload: CreateCouponPayload): Observable<CouponApiResponse> {
    return this.http.post<CouponApiResponse>(this.baseUrl, payload);
  }

  /** PUT /api/provider/coupons/:id */
  update(id: string, payload: UpdateCouponPayload): Observable<CouponApiResponse> {
    return this.http.put<CouponApiResponse>(`${this.baseUrl}/${id}`, payload);
  }

  /** PUT /api/provider/coupons/:id with `{ active }` — activate / pause. */
  setActive(id: string, active: boolean): Observable<CouponApiResponse> {
    return this.update(id, { active });
  }

  /** PATCH /api/provider/coupons/:id/approval (company accounts only). */
  decideApproval(id: string, payload: ApprovalDecisionPayload): Observable<CouponApiResponse> {
    return this.http.patch<CouponApiResponse>(`${this.baseUrl}/${id}/approval`, payload);
  }
}
