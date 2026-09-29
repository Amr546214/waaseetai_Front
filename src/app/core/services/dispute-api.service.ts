import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminDisputesQuery,
  CreateDisputeApiResponse,
  CreateDisputePayload,
  DisputeAiSummaryApiResponse,
  DisputeApiResponse,
  DisputeListApiResponse,
  ResolveDisputeApiResponse,
  ResolveDisputePayload,
} from '../models/dispute.model';

@Injectable({
  providedIn: 'root',
})
export class DisputeApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  // ── Client ──────────────────────────────────────────────────────────

  /**
   * Client creates a dispute for a request.
   * POST /api/client/requests/:id/disputes
   */
  createClientDispute(requestId: string, payload: CreateDisputePayload): Observable<CreateDisputeApiResponse> {
    return this.http.post<CreateDisputeApiResponse>(
      `${this.baseUrl}/client/requests/${requestId}/disputes`,
      payload,
    );
  }

  /**
   * Alias / legacy duplicate of the primary client create endpoint.
   * The Swagger schema for this route is GenericObject (untyped).
   * Prefer createClientDispute() unless this route is explicitly required.
   * POST /api/client/my-requests/:id/disputes
   */
  createClientMyRequestDispute(
    requestId: string,
    payload: CreateDisputePayload | Record<string, unknown>,
  ): Observable<CreateDisputeApiResponse> {
    return this.http.post<CreateDisputeApiResponse>(
      `${this.baseUrl}/client/my-requests/${requestId}/disputes`,
      payload,
    );
  }

  /**
   * Client lists their own disputes (as opener or respondent).
   * GET /api/client/disputes
   */
  getClientDisputes(query?: AdminDisputesQuery): Observable<DisputeListApiResponse> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    return this.http.get<DisputeListApiResponse>(`${this.baseUrl}/client/disputes`, { params });
  }

  /**
   * Client gets a single dispute they're a party to.
   * GET /api/client/disputes/:id
   */
  getClientDispute(id: string): Observable<DisputeApiResponse> {
    return this.http.get<DisputeApiResponse>(`${this.baseUrl}/client/disputes/${id}`);
  }

  // ── Provider ────────────────────────────────────────────────────────

  /**
   * Provider creates a dispute for a request.
   * POST /api/provider/requests/:id/disputes
   */
  createProviderDispute(requestId: string, payload: CreateDisputePayload): Observable<CreateDisputeApiResponse> {
    return this.http.post<CreateDisputeApiResponse>(
      `${this.baseUrl}/provider/requests/${requestId}/disputes`,
      payload,
    );
  }

  /**
   * Provider cancels a request (إلغاء بالتراضي).
   * POST /api/provider/requests/:id/cancel
   */
  cancelProviderRequest(requestId: string, payload?: Record<string, unknown>): Observable<CreateDisputeApiResponse> {
    return this.http.post<CreateDisputeApiResponse>(
      `${this.baseUrl}/provider/requests/${requestId}/cancel`,
      payload ?? {},
    );
  }

  /**
   * Provider lists their own disputes (as opener or respondent).
   * GET /api/provider/disputes
   */
  getProviderDisputes(query?: AdminDisputesQuery): Observable<DisputeListApiResponse> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    return this.http.get<DisputeListApiResponse>(`${this.baseUrl}/provider/disputes`, { params });
  }

  /**
   * Provider gets a single dispute they're a party to.
   * GET /api/provider/disputes/:id
   */
  getProviderDispute(id: string): Observable<DisputeApiResponse> {
    return this.http.get<DisputeApiResponse>(`${this.baseUrl}/provider/disputes/${id}`);
  }

  // ── Admin ───────────────────────────────────────────────────────────

  /**
   * Admin lists all disputes with optional filters.
   * GET /api/admin/disputes
   */
  getAdminDisputes(query?: AdminDisputesQuery): Observable<DisputeListApiResponse> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    return this.http.get<DisputeListApiResponse>(`${this.baseUrl}/admin/disputes`, { params });
  }

  /**
   * Admin gets a single dispute by ID.
   * GET /api/admin/disputes/:id
   */
  getAdminDispute(id: string): Observable<DisputeApiResponse> {
    return this.http.get<DisputeApiResponse>(`${this.baseUrl}/admin/disputes/${id}`);
  }

  /**
   * Admin resolves or rejects a dispute.
   * POST /api/admin/disputes/:id/resolve
   */
  resolveAdminDispute(id: string, payload: ResolveDisputePayload): Observable<ResolveDisputeApiResponse> {
    return this.http.post<ResolveDisputeApiResponse>(
      `${this.baseUrl}/admin/disputes/${id}/resolve`,
      payload,
    );
  }

  /**
   * Advisory-only Gemini summary for the human admin reviewer. Read-only —
   * never resolves/rejects the dispute, never touches status or money.
   * POST /api/admin/disputes/:id/ai-summary
   */
  getDisputeAiSummary(id: string): Observable<DisputeAiSummaryApiResponse> {
    return this.http.post<DisputeAiSummaryApiResponse>(
      `${this.baseUrl}/admin/disputes/${id}/ai-summary`,
      {},
    );
  }

  // ── Remaining backend gaps (not in Swagger) ─────────────────────────
  //
  // No dispute messages / conversation endpoints (no POST /disputes/:id/messages).
  // No dedicated evidence upload endpoint — use existing upload routes and pass URIs.
}
