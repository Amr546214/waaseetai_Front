import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  AdminListPagination,
  AdminListQuery,
  AdminPerson,
  buildListParams,
} from '../sa-requests/sa-requests.service';

export const OFFER_STATUS_CLASSES: Record<string, string> = {
  PENDING_SIGNATURE: 'of-st-pending',
  IN_AI_REVIEW: 'of-st-pending',
  SUBMITTED: 'of-st-pending',
  UNDER_NEGOTIATION: 'of-st-pending',
  ACCEPTED: 'of-st-accepted',
  REJECTED: 'of-st-rejected',
  CANCELLED: 'of-st-rejected',
};

export const NEGOTIATION_STATE_LABELS: Record<string, string> = {
  NONE: 'لا يوجد تفاوض',
  REQUEST_SENT: 'طلب تفاوض مرسل',
  COUNTER_PENDING: 'عرض مضاد بانتظار العميل',
};

export interface AdminOfferRow {
  id: string;
  requestId: string;
  requestTitle: string;
  title: string;
  status: string;
  price: number;
  deliveryDays: number;
  aiMatchScore: number | null;
  aiQualityTag: string | null;
  aiPriceTag: string | null;
  createdAt: string;
  currency: string;
  provider: AdminPerson;
  client: AdminPerson;
}

export interface AdminOffersList {
  items: AdminOfferRow[];
  pagination: AdminListPagination;
  counts: Record<string, number>;
}

export interface AdminOfferDetail {
  id: string;
  requestId: string;
  requestTitle: string;
  requestStatus: string;
  title: string;
  message: string | null;
  advantages: string[] | string | null;
  outputs: string[] | string | null;
  price: number;
  deliveryDays: number;
  currency: string;
  status: string;
  agreedToTerms: boolean | null;
  agreedToEscrow: boolean | null;
  aiReview: {
    matchScore: number | null;
    qualityTag: string | null;
    priceTag: string | null;
    feedback: { summary?: string | null } | string | null;
  } | null;
  milestones: {
    id: string;
    stepOrder: number;
    title: string;
    description: string | null;
    days: number | null;
    percentage: number | null;
    amount: number | null;
  }[];
  provider: AdminPerson;
  client: AdminPerson;
  contract: { id: string; status: string; price: number } | null;
  negotiation: {
    state: 'NONE' | 'REQUEST_SENT' | 'COUNTER_PENDING';
    entriesCount: number;
    entries: { kind: string; price: number | null; deliveryDays: number | null; notes: string | null; createdAt: string }[];
  };
  createdAt: string;
  updatedAt: string;
}

/** Normalises string-or-array text fields into a list. */
export function toList(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

export function feedbackSummary(ai: AdminOfferDetail['aiReview']): string {
  const f = ai?.feedback;
  if (!f) return '';
  return typeof f === 'string' ? f : f.summary || '';
}

@Injectable({ providedIn: 'root' })
export class SaOffersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.url_api}/admin/offers`;

  list(q: AdminListQuery): Observable<{ success: boolean; data: AdminOffersList }> {
    return this.http.get<{ success: boolean; data: AdminOffersList }>(this.apiUrl, { params: buildListParams(q) });
  }

  get(id: string): Observable<{ success: boolean; data: AdminOfferDetail }> {
    return this.http.get<{ success: boolean; data: AdminOfferDetail }>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
}
