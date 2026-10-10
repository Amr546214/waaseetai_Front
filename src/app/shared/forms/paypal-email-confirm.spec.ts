import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PaypalEmailConfirmComponent } from './paypal-email-confirm.component';
import { ProviderProfileService } from '../../core/services/provider-profile.service';

// The e-mailed code confirms a PayPal email: standard six-box OTP UI, masked ACCOUNT email, inline errors, resend cooldown on 429.
describe('PaypalEmailConfirmComponent', () => {
	const make = (api: any, inputs: Record<string, unknown> = {}) => {
		TestBed.configureTestingModule({ providers: [{ provide: ProviderProfileService, useValue: api }] });
		const f = TestBed.createComponent(PaypalEmailConfirmComponent);
		f.componentRef.setInput('email', 'new@paypal.example');
		for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
		const confirmed = vi.fn();
		f.componentInstance.confirmed.subscribe(confirmed);
		f.detectChanges();
		return { f, c: f.componentInstance, confirmed, el: f.nativeElement as HTMLElement };
	};
	afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

	it('renders the standard six-box OTP input (LTR digits) and no plain single input', () => {
		const { el } = make({});
		expect(el.querySelectorAll('ws-otp-input .otp-box').length).toBe(6);
		expect(el.querySelector('[data-testid="otp-group"]')!.getAttribute('dir')).toBe('ltr');
		expect(el.querySelector('input[maxlength="6"]')).toBeNull();
	});

	it('names the masked ACCOUNT email, add vs change wording, and the 24h freeze', () => {
		const add = make({}, { mode: 'add', accountEmailHint: 'a***@domain.com' });
		expect(add.el.querySelector('[data-testid="paypal-confirm-title"]')!.textContent).toContain('تأكيد بريد PayPal');
		expect(add.el.querySelector('[data-testid="paypal-confirm-sent"]')!.textContent).toContain('أرسلنا رمزًا إلى بريد حسابك: a***@domain.com');
		expect(add.el.querySelector('[data-testid="paypal-confirm-target"]')!.textContent).toContain('لتأكيد إضافة بريد PayPal');
		expect(add.el.querySelector('[data-testid="paypal-confirm-target"]')!.textContent).not.toContain('تغيير');
		expect(add.el.querySelector('[data-testid="paypal-confirm-freeze"]')!.textContent).toContain('بعد التأكيد، يتوقف السحب لمدة 24 ساعة لحماية الحساب');
		TestBed.resetTestingModule();
		const change = make({}, { mode: 'change', accountEmailHint: 'a***@domain.com' });
		expect(change.el.querySelector('[data-testid="paypal-confirm-target"]')!.textContent).toContain('لتأكيد تغيير بريد PayPal إلى');
	});

	it('typing six digits fills the boxes, enables the button, and confirm emits the saved email', () => {
		const api = { confirmPaypalEmailChange: vi.fn(() => of({ paypalPayoutEmail: 'new@paypal.example' })), requestPaypalEmailChange: vi.fn() };
		const { f, c, confirmed, el } = make(api);
		const boxes = Array.from(el.querySelectorAll('ws-otp-input .otp-box')) as HTMLInputElement[];
		const btn = () => el.querySelector('[data-testid="paypal-confirm-btn"]') as HTMLButtonElement;
		expect(btn().disabled).toBe(true);
		'12345'.split('').forEach((d, i) => { boxes[i].value = d; boxes[i].dispatchEvent(new Event('input')); });
		f.detectChanges();
		expect(btn().disabled).toBe(true);
		expect(c.code()).toBe('12345');
		boxes[5].value = '6'; boxes[5].dispatchEvent(new Event('input'));
		expect(api.confirmPaypalEmailChange).toHaveBeenCalledWith('123456'); // `complete` confirms automatically
		expect(confirmed).toHaveBeenCalledWith('new@paypal.example');
	});

	it('paste fills all six boxes', () => {
		const { f, c, el } = make({ confirmPaypalEmailChange: vi.fn(() => of({ paypalPayoutEmail: 'x' })), requestPaypalEmailChange: vi.fn() });
		const group = el.querySelector('[data-testid="otp-group"]')!;
		const ev = new Event('paste', { cancelable: true }) as any;
		ev.clipboardData = { getData: () => ' 98-76 54 ' };
		group.dispatchEvent(ev);
		f.detectChanges();
		expect(c.code()).toBe('987654');
		expect(Array.from(el.querySelectorAll('ws-otp-input .otp-box')).map(b => (b as HTMLInputElement).value).join('')).toBe('987654');
	});

	it('a wrong or expired code: inline error in the standard OTP style (red boxes), nothing emitted', () => {
		const err = { status: 400, error: { success: false, message: 'رمز التحقق غير صحيح' } };
		const api = { confirmPaypalEmailChange: vi.fn(() => throwError(() => err)), requestPaypalEmailChange: vi.fn() };
		const { f, c, confirmed, el } = make(api);
		c.code.set('000000'); c.confirm(); f.detectChanges();
		expect(el.querySelector('[data-testid="paypal-confirm-error"]')!.textContent).toContain('رمز التحقق غير صحيح');
		expect(el.querySelectorAll('ws-otp-input .otp-box.has-error').length).toBe(6);
		expect(confirmed).not.toHaveBeenCalled();
	});

	it('resend: a new code for the same pending email', () => {
		const api = { confirmPaypalEmailChange: vi.fn(), requestPaypalEmailChange: vi.fn(() => of({ emailSent: true, emailHint: 'x' })) };
		const { c } = make(api);
		c.resend();
		expect(api.requestPaypalEmailChange).toHaveBeenCalledWith('new@paypal.example');
		expect(c.notice()).toContain('أرسلنا رمزًا جديدًا');
	});

	it('resend answered 429: the message and a cooldown (button disabled with the seconds), never silent', () => {
		vi.useFakeTimers();
		const err = { status: 429, error: { success: false, message: 'أرسلنا لك رمزًا قبل قليل. انتظر 30 ثانية قبل طلب رمز جديد.', retryAfterSeconds: 30 } };
		const api = { confirmPaypalEmailChange: vi.fn(), requestPaypalEmailChange: vi.fn(() => throwError(() => err)) };
		const { f, c, el } = make(api);
		c.resend(); f.detectChanges();
		expect(el.querySelector('[data-testid="paypal-confirm-error"]')!.textContent).toContain('انتظر 30 ثانية');
		const resend = el.querySelector('[data-testid="paypal-resend-btn"]') as HTMLButtonElement;
		expect(resend.disabled).toBe(true);
		expect(resend.textContent).toContain('30');
		c.resend();
		expect(api.requestPaypalEmailChange).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(31_000); f.detectChanges();
		expect(c.cooldown()).toBe(0);
		expect((el.querySelector('[data-testid="paypal-resend-btn"]') as HTMLButtonElement).disabled).toBe(false);
	});

	it('resend failing because the mail was not sent shows the controlled error', () => {
		const err = { status: 503, error: { success: false, code: 'PAYPAL_OTP_EMAIL_FAILED', message: 'تعذر إرسال رمز التحقق، حاول مرة أخرى' } };
		const { f, c, el } = make({ confirmPaypalEmailChange: vi.fn(), requestPaypalEmailChange: vi.fn(() => throwError(() => err)) });
		c.resend(); f.detectChanges();
		expect(el.querySelector('[data-testid="paypal-confirm-error"]')!.textContent).toContain('تعذر إرسال رمز التحقق، حاول مرة أخرى');
	});
});
