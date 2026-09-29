import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MarketingCenterApiResponse, SpendCapApiResponse } from '../models/marketing.model';

/**
 * مركز التسويق — aggregated marketing KPIs.
 * Base: /api/provider/marketing
 */
@Injectable({
  providedIn: 'root',
})
export class MarketingCenterService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.url_api}/provider/marketing`;

  /**
   * Live company pending-approvals count (coupons + offers), fed by every
   * getCenter() call. Drives the sidebar "طلبات الموافقة" badge. null until
   * the first successful load (or for individual accounts).
   */
  readonly pendingApprovalsCount = signal<number | null>(null);

  /** GET /api/provider/marketing/center */
  getCenter(): Observable<MarketingCenterApiResponse> {
    return this.http.get<MarketingCenterApiResponse>(`${this.baseUrl}/center`).pipe(
      tap(res => this.pendingApprovalsCount.set(res?.data?.company?.pendingApprovals?.count ?? null))
    );
  }

  /** Re-fetches the center only to refresh the pending-approvals badge. */
  refreshPendingCount(): void {
    this.getCenter().subscribe({ error: () => { /* badge is best-effort */ } });
  }

  /** PATCH /api/provider/marketing/spend-cap (company only). `null` removes the cap. */
  updateSpendCap(cap: number | null): Observable<SpendCapApiResponse> {
    return this.http.patch<SpendCapApiResponse>(`${this.baseUrl}/spend-cap`, { cap });
  }
}
