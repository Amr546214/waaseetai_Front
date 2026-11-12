import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';

export type ControlAction =
  | 'REQUEST_SUSPEND' | 'REQUEST_RESUME' | 'REQUEST_CANCEL'
  | 'OFFER_SUSPEND' | 'OFFER_RESUME'
  | 'CONTRACT_FREEZE' | 'CONTRACT_UNFREEZE' | 'CONTRACT_CANCEL' | 'ESCROW_REFUND' | 'ESCROW_RELEASE';
export type ControlKind = 'request' | 'offer' | 'contract';

/** One action of the controls read model: `code` is the server's stable reason code when it is not allowed (mapped to Arabic copy in order-controls.copy.ts). */
export interface ControlState { allowed: boolean; code: string | null; message: string | null; requiresSuperAdmin: boolean }
export interface ControlsData {
  version: string;
  status?: string | null;
  suspended?: boolean;
  frozen?: boolean;
  suspendReason?: string | null;
  freezeReason?: string | null;
  cancelReason?: string | null;
  escrow?: { status: string; amount: number; releasedAmount: number; heldAmount: number } | null;
  actions: Partial<Record<ControlAction, ControlState>>;
}
export interface ControlQuote {
  action: string; version: string | null; currency: string;
  blocked: { code: string; message: string } | null;
  expectedHeldAmount: number;
  escrow?: { status: string; amount: number; releasedAmount: number; heldAmount: number } | null;
  amounts: { heldBefore: number; refundToClient: number; releaseToProvider: number; platformCommission: number; providerNet: number };
  beneficiary: { kind: 'CLIENT' | 'PROVIDER' | 'NONE'; userId: string | null; name: string | null };
  commission: { feePolicyVersion: number | null; ratePercent: number | null; appliesTo: 'RELEASE' | 'NONE' };
  settlement: { options: string[]; partial: { available: boolean; code: string } } | null;
  after: { contractStatus: string | null; requestStatus: string | null; escrowStatus: string | null };
  effects: string[];
  offersToClose?: number;
}
export interface ControlPayload { reason?: string; expectedVersion: string; confirm?: boolean; expectedHeldAmount?: number; settlement?: string }

/** Admin controls over requests / offers / contracts / escrow. Every mutation carries an Idempotency-Key (one per user attempt) and the version the admin saw. */
@Injectable({ providedIn: 'root' })
export class AdminOrderControlsApiService {
  private http = inject(HttpClient);
  private readonly base = environment.url_api;

  private path(kind: ControlKind, id: string): string {
    return `${this.base}/admin/${kind === 'request' ? 'requests' : kind === 'offer' ? 'offers' : 'contracts'}/${id}`;
  }

  controls(kind: ControlKind, id: string): Observable<ApiResponse<ControlsData>> {
    return this.http.get<ApiResponse<ControlsData>>(`${this.path(kind, id)}/controls`);
  }

  /** The preview shown BEFORE the confirmation (amounts, beneficiary, commission, effects). Moves nothing. */
  quote(action: ControlAction, id: string): Observable<ApiResponse<ControlQuote>> {
    if (action === 'REQUEST_CANCEL') return this.http.get<ApiResponse<ControlQuote>>(`${this.path('request', id)}/cancel-quote`);
    const a = action === 'CONTRACT_CANCEL' ? 'CANCEL' : action === 'ESCROW_REFUND' ? 'REFUND' : 'RELEASE';
    return this.http.get<ApiResponse<ControlQuote>>(`${this.path('contract', id)}/quote`, { params: { action: a } });
  }

  run(action: ControlAction, id: string, body: ControlPayload, key: string): Observable<ApiResponse<Record<string, unknown>>> {
    const headers = new HttpHeaders({ 'Idempotency-Key': key });
    const url = (kind: ControlKind, verb: string) => `${this.path(kind, id)}/${verb}`;
    switch (action) {
      case 'REQUEST_SUSPEND': return this.http.post<ApiResponse<Record<string, unknown>>>(url('request', 'suspend'), body, { headers });
      case 'REQUEST_RESUME': return this.http.post<ApiResponse<Record<string, unknown>>>(url('request', 'resume'), body, { headers });
      case 'REQUEST_CANCEL': return this.http.post<ApiResponse<Record<string, unknown>>>(url('request', 'cancel'), body, { headers });
      case 'OFFER_SUSPEND': return this.http.post<ApiResponse<Record<string, unknown>>>(url('offer', 'suspend'), body, { headers });
      case 'OFFER_RESUME': return this.http.post<ApiResponse<Record<string, unknown>>>(url('offer', 'resume'), body, { headers });
      case 'CONTRACT_FREEZE': return this.http.post<ApiResponse<Record<string, unknown>>>(url('contract', 'freeze'), body, { headers });
      case 'CONTRACT_UNFREEZE': return this.http.post<ApiResponse<Record<string, unknown>>>(url('contract', 'unfreeze'), body, { headers });
      case 'CONTRACT_CANCEL': return this.http.post<ApiResponse<Record<string, unknown>>>(url('contract', 'cancel'), body, { headers });
      case 'ESCROW_REFUND': return this.http.post<ApiResponse<Record<string, unknown>>>(url('contract', 'refund'), body, { headers });
      case 'ESCROW_RELEASE': return this.http.post<ApiResponse<Record<string, unknown>>>(url('contract', 'release'), body, { headers });
    }
  }
}
