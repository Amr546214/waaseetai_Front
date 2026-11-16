import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';

// The code opens the dashboard by itself: the sixth digit (typed or pasted) sends it, with no button press.
function mount(verifyOtp: (...a: any[]) => any) {
	TestBed.configureTestingModule({
		imports: [VerifyOtp],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1', currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }) } },
			{ provide: AuthApiService, useValue: { verifyOtp, resendOtp: vi.fn(), isLoginOtpPending: () => true } }],
	});
	const f = TestBed.createComponent(VerifyOtp);
	vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
	f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	const box = (i: number) => el.querySelector(`#otp-${i}`) as HTMLInputElement;
	const type = (digits: string) => { [...digits].forEach((d, i) => { box(i).value = d; box(i).dispatchEvent(new Event('input')); }); f.detectChanges(); };
	return { f, c: f.componentInstance as any, el, box, type };
}
const ok = () => of({ success: true, data: { user: { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' } } });

describe('verify-otp: automatic submit when the code is complete', () => {
	afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

	it('typing the sixth digit sends the code once, with no click', () => {
		const verifyOtp = vi.fn(ok);
		const { type } = mount(verifyOtp);
		type('12345');
		expect(verifyOtp).not.toHaveBeenCalled();
		type('123456');
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		expect(verifyOtp).toHaveBeenCalledWith({ userId: 'u1', code: '123456' });
	});

	it('pasting a full code (also Arabic digits) sends it once', () => {
		const verifyOtp = vi.fn(ok);
		const { f, el } = mount(verifyOtp);
		const paste = new Event('paste', { bubbles: true }) as any;
		paste.clipboardData = { getData: () => '١٢٣٤٥٦' };
		el.querySelector('#otp-group')!.dispatchEvent(paste);
		f.detectChanges();
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		expect(verifyOtp).toHaveBeenCalledWith({ userId: 'u1', code: '123456' });
	});

	it('a partial paste does nothing', () => {
		const verifyOtp = vi.fn(ok);
		const { f, el } = mount(verifyOtp);
		const paste = new Event('paste', { bubbles: true }) as any;
		paste.clipboardData = { getData: () => '1234' };
		el.querySelector('#otp-group')!.dispatchEvent(paste);
		f.detectChanges();
		expect(verifyOtp).not.toHaveBeenCalled();
	});

	it('a wrong code is not re-sent by itself; changing a digit and completing it again sends the new code', () => {
		const verifyOtp = vi.fn(() => throwError(() => ({ status: 400, error: { message: 'رمز غير صحيح' } })));
		const { f, c, box, type } = mount(verifyOtp);
		type('111111'); f.detectChanges();
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		expect(c.errorMsg).not.toBe('');
		// the same code again (e.g. a repeated event) never goes out by itself
		c['autoSubmitWhenComplete']();
		expect(verifyOtp).toHaveBeenCalledTimes(1);
		// the user edits the last digit: the new complete code goes out
		box(5).value = '2'; box(5).dispatchEvent(new Event('input')); f.detectChanges();
		expect(verifyOtp).toHaveBeenCalledTimes(2);
		expect(verifyOtp).toHaveBeenLastCalledWith({ userId: 'u1', code: '111112' });
	});

	it('Enter and the button still work, and a code being verified is never sent twice', () => {
		const verifyOtp = vi.fn(ok);
		const { f, c, type } = mount(verifyOtp);
		type('123456');
		c.verify(); c.verify(); f.detectChanges();
		expect(verifyOtp).toHaveBeenCalledTimes(1);
	});
});
