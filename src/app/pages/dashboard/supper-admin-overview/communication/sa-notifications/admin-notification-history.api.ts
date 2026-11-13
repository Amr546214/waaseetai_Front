import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../../environments/environment';

export const NOTIFICATION_CATEGORIES = { ALL: 'عام', OFFERS: 'العروض', PROJECTS: 'المشاريع', FINANCIAL: 'المالية', AI: 'الذكاء الاصطناعي' } as const;
export type Category = keyof typeof NOTIFICATION_CATEGORIES;
export interface HistoryFilters { range: '24h' | '7d'; category: Category | ''; read: 'read' | 'unread' | '';source?:'SYSTEM'|'ADMIN'|'' }
export interface HistoryCursor { beforeAt: string; beforeId: string }
export interface HistoryItem { id: string; category: Category; type: string; isRead: boolean; createdAt: string;source?:string;title?:string;message?:string;delivery?:{status:string;emailStatus:string;emailError:string|null} }
export interface HistoryPage { items: HistoryItem[]; nextCursor: HistoryCursor | null }

@Injectable({ providedIn: 'root' })
export class AdminNotificationHistoryApi {
  private readonly http = inject(HttpClient);

  list(filters: HistoryFilters, cursor: HistoryCursor | null) {
    let params = new HttpParams().set('range', filters.range);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.source) params = params.set('source', filters.source);
    if (filters.read) params = params.set('read', filters.read);
    if (cursor) params = params.set('beforeAt', cursor.beforeAt).set('beforeId', cursor.beforeId);
    return this.http.get<{ data: HistoryPage }>(`${environment.url_api}/admin/notification-history`, { params });
  }
}
