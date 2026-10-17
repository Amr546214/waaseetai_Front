import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { formatMoney } from '../../../../core/utils/money.util';

export type RequestStatusKey =
  | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DRAFT' | 'PENDING_SIGNATURE' | 'DISPUTED';

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  OPEN: 'مفتوح',
  IN_PROGRESS: 'جارٍ',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  DRAFT: 'مسودة',
  PENDING_SIGNATURE: 'بانتظار التوقيع',
  DISPUTED: 'عليه نزاع',
};

export const REQUEST_STATUS_CLASSES: Record<string, string> = {
  OPEN: 'rq-st-open',
  IN_PROGRESS: 'rq-st-progress',
  COMPLETED: 'rq-st-completed',
  CANCELLED: 'rq-st-cancelled',
  DRAFT: 'rq-st-cancelled',
  PENDING_SIGNATURE: 'rq-st-open',
  DISPUTED: 'rq-st-flagged',
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  PENDING_SIGNATURE: 'بانتظار التوقيع',
  IN_AI_REVIEW: 'قيد المراجعة الآلية',
  SUBMITTED: 'مقدّم',
  UNDER_NEGOTIATION: 'قيد التفاوض',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
  CANCELLED: 'مسحوب',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  PENDING_CLIENT_SIGNATURE: 'بانتظار توقيع العميل',
  PENDING_PAYMENT: 'بانتظار الدفع',
  PENDING_PROVIDER_SIGNATURE: 'بانتظار توقيع مقدم الخدمة',
  ACTIVE: 'ساري',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  DISPUTED: 'عليه نزاع',
};

export interface AdminPerson {
  userId: string;
  name: string;
  email: string;
  accountType: string;
  memberSince: string;
  rating: number | string | null;
  completedProjects: number;
  kycStatus?: string | null;
}

export interface AdminBudget {
  type: 'FIXED' | 'RANGE' | 'HOURLY';
  min: number | null;
  max: number | null;
  currency: string;
}

export interface AdminRequestRow {
  id: string;
  title: string;
  status: string;
  projectStatus: string | null;
  contractStatus: string | null;
  client: AdminPerson | null;
  specialty: string | null;
  budget: AdminBudget;
  durationDays: number | null;
  offersCount: number;
  openDisputes: number;
  createdAt: string;
}

export interface AdminListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminRequestsList {
  items: AdminRequestRow[];
  pagination: AdminListPagination;
  counts: Record<string, number>;
}

export interface AdminRequestOffer {
  id: string;
  status: string;
  price: number;
  deliveryDays: number;
  aiMatchScore: number | null;
  aiQualityTag: string | null;
  aiPriceTag: string | null;
  createdAt: string;
  accepted: boolean;
  provider: AdminPerson;
}

export interface AdminRequestDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectStatus: string | null;
  specialty: string | null;
  subSpecialties: string[] | null;
  requiredSkills: string[] | null;
  budget: AdminBudget;
  durationDays: number | null;
  conditions: {
    preferredProviderType?: string | null;
    requiresNda?: boolean | null;
    ipRights?: string | null;
    allowNegotiation?: boolean | null;
    splitMilestones?: boolean | null;
    outputs?: string[] | string | null;
    customConditions?: string | null;
  } | null;
  attachmentsCount: number;
  aiAnalysis: { source: string; summary: string; complexity: string | null } | null;
  client: AdminPerson | null;
  contract: {
    id: string;
    status: string;
    price: number;
    durationDays: number | null;
    clientSignedAt: string | null;
    providerSignedAt: string | null;
  } | null;
  escrow: { status: string; amount: number; fundedAt: string | null } | null;
  offers: AdminRequestOffer[];
  disputes: { id: string; reason: string; status: string; createdAt: string }[];
  timeline: { at: string; text: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminListQuery {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function buildListParams(q: AdminListQuery): HttpParams {
  let p = new HttpParams();
  if (q.status && q.status !== 'ALL') p = p.set('status', q.status);
  if (q.search && q.search.trim()) p = p.set('search', q.search.trim());
  if (q.page) p = p.set('page', String(q.page));
  if (q.limit) p = p.set('limit', String(q.limit));
  return p;
}

/** Budget text, USD only: range, fixed, or hourly. */
export function formatBudget(b: AdminBudget | null | undefined): string {
  if (!b) return '—';
  const f = (n: number | null) => (n === null || n === undefined ? null : formatMoney(n));
  const min = f(b.min);
  const max = f(b.max);
  if (b.type === 'RANGE' && min && max) return `${min}–${max} $`;
  const one = min ?? max;
  if (!one) return '—';
  return b.type === 'HOURLY' ? `${one} $ / ساعة` : `${one} $`;
}

export function apiErrorMessage(err: any, fallback: string): string {
  return err?.error?.message || fallback;
}

@Injectable({ providedIn: 'root' })
export class SaRequestsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.url_api}/admin/requests`;

  list(q: AdminListQuery): Observable<{ success: boolean; data: AdminRequestsList }> {
    return this.http.get<{ success: boolean; data: AdminRequestsList }>(this.apiUrl, { params: buildListParams(q) });
  }

  get(id: string): Observable<{ success: boolean; data: AdminRequestDetail }> {
    return this.http.get<{ success: boolean; data: AdminRequestDetail }>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
}
