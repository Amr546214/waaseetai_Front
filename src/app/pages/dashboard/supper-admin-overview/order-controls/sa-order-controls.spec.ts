import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaOrderControls, __resetOrderControlAttempts } from './sa-order-controls';
import { AdminOrderControlsApiService } from '../../../../core/services/admin-order-controls-api.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { ACTION_DEFS, REASON_COPY, controlErrorCopy } from './order-controls.copy';

const allow = { allowed: true, code: null, message: null, requiresSuperAdmin: false };
const deny = (code: string, su = false) => ({ allowed: false, code, message: null, requiresSuperAdmin: su });
const reqControls = (over: any = {}) => ({ success: true, data: { version: 'rv1', status: 'OPEN', suspended: false, actions: { REQUEST_SUSPEND: allow, REQUEST_RESUME: deny('REQUEST_NOT_SUSPENDED'), REQUEST_CANCEL: allow, ...over } } });
const quote = (over: any = {}) => ({ success: true, data: {
  action: 'CONTRACT_CANCEL', version: 'rv1', currency: 'USD', blocked: null, expectedHeldAmount: 20,
  amounts: { heldBefore: 20, refundToClient: 20, releaseToProvider: 0, platformCommission: 0, providerNet: 0 },
  beneficiary: { kind: 'CLIENT', userId: 'c1', name: 'نور خالد' }, commission: { feePolicyVersion: 2, ratePercent: 12.75, appliesTo: 'NONE' },
  settlement: null,
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

beforeEach(() => __resetOrderControlAttempts());

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
    expect(el.querySelector('[data-testid="oc-settlement"]')).toBeNull(); // no settlement is offered or assumed by a cancellation
    const submit = () => el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement;
    type(f, el, 'مخالفة جسيمة للسياسة'); expect(submit().disabled).toBe(true); // not confirmed yet
    const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement; cb.checked = true; cb.dispatchEvent(new Event('change')); f.detectChanges();
    expect(submit().disabled).toBe(false);
    submit().click(); f.detectChanges(); await tick(f);
    const [, , body] = api.run.mock.calls[0] as any[];
    expect(body).toEqual({ expectedVersion: 'rv1', reason: 'مخالفة جسيمة للسياسة', confirm: true, expectedHeldAmount: 20 });
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
      quote: vi.fn(() => of(quote({ version: 'cv1' }))), run: vi.fn(() => of({ success: true, data: {} })),
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

describe('SaOrderControls: stale / out-of-order responses', () => {
  const open = (el: HTMLElement, a: string, f: any) => { (el.querySelector(`[data-action="${a}"]`) as HTMLButtonElement).click(); f.detectChanges(); };
  const confirm = (f: any, el: HTMLElement) => { type(f, el, 'سبب كافٍ للقرار'); const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement | null; if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); } f.detectChanges(); };
  const both = { REQUEST_SUSPEND: allow, REQUEST_RESUME: deny('REQUEST_NOT_SUSPENDED'), REQUEST_CANCEL: allow };

  it('the confirmation is impossible while the preview is loading, and after it arrives only for the SAME action, entity and version', async () => {
    const { Subject } = await import('rxjs'); const q = new Subject<any>();
    const api = { controls: vi.fn(() => of(reqControls(both))), quote: vi.fn(() => q), run: vi.fn(() => of({ success: true, data: {} })) };
    const { f, el } = make(api);
    open(el, 'REQUEST_CANCEL', f); confirm(f, el);
    expect((el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).disabled).toBe(true); // preview still loading
    q.next(quote({ version: 'OTHER' })); f.detectChanges(); confirm(f, el);
    expect((el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).disabled).toBe(true); // a preview of another version
    expect(api.run).not.toHaveBeenCalled();
  });

  it('reversed quote responses: opening another action drops the first preview; its LATE answer never replaces the second', async () => {
    const { Subject } = await import('rxjs'); const qCancel = new Subject<any>(); const qOther = new Subject<any>();
    const api = { controls: vi.fn(() => of({ success: true, data: { version: 'rv1', actions: { REQUEST_SUSPEND: allow, REQUEST_RESUME: deny('REQUEST_NOT_SUSPENDED'), REQUEST_CANCEL: allow, CONTRACT_CANCEL: allow } } })), quote: vi.fn((a: string) => (a === 'REQUEST_CANCEL' ? qCancel : qOther)), run: vi.fn() };
    const { f, el } = make(api);
    open(el, 'REQUEST_CANCEL', f);
    // the admin closes it and opens a different previewed action before the first answer arrived
    const cmp: any = f.debugElement.children[0].componentInstance;
    cmp.open(ACTION_DEFS.CONTRACT_CANCEL); f.detectChanges();
    qOther.next(quote({ action: 'CONTRACT_CANCEL', amounts: { heldBefore: 5, refundToClient: 5, releaseToProvider: 0, platformCommission: 0, providerNet: 0 }, expectedHeldAmount: 5 })); f.detectChanges();
    qCancel.next(quote({ expectedHeldAmount: 99, amounts: { heldBefore: 99, refundToClient: 99, releaseToProvider: 0, platformCommission: 0, providerNet: 0 } })); f.detectChanges(); // late, stale
    expect(el.querySelector('[data-testid="oc-quote"]')!.textContent).toContain('5.00 $');
    expect(el.querySelector('[data-testid="oc-quote"]')!.textContent).not.toContain('99.00');
    expect(qCancel.observed).toBe(false); // the old request was cancelled
  });

  it('closing the dialog cancels the pending preview: a late answer is ignored and a reopened dialog starts clean', async () => {
    const { Subject } = await import('rxjs'); const q1 = new Subject<any>(); const q2 = new Subject<any>(); let n = 0;
    const api = { controls: vi.fn(() => of(reqControls(both))), quote: vi.fn(() => (n++ === 0 ? q1 : q2)), run: vi.fn() };
    const { f, el } = make(api);
    open(el, 'REQUEST_CANCEL', f);
    (Array.from(el.querySelectorAll('.oc-row button')).find(b => b.textContent!.trim() === 'إلغاء') as HTMLButtonElement).click(); f.detectChanges();
    expect(el.querySelector('[data-testid="oc-dialog"]')).toBeNull();
    q1.next(quote({ expectedHeldAmount: 77 })); f.detectChanges();
    open(el, 'REQUEST_CANCEL', f);
    expect(el.querySelector('[data-testid="oc-quote"]')).toBeNull(); // nothing from the first preview leaks in
    q2.next(quote()); f.detectChanges();
    expect(el.querySelector('[data-testid="oc-quote"]')!.textContent).toContain('20.00 $');
  });

  it('reversed controls responses: the latest reload wins; navigation to another entity drops the old data and ignores its late answer', async () => {
    const { Subject } = await import('rxjs'); const a = new Subject<any>(); const b = new Subject<any>(); const c = new Subject<any>(); const subs = [a, b, c]; let i = 0;
    const api = { controls: vi.fn(() => subs[i++]), quote: vi.fn(), run: vi.fn() };
    TestBed.configureTestingModule({ imports: [SaOrderControls], providers: [{ provide: AdminOrderControlsApiService, useValue: api }, { provide: UiNotificationService, useValue: { success: vi.fn() } }] });
    const f = TestBed.createComponent(SaOrderControls);
    f.componentRef.setInput('kind', 'request'); f.componentRef.setInput('id', 'r1'); f.detectChanges();
    (f.componentInstance as any).reload(); // a second load while the first is pending
    b.next(reqControls({ REQUEST_CANCEL: deny('ACTIVE_DISPUTE') })); f.detectChanges();
    a.next(reqControls()); f.detectChanges(); // the OLDER answer arrives last
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-reason-code="ACTIVE_DISPUTE"]')).toBeTruthy();
    expect(a.observed).toBe(false);
    // navigation to another request: the previous controls are cleared at once and a late answer for the old one is ignored
    f.componentRef.setInput('id', 'r2'); f.detectChanges();
    expect(el.querySelector('[data-action]')).toBeNull();
    c.next(reqControls()); f.detectChanges();
    expect(el.querySelector('[data-action="REQUEST_CANCEL"]')).toBeTruthy();
    expect(b.observed).toBe(false);
  });

  it('after the component is destroyed a late answer does nothing (no error)', async () => {
    const { Subject } = await import('rxjs'); const a = new Subject<any>();
    const api = { controls: vi.fn(() => a), quote: vi.fn(), run: vi.fn() };
    const { f } = make(api);
    f.destroy();
    expect(() => a.next(reqControls())).not.toThrow();
    expect(a.observed).toBe(false);
  });
});

