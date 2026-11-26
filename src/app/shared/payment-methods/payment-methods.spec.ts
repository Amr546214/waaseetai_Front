import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentMethods } from './payment-methods';
import { PaypalReturn } from './paypal-return';
import { PaymentMethodsState } from '../../core/services/payment-methods-api.service';
import { environment } from '../../../environments/environment';
import { PAYPAL_PENDING_KEY } from './payment-methods';
import { vi } from 'vitest';

const base = `${environment.url_api}/payment-methods`;
const state = (over: Partial<PaymentMethodsState> = {}): PaymentMethodsState => ({ role: 'PROVIDER', environment: 'sandbox', methods: [], legacyPaypal: null, capabilities: { paypalConnect: true, bankSave: true, bankVerification: false }, ...over });
const bank = { id: 'bank-id', kind: 'ALRAJHI' as const, label: 'حساب الراجحي', hint: 'SA••1234', status: 'UNVERIFIED' as const, isDefault: false, canActivate: false, emailVerified: null, accountVerified: null };
const paypal = { id: 'paypal-id', kind: 'PAYPAL' as const, label: 'PayPal', hint: 'o***@e***.com', status: 'NEEDS_ACTIVATION' as const, isDefault: false, canActivate: true, emailVerified: true, accountVerified: false };

describe('Payment methods: real HTTP state, owner scope and honest verification UI', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ imports: [PaymentMethods], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { data: { paymentRole: 'PROVIDER' } } } }] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  const page = (data = state()) => { const fixture = TestBed.createComponent(PaymentMethods); fixture.detectChanges(); http.expectOne(`${base}?role=PROVIDER`).flush({ data }); fixture.detectChanges(); return fixture; };
  it('lists only PayPal and Al Rajhi, masks legacy email and marks bank ownership unverified', () => {
    const f = page(state({ methods: [bank], legacyPaypal: { hint: 'l***@e***.com', status: 'LEGACY_UNVERIFIED' } }));
    expect(f.nativeElement.textContent).toContain('لم تُتحقق الملكية'); expect(f.nativeElement.textContent).toContain('لم يُربط بحساب PayPal');
    expect(f.nativeElement.textContent).not.toContain('تعيين كافتراضية');
    expect(f.nativeElement.textContent).not.toContain('تم التحقق من الحساب البنكي');
  });
  it('saving does not claim success before server confirmation; a failed save preserves input for retry', () => {
    const f = page(); const c = f.componentInstance; c.newBank(); c.bankForm.setValue({ accountHolder: 'Test Owner', iban: 'SA-invalid', label: 'Main' });
    c.saveBank(); expect(c.notice()).toBe(''); expect(c.busy()).toBe(true); c.saveBank();
    const req = http.expectOne(`${base}/alrajhi?role=PROVIDER`); expect(req.request.body.iban).toBe('SA-invalid');
    req.flush({ message: 'آيبان غير صحيح', errors: [{ field: 'iban', message: 'أدخل آيبان الراجحي الصحيح' }] }, { status: 400, statusText: 'Bad Request' });
    expect(c.fieldErrors()['iban']).toBe('أدخل آيبان الراجحي الصحيح');
    expect(c.error()).toBe('آيبان غير صحيح'); expect(c.bankForm.getRawValue().iban).toBe('SA-invalid'); expect(c.bankOpen()).toBe(true);
    c.saveBank(); http.expectOne(`${base}/alrajhi?role=PROVIDER`).flush({ data: state({ methods: [bank] }) });
    expect(c.bankOpen()).toBe(false); expect(c.notice()).toContain('لم يتم التحقق من الملكية');
  });
  it('provider activation keeps OTP confirmation separate and does not show a connected destination prematurely', () => {
    const f = page(state({ methods: [paypal] })); const c = f.componentInstance;
    c.activate(paypal); http.expectOne(`${base}/paypal-id/activate?role=PROVIDER`).flush({ data: { otpRequired: true, emailHint: 'u***@e***.com' } });
    expect(c.otpMethod()?.id).toBe('paypal-id'); expect(c.state()?.methods[0].status).toBe('NEEDS_ACTIVATION');
    c.otpForm.setValue({ code: '123456' }); c.confirmOtp();
    const req = http.expectOne(`${base}/paypal-id/confirm?role=PROVIDER`); expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ data: state({ methods: [{ ...paypal, status: 'CONNECTED', canActivate: false }] }) });
    expect(c.otpMethod()).toBeNull(); expect(c.notice()).toContain('24');
  });
  it('disconnect requires an explicit confirmation and explains that canonical payout data remains', () => {
    const f = page(state({ methods: [paypal] })); const c = f.componentInstance;
    c.removeTarget.set(paypal); f.detectChanges(); http.expectNone(r => r.method === 'DELETE');
    expect(f.nativeElement.textContent).toContain('ويبقى بريد السحب المحفوظ');
    c.remove(); const req = http.expectOne(`${base}/paypal-id?role=PROVIDER`); expect(req.request.method).toBe('DELETE');
    req.flush({ data: state({ legacyPaypal: { hint: 'o***@e***.com', status: 'LEGACY_UNVERIFIED' } }) });
    expect(c.removeTarget()).toBeNull(); expect(c.state()?.legacyPaypal).not.toBeNull();
  });
  it('missing credentials disable connection without misrepresenting legacy email as a PayPal link', () => {
    const f = page(state({ capabilities: { paypalConnect: false, bankSave: false, bankVerification: false } }));
    const buttons = [...f.nativeElement.querySelectorAll('.add-card button')] as HTMLButtonElement[];
    expect(buttons.every(b => b.disabled)).toBe(true);
  });
  it('load failures offer retry instead of stale method cards', () => {
    const f = TestBed.createComponent(PaymentMethods); f.detectChanges();
    http.expectOne(`${base}?role=PROVIDER`).flush({ message: 'الخدمة غير متاحة' }, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    expect(f.componentInstance.state()).toBeNull(); expect(f.nativeElement.textContent).toContain('إعادة المحاولة');
  });
});

