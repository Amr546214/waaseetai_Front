import { installMemoryStorage } from '../../../../../core/wait/memory-storage.testkit';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EscrowDeposit } from './escrow-deposit';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';
import { ThemeService } from '../../../../../core/services/theme.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

// Funding the escrow: the amount is the frozen contract's price, an unready contract shows no pay button, the code errors live INSIDE the code dialog
// (never a browser alert), a double submit pays once, and the success overlay appears only after the server confirmed the funding.
const CONTRACT = (o: Record<string, unknown> = {}) => ({ success: true, data: { requestId: 'req-1', title: 'مشروع الهوية', state: 'ready', ready: true, price: 1500, durationDays: 21, otpTtlSeconds: 600, ...o } });
const SIGNED = { success: true, data: { email: 'client@example.com', expiresInSeconds: 600 } };

let restoreStorage: () => void = () => undefined;
beforeEach(() => { restoreStorage = installMemoryStorage(); });
afterEach(() => restoreStorage());

describe('client escrow deposit page', () => {
	async function setup(o: { contract?: any; contractError?: any; wallet?: number; sign?: any; deposit?: any } = {}) {
		const post = vi.fn((url: string, _body: any) => (url.endsWith('/contract/sign') ? (o.sign ?? of(SIGNED)) : (o.deposit ?? of({ success: true }))));
		const get = vi.fn((_url: string) => o.contractError ? throwError(() => o.contractError) : of(o.contract ?? CONTRACT()));
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
		await TestBed.configureTestingModule({ imports: [EscrowDeposit], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get, post } },
			{ provide: ClientFinanceService, useValue: { getWallet: () => of({ data: { summary: { availableBalance: o.wallet ?? 5000 } } }) } },
			{ provide: ThemeService, useValue: {} },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: AccountType.CLIENT_INDIVIDUAL }) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'req-1' }), queryParamMap: convertToParamMap({ offerId: 'offer-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(EscrowDeposit); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const text = () => (el.ownerDocument.body.textContent || '').replace(/\s+/g, ' ');
		const q = (id: string) => el.ownerDocument.body.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
		return { f, c: f.componentInstance, el, get, post, alertSpy, text, q };
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('the amount to fund is the contract price from the contract endpoint', async () => {
		const s = await setup();
		expect(s.get.mock.calls[0][0]).toContain('/client/my-requests/req-1/contract?offerId=offer-1');
		expect(s.c.totalAmount()).toBe(1500);
		expect(s.text()).toContain('1,500.00 USD');
		expect(s.text()).toContain('21 يوم');
	});

	it('a contract that is not ready shows the reason and NO pay button / payment form', async () => {
		const s = await setup({ contract: CONTRACT({ state: 'awaiting_provider', ready: false, message: 'وقّعت هذا العقد وأودعت الضمان، وبانتظار توقيع مقدم الخدمة.' }) });
		expect(s.q('ed-blocked-reason')!.textContent).toContain('وقّعت هذا العقد');
		expect(s.q('ed-pay')).toBeNull();
		expect(s.text()).not.toContain('تفاصيل مبلغ الضمان');
	});

	it('a request that is not the client\'s (404) is blocked with the server message', async () => {
		const s = await setup({ contractError: { status: 404, error: { message: 'طلب المشروع غير موجود أو لا تملك صلاحية الوصول إليه' } } });
		expect(s.q('ed-blocked-reason')!.textContent).toContain('لا تملك صلاحية الوصول');
		expect(s.q('ed-pay')).toBeNull();
	});

	it('a server failure shows a retry state (nothing was charged) and no pay button', async () => {
		const s = await setup({ contractError: { status: 500 } });
		expect(s.q('ed-error')!.textContent).toContain('لم يُخصم أي مبلغ');
		expect(s.q('ed-pay')).toBeNull();
	});

	it('insufficient balance: the exact shortfall is shown and paying opens the top-up, never the code step (no code is requested)', async () => {
		const s = await setup({ wallet: 400 });
		expect(s.text()).toContain('الرصيد غير كافٍ');
		expect(s.c.shortfall()).toBe(1100);
		s.c.toggleTerms(); s.c.handlePrimaryAction();
		expect(s.c.showWalletDeposit()).toBe(true);
		expect(s.c.showOtpModal()).toBe(false);
		expect(s.post).not.toHaveBeenCalled();
	});

	it('the code dialog opens only after the code e-mail was really sent, shows the masked address and the server\'s validity', async () => {
		const s = await setup();
		s.c.toggleTerms(); s.c.handlePrimaryAction(); s.f.detectChanges();
		expect(s.post.mock.calls[0][0]).toContain('/client/my-requests/req-1/contract/sign');
		expect(s.c.showOtpModal()).toBe(true);
		expect(s.text()).toContain('c***t@example.com');
		expect(s.q('ed-otp-timer')!.textContent).toContain('10:00');
		expect(s.text()).not.toContain('30 ثانية');
	});

	it('when the code cannot be sent the dialog never opens and the reason is shown', async () => {
		const s = await setup({ sign: throwError(() => ({ status: 503, error: { message: 'تعذر إرسال رمز التوقيع. لم يتم تنفيذ أي توقيع أو حجز' } })) });
		s.c.toggleTerms(); s.c.handlePrimaryAction(); s.f.detectChanges();
		expect(s.c.showOtpModal()).toBe(false);
		expect(s.c.formError()).toContain('لم يتم تنفيذ أي توقيع');
		expect(s.text()).toContain('لم يتم تنفيذ أي توقيع');
	});

	async function openDialog(s: Awaited<ReturnType<typeof setup>>) {
		s.c.toggleTerms(); s.c.handlePrimaryAction(); s.f.detectChanges();
	}

	it('a wrong code is shown INSIDE the dialog with the server message, the boxes are cleared, and no browser alert is used', async () => {
		const s = await setup({ deposit: throwError(() => ({ status: 400, error: { message: 'رمز التحقق غير صحيح. المحاولات المتبقية: 4' } })) });
		await openDialog(s);
		s.c.otpValues.set(['1', '2', '3', '4', '5', '6']);
		s.c.confirmDeposit(); s.f.detectChanges();
		expect(s.q('ed-otp-error')!.textContent).toContain('المحاولات المتبقية: 4');
		expect(s.c.otpValues().join('')).toBe('');
		expect(s.c.showOtpModal()).toBe(true);
		expect(s.c.showSuccessOverlay()).toBe(false);
		expect(s.alertSpy).not.toHaveBeenCalled();
	});

	it('an incomplete code is a message inside the dialog and sends nothing', async () => {
		const s = await setup();
		await openDialog(s);
		s.post.mockClear();
		s.c.otpValues.set(['1', '2', '', '', '', '']);
		s.c.confirmDeposit(); s.f.detectChanges();
		expect(s.q('ed-otp-error')!.textContent).toContain('6 أرقام');
		expect(s.post).not.toHaveBeenCalled();
		expect(s.alertSpy).not.toHaveBeenCalled();
	});

	it('an expired code (countdown reached zero) asks for a new one and sends nothing', async () => {
		const s = await setup();
		await openDialog(s);
		s.post.mockClear();
		s.c.validityWait.clear();
		s.c.otpValues.set(['1', '2', '3', '4', '5', '6']);
		s.c.confirmDeposit(); s.f.detectChanges();
		expect(s.q('ed-otp-error')!.textContent).toContain('انتهت صلاحية الرمز');
		expect(s.post).not.toHaveBeenCalled();
	});

	it('double submit: a second confirm while the first is in flight sends no second payment', async () => {
		const pending = new Subject<any>();
		const s = await setup({ deposit: pending });
		await openDialog(s);
		s.post.mockClear();
		s.c.otpValues.set(['1', '2', '3', '4', '5', '6']);
		s.c.confirmDeposit(); s.c.confirmDeposit(); s.c.confirmDeposit();
		expect(s.post).toHaveBeenCalledTimes(1);
		expect(s.post.mock.calls[0][0]).toContain('/escrow/deposit');
		expect(s.post.mock.calls[0][1]).toEqual({ offerId: 'offer-1', otpCode: '123456', paymentMethod: 'wallet' });
		pending.next({ success: true }); pending.complete(); s.f.detectChanges();
		expect(s.c.showSuccessOverlay()).toBe(true);
	});

	it('success: the overlay appears only after the server confirmed, with the real amount and an honest next step', async () => {
		const s = await setup();
		await openDialog(s);
		expect(s.c.showSuccessOverlay()).toBe(false);
		s.c.otpValues.set(['1', '2', '3', '4', '5', '6']);
		s.c.confirmDeposit(); s.f.detectChanges();
		expect(s.c.showSuccessOverlay()).toBe(true);
		expect(s.text()).toContain('تم إيداع الضمان بنجاح');
		expect(s.text()).toContain('بعد توقيع مقدم الخدمة للعقد');
	});

	it('402 (the wallet changed meanwhile): the dialog closes, the shortfall message says nothing was charged, no success', async () => {
		const s = await setup({ deposit: throwError(() => ({ status: 402, error: { message: 'رصيد المحفظة غير كافٍ لتمويل الضمان' } })) });
		await openDialog(s);
		s.c.otpValues.set(['1', '2', '3', '4', '5', '6']);
		s.c.confirmDeposit(); s.f.detectChanges();
		expect(s.c.showOtpModal()).toBe(false);
		expect(s.c.showSuccessOverlay()).toBe(false);
		expect(s.c.formError()).toContain('لم يُخصم أي مبلغ');
	});

	it('409 (already signed and funded, e.g. a second tab): blocked message, no success overlay, no second charge', async () => {
		const s = await setup({ deposit: throwError(() => ({ status: 409, error: { message: 'العقد غير جاهز لتوقيع العميل أو تم توقيعه مسبقاً' } })) });
		await openDialog(s);
		s.c.otpValues.set(['1', '2', '3', '4', '5', '6']);
		s.c.confirmDeposit(); s.f.detectChanges();
		expect(s.c.showSuccessOverlay()).toBe(false);
		expect(s.q('ed-blocked-reason')!.textContent).toContain('تم توقيعه مسبقاً');
	});

	it('resend: a failure (e.g. too many requests) is shown inside the dialog, a success says a new code was sent', async () => {
		const s = await setup();
		await openDialog(s);
		s.post.mockImplementationOnce(() => throwError(() => ({ status: 429, error: { message: 'طلبات رمز التوقيع كثيرة. انتظر دقيقة ثم حاول مجدداً' } })));
		s.c.resetOTP(); s.f.detectChanges();
		// countdown batch: a 429 that states no duration is an honest «بعد قليل» (no seconds invented), not a timer; resend stays usable
		expect(s.q('ed-otp-error')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد قليل');
		expect(s.q('ed-otp-error')!.textContent).not.toMatch(/\d/);
		s.c.resetOTP(); s.f.detectChanges();
		expect(s.q('ed-otp-notice')!.textContent).toContain('رمز جديد');
	});

	it('no browser alert(), no PayPal wording on the wallet funding step, and the terms button is a real link', () => {
		const ts = readFileSync(join(__dirname, 'escrow-deposit.ts'), 'utf8');
		const html = readFileSync(join(__dirname, 'escrow-deposit.html'), 'utf8');
		expect(ts).not.toMatch(/\balert\(/);
		expect(html).not.toContain('PayPal');
		expect(html).not.toContain('ERR-SK-008');
		expect(html).toContain('<a routerLink="/terms" target="_blank"');
	});

	describe('countdown (end timestamps from the server)', () => {
		beforeEach(() => { localStorage.clear(); });
		afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
		const e429 = (retryAfter: string | null, body: any = { message: 'x' }) => ({ status: 429, headers: { get: (k: string) => (k === 'Retry-After' ? retryAfter : null) }, error: body });

		it('validity comes from expiresAt: ticks per second, expires, and returns correctly after the tab sleeps', async () => {
			vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
			const s = await setup({ sign: of({ success: true, data: { email: 'client@example.com', expiresAt: new Date(Date.now() + 90_000).toISOString() } }) });
			await openDialog(s);
			expect(s.q('ed-otp-timer')!.textContent).toContain('1:30');
			vi.advanceTimersByTime(2000); s.f.detectChanges();
			expect(s.q('ed-otp-timer')!.textContent).toContain('1:28');
			vi.setSystemTime(Date.now() + 80_000); window.dispatchEvent(new Event('focus')); s.f.detectChanges();
			expect(s.q('ed-otp-timer')!.textContent).toContain('0:08');
			vi.advanceTimersByTime(9000); s.f.detectChanges();
			expect(s.q('ed-otp-timer')!.textContent).toContain('انتهت صلاحية الرمز');
		});

		it('the server gave no validity at all: no timer and no guessed 10 minutes; confirm is not blocked by a fake expiry', async () => {
			const s = await setup({ sign: of({ success: true, data: { email: 'client@example.com' } }) });
			await openDialog(s);
			expect(s.q('ed-otp-timer')!.textContent!.trim()).toBe('');
			s.post.mockClear(); s.c.otpValues.set(['1', '2', '3', '4', '5', '6']); s.c.confirmDeposit();
			expect(s.post).toHaveBeenCalledTimes(1);
		});

		it('send 429 (Retry-After seconds) disables the pay button with «بعد m:ss», sends nothing at zero, and a refresh keeps the wait', async () => {
			vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
			const s = await setup({ sign: throwError(() => e429('50', { message: 'طلبات رمز التوقيع كثيرة. انتظر دقيقة ثم حاول مجدداً' })) });
			s.c.toggleTerms(); s.c.handlePrimaryAction(); s.f.detectChanges();
			expect(s.c.showOtpModal()).toBe(false);
			expect((s.q('ed-pay') as HTMLButtonElement).disabled).toBe(true);
			expect(s.q('ed-send-wait')!.textContent).toContain('بعد 0:50');
			const n = s.post.mock.calls.length;
			s.c.handlePrimaryAction(); expect(s.post.mock.calls.length).toBe(n);
			vi.advanceTimersByTime(20_000);
			TestBed.resetTestingModule();
			const s2 = await setup();
			expect(s2.c.sendWait.remainingSeconds()).toBe(30);
			expect((s2.q('ed-pay') as HTMLButtonElement).disabled).toBe(true);
			vi.advanceTimersByTime(31_000); s2.f.detectChanges();
			expect((s2.q('ed-pay') as HTMLButtonElement).disabled).toBe(false);
			expect(s2.post).not.toHaveBeenCalled();
		});

		it('deposit 429 with a wait: confirm disabled with the label, digits kept, dialog stays open, nothing re-sent at zero; a 429 is never "wrong code"', async () => {
			vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
			const s = await setup({ deposit: throwError(() => e429(null, { message: 'محاولات دفع كثيرة', retryAfterSeconds: 40 })) });
			await openDialog(s);
			s.c.otpValues.set(['1', '2', '3', '4', '5', '6']); s.post.mockClear();
			s.c.confirmDeposit(); s.f.detectChanges();
			expect(s.post).toHaveBeenCalledTimes(1);
			expect((s.q('ed-otp-confirm') as HTMLButtonElement).disabled).toBe(true);
			expect(s.q('ed-confirm-wait')!.textContent).toContain('بعد 0:40');
			expect(s.q('ed-rate-limit')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:40');
			expect(s.q('ed-otp-error')).toBeNull();
			expect(s.c.otpValues().join('')).toBe('123456');
			expect(s.c.showOtpModal()).toBe(true);
			vi.advanceTimersByTime(41_000); s.f.detectChanges();
			expect((s.q('ed-otp-confirm') as HTMLButtonElement).disabled).toBe(false);
			expect(s.post).toHaveBeenCalledTimes(1);
		});

		it('timers stop when the page is destroyed (no interval left)', async () => {
			vi.useFakeTimers();
			const s = await setup({ sign: of({ success: true, data: { email: 'client@example.com', expiresInSeconds: 600 } }) });
			await openDialog(s);
			const svc: any = TestBed.inject((s.c as any).waits.constructor);
			expect(svc.activeIntervals).toBe(1);
			s.f.destroy();
			expect(svc.activeIntervals).toBe(0);
		});
	});
});
