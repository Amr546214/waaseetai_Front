import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';

export interface AdminPagination { page: number; limit: number; total: number; pages: number; totalPages: number }
export interface AdminParty { id: string; name: string; email: string | null }
export interface AdminEscrow {
  status: 'HELD' | 'RELEASED' | 'REFUNDED';
  amount: number;
  releasedAmount: number;
  /** Still held for the project (0 once RELEASED / REFUNDED). */
  heldAmount: number | null;
  fundedAt: string | null;
  platformCommissionAmount: number;
  providerNetReleasedAmount: number;
  feePolicyVersion: number | null;
}
export interface AdminProgress { totalStages: number; approvedStages: number; percent: number }

export interface AdminProjectRow {
  id: string; title: string; status: string; createdAt: string; deliveryDays: number;
  client: AdminParty | null; provider: AdminParty | null;
  contract: { id: string; price: number; status: string } | null;
  escrow: AdminEscrow | null; progress: AdminProgress;
}
export interface AdminProjectListData {
  items: AdminProjectRow[];
  counts: Record<string, number>;
  kpis: { escrowHeldCount: number; escrowHeldTotal: number; currency: string };
  pagination: AdminPagination;
}
export interface AdminStageDelivery { id: string; status: string; note: string; files: string[]; reviewNote: string | null; submittedAt: string; reviewedAt: string | null }
export interface AdminStage { id: string; stepOrder: number; title: string; amount: number; percentage: number; days: number; status: string; startedAt: string | null; approvedAt: string | null; deliveries: AdminStageDelivery[] }
export interface AdminProjectDetail {
  id: string; title: string; description: string; status: string; createdAt: string; deliveryDays: number; specialty: string;
  client: AdminParty | null; provider: AdminParty | null;
  contract: { id: string; price: number; status: string; durationDays: number; signedAt: string | null; clientSignedAt: string | null; providerSignedAt: string | null } | null;
  escrow: AdminEscrow | null; stages: AdminStage[];
  amendments: { id: string; title: string; type: string; status: string; budgetDelta: number | null; durationDeltaDays: number | null; createdAt: string; effect?: 'RECORD_ONLY'; effectNote?: string }[];
  progress: AdminProgress;
  disputes: { id: string; status: string; reason: string; createdAt: string; resolvedAt: string | null }[];
  openDisputes: number; currency: string;
}
export interface AdminContractRow {
  id: string; projectId: string; projectTitle: string; price: number; durationDays: number; status: string; signedAt: string | null; createdAt: string;
  client: AdminParty | null; provider: AdminParty | null; escrow: AdminEscrow | null;
}
export interface AdminContractListData {
  items: AdminContractRow[]; counts: Record<string, number>;
  kpis: { activeContractsValue: number; currency: string };
  pagination: AdminPagination;
}
export interface AdminContractDetail extends AdminProjectDetail {
  contractId: string; terms: unknown; termsVersion: number | null; phasesCount: number | null;
  signatures: { client: boolean; provider: boolean };
}
export interface AdminStaffMember { id: string; name: string; email: string; accountType: string }

export interface FinanceBucket { count: number; amount: number }
export interface AdminFinanceOverview {
  currency: string;
  totals: { escrowHeldCount: number; escrowHeldAmount: number; releasedGross: number; platformCommission: number; providerNetReleased: number; depositsCount: number; depositsAmount: number; paymentGatewayFees: number };
  withdrawals: Record<string, FinanceBucket>;
  affiliateCommissions: Record<string, FinanceBucket>;
  series: { month: string; deposits: number; releasedGross: number; withdrawalsPaid: number; affiliateCommissions: number }[];
}
export interface AdminTransaction { id: string; type: string; amount: number; currency: string; status: string; paymentMethod: string | null; referenceId: string | null; description: string | null; createdAt: string; user: AdminParty | null }
export interface AdminTransactionsData { items: AdminTransaction[]; typeCounts: Record<string, number>; pagination: AdminPagination }
export interface AdminCommissionRow { id: string; projectId: string; projectTitle: string; provider: string; escrowStatus: string; releasedGross: number; platformCommission: number; providerNet: number; ratePercent: number | null; level: number | null; updatedAt: string }
export interface AdminCommissionsData {
  currency: string;
  totals: { releasedGross: number; platformCommission: number; providerNet: number };
  affiliate: Record<string, FinanceBucket>;
  items: AdminCommissionRow[]; pagination: AdminPagination;
}
export interface AdminInvoice {
  id: string; sourceId: string; contractId: string; projectId: string; clientName: string; providerName: string; projectTitle: string; stageTitle: string; date: string;
  stageValue: number; platformCommission: number; net: number; status: 'paid' | 'due'; paymentDate: string | null; currency: string;
}
export interface AdminInvoicesData {
  currency: string;
  summary: { totalCount: number; paidCount: number; dueCount: number; paidTotal: number; dueTotal: number; platformCommission: number };
  items: AdminInvoice[]; pagination: AdminPagination;
}

