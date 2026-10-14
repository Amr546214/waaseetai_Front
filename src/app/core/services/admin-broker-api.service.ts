import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
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

  /**
   * Admin suspends / reactivates a broker account (reason required to suspend; audit-logged server side).
   * PATCH /api/admin/brokers/:id/status
   */
  setBrokerStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string): Observable<ApiResponse<{ id: string; status: string }>> {
    return this.http.patch<ApiResponse<{ id: string; status: string }>>(`${this.baseUrl}/admin/brokers/${id}/status`, { status, reason });
  }
}
