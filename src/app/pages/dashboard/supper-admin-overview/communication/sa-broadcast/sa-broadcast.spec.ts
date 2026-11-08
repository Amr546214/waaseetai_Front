import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { SaBroadcast } from './sa-broadcast';

const draft = (over: Record<string, unknown> = {}) => ({ id: 'd1', title: 'عنوان', message: 'نص', category: 'ALL', audience: 'CLIENTS', version: 1, updatedAt: '2026-11-08T12:00:00Z', ...over });
const view = (over: Record<string, unknown> = {}) => ({ id: 'b1', sender: { id: 'u', name: 'مدير' }, title: 'عنوان', category: 'ALL', audience: 'CLIENTS', status: 'COMPLETED', totals: { audience: 3, sent: 3, failed: 0, pending: 0 }, createdAt: '2026-11-08T12:00:00Z', completedAt: null, lastProgressAt: null, ...over });
const previewBody = (over: Record<string, unknown> = {}) => ({ draftId: 'd1', version: 1, audience: 'CLIENTS', count: 3, checkedAt: '2026-11-08T12:00:00Z', canSend: true, previewToken: 'tok-1', ...over });

let confirmAnswer = true; let confirmArgs: any = null;
const pfOf = (over: Record<string, unknown> = {}) => ({ canEnableSafely: true, blockers: [], counts: {}, jobs: 0, oldestAgeSeconds: null, thresholds: { maxQueueAgeSeconds: 86400 }, workerEnabled: false, ...over });
const summaryOf = (over: Record<string, unknown> = {}) => ({ waitingDisabled: 0, waitingForWorker: 0, running: 0, stuckMidRun: 0, stuckNoProgress: 0, oldestWaitingSeconds: null, workerEnabled: true, ...over });
const job = (state: string, over: Record<string, unknown> = {}) => ({ ...view({ status: state === 'RUNNING' ? 'SENDING' : 'QUEUED', totals: { audience: 10, sent: 0, failed: 0, pending: 10 } }), queueState: state, stale: state.startsWith('STUCK'), waitingSeconds: 7200, heartbeatAt: null, leaseUntil: null, ...over });
function setup(latest: unknown = null, active: unknown = null, delivery: boolean | null = true, queue: { items: unknown[]; summary: unknown } = { items: [], summary: summaryOf() }, keepQueuePoll = false, pf: unknown = pfOf()) {
  confirmAnswer = true; confirmArgs = null;
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
    { provide: ConfirmModalService, useValue: { confirm: async (c: unknown) => { confirmArgs = c; return confirmAnswer; } } }] });
  const fixture = TestBed.createComponent(SaBroadcast);
  const c = fixture.componentInstance; const http = TestBed.inject(HttpTestingController);
  c.autosaveMs = 50;
  fixture.detectChanges();
  http.expectOne(r => r.url.endsWith('/admin/notification-templates')).flush({ data: { page: 1, hasNext: false, items: [{ id: 'qa', name: 'ترحيب', title: 'أهلًا', message: '<b>نص فقط</b>' }] } });
  http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
  http.expectOne(r => r.url.endsWith('/admin/broadcasts/queue/preflight')).flush({ data: pf });
  http.expectOne(r => r.url.endsWith('/admin/broadcasts/queue')).flush({ data: queue });
  http.expectOne(r => r.url.endsWith('/admin/broadcasts/status')).flush({ data: { deliveryEnabled: delivery } });
  http.expectOne(r => r.url.endsWith('/admin/broadcasts/active')).flush({ data: active });
  http.expectOne(r => r.url.endsWith('/broadcasts/drafts/latest')).flush({ data: latest });
  if (!keepQueuePoll) c.stopQueuePolling();
  return { fixture, c, http, el: fixture.nativeElement as HTMLElement };
}
const flushAsync = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const route = (http: HttpTestingController, method: string, suffix: string) => http.expectOne(r => r.method === method && r.url.endsWith(suffix));