/** Admin back-office reads: projects / contracts / escrow, finance read models, CSV exports and the staff list. All routes are ADMIN / SUPER_ADMIN only. */
@Injectable({ providedIn: 'root' })
export class AdminOpsApiService {
  private http = inject(HttpClient);
  private readonly base = environment.url_api;

  private params(q: Record<string, string | number | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p = p.set(k, String(v));
    return p;
  }

  listProjects(q: { status?: string; q?: string; page?: number; limit?: number } = {}): Observable<ApiResponse<AdminProjectListData>> {
    return this.http.get<ApiResponse<AdminProjectListData>>(`${this.base}/admin/projects`, { params: this.params(q) });
  }
  getProject(id: string): Observable<ApiResponse<AdminProjectDetail>> {
    return this.http.get<ApiResponse<AdminProjectDetail>>(`${this.base}/admin/projects/${id}`);
  }
  listContracts(q: { status?: string; q?: string; page?: number; limit?: number } = {}): Observable<ApiResponse<AdminContractListData>> {
    return this.http.get<ApiResponse<AdminContractListData>>(`${this.base}/admin/contracts`, { params: this.params(q) });
  }
  getContract(id: string): Observable<ApiResponse<AdminContractDetail>> {
    return this.http.get<ApiResponse<AdminContractDetail>>(`${this.base}/admin/contracts/${id}`);
  }
  listStaff(): Observable<ApiResponse<AdminStaffMember[]>> {
    return this.http.get<ApiResponse<AdminStaffMember[]>>(`${this.base}/admin/staff`);
  }

  financeOverview(months = 6): Observable<ApiResponse<AdminFinanceOverview>> {
    return this.http.get<ApiResponse<AdminFinanceOverview>>(`${this.base}/admin/finance/overview`, { params: this.params({ months }) });
  }
  financeTransactions(q: { type?: string; status?: string; q?: string; page?: number; limit?: number } = {}): Observable<ApiResponse<AdminTransactionsData>> {
    return this.http.get<ApiResponse<AdminTransactionsData>>(`${this.base}/admin/finance/transactions`, { params: this.params(q) });
  }
  financeCommissions(q: { page?: number; limit?: number } = {}): Observable<ApiResponse<AdminCommissionsData>> {
    return this.http.get<ApiResponse<AdminCommissionsData>>(`${this.base}/admin/finance/commissions`, { params: this.params(q) });
  }
  financeInvoices(q: { status?: 'paid' | 'due'; page?: number; limit?: number } = {}): Observable<ApiResponse<AdminInvoicesData>> {
    return this.http.get<ApiResponse<AdminInvoicesData>>(`${this.base}/admin/finance/invoices`, { params: this.params(q) });
  }

  /** Downloads a real CSV produced by the server (`transactions`, `commissions`, `invoices`, `withdrawals`) and saves it in the browser. */
  downloadCsv(name: 'transactions' | 'commissions' | 'invoices' | 'withdrawals', q: Record<string, string | undefined> = {}): Observable<Blob> {
    return this.http.get(`${this.base}/admin/finance/${name}.csv`, { params: this.params(q), responseType: 'blob' });
  }
}

/** Saves a Blob as a file in the browser. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