describe('SaOrderControls: run() replies bound to their own entity / action / attempt', () => {
  const mount = async (api: any) => {
    const notify = { success: vi.fn() };
    TestBed.configureTestingModule({ imports: [SaOrderControls], providers: [{ provide: AdminOrderControlsApiService, useValue: api }, { provide: UiNotificationService, useValue: notify }] });
    const f = TestBed.createComponent(SaOrderControls); let changed = 0;
    f.componentInstance.changed.subscribe(() => changed++);
    f.componentRef.setInput('kind', 'request'); f.componentRef.setInput('id', 'A'); f.detectChanges(); await f.whenStable(); f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, notify, changed: () => changed };
  };
  const submitSuspend = (f: any, el: HTMLElement, reason: string) => {
    (el.querySelector('[data-action="REQUEST_SUSPEND"]') as HTMLButtonElement).click(); f.detectChanges();
    const ta = el.querySelector('#oc-reason-input') as HTMLTextAreaElement; ta.value = reason; ta.dispatchEvent(new Event('input')); f.detectChanges();
    (el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); f.detectChanges();
  };
  const goto = async (f: any, id: string) => { f.componentRef.setInput('id', id); f.detectChanges(); await f.whenStable(); f.detectChanges(); };

  it('a LATE success of entity A never closes / clears / notifies inside entity B (B stays busy until its own reply)', async () => {
    const { Subject } = await import('rxjs'); const runs: Record<string, any> = { A: new Subject(), B: new Subject() };
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn((_a: string, id: string) => runs[id]) };
    const m = await mount(api);
    submitSuspend(m.f, m.el, 'سبب لتعليق الطلب أ');
    await goto(m.f, 'B');
    submitSuspend(m.f, m.el, 'سبب لتعليق الطلب ب');
    expect((m.el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).disabled).toBe(true); // B is busy
    runs['A'].next({ success: true, data: {} }); runs['A'].complete(); m.f.detectChanges();
    expect(m.el.querySelector('[data-testid="oc-dialog"]')).toBeTruthy();          // B's dialog was not closed by A's reply
    expect(m.el.textContent).toContain('جارٍ التنفيذ');                              // B is still busy
    expect(m.notify.success).not.toHaveBeenCalled(); expect(m.changed()).toBe(0);
    runs['B'].next({ success: true, data: {} }); runs['B'].complete(); m.f.detectChanges();
    expect(m.el.querySelector('[data-testid="oc-dialog"]')).toBeNull(); expect(m.notify.success).toHaveBeenCalledTimes(1); expect(m.changed()).toBe(1);
  });

  it('a LATE failure of entity A shows no error inside B and does not clear B\'s attempt', async () => {
    const { Subject } = await import('rxjs'); const runs: Record<string, any> = { A: new Subject(), B: new Subject() };
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn((_a: string, id: string) => runs[id]) };
    const m = await mount(api);
    submitSuspend(m.f, m.el, 'سبب لتعليق الطلب أ'); await goto(m.f, 'B'); submitSuspend(m.f, m.el, 'سبب لتعليق الطلب ب');
    runs['A'].error({ status: 409, error: { code: 'REQUEST_NOT_OPEN' } }); m.f.detectChanges();
    expect(m.el.querySelector('[data-testid="oc-error"]')).toBeNull();
    expect(m.el.textContent).toContain('جارٍ التنفيذ');
    // B's own transient failure then retry still reuses B's key (its attempt survived A's reply)
    runs['B'].error({ status: 0, error: null }); m.f.detectChanges();
    expect(m.el.querySelector('[data-testid="oc-unknown"]')).toBeTruthy();
    runs['B'] = of({ success: true, data: {} });
    (m.el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement).click(); m.f.detectChanges();
    const calls = api.run.mock.calls as any[][]; const bCalls = calls.filter(c => c[1] === 'B'); expect(bCalls.length).toBe(2); expect(bCalls[0][3]).toBe(bCalls[1][3]);
  });

  it('A\'s unresolved attempt is KEPT when the admin leaves A: coming back and repeating the same payload reuses the same Idempotency-Key (server replays it)', async () => {
    const { Subject } = await import('rxjs'); const a1 = new Subject<any>(); let call = 0;
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn(() => (call++ === 0 ? a1 : of({ success: true, data: {} }))) };
    const m = await mount(api);
    submitSuspend(m.f, m.el, 'سبب لتعليق الطلب أ');
    await goto(m.f, 'B'); await goto(m.f, 'A');
    a1.error({ status: 0, error: null }); // the answer was lost while away: outcome unknown, the attempt must stay
    submitSuspend(m.f, m.el, 'سبب لتعليق الطلب أ');
    const calls = api.run.mock.calls as any[][]; expect(calls.length).toBe(2); expect(calls[0][3]).toBe(calls[1][3]);
    expect(calls[0][1]).toBe('A'); expect(calls[1][1]).toBe('A');
  });

  it('a reply that arrives after the component was destroyed does nothing', async () => {
    const { Subject } = await import('rxjs'); const a = new Subject<any>();
    const api = { controls: vi.fn(() => of(reqControls())), quote: vi.fn(), run: vi.fn(() => a) };
    const m = await mount(api);
    submitSuspend(m.f, m.el, 'سبب لتعليق الطلب أ'); m.f.destroy();
    expect(() => { a.next({ success: true, data: {} }); a.complete(); }).not.toThrow();
    expect(m.notify.success).not.toHaveBeenCalled(); expect(m.changed()).toBe(0);
  });
});

