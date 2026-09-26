import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccreditationActionApiResponse,
  AccreditationDetailApiResponse,
  AccreditationListApiResponse,
  AdminAccreditationsQuery,
  RejectAccreditationPayload,
} from '../models/accreditation.model';

@Injectable({
  providedIn: 'root',
})
export class AccreditationApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  // ── Admin ───────────────────────────────────────────────────────────

  /**
   * Admin lists accreditation samples with optional status filter + pagination.
   * GET /api/admin/accreditation/samples
   */
  getAdminSamples(query?: AdminAccreditationsQuery): Observable<AccreditationListApiResponse> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    return this.http.get<AccreditationListApiResponse>(`${this.baseUrl}/admin/accreditation/samples`, { params });
  }

  /**
   * Admin gets a single accreditation sample by ID.
   * GET /api/admin/accreditation/samples/:id
   */
  getAdminSample(id: string): Observable<AccreditationDetailApiResponse> {
    return this.http.get<AccreditationDetailApiResponse>(`${this.baseUrl}/admin/accreditation/samples/${id}`);
  }

  /**
   * Admin approves an accreditation sample. This also grants the linked
   * ProviderSpecialty its accreditation badge server-side (status=APPROVED,
   * isPassed=true, badgeGrantedAt=now) as part of the same transaction.
   * POST /api/admin/accreditation/samples/:id/approve
   */
  approveSample(id: string): Observable<AccreditationActionApiResponse> {
    return this.http.post<AccreditationActionApiResponse>(
      `${this.baseUrl}/admin/accreditation/samples/${id}/approve`,
      {},
    );
  }

  /**
   * Admin rejects an accreditation sample with a required reason (2-2000 chars).
   * The backend has no dedicated rejection-reason column — the reason is
   * appended to the sample's own aiFeedbackAr field, prefixed with
   * "[مراجعة الإدارة] سبب الرفض: ".
   * POST /api/admin/accreditation/samples/:id/reject
   */
  rejectSample(id: string, payload: RejectAccreditationPayload): Observable<AccreditationActionApiResponse> {
    return this.http.post<AccreditationActionApiResponse>(
      `${this.baseUrl}/admin/accreditation/samples/${id}/reject`,
      payload,
    );
  }

  // ── Backend gaps (confirmed absent, not built in this batch) ───────────
  //
  // No "request additional documents" admin action exists — only approve/reject.
  // No admin-scoped accepted/rejected-this-month or average-review-time stats
  // endpoint exists for accreditations specifically; KPI counts must be
  // derived from real per-status totals (pagination.total with limit=1),
  // not invented.
  // No admin-side full-text search (by provider name/email/title) endpoint —
  // only a single-value status filter + page/limit pagination.
}
