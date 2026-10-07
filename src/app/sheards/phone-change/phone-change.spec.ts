import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { PhoneChange, normalizeDigits } from './phone-change';
import { PhoneChangeService } from '../../core/services/phone-change.service';

// #26 UI — change the phone with an email OTP. Messages shown are the backend's Arabic text.
describe('phone change dialog (#26)', () => {
	let fixture: ComponentFixture<PhoneChange>;
	let api: { request: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn> };
	let changed: ReturnType<typeof vi.fn<(v: string) => void>>;

	const setup = (over: Partial<typeof api> = {}) => {
		api = { request: vi.fn(() => of({ emailSent: true, emailHint: 'on***@example.com', expiresInSeconds: 600 })), confirm: vi.fn(() => of({ phoneNumber: '0511111111' })), ...over } as any;
		TestBed.configureTestingModule({ imports: [PhoneChange], providers: [{ provide: PhoneChangeService, useValue: api }] });
		fixture = TestBed.createComponent(PhoneChange);
		changed = vi.fn<(v: string) => void>();
		fixture.componentInstance.changed.subscribe((v: string) => changed(v));
		fixture.detectChanges();
	};
	const c = () => fixture.componentInstance;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const http = (status: number, message: string) => throwError(() => new HttpErrorResponse({ status, error: { message } }));
	const toStep2 = () => { c().show(); c().onPhoneInput('0511111111'); c().sendCode(); fixture.detectChanges(); };
	afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

	it('opens on step 1; the number is digits only (Arabic digits and separators normalised) and "send" is enabled only for 9–15 digits', () => {
		setup();
		expect(q('phone-change-dialog')).toBeNull();
		q('phone-change-open')!.click();
		fixture.detectChanges();
		expect(q('phone-change-dialog')).toBeTruthy();
		expect(normalizeDigits('٠٥١ ١١١-١١١١')).toBe('0511111111');
		c().onPhoneInput('12345'); fixture.detectChanges();
		expect((q('phone-send') as HTMLButtonElement).disabled).toBe(true);
		c().onPhoneInput('٠٥١١١١١١١١'); fixture.detectChanges();
		expect(c().phone()).toBe('0511111111');
		expect((q('phone-send') as HTMLButtonElement).disabled).toBe(false);
	});

	it('send → step 2 explains the code went to the ACCOUNT EMAIL (masked), with a 60 s resend countdown', () => {
		vi.useFakeTimers();
		setup();
		toStep2();
		expect(api.request).toHaveBeenCalledWith('0511111111');
		expect(c().step()).toBe(2);
		expect(q('phone-code-sent')!.textContent).toContain('on***@example.com');
		expect(q('phone-countdown')!.textContent).toContain('60');
		vi.advanceTimersByTime(61_000); fixture.detectChanges();
		expect(q('phone-countdown')).toBeNull();
		expect(q('phone-resend')).toBeTruthy();
		q('phone-resend')!.click();
		expect(api.request).toHaveBeenCalledTimes(2);
	});

	it('confirm with a valid code → success message and the host is told (changed event)', () => {
		setup();
		toStep2();
		c().onCodeInput('12a3456'); fixture.detectChanges();
		expect(c().code()).toBe('123456');
		q('phone-confirm')!.click(); fixture.detectChanges();
		expect(api.confirm).toHaveBeenCalledWith('123456');
		expect(c().step()).toBe(3);
		expect(q('phone-changed')!.textContent).toContain('تم تغيير رقم الجوال');
		expect(changed).toHaveBeenCalledWith('0511111111');
	});

	it('a full code can be pasted', () => {
		setup(); toStep2();
		c().onCodePaste({ preventDefault: vi.fn(), clipboardData: { getData: () => ' ٦٥٤ ٣٢١ ' } } as any);
		expect(c().code()).toBe('654321');
	});

	it('wrong code: the backend message is shown and the user stays on step 2 to retry', () => {
		setup({ confirm: vi.fn(() => http(400, 'رمز التحقق غير صحيح')) as any });
		toStep2(); c().onCodeInput('111111'); c().confirm(); fixture.detectChanges();
		expect(q('phone-error')!.textContent).toContain('رمز التحقق غير صحيح');
		expect(c().step()).toBe(2);
		expect(changed).not.toHaveBeenCalled();
	});

	it('too many attempts (429), expired (400) or a conflicting number (409, generic text): message shown and back to step 1 for a new code', () => {
		for (const [status, message] of [[429, 'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد'], [400, 'انتهت صلاحية رمز التحقق أو لم يُطلب رمز، اطلب رمزًا جديدًا'], [409, 'تعذر حفظ رقم الجوال، تأكد من الرقم أو جرّب رقمًا آخر']] as const) {
			setup({ confirm: vi.fn(() => http(status, message)) as any });
			toStep2(); c().onCodeInput('111111'); c().confirm(); fixture.detectChanges();
			expect(q('phone-error')!.textContent).toContain(message);
			expect(c().step()).toBe(1);
			expect(q('phone-error')!.textContent).not.toMatch(/مسجل|مستخدم بالفعل/);
			TestBed.resetTestingModule();
		}
	});

	it('request failures: the throttle message (429), a mail failure (emailSent false) and an invalid number (400) are shown; no step change', () => {
		setup({ request: vi.fn(() => http(429, 'أرسلنا لك رمزًا قبل قليل. انتظر 45 ثانية قبل طلب رمز جديد.')) as any });
		c().show(); c().onPhoneInput('0511111111'); c().sendCode(); fixture.detectChanges();
		expect(q('phone-error')!.textContent).toContain('انتظر 45 ثانية');
		expect(c().step()).toBe(1);
		TestBed.resetTestingModule();
		setup({ request: vi.fn(() => of({ emailSent: false, emailHint: 'on***@example.com', expiresInSeconds: 600 })) as any });
		c().show(); c().onPhoneInput('0511111111'); c().sendCode(); fixture.detectChanges();
		expect(q('phone-error')!.textContent).toContain('تعذر إرسال رمز التحقق');
		expect(c().step()).toBe(1);
	});

	it('cancel closes the dialog without any request', () => {
		setup(); c().show(); fixture.detectChanges();
		c().close(); fixture.detectChanges();
		expect(q('phone-change-dialog')).toBeNull();
		expect(api.request).not.toHaveBeenCalled();
	});
});
