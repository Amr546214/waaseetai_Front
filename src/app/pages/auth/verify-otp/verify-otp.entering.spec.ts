import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { rememberReturnUrl } from '../../../core/routing/return-url';
import { AuthApiService } from '../../../core/services/auth-api.service';

// After a good code the dashboard opens through a lazy chunk (seconds on a cold start). The form must stay locked and say so until that navigation
// ends: it used to be shown ready again, so a second click re-sent a code that had just been consumed ("invalid code" → "I need another code").
function mount(verifyOtp: (...a: any[]) => any, resendOtp = vi.fn()) {
	TestBed.configureTestingModule({
		imports: [VerifyOtp],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1', currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }) } },
			{ provide: AuthApiService, useValue: { verifyOtp, resendOtp, isLoginOtpPending: () => true } }],
	});
	const f = TestBed.createComponent(VerifyOtp);
	const nav = new Subject<boolean>();
	vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockReturnValue(new Promise<boolean>(r => nav.subscribe(r)));
	f.detectChanges();
	const c: any = f.componentInstance;
	c.otpCtrl.setValue('123456');
	const el = f.nativeElement as HTMLElement;
	return { f, c, el, nav, btn: () => el.querySelector('#btn-confirm') as HTMLButtonElement, resend: () => el.querySelector('#btn-resend') as HTMLButtonElement };
}

describe('verify-otp: locked while the dashboard opens', () => {
	afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

	it('stays locked with an honest label until the navigation ends, and a second submit sends nothing', async () => {
		const verifyOtp = vi.fn(() => of({ success: true, data: { user: { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' } } }));
		const { f, c, el, nav, btn, resend } = mount(verifyOtp);
		c.verify(); f.detectChanges();
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		expect(btn().disabled).toBe(true);
		expect(btn().textContent).toContain('جارٍ فتح لوحتك');
		expect(resend().disabled).toBe(true);
		expect(el.textContent).toContain('جارٍ فتح لوحتك');
		c.verify(); c.verify();
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		nav.next(true); await new Promise<void>(resolve => setTimeout(resolve, 0));
	});

	it('if the navigation does not happen the code form is replaced by «إعادة فتح لوحتي», which retries ONLY the navigation (the used code is never sent again)', async () => {
		const verifyOtp = vi.fn(() => of({ success: true, data: { user: { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' } } }));
		const { f, c, el, nav } = mount(verifyOtp);
		const navigate = TestBed.inject(Router).navigateByUrl as any;
		c.verify(); f.detectChanges();
		nav.next(false); await new Promise<void>(resolve => setTimeout(resolve, 0)); f.detectChanges();
		expect(el.querySelector('#btn-confirm')).toBeNull();
		expect(el.querySelector('.otp-box')).toBeNull();
		expect(el.querySelector('#banner-error-txt')?.textContent).toContain('تعذر فتح لوحتك');
		const reopen = el.querySelector('[data-testid="reopen-dashboard"]') as HTMLButtonElement;
		expect(reopen.textContent).toContain('إعادة فتح لوحتي');
		const callsBefore = navigate.mock.calls.length;
		c.verify(); c.resendOtp();
		reopen.click(); f.detectChanges();
		expect(navigate.mock.calls.length).toBe(callsBefore + 1);
		expect(navigate.mock.calls[callsBefore][0]).toBe(navigate.mock.calls[0][0]);
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		expect((el.querySelector('[data-testid="reopen-dashboard"]') as HTMLButtonElement).disabled).toBe(true);
	});

	it('tries the role dashboard when a remembered page fails without verifying the code again', async () => {
		const user = { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' };
		const verifyOtp = vi.fn(() => of({ success: true, data: { user } }));
		const { c, el, f } = mount(verifyOtp);
		const navigate = vi.mocked(TestBed.inject(Router).navigateByUrl);
		navigate.mockRejectedValueOnce(new Error('stale page')).mockResolvedValueOnce(true);
		rememberReturnUrl('/client-overview/my-requests');
		await c.verify();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		f.detectChanges();
		expect(navigate.mock.calls.map(([url]) => url)).toEqual(['/client-overview/my-requests', '/client-overview']);
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		expect(el.querySelector('[data-testid="reopen-dashboard"]')).toBeNull();
	});

	it('clears the old code only after the server sends a replacement', () => {
		const resendOtp = vi.fn()
			.mockReturnValueOnce(of({ success: true, data: { emailSent: false } }))
			.mockReturnValueOnce(of({ success: true, data: { emailSent: true, expiresAt: new Date(Date.now() + 600_000).toISOString(), resendAvailableAt: new Date(Date.now() + 60_000).toISOString() } }));
		const { c } = mount(vi.fn(), resendOtp);
		c.resendOtp();
		expect(c.otpCtrl.value).toBe('123456');
		c.resendOtp();
		expect(c.otpCtrl.value).toBe('');
		expect(c.validWait().remainingSeconds()).toBeGreaterThan(590);
		expect(c.resendWait().remainingSeconds()).toBeGreaterThan(50);
	});

	it('a wrong code unlocks at once, keeps the typed digits and says the code is wrong (nothing is sent again by itself)', () => {
		const verifyOtp = vi.fn(() => throwError(() => ({ status: 400, error: { message: 'رمز التحقق غير صحيح' } })));
		const { f, c, el, btn } = mount(verifyOtp);
		c.verify(); f.detectChanges();
		expect(btn().disabled).toBe(false);
		expect(el.querySelector('#banner-error-txt')?.textContent).toContain('رمز التحقق غير صحيح');
		expect(c.otpCtrl.value).toBe('123456');
		expect(verifyOtp).toHaveBeenCalledTimes(1);
	});
});
