import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PaymentRole = 'CLIENT' | 'PROVIDER' | 'AFFILIATE';
export interface SavedPaymentMethod {
  id: string; kind: 'PAYPAL' | 'ALRAJHI'; label: string; hint: string;
  status: 'UNVERIFIED' | 'EMAIL_UNCONFIRMED' | 'CONNECTED' | 'NEEDS_ACTIVATION';
  isDefault: boolean; canActivate: boolean; emailVerified: boolean | null; accountVerified: boolean | null;
}
export interface PaymentMethodsState {
  methods: SavedPaymentMethod[]; role: PaymentRole; environment: 'live' | 'sandbox';
  legacyPaypal: { hint: string; status: string } | null;
  capabilities: { paypalConnect: boolean; paypalConnectOrigin?: string | null; bankSave: boolean; bankVerification: boolean };
}
export const paymentMethodsPath = (role: PaymentRole) => `${role === 'CLIENT' ? '/client-overview' : role === 'PROVIDER' ? '/provider-overview' : '/marketer-overview'}/finance/payment-methods`;

@Injectable({ providedIn: 'root' })
export class PaymentMethodsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.url_api}/payment-methods`;
  private url(role: PaymentRole, path = '') { return `${this.base}${path}?role=${role}`; }
  list(role: PaymentRole) { return this.http.get<{ data: PaymentMethodsState }>(this.url(role)).pipe(map(r => r.data)); }
  bank(role: PaymentRole, body: { accountHolder: string; iban: string; label?: string }) { return this.http.post<{ data: PaymentMethodsState }>(this.url(role, '/alrajhi'), body).pipe(map(r => r.data)); }
  detail(role: PaymentRole, id: string) { return this.http.get<{ data: { accountHolder: string; iban: string; label?: string } }>(this.url(role, `/${encodeURIComponent(id)}`)).pipe(map(r => r.data)); }
  start(role: PaymentRole) { return this.http.post<{ data: { url: string } }>(this.url(role, '/paypal/start'), {}).pipe(map(r => r.data)); }
  complete(role: PaymentRole, code: string, state: string) { return this.http.post<{ data: PaymentMethodsState }>(this.url(role, '/paypal/complete'), { code, state }).pipe(map(r => r.data)); }
  activate(role: PaymentRole, id: string) { return this.http.post<{ data: PaymentMethodsState & { otpRequired: boolean; emailHint?: string; resendAvailableAt?: string } }>(this.url(role, `/${encodeURIComponent(id)}/activate`), {}).pipe(map(r => r.data)); }
  confirm(role: PaymentRole, id: string, code: string) { return this.http.post<{ data: PaymentMethodsState }>(this.url(role, `/${encodeURIComponent(id)}/confirm`), { code }).pipe(map(r => r.data)); }
  makeDefault(role: PaymentRole, id: string) { return this.http.post<{ data: PaymentMethodsState }>(this.url(role, `/${encodeURIComponent(id)}/default`), {}).pipe(map(r => r.data)); }
  remove(role: PaymentRole, id: string) { return this.http.delete<{ data: PaymentMethodsState }>(this.url(role, `/${encodeURIComponent(id)}`)).pipe(map(r => r.data)); }
}
