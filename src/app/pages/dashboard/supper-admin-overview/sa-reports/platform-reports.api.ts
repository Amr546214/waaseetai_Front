import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../environments/environment';

export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';
export const REPORT_STATUSES: Record<ReportStatus, string> = { OPEN: 'بانتظار المراجعة', RESOLVED: 'تمت المعالجة', DISMISSED: 'مرفوض' };
export const REPORT_TARGETS = { ACCOUNT: 'حساب', SERVICE: 'خدمة' } as const;
type Person = { firstName: string; lastName: string };
export interface ReportItem { id: string; targetLabel: string; targetType: keyof typeof REPORT_TARGETS; status: ReportStatus; createdAt: string }
export interface ReportDetail extends ReportItem { targetId: string; reason: string; reporter: Person; reviewer: Person | null; resolution: string | null; reviewedAt: string | null }
export interface ReportPage { items: ReportItem[]; total: number; page: number; pages: number }

@Injectable({ providedIn: 'root' })
export class PlatformReportsApi {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.url_api}/admin/reports`;
  list(page: number, status?: ReportStatus) {
    let params = new HttpParams().set('page', page);
    if (status) params = params.set('status', status);
    return this.http.get<{ data: ReportPage }>(this.root, { params });
  }
  detail(id: string) {
    return this.http.get<{ data: ReportDetail }>(`${this.root}/${encodeURIComponent(id)}`);
  }
  decide(id: string, status: 'RESOLVED' | 'DISMISSED', resolution: string) {
    return this.http.patch<{ data: ReportDetail }>(`${this.root}/${encodeURIComponent(id)}`, { status, resolution });
  }
}