describe('SaBroadcast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); });

  it('restores the latest server draft after a reload and shows no fake numbers', () => {
    const { c, fixture, el, http } = setup(draft({ title: 'مسودة محفوظة', message: 'من الخادم', audience: 'PROVIDERS', category: 'OFFERS', version: 4 }));
    fixture.detectChanges();
    expect(c.title).toBe('مسودة محفوظة'); expect(c.message).toBe('من الخادم'); expect(c.audience).toBe('PROVIDERS'); expect(c.category).toBe('OFFERS'); expect(c.draft()?.version).toBe(4);
    expect(el.textContent).toContain('لم يُرسل أي بث بعد');
    expect(c.preview()).toBeNull();
    http.verify();
  });

  it('autosaves once after the debounce (create, then patch with the version) and shows the saved state', async () => {
    const { c, http, fixture, el } = setup();
    c.title = 'أول'; c.message = 'نص'; c.audience = 'CLIENTS'; c.edited(); c.title = 'أول ثاني'; c.edited();
    http.expectNone(r => r.url.endsWith('/broadcasts/drafts'));
    vi.advanceTimersByTime(60);
    const create = route(http, 'POST', '/broadcasts/drafts');
    expect(create.request.body).toEqual({ title: 'أول ثاني', message: 'نص', category: 'ALL', audience: 'CLIENTS' });
    create.flush({ data: draft({ id: 'd9', title: 'أول ثاني' }) });
    await flushAsync(); fixture.detectChanges();
    expect(c.saveState()).toBe('saved'); expect(el.querySelector('[aria-label="حالة الحفظ"]')!.textContent).toContain('تم الحفظ');
    c.message = 'تعديل'; c.edited(); vi.advanceTimersByTime(60);
    const patch = route(http, 'PATCH', '/broadcasts/drafts/d9');
    expect(patch.request.body.version).toBe(1);
    patch.flush({ data: draft({ id: 'd9', version: 2, message: 'تعديل' }) });
    await flushAsync();
    expect(c.draft()?.version).toBe(2);
    http.verify();
  });

  it('on a 409 shows the newer server copy, stops autosaving and never overwrites; the user decides', async () => {
    const { c, http, fixture, el } = setup(draft());
    c.title = 'من تبويبي'; c.edited(); vi.advanceTimersByTime(60);
    route(http, 'PATCH', '/broadcasts/drafts/d1').flush({ code: 'BROADCAST_DRAFT_CHANGED', data: { current: draft({ title: 'من تبويب آخر', version: 3 }) } }, { status: 409, statusText: 'Conflict' });
    await flushAsync(); fixture.detectChanges();
    expect(c.conflict()?.version).toBe(3); expect(c.title).toBe('من تبويبي');
    expect(el.querySelector('[aria-label="تعارض في المسودة"]')!.textContent).toContain('من تبويب آخر');
    c.edited(); vi.advanceTimersByTime(100);
    http.expectNone(r => r.method === 'PATCH'); // no silent retry while the conflict is open
    const kept = c.keepMine(); await flushAsync();
    const patch = route(http, 'PATCH', '/broadcasts/drafts/d1');
    expect(patch.request.body.version).toBe(3); // explicit choice: rebased on the newer version
    patch.flush({ data: draft({ version: 4, title: 'من تبويبي' }) }); await kept;
    expect(c.conflict()).toBeNull();
    // the other choice: take the server copy
    c.title = 'x'; c.edited(); vi.advanceTimersByTime(60);
    route(http, 'PATCH', '/broadcasts/drafts/d1').flush({ code: 'BROADCAST_DRAFT_CHANGED', data: { current: draft({ title: 'الخادم', version: 9 }) } }, { status: 409, statusText: 'Conflict' });
    await flushAsync(); c.useServerCopy();
    expect(c.title).toBe('الخادم'); expect(c.conflict()).toBeNull(); expect(c.draft()?.version).toBe(9);
    http.verify();
  });

  it('confirm step shows title, body, category, audience count and in-platform-only; an edit after preview forces a new preview', async () => {
    const { c, http, fixture, el } = setup(draft({ category: 'OFFERS' }));
    const p = c.requestPreview(); await flushAsync();
    route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
    fixture.detectChanges();
    expect(c.preview()?.count).toBe(3); expect(el.textContent).toContain('الحسابات المؤهلة الآن: 3');
    c.title = 'تعديل بعد المعاينة'; c.edited(); fixture.detectChanges();
    expect(c.preview()).toBeNull(); expect(el.querySelector('[aria-label="معاينة قديمة"]')!.textContent).toContain('اعمل معاينة جديدة');
    await c.confirmAndSend();
    expect(confirmArgs).toBeNull(); http.expectNone(r => r.url.endsWith('/send'));
    vi.advanceTimersByTime(60); route(http, 'PATCH', '/broadcasts/drafts/d1').flush({ data: draft({ version: 2, title: 'تعديل بعد المعاينة', category: 'OFFERS' }) }); await flushAsync();
    const p2 = c.requestPreview(); await flushAsync();
    route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody({ version: 2 }) }); await p2;
    c.confirmAndSend(); await flushAsync();
    const text = confirmArgs.message as string;
    expect(text).toContain('تعديل بعد المعاينة'); expect(text).toContain('نص'); expect(text).toContain('العروض'); expect(text).toContain('طالبي الخدمة'); expect(text).toContain('3'); expect(text).toContain('داخل المنصة فقط');
    route(http, 'POST', '/broadcasts/drafts/d1/send').flush({ data: { broadcast: view() } }); await flushAsync();
    http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [view()] } });
    http.verify();
  });

  it('cancelling the confirmation sends nothing; a stale-preview answer clears the preview and asks for a new one', async () => {
    const { c, http, fixture, el } = setup(draft());
    let p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
    confirmAnswer = false; await c.confirmAndSend(); http.expectNone(r => r.url.endsWith('/send'));
    confirmAnswer = true; const s = c.confirmAndSend(); await flushAsync();
    route(http, 'POST', '/broadcasts/drafts/d1/send').flush({ code: 'PREVIEW_STALE' }, { status: 409, statusText: 'Conflict' }); await s;
    fixture.detectChanges();
    expect(c.preview()).toBeNull(); expect(c.result()).toBeNull(); expect(el.querySelector('[aria-label="معاينة قديمة"]')!.textContent).toContain('ولم يُرسل شيء');
    http.verify();
  });

  it('double click sends once; a lost response is retried with the SAME idempotency key; a new confirm attempt gets a new key', async () => {
    const { c, http } = setup(draft());
    const p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
    const first = c.confirmAndSend(); const second = c.confirmAndSend(); await flushAsync(); // double click while the confirmation is open
    const req = route(http, 'POST', '/broadcasts/drafts/d1/send');
    const key = req.request.headers.get('Idempotency-Key')!;
    expect(key).toMatch(/^bc-/); expect(req.request.body).toEqual({ previewToken: 'tok-1' });
    expect(c.sending()).toBe(true);
    req.error(new ProgressEvent('error'), { status: 0 }); await first; await second;
    expect(c.sending()).toBe(false); expect(c.hasPendingAttempt).toBe(true);
    const retry = c.retrySend(); const retry2 = c.retrySend(); await flushAsync();
    const again = route(http, 'POST', '/broadcasts/drafts/d1/send');
    expect(again.request.headers.get('Idempotency-Key')).toBe(key);
    again.flush({ data: { broadcast: view() } }); await retry; await retry2;
    expect(c.result()?.id).toBe('b1'); expect(c.hasPendingAttempt).toBe(false);
    http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
    http.verify();
  });

  it('result screen shows sent/failed counts and retry-remaining calls the retry endpoint once even on double click', async () => {
    const { c, http, fixture, el } = setup(draft());
    const p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
    const s = c.confirmAndSend(); await flushAsync();
    route(http, 'POST', '/broadcasts/drafts/d1/send').flush({ data: { broadcast: view({ status: 'PARTIAL', totals: { audience: 7, sent: 5, failed: 2, pending: 0 } }) } }); await s;
    http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
    fixture.detectChanges();
    const text = el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent!;
    expect(text).toContain('أُرسل: 5'); expect(text).toContain('فشل: 2'); expect(text).toContain('اكتمل جزئيًا');
    const a = c.retryRemaining(); const b = c.retryRemaining(); await flushAsync();
    route(http, 'POST', '/broadcasts/b1/retry').flush({ data: view({ totals: { audience: 7, sent: 7, failed: 0, pending: 0 } }) }); await a; await b;
    http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
    fixture.detectChanges();
    expect(c.result()?.totals.sent).toBe(7); expect(el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent).not.toContain('إعادة إرسال المتبقي');
    http.verify();
  });

  it('empty audience: preview says so and offers no send button', async () => {
    const { c, http, fixture, el } = setup(draft());
    const p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody({ count: 0, canSend: false }) }); await p;
    fixture.detectChanges();
    expect(el.textContent).toContain('لا يوجد مستلمون مؤهلون'); expect(el.textContent).not.toContain('مراجعة وإرسال');
    http.verify();
  });

  it('history lists sender, audience, totals and status, and opens a detail with failure codes', () => {
    const { c, http, fixture, el } = setup();
    c.loadHistory(1);
    http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: true, items: [view({ status: 'PARTIAL', totals: { audience: 7, sent: 5, failed: 2, pending: 0 } })] } });
    fixture.detectChanges();
    const t = el.querySelector('.broadcast-history-item')!.textContent!;
    expect(t).toContain('مدير'); expect(t).toContain('طالبي الخدمة'); expect(t).toContain('أُرسل 5'); expect(t).toContain('فشل 2'); expect(t).toContain('اكتمل جزئيًا');
    c.openDetail('b1');
    http.expectOne(r => r.url.endsWith('/admin/broadcasts/b1')).flush({ data: { ...view(), message: 'نص كامل', failureCodes: [{ code: 'INJECTED_FAULT', count: 2 }] } });
    fixture.detectChanges();
    expect(el.querySelector('[aria-label="تفاصيل الإرسال"]')!.textContent).toContain('INJECTED_FAULT');
    http.verify();
  });

  it('copies a template into a plain-text draft without sending', () => {
    const { c, http, fixture, el } = setup();
    c.selectedTemplateId = 'qa'; c.useTemplate(); fixture.detectChanges();
    const shown = el.querySelector('[aria-label="معاينة الرسالة"]')!;
    expect(shown.textContent).toContain('<b>نص فقط</b>'); expect(shown.querySelector('b')).toBeNull();
    http.expectNone(r => r.url.endsWith('/send'));
  });

  describe('background progress', () => {
    const running = (status: string, sent: number, over: Record<string, unknown> = {}) => view({ status, totals: { audience: 10, sent, failed: 0, pending: 10 - sent }, lastProgressAt: sent ? '2026-11-08T12:01:00Z' : null, ...over });
    const confirmed = async (c: SaBroadcast, http: HttpTestingController, body: unknown) => {
      const p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
      const s = c.confirmAndSend(); await flushAsync();
      const req = route(http, 'POST', '/broadcasts/drafts/d1/send'); req.flush({ data: { broadcast: body } }, { status: 202, statusText: 'Accepted' }); await s;
      http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [body] } });
    };
    const poll = async (http: HttpTestingController, body: unknown) => {
      vi.advanceTimersByTime(3000); await flushAsync();
      http.expectOne(r => r.method === 'GET' && r.url.endsWith('/admin/broadcasts/b1')).flush({ data: { ...(body as object), message: 'x', failureCodes: [] } }); await flushAsync();
    };

    it('shows QUEUED right after confirm, polls every 3s, shows progress, and stops at COMPLETED', async () => {
      const { c, http, fixture, el } = setup(draft());
      await confirmed(c, http, running('QUEUED', 0));
      fixture.detectChanges();
      let card = el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent!;
      expect(card).toContain('في قائمة الانتظار'); expect(c.isPolling).toBe(true); expect(el.querySelector('progress')).not.toBeNull();
      vi.advanceTimersByTime(2000); http.expectNone(r => r.url.endsWith('/admin/broadcasts/b1')); // not faster than 3s
      await poll(http, running('SENDING', 4)); // 1s later => total 3s
      fixture.detectChanges();
      card = el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent!;
      expect(card).toContain('جارٍ الإرسال'); expect(card).toContain('40%'); expect(card).toContain('أُرسل: 4'); expect(card).toContain('متبقٍ: 6'); expect(c.isPolling).toBe(true);
      expect(el.querySelector('.broadcast-history-item')!.textContent).toContain('جارٍ الإرسال'); // history shows the live status
      await poll(http, running('COMPLETED', 10));
      http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [running('COMPLETED', 10)] } });
      fixture.detectChanges();
      expect(c.isPolling).toBe(false); expect(el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent).toContain('اكتمل');
      vi.advanceTimersByTime(10000); http.expectNone(r => r.url.endsWith('/admin/broadcasts/b1'));
      http.verify();
    });

    it('ends as PARTIAL with a retry button; retry re-queues and polling starts again', async () => {
      const { c, http, fixture, el } = setup(draft());
      await confirmed(c, http, running('SENDING', 3));
      await poll(http, running('PARTIAL', 8, { totals: { audience: 10, sent: 8, failed: 2, pending: 0 } }));
      http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
      fixture.detectChanges();
      expect(c.isPolling).toBe(false); expect(el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent).toContain('اكتمل جزئيًا');
      const r = c.retryRemaining(); await flushAsync();
      route(http, 'POST', '/broadcasts/b1/retry').flush({ data: running('QUEUED', 8, { totals: { audience: 10, sent: 8, failed: 0, pending: 2 } }) }); await r;
      http.expectOne(r2 => r2.url.endsWith('/admin/broadcasts') && r2.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
      expect(c.isPolling).toBe(true); expect(c.result()?.status).toBe('QUEUED');
      c.stopPolling();
    });

    it('a refresh restores the running broadcast and resumes polling; leaving the page stops it', async () => {
      const { c, http, fixture, el } = setup(null, running('SENDING', 5));
      fixture.detectChanges();
      expect(c.result()?.id).toBe('b1'); expect(c.isPolling).toBe(true);
      expect(el.querySelector('[aria-label="نتيجة الإرسال"]')!.textContent).toContain('جارٍ الإرسال');
      fixture.destroy();
      vi.advanceTimersByTime(20000); http.expectNone(r => r.url.endsWith('/admin/broadcasts/b1'));
      expect(c.isPolling).toBe(false);
      http.verify();
    });

    it('a double click on confirm while pending sends the job once', async () => {
      const { c, http } = setup(draft());
      const p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
      const a = c.confirmAndSend(); const b = c.confirmAndSend(); await flushAsync();
      route(http, 'POST', '/broadcasts/drafts/d1/send').flush({ data: { broadcast: running('QUEUED', 0) } }, { status: 202, statusText: 'Accepted' }); await a; await b;
      http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } });
      http.expectNone(r => r.url.endsWith('/send')); c.stopPolling();
    });
  });

  describe('delivery disabled on this environment', () => {
    it('disables the send button with a clear message, never opens the confirm modal; save, preview and history still work', async () => {
      const { c, http, fixture, el } = setup(draft(), null, false);
      const p = c.requestPreview(); await flushAsync();
      route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody({ deliveryEnabled: false }) }); await p;
      fixture.detectChanges();
      expect(c.preview()?.count).toBe(3); // preview works
      expect(el.querySelector('[aria-label="الإرسال غير مفعّل"]')!.textContent).toContain('غير مفعّل في هذه البيئة');
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('مراجعة وإرسال')) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      await c.confirmAndSend();
      expect(confirmArgs).toBeNull(); http.expectNone(r => r.url.endsWith('/send'));
      c.title = 'تعديل'; c.edited(); vi.advanceTimersByTime(60); // autosave still works
      route(http, 'PATCH', '/broadcasts/drafts/d1').flush({ data: draft({ version: 2, title: 'تعديل' }) }); await flushAsync();
      expect(c.saveState()).toBe('saved');
      c.loadHistory(1); http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [view()] } });
      http.verify();
    });

    it('a server refusal after the flag flipped shows the same message and leaves the draft and preview untouched', async () => {
      const { c, http, fixture, el } = setup(draft(), null, true);
      const p = c.requestPreview(); await flushAsync(); route(http, 'POST', '/broadcasts/drafts/d1/preview').flush({ data: previewBody() }); await p;
      const s = c.confirmAndSend(); await flushAsync();
      route(http, 'POST', '/broadcasts/drafts/d1/send').flush({ code: 'BROADCAST_WORKER_DISABLED' }, { status: 503, statusText: 'Service Unavailable' }); await s;
      fixture.detectChanges();
      expect(c.deliveryEnabled()).toBe(false); expect(c.result()).toBeNull(); expect(c.draft()?.version).toBe(1); expect(c.title).toBe('عنوان');
      expect(el.querySelector('[aria-label="الإرسال غير مفعّل"]')).not.toBeNull(); expect(c.hasPendingAttempt).toBe(false);
      http.verify();
    });

    it('retry-remaining is disabled the same way; enabled flow is unchanged', async () => {
      const { c, http, fixture, el } = setup(null, view({ status: 'PARTIAL', totals: { audience: 5, sent: 3, failed: 2, pending: 0 } }), false);
      fixture.detectChanges();
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('إعادة إرسال المتبقي')) as HTMLButtonElement;
      expect(btn.disabled).toBe(true); expect(el.textContent).toContain('غير مفعّل في هذه البيئة');
      await c.retryRemaining(); http.expectNone(r => r.url.endsWith('/retry'));
      c.deliveryEnabled.set(true); fixture.detectChanges();
      expect((Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('إعادة إرسال المتبقي')) as HTMLButtonElement).disabled).toBe(false);
      http.verify();
    });
  });

  describe('queue review', () => {
    const all = [job('WAITING_WORKER_DISABLED', { id: 'q1', waitingSeconds: 30 }), job('WAITING_FOR_WORKER', { id: 'q2', waitingSeconds: 400 }), job('RUNNING', { id: 'q3', waitingSeconds: null, totals: { audience: 10, sent: 4, failed: 0, pending: 6 } }), job('STUCK_STOPPED_MID_RUN', { id: 'q4', status: 'SENDING', waitingSeconds: null, lastProgressAt: '2026-11-08T11:00:00Z', totals: { audience: 10, sent: 4, failed: 0, pending: 6 } }), job('STUCK_NO_PROGRESS', { id: 'q5', waitingSeconds: 7200 })];
    it('lists every state with its own Arabic label, wait time, counters and a stuck banner; cancel only where allowed', () => {
      const { el, fixture, c } = setup(null, null, true, { items: all, summary: summaryOf({ waitingDisabled: 1, waitingForWorker: 1, running: 1, stuckMidRun: 1, stuckNoProgress: 1, oldestWaitingSeconds: 7200 }) });
      fixture.detectChanges();
      const rows = Array.from(el.querySelectorAll('[aria-label="طابور البث"] article')) as HTMLElement[];
      expect(rows.map(r => r.dataset['state'])).toEqual(['WAITING_WORKER_DISABLED', 'WAITING_FOR_WORKER', 'RUNNING', 'STUCK_STOPPED_MID_RUN', 'STUCK_NO_PROGRESS']);
      for (const [i, label] of ['في الانتظار — العامل مقفول', 'في الانتظار — بانتظار العامل', 'يعمل الآن', 'توقفت أثناء التنفيذ', 'عالقة بلا تقدّم'].entries()) expect(rows[i].textContent).toContain(label);
      expect(rows[0].textContent).toContain('أقل من دقيقة'); expect(rows[1].textContent).toContain('6 دقيقة'); expect(rows[4].textContent).toContain('2 ساعة');
      expect(rows[2].textContent).toContain('أُرسل 4'); expect(rows[2].textContent).toContain('متبقٍ 6');
      expect(rows.map(r => !!r.querySelector('button'))).toEqual([true, true, false, true, true]); // a running job cannot be cancelled
      expect(new Set(rows.map(r => r.querySelector('.queue-state')!.className)).size).toBe(5); // distinct styling per state
      expect(el.querySelector('[aria-label="تنبيه إرسال عالق"]')!.textContent).toContain('2 إرسال عالق');
      expect(c.stuckCount).toBe(2);
    });
    it('shows a notice (not an alert) when only waiting-with-worker-off jobs exist, and an empty queue message otherwise', () => {
      const a = setup(null, null, true, { items: [all[0]], summary: summaryOf({ waitingDisabled: 1, workerEnabled: false }) });
      a.fixture.detectChanges();
      expect(a.el.querySelector('[aria-label="تنبيه إرسال عالق"]')).toBeNull(); expect(a.el.querySelector('[aria-label="إرسال بانتظار العامل"]')!.textContent).toContain('العامل مقفول');
      TestBed.resetTestingModule();
      const b = setup(); b.fixture.detectChanges();
      expect(b.el.textContent).toContain('الطابور فارغ'); expect(b.el.querySelector('[role="alert"][aria-label="تنبيه إرسال عالق"]')).toBeNull();
    });
    it('cancel opens a confirmation with sender, category, counters (no body), posts the reason, refreshes the queue', async () => {
      const { c, http } = setup(null, null, true, { items: [all[3]], summary: summaryOf({ stuckMidRun: 1 }) });
      c.openCancel(all[3] as any); c.cancelReason = 'رسالة قديمة';
      const p = c.confirmCancel(); await flushAsync();
      const text = confirmArgs.message as string;
      expect(text).toContain('المرسل: مدير'); expect(text).toContain('أُرسل 4'); expect(text).toContain('رسالة قديمة'); expect(text).not.toContain('message');
      const req = route(http, 'POST', '/broadcasts/q4/cancel'); expect(req.request.body).toEqual({ reason: 'رسالة قديمة' });
      req.flush({ data: view({ status: 'CANCELLED' }) }); await flushAsync();
      http.expectOne(r => r.url.endsWith('/queue/preflight')).flush({ data: pfOf() });
      http.expectOne(r => r.url.endsWith('/admin/broadcasts/queue')).flush({ data: { items: [], summary: summaryOf() } }); await flushAsync();
      http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } }); await p;
      expect(c.cancelTarget()).toBeNull(); expect(c.queue()?.items.length).toBe(0);
    });
    it('declining the confirmation cancels nothing; a refusal from the server is explained', async () => {
      const { c, http } = setup(null, null, true, { items: [all[3]], summary: summaryOf({ stuckMidRun: 1 }) });
      c.openCancel(all[3] as any); confirmAnswer = false; await c.confirmCancel(); http.expectNone(r => r.url.endsWith('/cancel'));
      confirmAnswer = true; const p = c.confirmCancel(); await flushAsync();
      route(http, 'POST', '/broadcasts/q4/cancel').flush({ code: 'BROADCAST_RUNNING' }, { status: 409, statusText: 'Conflict' }); await flushAsync();
      http.expectOne(r => r.url.endsWith('/queue/preflight')).flush({ data: pfOf() });
      http.expectOne(r => r.url.endsWith('/admin/broadcasts/queue')).flush({ data: { items: [all[2]], summary: summaryOf({ running: 1 }) } }); await p;
      expect(c.cancelError()).toContain('يعمل الآن');
    });
    it('polls the queue every 15 s with one shared fetch and stops on leaving the page', async () => {
      const { c, http, fixture } = setup(null, null, true, { items: [], summary: summaryOf() }, true);
      expect(c.isQueuePolling).toBe(true);
      vi.advanceTimersByTime(14000); http.expectNone(r => r.url.endsWith('/admin/broadcasts/queue'));
      vi.advanceTimersByTime(1500); await flushAsync();
      http.expectOne(r => r.url.endsWith('/queue/preflight')).flush({ data: pfOf() });
      http.expectOne(r => r.url.endsWith('/admin/broadcasts/queue')).flush({ data: { items: [all[1]], summary: summaryOf({ waitingForWorker: 1 }) } }); await flushAsync();
      expect(c.queue()?.items.length).toBe(1);
      fixture.destroy(); expect(c.isQueuePolling).toBe(false);
      vi.advanceTimersByTime(60000); http.expectNone(r => r.url.endsWith('/admin/broadcasts/queue'));
    });
  });

  describe('pre-activation check and expired jobs', () => {
    const expired = job('EXPIRED_NEEDS_REVIEW', { id: 'e1', ageSeconds: 3 * 86400, reviewed: false, approved: false, message: 'SECRET-BODY' });
    const fresh = job('WAITING_WORKER_DISABLED', { id: 'f1', ageSeconds: 600, reviewed: false });
    const mk = (pf: unknown = pfOf()) => setup(null, null, true, { items: [expired, fresh], summary: summaryOf({ expiredNeedsReview: 1, waitingDisabled: 1 }) }, false, pf);
    it('green only when safe; otherwise the Arabic blockers with counts', () => {
      const a = mk(); a.fixture.detectChanges();
      expect(a.el.querySelector('[aria-label="الفحص قبل التفعيل"]')!.className).toContain('ok'); expect(a.el.textContent).toContain('جاهز للتفعيل'); expect(a.el.textContent).toContain('لا يُرسل شيء من الطابور طالما العامل مقفول');
      TestBed.resetTestingModule();
      const b = mk(pfOf({ canEnableSafely: false, blockers: [{ code: 'EXPIRED_JOBS', count: 1, message: 'إرسالات أقدم من 24 ساعة' }, { code: 'UNREVIEWED_JOBS', count: 2, message: 'إرسالات لم تُراجَع' }] })); b.fixture.detectChanges();
      const panel = b.el.querySelector('[aria-label="الفحص قبل التفعيل"]')!;
      expect(panel.className).toContain('bad'); expect(panel.textContent).toContain('1 — إرسالات أقدم من 24 ساعة'); expect(panel.textContent).toContain('2 — إرسالات لم تُراجَع'); expect(panel.textContent).not.toContain('جاهز للتفعيل');
    });
    it('shows the expired label and age, the three actions only where allowed, and never a body', () => {
      const { el, fixture } = mk(); fixture.detectChanges();
      const rows = Array.from(el.querySelectorAll('[aria-label="طابور البث"] article')) as HTMLElement[];
      expect(rows[0].textContent).toContain('منتهية الصلاحية — تحتاج مراجعة'); expect(rows[0].textContent).toContain('3 يوم');
      const labels = (r: HTMLElement) => Array.from(r.querySelectorAll('button')).map(b => b.textContent!.trim());
      expect(labels(rows[0])).toEqual(['تمت المراجعة', 'اعتماد الإرسال', 'إلغاء']); expect(labels(rows[1])).toEqual(['تمت المراجعة', 'إلغاء']);
      expect(el.textContent).not.toContain('SECRET-BODY');
    });
    it('review, approve (reason required) and cancel each confirm with title, sender, category, counters and age (no body)', async () => {
      const { c, http } = mk(); const done = async (path: string, body: unknown) => {
        const req = route(http, 'POST', path); expect(req.request.body).toEqual(body); req.flush({ data: view() }); await flushAsync();
        http.expectOne(r => r.url.endsWith('/queue/preflight')).flush({ data: pfOf() }); http.expectOne(r => r.url.endsWith('/admin/broadcasts/queue')).flush({ data: { items: [], summary: summaryOf() } }); await flushAsync();
        http.expectOne(r => r.url.endsWith('/admin/broadcasts') && r.method === 'GET').flush({ data: { page: 1, hasNext: false, items: [] } }); await flushAsync();
      };
      c.openReview(expired as any); let p = c.confirmAction(); await flushAsync();
      let text = confirmArgs.message as string; expect(text).toContain('المرسل: مدير'); expect(text).toContain('3 يوم'); expect(text).toContain('أُرسل 0'); expect(text).not.toContain('SECRET-BODY'); expect(confirmArgs.title).toContain('مراجعة');
      await done('/broadcasts/e1/review', {}); await p;
      c.openApprove(expired as any); c.cancelReason = 'ab'; await c.confirmAction(); expect(c.cancelError()).toContain('3 أحرف'); http.expectNone(r => r.url.endsWith('/approve-send'));
      c.cancelReason = 'ما زالت مطلوبة'; p = c.confirmAction(); await flushAsync();
      expect(confirmArgs.message).toContain('ما زالت مطلوبة'); expect(confirmArgs.message).toContain('لا يُرسل شيء طالما العامل مقفول');
      await done('/broadcasts/e1/approve-send', { reason: 'ما زالت مطلوبة' }); await p;
      c.openCancel(expired as any); c.cancelReason = 'قديمة'; p = c.confirmAction(); await flushAsync();
      await done('/broadcasts/e1/cancel', { reason: 'قديمة' }); await p;
      confirmAnswer = false; c.openReview(expired as any); await c.confirmAction(); http.expectNone(r => r.url.endsWith('/review'));
    });
  });
});
