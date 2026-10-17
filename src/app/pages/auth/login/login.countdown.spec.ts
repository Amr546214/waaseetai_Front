import { installMemoryStorage } from '../../../core/wait/memory-storage.testkit';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Login } from './login';
import { AuthStore } from '../../../core/store/auth.store';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { WaitTimerService, waitScope } from '../../../core/wait/wait-timer.service';

// Login wait: a 429 (Retry-After in seconds or an HTTP-date) disables ONLY the login button with «بعد m:ss», keeps the typed e-mail and password,
// never logs in again by itself at zero, and a refresh keeps the stored end for the same e-mail only.
let restoreStorage: () => void = () => undefined;
beforeEach(() => { restoreStorage = installMemoryStorage(); });
afterEach(() => restoreStorage());

describe('Login countdown', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });

	// the page wipes browser-autofilled fields at 150 ms and 600 ms after it opens; a user types after that
	function mount(post: (...a: any[]) => any) {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [Login],
			providers: [
				provideRouter([]),
				{ provide: HttpClient, useValue: { post } },
				{ provide: AuthStore, useValue: { currentUser: signal<any>(null), authenticate: vi.fn(), setPendingVerification: vi.fn() } },
				{ provide: SocialAuthService, useValue: { authState: new Subject<any>(), initState: of(undefined) } },
			],
		});
		const f = TestBed.createComponent(Login);
		vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		f.detectChanges();
		vi.advanceTimersByTime(700);
		const c: any = f.componentInstance; const el = f.nativeElement as HTMLElement;
		const fill = (email: string, password = 'Secret#123') => { c.loginForm.patchValue({ email, password }); f.detectChanges(); };
		return { f, c, el, fill, btn: () => el.querySelector('#btn-login') as HTMLButtonElement };
	}
	const e429 = (retryAfter: string | null, error: any = { message: 'محاولات كثيرة' }) => throwError(() => ({ status: 429, headers: new HttpHeaders(retryAfter ? { 'Retry-After': retryAfter } : {}), error }));

	it('429 with Retry-After seconds: button disabled with the ticking label, sentence shown, inputs kept, no generic server error, enabled at zero with NO new request', async () => {
		const post = vi.fn(() => e429('90'));
		const { f, c, el, fill, btn } = mount(post);
		fill('a@b.co'); c.onSubmit();
		await vi.advanceTimersByTimeAsync(0); f.detectChanges();
		expect(btn().disabled).toBe(true);
		expect(el.querySelector('#login-wait')!.textContent).toContain('بعد 1:30');
		expect(el.querySelector('[data-testid="rate-limit-msg"]')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:30');
		expect(el.querySelectorAll('#banner-error').length).toBe(1); // only the wait line, no second error banner
		expect(el.textContent).not.toContain('حدث خطأ في الخادم');
		expect(c.loginForm.value.email).toBe('a@b.co'); expect(c.loginForm.value.password).toBe('Secret#123');
		c.onSubmit(); expect(post).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000); f.detectChanges();
		expect(el.querySelector('#login-wait')!.textContent).toContain('بعد 1:29');
		await vi.advanceTimersByTimeAsync(90_000); f.detectChanges();
		expect(btn().disabled).toBe(false);
		expect(el.querySelector('[data-testid="rate-limit-msg"]')).toBeNull();
		expect(post).toHaveBeenCalledTimes(1);
	});

	it('Retry-After as an HTTP-date; a past date means no wait', async () => {
		const at = new Date(Date.now() + 125_000).toUTCString();
		const a = mount(vi.fn(() => e429(at)));
		a.fill('a@b.co'); a.c.onSubmit(); await vi.advanceTimersByTimeAsync(0); a.f.detectChanges();
		expect(a.el.querySelector('#login-wait')!.textContent).toContain('بعد 2:05');
		localStorage.clear();
		const past = new Date(Date.now() - 60_000).toUTCString();
		const b = mount(vi.fn(() => e429(past)));
		b.fill('a@b.co'); b.c.onSubmit(); await vi.advanceTimersByTimeAsync(0); b.f.detectChanges();
		expect(b.btn().disabled).toBe(false);
		expect(b.el.querySelector('#login-wait')).toBeNull();
	});

	it('429 with no time at all (or garbage): honest sentence with no number, button stays usable', async () => {
		const a = mount(vi.fn(() => e429(null)));
		a.fill('a@b.co'); a.c.onSubmit(); await vi.advanceTimersByTimeAsync(0); a.f.detectChanges();
		const t = a.el.querySelector('[data-testid="rate-limit-msg"]')!.textContent!;
		expect(t).toContain('بعد قليل'); expect(t).not.toMatch(/\d/);
		expect(a.btn().disabled).toBe(false);
		const g = mount(vi.fn(() => e429('later')));
		g.fill('a@b.co'); g.c.onSubmit(); await vi.advanceTimersByTimeAsync(0); g.f.detectChanges();
		expect(g.el.querySelector('#login-wait')).toBeNull();
	});

	it('a wrong password (401) starts NO wait', async () => {
		const { f, c, el, fill, btn } = mount(() => throwError(() => ({ status: 401, error: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' } })));
		fill('a@b.co'); c.onSubmit(); await vi.advanceTimersByTimeAsync(0); f.detectChanges();
		expect(btn().disabled).toBe(false);
		expect(el.querySelector('#login-wait')).toBeNull();
		expect(el.querySelector('#banner-error')).not.toBeNull();
	});

	it('refresh: the wait follows the e-mail; another e-mail is not blocked', async () => {
		const first = mount(vi.fn(() => e429('60')));
		first.fill('a@b.co'); first.c.onSubmit(); await vi.advanceTimersByTimeAsync(20_000);
		const second = mount(vi.fn());
		second.fill('a@b.co');
		expect(second.btn().disabled).toBe(true);
		expect(second.c.loginWait().remainingSeconds()).toBe(40);
		second.fill('other@b.co');
		expect(second.btn().disabled).toBe(false);
	});

	it('hand-off to the code screen: the login answer\'s resendAvailableAt / retryAfterSeconds is stored under the shared otp-resend scope of that user', async () => {
		const { c, fill } = mount(() => of({ success: true, data: { verified: false, loginOtpRequired: true, userId: 'u1', emailSent: true, resendAvailableAt: new Date(Date.now() + 60_000).toISOString() } }));
		fill('a@b.co'); c.onSubmit(); await vi.advanceTimersByTimeAsync(0);
		const svc = TestBed.inject(WaitTimerService);
		expect(svc.remainingMsOf(waitScope('otp-resend', 'u1'))).toBe(60_000);
		expect(TestBed.inject(OtpHandoffService)).toBeTruthy();
	});

	it('hand-off after a THROTTLED send (retryAfterSeconds, emailSent false) stores that end; no time = nothing stored', async () => {
		const a = mount(() => of({ success: true, data: { verified: false, loginOtpRequired: true, userId: 'u2', emailSent: false, retryAfterSeconds: 45 } }));
		a.fill('a@b.co'); a.c.onSubmit(); await vi.advanceTimersByTimeAsync(0);
		expect(TestBed.inject(WaitTimerService).remainingMsOf(waitScope('otp-resend', 'u2'))).toBe(45_000);
		const b = mount(() => of({ success: true, data: { verified: false, loginOtpRequired: true, userId: 'u3', emailSent: false } }));
		b.fill('a@b.co'); b.c.onSubmit(); await vi.advanceTimersByTimeAsync(0);
		expect(TestBed.inject(WaitTimerService).remainingMsOf(waitScope('otp-resend', 'u3'))).toBe(0);
	});

	describe('Google sign-in 429', () => {
		it('gates ONLY the Google button (label + the overlay is removed), shows the sentence, email login stays usable, nothing retried at zero', async () => {
			const authState = new Subject<any>();
			const post = vi.fn(() => e429('50'));
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({ imports: [Login], providers: [provideRouter([]), { provide: HttpClient, useValue: { post } }, { provide: AuthStore, useValue: { currentUser: signal<any>(null), authenticate: vi.fn(), setPendingVerification: vi.fn() } }, { provide: SocialAuthService, useValue: { authState, initState: of(undefined) } }] });
			const f = TestBed.createComponent(Login); f.detectChanges();
			const el = f.nativeElement as HTMLElement;
			authState.next({ idToken: 'tok' }); await vi.advanceTimersByTimeAsync(0); f.detectChanges();
			expect(post).toHaveBeenCalledTimes(1);
			expect((el.querySelector('#btn-google') as HTMLButtonElement).disabled).toBe(true);
			expect(el.querySelector('#google-wait')!.textContent).toContain('بعد 0:50');
			expect(el.querySelector('asl-google-signin-button')).toBeNull();
			expect(el.querySelector('[data-testid="rate-limit-msg"]')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:50');
			expect((el.querySelector('#btn-login') as HTMLButtonElement).disabled).toBe(false);
			authState.next({ idToken: 'tok2' }); await vi.advanceTimersByTimeAsync(0);
			expect(post).toHaveBeenCalledTimes(1); // blocked while the wait runs
			await vi.advanceTimersByTimeAsync(51_000); f.detectChanges();
			expect((el.querySelector('#btn-google') as HTMLButtonElement).disabled).toBe(false);
			expect(el.querySelector('asl-google-signin-button')).not.toBeNull();
			expect(post).toHaveBeenCalledTimes(1);
		});
	});
});
