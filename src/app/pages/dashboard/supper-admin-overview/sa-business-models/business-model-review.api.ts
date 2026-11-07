import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../environments/environment';

export const MODEL_STATUSES = {
  PENDING_APPROVAL: 'بانتظار الاعتماد', UNDER_REVIEW: 'قيد المراجعة', APPROVED: 'معتمد',
  REJECTED: 'مرفوض', PUBLISHED: 'منشور', ARCHIVED: 'مخفي',
} as const;
export const MODEL_ACTIONS = { APPROVE: 'اعتماد ونشر', REJECT: 'رفض', HIDE: 'إخفاء', RESTORE: 'إعادة النشر' } as const;
export type ModelStatus = keyof typeof MODEL_STATUSES;
export type ModelAction = keyof typeof MODEL_ACTIONS;
export interface ReviewModel {
  id: string; title: string; status: ModelStatus; totalDays: number; auditRejectionReason: string | null;
  provider: { firstName: string; lastName: string }; specialty: { nameAr: string } | null;
}
export interface ReviewModelDetail extends ReviewModel {
  description: string; actions: ModelAction[];
  stages: { id: string; title: string; description: string | null; deliveryDays: number }[];
}
export interface ReviewPage {
  items: ReviewModel[]; pagination: { page: number; pages: number; total: number };
}
export const modelError = (e: HttpErrorResponse, fallback: string) => {
  if (e.status === 403) return 'ليست لديك صلاحية لهذا الإجراء.';
  if (e.status === 404) return 'النموذج غير موجود.';
  if (e.status === 409) return 'تغيّرت حالة النموذج. راجع الحالة الحالية قبل اتخاذ قرار جديد.';
  return fallback;
};

@Injectable({ providedIn: 'root' })
export class BusinessModelReviewApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.url_api}/admin/marketplace-services`;
  list(page: number, search: string, status: string) {
    let params = new HttpParams().set('page', page);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    return this.http.get<{ data: ReviewPage }>(this.url, { params });
  }
  detail(id: string) {
    return this.http.get<{ data: ReviewModelDetail }>(`${this.url}/${encodeURIComponent(id)}`);
  }
  decide(id: string, action: ModelAction, reason: string, expectedStatus: ModelStatus) {
    return this.http.patch(`${this.url}/${encodeURIComponent(id)}/moderation`, { action, reason, expectedStatus });
  }
}