describe('SaOrderControls: controls / quote version mismatch recovers visibly', () => {
  const both = { REQUEST_SUSPEND: allow, REQUEST_RESUME: deny('REQUEST_NOT_SUSPENDED'), REQUEST_CANCEL: allow };
  const ctrl = (v: string) => ({ success: true, data: { version: v, status: 'OPEN', suspended: false, actions: both } });
  const check = (f: any, el: HTMLElement) => { type(f, el, 'سبب كافٍ للقرار'); const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement | null; if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); } f.detectChanges(); };
  const submitBtn = (el: HTMLElement) => el.querySelector('[data-testid="oc-submit"]') as HTMLButtonElement;

  it('controls v1 + quote v2: a visible message, controls AND quote are refreshed together, the confirmation is cleared, reversed replies are tolerated, and only the new data can be confirmed', async () => {
    const { Subject } = await import('rxjs'); const controlsReplies: any[] = []; const quoteReplies: any[] = [];
    const api = { controls: vi.fn(() => { const s = new Subject<any>(); controlsReplies.push(s); return s; }), quote: vi.fn(() => { const s = new Subject<any>(); quoteReplies.push(s); return s; }), run: vi.fn(() => of({ success: true, data: {} })) };
    const { f, el } = make(api);
    controlsReplies[0].next(ctrl('v1')); f.detectChanges();
    (el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges();
    quoteReplies[0].next(quote({ version: 'v2' })); f.detectChanges();
    expect(el.querySelector('[data-testid="oc-version-note"]')!.textContent).toContain('تغيّر');
    expect(submitBtn(el).disabled).toBe(true);
    // a refresh of BOTH was issued
    expect(api.controls).toHaveBeenCalledTimes(2); expect(api.quote).toHaveBeenCalledTimes(2);
    // reversed order: the NEW quote arrives before the NEW controls; the first (older) quote reply has already been dropped
    quoteReplies[1].next(quote({ version: 'v2' })); f.detectChanges();
    expect(submitBtn(el).disabled).toBe(true); // controls still v1 -> still not confirmable
    controlsReplies[1].next(ctrl('v2')); f.detectChanges();
    expect(el.querySelector('[data-testid="oc-version-note"]')).toBeNull();
    // the confirmation must be given again on the new data
    const cb = el.querySelector('[data-testid="oc-confirm"]') as HTMLInputElement; expect(cb.checked).toBe(false);
    check(f, el); expect(submitBtn(el).disabled).toBe(false);
    submitBtn(el).click(); f.detectChanges();
    expect((api.run.mock.calls as any[][])[0][2].expectedVersion).toBe('v2');
  });

  it('an older controls reply arriving after the newer one cannot re-open a mismatch', async () => {
    const { Subject } = await import('rxjs'); const cs: any[] = []; const qs: any[] = [];
    const api = { controls: vi.fn(() => { const s = new Subject<any>(); cs.push(s); return s; }), quote: vi.fn(() => { const s = new Subject<any>(); qs.push(s); return s; }), run: vi.fn() };
    const { f, el } = make(api);
    cs[0].next(ctrl('v1')); f.detectChanges();
    (el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges();
    qs[0].next(quote({ version: 'v2' })); f.detectChanges();
    cs[1].next(ctrl('v2')); qs[1].next(quote({ version: 'v2' })); f.detectChanges();
    expect(el.querySelector('[data-testid="oc-version-note"]')).toBeNull();
    cs[0].next(ctrl('v1')); f.detectChanges(); // stale (its subscription was cancelled)
    expect(el.querySelector('[data-testid="oc-version-note"]')).toBeNull();
    check(f, el); expect(submitBtn(el).disabled).toBe(false);
  });

  it('after the automatic refresh budget is spent the message stays with a manual refresh button (no silent block)', async () => {
    const api = { controls: vi.fn(() => of(ctrl('v1'))), quote: vi.fn(() => of(quote({ version: 'vX' }))), run: vi.fn() };
    const { f, el } = make(api);
    (el.querySelector('[data-action="REQUEST_CANCEL"]') as HTMLButtonElement).click(); f.detectChanges(); await tick(f);
    expect(el.querySelector('[data-testid="oc-version-note"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="oc-version-refresh"]')).toBeTruthy();
    expect(submitBtn(el).disabled).toBe(true);
    const before = api.controls.mock.calls.length;
    (el.querySelector('[data-testid="oc-version-refresh"]') as HTMLButtonElement).click(); f.detectChanges();
    expect(api.controls.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('order-controls copy', () => {
  // every stable reason code the backend can answer with (src/constants/admin-controls.ts) has its own Arabic sentence
  const BACKEND_CODES = ['SUPER_ADMIN_REQUIRED', 'PERMISSION_DENIED', 'NOT_FOUND', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_CONFLICT', 'REASON_REQUIRED', 'REASON_TOO_LONG', 'CONFIRMATION_REQUIRED', 'VERSION_REQUIRED', 'STALE_VERSION',
    'REQUEST_DRAFT', 'REQUEST_NOT_OPEN', 'REQUEST_HAS_CONTRACT', 'REQUEST_ALREADY_SUSPENDED', 'REQUEST_NOT_SUSPENDED', 'REQUEST_ALREADY_CANCELLED', 'REQUEST_COMPLETED', 'REQUEST_SETTLED',
    'OFFER_ALREADY_SUSPENDED', 'OFFER_NOT_SUSPENDED', 'OFFER_STATE_NOT_SUSPENDABLE', 'OFFER_LINKED_TO_CONTRACT', 'OFFER_REQUEST_CLOSED',
    'NO_CONTRACT', 'CONTRACT_CLOSED', 'CONTRACT_ALREADY_FROZEN', 'CONTRACT_NOT_FROZEN', 'CONTRACT_FROZEN', 'ACTIVE_DISPUTE', 'CANCELLATION_AGREED_PENDING_SETTLEMENT', 'NO_ESCROW', 'ESCROW_ALREADY_RELEASED', 'ESCROW_ALREADY_REFUNDED',
    'NO_HELD_BALANCE', 'EXPECTED_AMOUNT_REQUIRED', 'HELD_BALANCE_CHANGED', 'RELEASE_REQUIRES_ACTIVE_CONTRACT', 'SETTLEMENT_CHOICE_REQUIRED', 'PARTIAL_SETTLEMENT_NOT_DEFINED', 'CANCELLATION_SETTLEMENT_NOT_APPROVED', 'ESCROW_CHANGED', 'ADMIN_PERMISSION_DENIED', 'ADMIN_SUPER_ADMIN_REQUIRED'];
  it('maps every backend reason code to Arabic copy', () => {
    for (const c of BACKEND_CODES) { expect(REASON_COPY[c], c).toBeTruthy(); expect(/[؀-ۿ]/.test(REASON_COPY[c]), c).toBe(true); }
  });
  it('an unknown code falls back to the server Arabic message, never to an English text', () => {
    expect(controlErrorCopy({ error: { code: 'SOMETHING_NEW', message: 'English only' } })).toContain('لم يتغيّر شيء');
    expect(controlErrorCopy({ error: { code: 'SOMETHING_NEW', message: 'رسالة عربية من الخادم' } })).toBe('رسالة عربية من الخادم');
  });
});
