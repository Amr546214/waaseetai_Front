import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaOrderControls } from './sa-order-controls';
import { AdminOrderControlsApiService } from '../../../../core/services/admin-order-controls-api.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { REASON_COPY, controlErrorCopy } from './order-controls.copy';

const allow = { allowed: true, code: null, message: null, requiresSuperAdmin: false };
const deny = (code: string, su = false) => ({ allowed: false, code, message: null, requiresSuperAdmin: su });
const reqControls = (over: any = {}) => ({ success: true, data: { version: 'rv1', status: 'OPEN', suspended: false, actions: { REQUEST_SUSPEND: allow, REQUEST_RESUME: deny('REQUEST_NOT_SUSPENDED'), REQUEST_CANCEL: allow, ...over } } });
const quote = (over: any = {}) => ({ success: true, data: {
  action: 'CONTRACT_CANCEL', version: 'qv9', currency: 'USD', blocked: null, expectedHeldAmount: 20,
  amounts: { heldBefore: 20, refundToClient: 20, releaseToProvider: 0, platformCommission: 0, providerNet: 0 },
  beneficiary: { kind: 'CLIENT', userId: 'c1', name: 'نور خالد' }, commission: { feePolicyVersion: 2, ratePercent: 12.75, appliesTo: 'NONE' },
  settlement: { options: ['REFUND_ALL_TO_CLIENT'], partial: { available: false, code: 'PARTIAL_SETTLEMENT_NOT_DEFINED' } },
  after: { contractStatus: 'CANCELLED', requestStatus: 'CANCELLED', escrowStatus: 'REFUNDED' }, effects: ['HELD_REFUNDED_TO_CLIENT', 'CONTRACT_CANCELLED', 'ALREADY_RELEASED_UNCHANGED'], offersToClose: 2, ...over } });

@Component({ standalone: true, imports: [SaOrderControls], template: `<sa-order-controls [kind]="kind" [id]="id" (changed)="n = n + 1"></sa-order-controls>` })
class Host { kind: 'request' | 'offer' | 'contract' = 'request'; id = 'r1'; n = 0; }

function make(api: Partial<Record<'controls' | 'quote' | 'run', any>>, kind: Host['kind'] = 'request') {
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  TestBed.configureTestingModule({ imports: [Host], providers: [{ provide: AdminOrderControlsApiService, useValue: api }, { provide: UiNotificationService, useValue: notify }] });
  const f = TestBed.createComponent(Host);
  f.componentInstance.kind = kind;
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, notify, host: f.componentInstance };
}
const type = (f: any, el: HTMLElement, text: string) => { const ta = el.querySelector('#oc-reason-input') as HTMLTextAreaElement; ta.value = text; ta.dispatchEvent(new Event('input')); f.detectChanges(); };
const tick = async (f: any) => { await f.whenStable(); f.detectChanges(); };

