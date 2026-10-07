import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp/verify-otp';
import { RestPassword } from './rest-password/rest-password';
import { AuthStore } from '../../core/store/auth.store';
import { AuthApiService } from '../../core/services/auth-api.service';

// #23 — a full code pasted into any of the six OTP boxes fills every box (digits only, Arabic-Indic digits normalised, extra characters
// and spaces ignored, more than six digits truncated).
const paste = (text: string) => ({ preventDefault: vi.fn(), clipboardData: { getData: () => text } }) as any;
const CASES: [string, string][] = [['123456', '123456'], [' 123 456 ', '123456'], ['١٢٣٤٥٦', '123456'], ['12-34-56', '123456'], ['123456789', '123456'], ['code: 654321.', '654321']];

describe('OTP boxes: full paste (#23)', () => {
	afterEach(() => TestBed.resetTestingModule());

	describe('verify-otp', () => {
		function make() {
			TestBed.configureTestingModule({
				imports: [VerifyOtp],
				providers: [provideRouter([]),
					{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1', pendingEmail: () => 'a@b.co', pendingRole: () => null, pendingAccountType: () => null } },
					{ provide: AuthApiService, useValue: { verifyOtp: vi.fn(), resendOtp: vi.fn() } }],
			});
			const fixture = TestBed.createComponent(VerifyOtp);
			fixture.detectChanges();
			return fixture.componentInstance as any;
		}
		for (const [input, expected] of CASES) {
			it(`pasting "${input}" fills the six boxes with ${expected}`, () => {
				const c = make();
				const ev = paste(input);
				c.onOtpPaste(ev);
				expect(ev.preventDefault).toHaveBeenCalled();
				expect([0, 1, 2, 3, 4, 5].map(i => c.otpDigit(i)).join('')).toBe(expected);
				expect(c.otpCtrl.value).toBe(expected);
			});
		}
		it('pasting text with no digits changes nothing', () => {
			const c = make();
			c.onOtpPaste(paste('abc'));
			expect(c.otpCtrl.value).toBe('');
		});
	});

	describe('rest-password', () => {
		function make() {
			TestBed.configureTestingModule({ imports: [RestPassword], providers: [provideRouter([]), { provide: AuthApiService, useValue: { forgotPassword: vi.fn(), verifyResetCode: vi.fn(), resetPassword: vi.fn() } }] });
			const fixture = TestBed.createComponent(RestPassword);
			fixture.detectChanges();
			return fixture.componentInstance as any;
		}
		for (const [input, expected] of CASES) {
			it(`pasting "${input}" fills the six boxes with ${expected}`, () => {
				const c = make();
				c.onOtpPaste(paste(input));
				expect([0, 1, 2, 3, 4, 5].map(i => c.otpDigit(i)).join('')).toBe(expected);
			});
		}
	});
});
