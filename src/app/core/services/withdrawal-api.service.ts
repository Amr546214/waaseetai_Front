import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminWithdrawalsQuery,
  ApproveWithdrawalPayload,
  ProviderWalletApiResponse,
  ProviderWithdrawalApiResponse,
  ProviderWithdrawalListApiResponse,
  ProviderWithdrawalPayload,
  RejectWithdrawalPayload,
  WithdrawalApiResponse,
  WithdrawalListApiResponse,
} from '../models/withdrawal.model';

@Injectable({
  providedIn: 'root',
})
export class WithdrawalApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  // ── Admin ───────────────────────────────────────────────────────────

  /**
   * Admin lists all withdrawal requests with optional filters.
   * GET /api/admin/withdrawals
   */
  getAdminWithdrawals(query?: AdminWithdrawalsQuery): Observable<WithdrawalListApiResponse> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    return this.http.get<WithdrawalListApiResponse>(`${this.baseUrl}/admin/withdrawals`, { params });
  }

  /**
   * Admin gets a single withdrawal by ID.
   * GET /api/admin/withdrawals/:id
   */
  getAdminWithdrawal(id: string): Observable<WithdrawalApiResponse> {
    return this.http.get<WithdrawalApiResponse>(`${this.baseUrl}/admin/withdrawals/${id}`);
  }

  /**
   * Admin approves a withdrawal request.
   * POST /api/admin/withdrawals/:id/approve
   * Body is optional: { adminNote?: string }
   */
  approveAdminWithdrawal(id: string, payload?: ApproveWithdrawalPayload): Observable<WithdrawalApiResponse> {
    return this.http.post<WithdrawalApiResponse>(
      `${this.baseUrl}/admin/withdrawals/${id}/approve`,
      payload ?? {},
    );
  }

  /**
   * Admin rejects a withdrawal request.
   * POST /api/admin/withdrawals/:id/reject
   * Body required: { rejectionReason: string }
   */
  rejectAdminWithdrawal(id: string, payload: RejectWithdrawalPayload): Observable<WithdrawalApiResponse> {
    return this.http.post<WithdrawalApiResponse>(
      `${this.baseUrl}/admin/withdrawals/${id}/reject`,
      payload,
    );
  }

  // ── Provider ────────────────────────────────────────────────────────

  /**
   * Provider wallet summary.
   * GET /api/provider/finance/wallet
   */
  getProviderWallet(): Observable<ProviderWalletApiResponse> {
    return this.http.get<ProviderWalletApiResponse>(`${this.baseUrl}/provider/finance/wallet`);
  }

  /**
   * Provider lists their own withdrawal requests.
   * GET /api/provider/finance/withdrawals?page=&limit=
   */
  getProviderWithdrawals(page = 1, limit = 10): Observable<ProviderWithdrawalListApiResponse> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ProviderWithdrawalListApiResponse>(`${this.baseUrl}/provider/finance/withdrawals`, { params });
  }

  /**
   * Provider submits a new withdrawal request.
   * POST /api/provider/finance/withdrawals
   * Creates a PENDING withdrawal; wallet balance is NOT reduced on submit.
   */
  submitProviderWithdrawal(payload: ProviderWithdrawalPayload): Observable<ProviderWithdrawalApiResponse> {
    return this.http.post<ProviderWithdrawalApiResponse>(`${this.baseUrl}/provider/finance/withdrawals`, payload);
  }
}
