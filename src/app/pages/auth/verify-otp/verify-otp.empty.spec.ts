import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { VerifyOtp } from './verify-otp';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';

// Confirm with an empty / partial code: a specific Arabic message sits directly UNDER the code boxes (not in a banner at the top), the boxes are red + aria-invalid, nothing is sent.
describe('verify-otp: empty / partial code', () => {
	function mount() {
		const verifyOtp = vi.fn();
		TestBed.configureTestingModule({ imports: [VerifyOtp], providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isPendingVerification: () => true, token: () => null, pendingUserId: () => 'u1' } },
			{ provide: AuthApiService, useValue: { verifyOtp, resendOtp: vi.fn(), isLoginOtpPending: () => true } }] });
		const f = TestBed.createComponent(VerifyOtp);
		f.detectChanges();
		return { f, c: f.componentInstance as any, el: f.nativeElement as HTMLElement, verifyOtp };
	}
	afterEach(() => TestBed.resetTestingModule());
	it('empty and partial: the message follows the code boxes, boxes are invalid, no request', () => {
		const { f, c, el, verifyOtp } = mount();
		for (const code of ['', '123']) {
			c.otpCtrl.setValue(code); c.verify(); f.detectChanges();
			const group = el.querySelector('#otp-group')!;
			const banner = el.querySelector('#banner-error')!;
			expect(banner.textContent).toContain('الرجاء إدخال رمز التحقق المكون من 6 أرقام');
			expect(group.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
			expect(el.querySelector('.otp-box')!.getAttribute('aria-invalid')).toBe('true');
			expect(el.querySelector('.otp-box')!.getAttribute('aria-describedby')).toBe('banner-error');
		}
		expect(verifyOtp).not.toHaveBeenCalled();
	});
});
