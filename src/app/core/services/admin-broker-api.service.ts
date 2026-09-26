import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminBrokerDetailApiResponse,
  AdminBrokerListApiResponse,
  AdminBrokersQuery,
} from '../models/admin-broker.model';

@Injectable({
  providedIn: 'root',
})
export class AdminBrokerApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  /**
   * Admin lists real brokers (AffiliateProfile) with optional search/status
   * filter + pagination.
   * GET /api/admin/brokers
   */
  getBrokers(query?: AdminBrokersQuery): Observable<AdminBrokerListApiResponse> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.page) params = params.set('page', query.page);
    if (query?.limit) params = params.set('limit', query.limit);
    if (query?.search) params = params.set('search', query.search);
    return this.http.get<AdminBrokerListApiResponse>(`${this.baseUrl}/admin/brokers`, { params });
  }

  /**
   * Admin gets a single broker's real detail (channels, channel metrics,
   * custom links, recent commissions).
   * GET /api/admin/brokers/:id
   */
  getBrokerDetail(id: string): Observable<AdminBrokerDetailApiResponse> {
    return this.http.get<AdminBrokerDetailApiResponse>(`${this.baseUrl}/admin/brokers/${id}`);
  }

  // ── Backend gaps (confirmed absent, not built in this batch) ───────────
  //
  // No suspend-account / freeze-commissions / send-for-manual-withdrawal
  // action endpoint exists for brokers specifically. A broker IS a User
  // under the hood, so an existing PATCH /admin/users/:id/status could
  // technically back a future "suspend broker" action — but wiring
  // account suspension was explicitly out of scope for this batch and
  // was not requested, so it is not connected here.
}
