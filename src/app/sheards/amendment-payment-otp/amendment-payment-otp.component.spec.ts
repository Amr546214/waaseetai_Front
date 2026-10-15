import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AmendmentPaymentOtpComponent } from './amendment-payment-otp.component';
import { insufficientBalanceOf } from '../../core/services/amendment-actions.service';
import { amendmentApproveText, amendmentEffect, amendmentEffectLines, amendmentEffectNote, amendmentNeedsPayment } from '../../core/constants/amendment-effect';

const INIT = { success: true, data: { otpSentTo: 'a***@x.com', expiresAt: new Date(Date.now() + 120000).toISOString(), amount: 5 } };

describe('AmendmentPaymentOtpComponent', () => {
	async function setup(mode: 'respond' | 'authorize', post: (url: string, body: any) => any) {
		const http = { post: vi.fn(post), get: vi.fn() };
		await TestBed.configureTestingModule({ imports: [AmendmentPaymentOtpComponent], providers: [provideRouter([]), { provide: HttpClient, useValue: http }] }).compileComponents();
		const f = TestBed.createComponent(AmendmentPaymentOtpComponent);
		f.componentRef.setInput('amendmentId', 'am-1'); f.componentRef.setInput('mode', mode); f.componentRef.setInput('amount', 5);
		const done = vi.fn(); const closed = vi.fn();
		f.componentInstance.done.subscribe(done); f.componentInstance.closed.subscribe(closed);
		f.detectChanges();
		const q = (id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
		const click = (id: string) => { (q(id) as HTMLButtonElement).click(); f.detectChanges(); };
		const type = (v: string) => { const i = q('amendment-otp-input') as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); f.detectChanges(); };
		return { f, http, done, closed, q, click, type };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('nothing is requested until the user asks; then the code endpoint is called for THIS amendment', async () => {
		const s = await setup('respond', () => of(INIT));
		expect(s.http.post).not.toHaveBeenCalled();
		expect(s.q('amendment-otp-input')).toBeNull();
		s.click('amendment-otp-send');
		expect(String(s.http.post.mock.calls[0][0])).toContain('/client/projects/amendments/am-1/payment-otp');
		expect(s.q('amendment-otp-input')).not.toBeNull();
		expect(s.q('amendment-otp-timer')!.textContent).toContain('ينتهي خلال');
	});

	it('respond mode: the approval carries the code and `done` fires only after the API succeeded', async () => {
		const gate = new Subject<any>();
		const s = await setup('respond', (url) => (url.includes('payment-otp') ? of(INIT) : gate.asObservable()));
		s.click('amendment-otp-send'); s.type('654321'); s.click('amendment-otp-confirm');
		const call = s.http.post.mock.calls[1];
		expect(String(call[0])).toContain('/client/projects/amendments/am-1/respond');
		expect(call[1]).toEqual({ decision: 'approve', otpCode: '654321' });
		expect(s.done).not.toHaveBeenCalled(); // still in flight: no optimistic success
		expect((s.q('amendment-otp-confirm') as HTMLButtonElement).disabled).toBe(true); // no double submit
		gate.next({ success: true, data: { id: 'am-1', effect: 'APPLIED' } }); gate.complete();
		expect(s.done).toHaveBeenCalledTimes(1);
	});

	it('authorize mode posts to authorize-funding (no decision) and says nothing is charged now', async () => {
		const s = await setup('authorize', (url) => (url.includes('payment-otp') ? of(INIT) : of({ success: true, data: { fundingAuthorized: true } })));
		expect(s.q('amendment-otp-intro')!.textContent).toContain('لا يُخصم شيء الآن');
		s.click('amendment-otp-send'); s.type('111111'); s.click('amendment-otp-confirm');
		expect(String(s.http.post.mock.calls[1][0])).toContain('/client/projects/amendments/am-1/authorize-funding');
		expect(s.http.post.mock.calls[1][1]).toEqual({ otpCode: '111111' });
		expect(s.done).toHaveBeenCalledTimes(1);
	});

	it('a wrong code shows the server message and does NOT emit done; the user can retry or resend', async () => {
		const s = await setup('respond', (url) => (url.includes('payment-otp') ? of(INIT) : throwError(() => ({ status: 400, error: { message: 'رمز التحقق غير صحيح' } }))));
		s.click('amendment-otp-send'); s.type('000000'); s.click('amendment-otp-confirm');
		expect(s.q('amendment-otp-error')!.textContent).toContain('رمز التحقق غير صحيح');
		expect(s.done).not.toHaveBeenCalled();
		expect((s.q('amendment-otp-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('a short wallet at the code request shows the shortfall with the deposit link', async () => {
		const s = await setup('respond', () => throwError(() => ({ status: 409, error: { message: 'رصيد المحفظة غير كافٍ', errors: [{ required: 5, available: 1, shortfall: 4 }] } })));
		s.click('amendment-otp-send');
		expect(s.q('amendment-otp-insufficient')!.textContent).toContain('المطلوب 5 $');
		expect((s.q('amendment-otp-deposit') as HTMLAnchorElement).getAttribute('href')).toBe('/client-overview/finance/wallet');
		expect(s.q('amendment-otp-input')).toBeNull();
	});

	it('back emits closed and sends nothing', async () => {
		const s = await setup('respond', () => of(INIT));
		s.click('amendment-otp-cancel');
		expect(s.closed).toHaveBeenCalledTimes(1);
		expect(s.http.post).not.toHaveBeenCalled();
	});
});

describe('amendment-effect helpers', () => {
	it('effect is read from the API; rows from an older API are read as legacy record-only when approved', () => {
		expect(amendmentEffect({ effect: 'APPLIED' })).toBe('APPLIED');
		expect(amendmentEffect({ status: 'APPROVED' })).toBe('RECORD_ONLY');
		expect(amendmentEffect({ status: 'PENDING_OTHER_PARTY' })).toBe('PENDING');
		expect(amendmentEffect({ status: 'REJECTED' })).toBe('NONE');
		expect(amendmentEffectNote({ status: 'APPROVED' })).toContain('للمتابعة فقط');
		expect(amendmentEffectNote({ effect: 'APPLIED' })).not.toContain('للمتابعة فقط');
	});

	it('only a budget INCREASE needs the payment code, and only for BUDGET / MIXED types', () => {
		expect(amendmentNeedsPayment({ type: 'BUDGET', budgetDelta: 5 })).toBe(true);
		expect(amendmentNeedsPayment({ type: 'BUDGET', budgetDelta: -5 })).toBe(false);
		expect(amendmentNeedsPayment({ type: 'DURATION', budgetDelta: 5 })).toBe(false); // a stray budget on a duration request has no effect
		expect(amendmentNeedsPayment({ type: 'MIXED', budgetDelta: 5, needsClientPayment: true })).toBe(true);
	});

	it('financial lines: increase (amount, new price, new stage), decrease (refund, shrink unreleased only), duration, scope', () => {
		const inc = amendmentEffectLines({ type: 'BUDGET', budgetDelta: 5, contractPrice: 20 }).map(l => `${l.label}:${l.value}`).join('|');
		expect(inc).toContain('يُخصم من محفظة العميل:5 $'); expect(inc).toContain('20 $ ← 25 $'); expect(inc).toContain('مرحلة جديدة في آخر العقد:5 $');
		const dec = amendmentEffectLines({ type: 'BUDGET', budgetDelta: -4, contractPrice: 20 }).map(l => `${l.label}:${l.value}`).join('|');
		expect(dec).toContain('يُردّ إلى محفظة العميل:4 $'); expect(dec).toContain('20 $ ← 16 $'); expect(dec).toContain('غير المسلَّمة فقط');
		expect(amendmentEffectLines({ type: 'DURATION', durationDeltaDays: -2, contractDurationDays: 14 })[0].value).toBe('14 ← 12 يومًا');
		expect(amendmentEffectLines({ type: 'SCOPE', description: 'إضافة' })[0].label).toBe('النطاق');
		expect(amendmentEffectLines({ type: 'SCOPE', description: '' })).toEqual([]);
	});

	it('the approve sentence differs by who pays: the client enters the code, the provider relies on the client\'s earlier authorization', () => {
		expect(amendmentApproveText({ type: 'BUDGET', budgetDelta: 5 }, 'client')).toContain('بعد إدخال رمز التحقق');
		expect(amendmentApproveText({ type: 'BUDGET', budgetDelta: 5 }, 'provider')).toContain('اعتمد الدفع مسبقًا');
		expect(amendmentApproveText({ type: 'DURATION', durationDeltaDays: 2 }, 'client')).not.toContain('رمز');
	});

	it('insufficientBalanceOf reads the structured 409 detail and nothing else', () => {
		expect(insufficientBalanceOf({ error: { errors: [{ required: 5, available: 1, shortfall: 4 }] } })).toEqual({ required: 5, available: 1, shortfall: 4 });
		expect(insufficientBalanceOf({ error: { message: 'x' } })).toBeNull();
	});
});

// Countdown: validity from expiresAt, send / confirm waits only from a server 429, end timestamps, no automatic retry of a money write.
describe('AmendmentPaymentOtpComponent countdown', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });
	async function mount(post: (url: string, body: any) => any) {
		TestBed.resetTestingModule();
		const http = { post: vi.fn(post), get: vi.fn() };
		await TestBed.configureTestingModule({ imports: [AmendmentPaymentOtpComponent], providers: [provideRouter([]), { provide: HttpClient, useValue: http }] }).compileComponents();
		const f = TestBed.createComponent(AmendmentPaymentOtpComponent);
		f.componentRef.setInput('amendmentId', 'am-1'); f.componentRef.setInput('mode', 'respond'); f.componentRef.setInput('amount', 5);
		f.detectChanges();
		const q = (id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
		const click = (id: string) => { (q(id) as HTMLButtonElement).click(); f.detectChanges(); };
		const type = (v: string) => { const i = q('amendment-otp-input') as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); f.detectChanges(); };
		return { f, http, q, click, type };
	}
	const init = (ms: number | null) => of({ success: true, data: { otpSentTo: 'a***@x.com', ...(ms != null ? { expiresAt: new Date(Date.now() + ms).toISOString() } : {}), amount: 5 } });
	const e429 = (headers: Record<string, string>, body: any = { message: 'محاولات كثيرة' }) => throwError(() => ({ status: 429, headers: { get: (k: string) => headers[k] ?? null }, error: body }));

	it('validity ticks from the server expiresAt (m:ss) and reaches expired; returning after a throttled background tab shows the real remaining time', async () => {
		const s = await mount(() => init(120_000));
		s.click('amendment-otp-send');
		expect(s.q('amendment-otp-timer')!.textContent).toContain('2:00');
		vi.advanceTimersByTime(1000); s.f.detectChanges();
		expect(s.q('amendment-otp-timer')!.textContent).toContain('1:59');
		// frozen background tab: the clock moves 100 s without ticks
		vi.setSystemTime(Date.now() + 100_000);
		window.dispatchEvent(new Event('focus')); s.f.detectChanges();
		expect(s.q('amendment-otp-timer')!.textContent).toContain('0:19');
		vi.advanceTimersByTime(20_000); s.f.detectChanges();
		expect(s.q('amendment-otp-timer')!.textContent).toContain('انتهت صلاحية الرمز');
	});

	it('the server sent no expiresAt: no timer and no invented 2 minutes (confirm is not blocked by a fake expiry)', async () => {
		const s = await mount(() => init(null));
		s.click('amendment-otp-send');
		expect(s.q('amendment-otp-timer')!.textContent!.trim()).toBe('');
		s.type('123456');
		expect(s.f.componentInstance.canConfirm()).toBe(true);
	});

	it('confirm 429 (Retry-After seconds): only confirm is disabled with «بعد m:ss», the typed code stays, zero does not call the API again', async () => {
		const s = await mount((url) => (url.includes('payment-otp') ? init(300_000) : e429({ 'Retry-After': '75' })));
		s.click('amendment-otp-send'); s.type('654321'); s.click('amendment-otp-confirm');
		expect((s.q('amendment-otp-confirm') as HTMLButtonElement).disabled).toBe(true);
		expect(s.q('amendment-otp-confirm-wait')!.textContent).toContain('بعد 1:15');
		expect(s.q('amendment-otp-rate-limit')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:15');
		expect(s.q('amendment-otp-error')).toBeNull();
		expect((s.q('amendment-otp-resend') as HTMLButtonElement).disabled).toBe(false);
		expect((s.q('amendment-otp-input') as HTMLInputElement).value).toBe('654321');
		const calls = s.http.post.mock.calls.length;
		vi.advanceTimersByTime(80_000); s.f.detectChanges();
		expect((s.q('amendment-otp-confirm') as HTMLButtonElement).disabled).toBe(false);
		expect(s.http.post.mock.calls.length).toBe(calls);
	});

	it('send 429 as an HTTP-date: send/resend wait; a garbage Retry-After gives an honest message with no seconds', async () => {
		const at = new Date(Date.now() + 61_000).toUTCString();
		const a = await mount(() => e429({ 'Retry-After': at }));
		a.click('amendment-otp-send');
		expect((a.q('amendment-otp-send') as HTMLButtonElement).disabled).toBe(true);
		expect(a.q('amendment-otp-send-wait')!.textContent).toContain('بعد 1:01');
		localStorage.clear();
		const b = await mount(() => e429({ 'Retry-After': 'soon' }));
		b.click('amendment-otp-send');
		const t = b.q('amendment-otp-rate-limit')!.textContent!;
		expect(t).toContain('بعد قليل'); expect(t).not.toMatch(/\d/);
		expect((b.q('amendment-otp-send') as HTMLButtonElement).disabled).toBe(false);
	});

	it('a wrong code (400) starts no wait', async () => {
		const s = await mount((url) => (url.includes('payment-otp') ? init(300_000) : throwError(() => ({ status: 400, error: { message: 'رمز التحقق غير صحيح' } }))));
		s.click('amendment-otp-send'); s.type('111111'); s.click('amendment-otp-confirm');
		expect(s.q('amendment-otp-confirm-wait')).toBeNull();
		expect((s.q('amendment-otp-confirm') as HTMLButtonElement).disabled).toBe(false);
		expect(s.q('amendment-otp-error')!.textContent).toContain('رمز التحقق غير صحيح');
	});

	it('timers stop with the component (no interval left) and double-clicking send does not stack intervals', async () => {
		const s = await mount(() => init(120_000));
		const svc: any = TestBed.inject((s.f.componentInstance as any).waits.constructor);
		s.click('amendment-otp-send'); s.click('amendment-otp-resend');
		expect(svc.activeIntervals).toBe(1);
		s.f.destroy();
		expect(svc.activeIntervals).toBe(0);
	});
});
