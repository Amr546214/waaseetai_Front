import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutConfirmComponent } from './confirm';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';

// The payment code has THREE different timers: validity (server expiresAt), resend wait (only a server 429) and confirm wait (only a server 429).
describe('CheckoutConfirmComponent countdown', () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); localStorage.clear(); });
	afterEach(() => { vi.useRealTimers(); localStorage.clear(); TestBed.resetTestingModule(); });

	function mount(opts: { expiresAt?: number | null; resend?: any; confirm?: any } = {}) {
		TestBed.resetTestingModule();
		const expires = signal<number | null>(opts.expiresAt ?? null);
		const svc = {
			currentOrder: signal({ id: 'o1' }), maskedPhone: signal('a***@b.co'), paymentReference: signal('P1'), error: signal(null),
			otpExpiresAt: expires.asReadonly(),
			resendOtp: opts.resend ?? vi.fn(() => of({ success: true, message: 'تم إعادة إرسال رمز التحقق' })),
			confirmPayment: opts.confirm ?? vi.fn(() => of({ success: false, message: 'رمز التحقق غير صحيح', errorKind: 'VALIDATION' })),
		};
		TestBed.configureTestingModule({ imports: [CheckoutConfirmComponent], providers: [provideRouter([]), { provide: CartService, useValue: { items: signal([]), itemCount: signal(1), total: signal(10) } }, { provide: CheckoutService, useValue: svc }] });
		const f = TestBed.createComponent(CheckoutConfirmComponent);
		f.detectChanges();
		const c: any = f.componentInstance; const el = f.nativeElement as HTMLElement;
		return { f, c, el, svc, expires };
	}
	const q = (el: HTMLElement, s: string) => el.querySelector(s) as HTMLElement | null;
	const fill = (c: any) => c.otpDigits.set(['1', '2', '3', '4', '5', '6']);

	it('validity comes from the server expiresAt (no hard-coded 120): ticks, then says expired; resend is NOT blocked by it', () => {
		const { f, el } = mount({ expiresAt: Date.now() + 125_000 });
		expect(q(el, '[data-testid="otp-validity"]')!.textContent).toContain('2:05');
		vi.advanceTimersByTime(126_000); f.detectChanges();
		expect(q(el, '[data-testid="otp-expired"]')!.textContent).toContain('انتهت صلاحية الرمز');
		expect((q(el, '#btn-resend') as HTMLButtonElement).disabled).toBe(false);
	});

	it('no expiry from the server: no validity timer is shown (nothing invented)', () => {
		const { el } = mount({ expiresAt: null });
		expect(q(el, '[data-testid="otp-validity"]')).toBeNull();
		expect(q(el, '[data-testid="otp-expired"]')).toBeNull();
	});

	it('a resend that succeeds starts no resend wait (the server has no gate) and restarts validity from the new expiresAt', () => {
		const { f, c, el, svc, expires } = mount({ expiresAt: Date.now() + 5_000 });
		(svc as any).resendOtp = vi.fn(() => { expires.set(Date.now() + 120_000); return of({ success: true, message: 'تم' }); });
		c.checkoutService.resendOtp = (svc as any).resendOtp;
		c.resendOtp(); f.detectChanges();
		expect(q(el, '[data-testid="resend-wait"]')).toBeNull();
		expect(q(el, '[data-testid="otp-validity"]')!.textContent).toContain('2:00');
	});

	it('a wrong code (400) starts NO wait and keeps the digits', () => {
		const { f, c, el } = mount();
		fill(c); c.confirmPayment(); f.detectChanges();
		expect(c.confirmWait.active()).toBe(false);
		expect(c.otpValue()).toBe('123456');
		expect(q(el, '[data-testid="confirm-wait"]')).toBeNull();
		expect(el.textContent).toContain('رمز التحقق غير صحيح');
	});

	it('confirm 429 with a wait: confirm button disabled with the label, resend stays enabled, digits kept, no auto-confirm at zero', () => {
		const confirm = vi.fn(() => of({ success: false, message: 'محاولات دفع كثيرة', errorKind: 'RATE_LIMITED', retryEndsAt: Date.now() + 45_000 }));
		const { f, c, el } = mount({ confirm });
		fill(c); c.confirmPayment(); f.detectChanges();
		expect((q(el, '#btn-verify') as HTMLButtonElement).disabled).toBe(true);
		expect(q(el, '[data-testid="confirm-wait"]')!.textContent).toContain('بعد 0:45');
		expect(q(el, '[data-testid="rate-limit-msg"]')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:45');
		expect((q(el, '#btn-resend') as HTMLButtonElement).disabled).toBe(false);
		expect(c.otpValue()).toBe('123456');
		c.confirmPayment(); expect(confirm).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(46_000); f.detectChanges();
		expect((q(el, '#btn-verify') as HTMLButtonElement).disabled).toBe(false);
		expect(confirm).toHaveBeenCalledTimes(1);
	});

	it('resend 429 with a wait disables only resend; with no stated wait the message names no number', () => {
		const withWait = mount({ resend: vi.fn(() => of({ success: false, message: 'x', errorKind: 'RATE_LIMITED', retryEndsAt: Date.now() + 30_000 })) });
		withWait.c.resendOtp(); withWait.f.detectChanges();
		expect((q(withWait.el, '#btn-resend') as HTMLButtonElement).disabled).toBe(true);
		expect(q(withWait.el, '[data-testid="resend-wait"]')!.textContent).toContain('بعد 0:30');
		expect((q(withWait.el, '#btn-verify') as HTMLButtonElement).disabled).toBe(false);
		localStorage.clear();
		const noWait = mount({ resend: vi.fn(() => of({ success: false, message: 'x', errorKind: 'RATE_LIMITED' })) });
		noWait.c.resendOtp(); noWait.f.detectChanges();
		const t = q(noWait.el, '[data-testid="rate-limit-msg"]')!.textContent!;
		expect(t).toContain('بعد قليل'); expect(t).not.toMatch(/\d/);
	});
});