describe('SaOrderControls', () => {
  it('shows only the buttons that make sense, enabled by the server, and a specific reason for a refused one', () => {
    const api = { controls: vi.fn(() => of(reqControls({ REQUEST_CANCEL: deny('ACTIVE_DISPUTE') }))), quote: vi.fn(), run: vi.fn() };
    const { el } = make(api);
    expect((el.querySelector('[data-action="REQUEST_SUSPEND"]') as HTMLButtonElement).disabled).toBe(false);
    expect(el.querySelector('[data-action="REQUEST_RESUME"]')).toBeNull();
    const cancel = el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(el.querySelector('[data-reason-code="ACTIVE_DISPUTE"]')!.textContent).toContain('نزاع مفتوح');
    expect(el.textContent).not.toContain('غير متاح');
  });

  it('suspend: reason is mandatory, key + version are sent, success refreshes the controls and tells the parent', async () => {
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn(() => of({ success: true, data: {} })) };
    const { f, el, notify, host } = make(api);
    (el.querySelector('[data-action="REQUEST_SUSPEND"]') as HTMLButtonElement).click(); f.detectChanges();
    const submit = () => el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement;
    expect(submit().disabled).toBe(true);
    type(f, el, 'abc'); expect(submit().disabled).toBe(true);
    type(f, el, 'مخالفة سياسة المنصة'); expect(submit().disabled).toBe(false);
    submit().click(); f.detectChanges(); await tick(f);
    expect(api.run).toHaveBeenCalledTimes(1);
    const [action, id, body, key] = api.run.mock.calls[0] as any[];
    expect([action, id]).toEqual(['REQUEST_SUSPEND', 'r1']);
    expect(body).toEqual({ expectedVersion: 'rv1', reason: 'مخالفة سياسة المنصة' });
    expect(typeof key).toBe('string'); expect(key.length).toBeGreaterThan(8);
    expect(notify.success).toHaveBeenCalledWith('عُلّق الطلب مؤقتًا');
    expect(api.controls).toHaveBeenCalledTimes(2); // reloaded after success
    expect(host.n).toBe(1);
    expect(el.querySelector('[data-testid="oc-dialog"]')).toBeNull();
  });

  it('double click: a second click while the call is in flight sends nothing', async () => {
    const { Subject } = await import('rxjs');
    const pending = new Subject<any>();
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn(() => pending) };
    const { f, el } = make(api);
    (el.querySelector('[data-action="REQUEST_SUSPEND"]') as HTMLButtonElement).click(); f.detectChanges();
    type(f, el, 'سبب كافٍ للتعليق');
    const b = el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement;
    b.click(); b.click(); f.detectChanges();
    expect(api.run).toHaveBeenCalledTimes(1);
    expect((el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).disabled).toBe(true);
    pending.next({ success: true, data: {} }); pending.complete(); await tick(f);
  });

  it('cancel with held money: the quote (amount, beneficiary, commission, effects, settlement) is shown BEFORE the confirmation; the confirmation is explicit', async () => {
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(() => of(quote())), run: vi.fn(() => of({ success: true, data: {} })) };
    const { f, el } = make(api);
    (el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    expect(api.quote).toHaveBeenCalledWith('REQUEST_CANCEL', 'r1');
    const t = el.querySelector('[data-testid="oc-quote"]')!.textContent!;
    expect(t).toContain('20.00 $'); expect(t).toContain('نور خالد'); expect(t).toContain('12.75%');
    expect(el.textContent).toContain('يُعاد كامل المبلغ المحتجز إلى رصيد الطالب');
    expect(el.textContent).toContain('ما صُرف سابقًا لمقدم الخدمة لا يتغيّر');
    expect(el.querySelector('[data-testid="oc-settlement"]')!.textContent).toContain('بانتظار قرار المنتج');
    const submit = () => el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement;
    type(f, el, 'مخالفة جسيمة للسياسة'); expect(submit().disabled).toBe(true); // not confirmed yet
    const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement; cb.checked = true; cb.dispatchEvent(new Event('change')); f.detectChanges();
    expect(submit().disabled).toBe(false);
    submit().click(); f.detectChanges(); await tick(f);
    const [, , body] = api.run.mock.calls[0] as any[];
    expect(body).toEqual({ expectedVersion: 'qv9', reason: 'مخالفة جسيمة للسياسة', confirm: true, expectedHeldAmount: 20, settlement: 'REFUND_ALL_TO_CLIENT' });
  });

  it('a blocked quote disables the confirmation and shows the specific reason', async () => {
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(() => of(quote({ blocked: { code: 'CONTRACT_FROZEN', message: 'x' } }))), run: vi.fn() };
    const { f, el } = make(api);
    (el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    expect(el.querySelector('[data-testid="oc-quote-blocked"]')!.textContent).toContain('فُكّ التجميد أولًا');
    type(f, el, 'سبب كافٍ للإلغاء'); const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement; cb.checked = true; cb.dispatchEvent(new Event('change')); f.detectChanges();
    expect((el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a changed held balance shows the Arabic reason, resets the confirmation and reloads controls + quote', async () => {
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(() => of(quote())), run: vi.fn(() => throwError(() => ({ status: 409, error: { code: 'HELD_BALANCE_CHANGED', message: 'x' } }))) };
    const { f, el } = make(api);
    (el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    type(f, el, 'سبب كافٍ للإلغاء'); const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement; cb.checked = true; cb.dispatchEvent(new Event('change')); f.detectChanges();
    (el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    expect(el.querySelector('[data-testid="oc-error"]')!.textContent).toContain('تغيّر المبلغ المحتجز');
    expect(api.quote).toHaveBeenCalledTimes(2); expect(api.controls).toHaveBeenCalledTimes(2);
    expect((el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).disabled).toBe(true); // must confirm again
  });

  it('a lost answer keeps the SAME key on retry (safe), a changed reason gets a NEW key', async () => {
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn() };
    api.run.mockReturnValueOnce(throwError(() => ({ status: 0, error: null }))).mockReturnValueOnce(of({ success: true, data: {} }));
    const { f, el } = make(api);
    (el.querySelector('[data-action="REQUEST_SUSPEND"]') as HTMLButtonElement).click(); f.detectChanges();
    type(f, el, 'سبب كافٍ للتعليق');
    (el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    expect(el.querySelector('[data-testid="oc-unknown"]')).toBeTruthy();
    (el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    const c1 = api.run.mock.calls as any[][]; expect(c1[0][3]).toBe(c1[1][3]);
    // new attempt with another reason
    const api2 = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn(() => throwError(() => ({ status: 409, error: { code: 'REQUEST_NOT_OPEN' } }))) };
    TestBed.resetTestingModule();
    const m = make(api2);
    (m.el.querySelector('[data-action="REQUEST_SUSPEND"]') as HTMLButtonElement).click(); m.f.detectChanges();
    type(m.f, m.el, 'سبب أول للتعليق'); (m.el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); m.f.detectChanges(); await tick(m.f);
    type(m.f, m.el, 'سبب ثانٍ مختلف تمامًا'); (m.el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); m.f.detectChanges(); await tick(m.f);
    const c2 = api2.run.mock.calls as any[][]; expect(c2[0][3]).not.toBe(c2[1][3]);
  });

  it('offer page: the linked contract can be cancelled through the contract controls with the contract version', async () => {
    const api = {
      controls: vi.fn((kind: string) => of(kind === 'offer' ? { success: true, data: { version: 'ov1', actions: { OFFER_SUSPEND: deny('OFFER_LINKED_TO_CONTRACT'), OFFER_RESUME: deny('OFFER_NOT_SUSPENDED') } } } : { success: true, data: { version: 'cv1', actions: { CONTRACT_CANCEL: allow } } })),
      quote: vi.fn(() => of(quote({ version: 'cv2' }))), run: vi.fn(() => of({ success: true, data: {} })),
    };
    TestBed.configureTestingModule({ imports: [SaOrderControls], providers: [{ provide: AdminOrderControlsApiService, useValue: api }, { provide: UiNotificationService, useValue: { success: vi.fn() } }] });
    const f = TestBed.createComponent(SaOrderControls);
    f.componentRef.setInput('kind', 'offer'); f.componentRef.setInput('id', 'o1'); f.componentRef.setInput('extraContractId', 'c1'); f.componentRef.setInput('only', ['OFFER_SUSPEND', 'OFFER_RESUME', 'CONTRACT_CANCEL']);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-reason-code="OFFER_LINKED_TO_CONTRACT"]')!.textContent).toContain('يُدار من العقد');
    (el.querySelector('[data-action="CONTRACT_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(api.quote).toHaveBeenCalledWith('CONTRACT_CANCEL', 'c1');
  });

  it('403 says the permission is missing; a failed load offers a retry', () => {
    const forbidden = make({ controls: vi.fn(() => throwError(() => ({ status: 403 }))) });
    expect(forbidden.el.querySelector('[data-testid="oc-forbidden"]')!.textContent).toContain('ليست لديك صلاحية');
    TestBed.resetTestingModule();
    const failed = make({ controls: vi.fn(() => throwError(() => ({ status: 500 }))) });
    expect(failed.el.querySelector('[data-testid="oc-load-failed"]')).toBeTruthy();
  });
});

describe('order-controls copy', () => {
  // every stable reason code the backend can answer with (src/constants/admin-controls.ts) has its own Arabic sentence
  const BACKEND_CODES = ['SUPER_ADMIN_REQUIRED', 'PERMISSION_DENIED', 'NOT_FOUND', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_CONFLICT', 'REASON_REQUIRED', 'REASON_TOO_LONG', 'CONFIRMATION_REQUIRED', 'VERSION_REQUIRED', 'STALE_VERSION',
    'REQUEST_DRAFT', 'REQUEST_NOT_OPEN', 'REQUEST_HAS_CONTRACT', 'REQUEST_ALREADY_SUSPENDED', 'REQUEST_NOT_SUSPENDED', 'REQUEST_ALREADY_CANCELLED', 'REQUEST_COMPLETED', 'REQUEST_SETTLED',
    'OFFER_ALREADY_SUSPENDED', 'OFFER_NOT_SUSPENDED', 'OFFER_STATE_NOT_SUSPENDABLE', 'OFFER_LINKED_TO_CONTRACT', 'OFFER_REQUEST_CLOSED',
    'NO_CONTRACT', 'CONTRACT_CLOSED', 'CONTRACT_ALREADY_FROZEN', 'CONTRACT_NOT_FROZEN', 'CONTRACT_FROZEN', 'ACTIVE_DISPUTE', 'CANCELLATION_AGREED_PENDING_SETTLEMENT', 'NO_ESCROW', 'ESCROW_ALREADY_RELEASED', 'ESCROW_ALREADY_REFUNDED',
    'NO_HELD_BALANCE', 'EXPECTED_AMOUNT_REQUIRED', 'HELD_BALANCE_CHANGED', 'RELEASE_REQUIRES_ACTIVE_CONTRACT', 'SETTLEMENT_CHOICE_REQUIRED', 'PARTIAL_SETTLEMENT_NOT_DEFINED', 'ESCROW_CHANGED', 'ADMIN_PERMISSION_DENIED', 'ADMIN_SUPER_ADMIN_REQUIRED'];
  it('maps every backend reason code to Arabic copy', () => {
    for (const c of BACKEND_CODES) { expect(REASON_COPY[c], c).toBeTruthy(); expect(/[؀-ۿ]/.test(REASON_COPY[c]), c).toBe(true); }
  });
  it('an unknown code falls back to the server Arabic message, never to an English text', () => {
    expect(controlErrorCopy({ error: { code: 'SOMETHING_NEW', message: 'English only' } })).toContain('لم يتغيّر شيء');
    expect(controlErrorCopy({ error: { code: 'SOMETHING_NEW', message: 'رسالة عربية من الخادم' } })).toBe('رسالة عربية من الخادم');
  });
});
