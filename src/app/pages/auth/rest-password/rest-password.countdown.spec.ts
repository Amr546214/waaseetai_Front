import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RestPassword } from './rest-password';

// Recovery: the send / resend wait comes from the server (resendAvailableAt, Retry-After); code validity (expiresAt) is a separate timer;
// a refresh keeps the stored end; nothing is invented; zero never resends by itself.
describe('RestPassword countdown', () => {
	const T0 = new Date('2026-10-15T10:00:00Z');
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });

	const ok = (resendMs: number | null, expMs: number | null) => of({ success: true, message: 'ok', ...(resendMs != null ? { resendAvailableAt: new Date(Date.now() + resendMs).toISOString() } : {}), ...(expMs != null ? { expiresAt: new Date(Date.now() + expMs).toISOString() } : {}) });
	function mount(post: (...a: any[]) => any) {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ imports: [RestPassword], providers: [provideRouter([]), { provide: HttpClient, useValue: { post } }] });
		const f = TestBed.createComponent(RestPassword);
		f.detectChanges();
		const c: any = f.componentInstance;
		const el = f.nativeElement as HTMLElement;
		const type = (email: string) => { c.recoveryForm.patchValue({ email }); f.detectChanges(); };
		return { f, c, el, type };
	}
	const q = (el: HTMLElement, sel: string) => el.querySelector(sel) as HTMLElement | null;

	it('after a send: validity (expiresAt) and resend (resendAvailableAt) are two separate timers; the resend button is disabled with «بعد m:ss» and enabled at zero with NO automatic send', () => {
		const post = vi.fn(() => ok(60_000, 600_000));
		const { f, c, el, type } = mount(post);
		type('a@b.co'); c.sendOtp(); f.detectChanges();
		expect(c.currentStep).toBe(2);
		expect(q(el, '#otp-timer')!.textContent).toBe('10:00');
		expect(q(el, '#resend-wait')!.textContent).toContain('بعد 1:00');
		expect((q(el, '#btn-resend') as HTMLButtonElement).disabled).toBe(true);
		vi.advanceTimersByTime(61_000); f.detectChanges();
		expect((q(el, '#btn-resend') as HTMLButtonElement).disabled).toBe(false);
		expect(q(el, '#resend-wait')).toBeNull();
		expect(q(el, '#otp-timer')!.textContent).toBe('8:59'); // validity keeps running on its own clock
		expect(post).toHaveBeenCalledTimes(1);
	});

	it('the code expiring says so (honest) and does not touch the resend button', () => {
		const { f, c, el, type } = mount(() => ok(1_000, 5_000));
		type('a@b.co'); c.sendOtp(); f.detectChanges();
		vi.advanceTimersByTime(6_000); f.detectChanges();
		expect(q(el, '#code-expired')!.textContent).toContain('انتهت صلاحية الرمز');
		expect((q(el, '#btn-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('the server sent no times: no timer and no invented number (resend stays available)', () => {
		const { f, c, el, type } = mount(() => ok(null, null));
		type('a@b.co'); c.sendOtp(); f.detectChanges();
		expect(q(el, '#otp-timer')).toBeNull(); expect(q(el, '#resend-wait')).toBeNull(); expect(q(el, '#code-expired')).toBeNull();
		expect((q(el, '#btn-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('429 on the first send (Retry-After as an HTTP-date): stays on step 1, button shows the wait, the typed e-mail is kept, no generic server error', async () => {
		const at = new Date(Date.now() + 125_000).toUTCString();
		const { f, c, el, type } = mount(() => throwError(() => ({ status: 429, headers: new HttpHeaders({ 'Retry-After': at }), error: { success: false, message: 'محاولات كثيرة' } })));
		type('a@b.co'); c.sendOtp();
		await vi.advanceTimersByTimeAsync(0); f.detectChanges();
		expect(c.currentStep).toBe(1);
		expect(c.recoveryForm.value.email).toBe('a@b.co');
		expect(q(el, '#send-wait')!.textContent).toContain('بعد 2:05');
		expect((q(el, '#btn-send-otp') as HTMLButtonElement).disabled).toBe(true);
		expect(el.textContent).not.toContain('حدث خطأ في الخادم');
	});

	it('refresh: a new page instance restores the wait for the same e-mail only; another e-mail is not blocked', async () => {
		const first = mount(() => throwError(() => ({ status: 429, headers: new HttpHeaders({ 'Retry-After': '90' }), error: { message: 'x' } })));
		first.type('a@b.co'); first.c.sendOtp();
		await vi.advanceTimersByTimeAsync(30_000);
		const second = mount(vi.fn());
		second.type('A@B.co');
		expect(second.c.sendWait.remainingSeconds()).toBe(60);
		expect((q(second.el, '#btn-send-otp') as HTMLButtonElement).disabled).toBe(true);
		second.c.sendOtp(); // blocked: no request
		second.type('other@b.co');
		expect((q(second.el, '#btn-send-otp') as HTMLButtonElement).disabled).toBe(false);
	});

	it('a 429 on resend replaces the wait with the server latest answer', () => {
		let n = 0;
		const post = vi.fn(() => (n++ === 0 ? ok(1_000, 600_000) : throwError(() => ({ status: 429, headers: new HttpHeaders({ 'Retry-After': '300' }), error: { message: 'x' } }))));
		const { f, c, el, type } = mount(post);
		type('a@b.co'); c.sendOtp(); vi.advanceTimersByTime(2_000); f.detectChanges();
		c.resendOtp(); f.detectChanges();
		expect(c.sendWait.remainingSeconds()).toBe(300);
		expect(q(el, '#resend-wait')!.textContent).toContain('بعد 5:00');
		c.resendOtp(); expect(post).toHaveBeenCalledTimes(2); // locked: no third call
	});

	it('destroying the page stops its share of the clock (no interval left)', () => {
		const { f, c, type } = mount(() => ok(60_000, 600_000));
		type('a@b.co'); c.sendOtp();
		const svc: any = TestBed.inject((c.waits as any).constructor);
		expect(svc.activeIntervals).toBe(1);
		f.destroy();
		expect(svc.activeIntervals).toBe(0);
	});
});