describe('PayPal return: session-bound local attempt plus authoritative server verification', () => {
  let http: HttpTestingController; let memory: Record<string, string>; let query: Record<string, string>; let clear: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    memory = {}; query = { code: 'synthetic-code', state: 'synthetic-state' };
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = v; }, removeItem: (k: string) => { delete memory[k]; } });
    clear = vi.spyOn(history, 'replaceState').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ imports: [PaypalReturn], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return convertToParamMap(query); } } } }] }); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); clear.mockRestore(); vi.unstubAllGlobals(); });
  const pending = (over = {}) => { memory[PAYPAL_PENDING_KEY] = JSON.stringify({ role: 'AFFILIATE', state: 'synthetic-state', at: Date.now(), ...over }); };
  const page = () => { const f = TestBed.createComponent(PaypalReturn); f.detectChanges(); return f; };
  it('clears authorization data and forwards code to backend bound to the original role, not a new account', () => {
    pending(); const f = page(); const req = http.expectOne(`${base}/paypal/complete?role=AFFILIATE`);
    expect(req.request.body).toEqual({ code: 'synthetic-code', state: 'synthetic-state' }); expect(clear).toHaveBeenCalled(); expect(memory[PAYPAL_PENDING_KEY]).toBeUndefined();
    expect(f.componentInstance.message()).not.toContain('تم حفظ'); req.flush({ data: state({ role: 'AFFILIATE' }) });
    expect(f.componentInstance.back()).toBe('/marketer-overview/finance/payment-methods'); expect(f.componentInstance.message()).toContain('تم حفظ');
  });
  it('refuses mismatched/absent state without exchanging the authorization code', () => {
    pending({ state: 'wrong' }); const f = page(); http.expectNone(r => r.method === 'POST'); expect(f.componentInstance.message()).toContain('غير صالحة');
  });
  it('handles a user cancellation without treating it as a successful link', () => {
    pending(); query = { error: 'access_denied', state: 'synthetic-state' }; const f = page(); http.expectNone(r => r.method === 'POST'); expect(f.componentInstance.message()).toContain('لم يكتمل');
  });
  it('rejects an expired local attempt and never sends a stale code', () => {
    pending({ at: Date.now() - 700000 }); page(); http.expectNone(r => r.method === 'POST');
  });
});
