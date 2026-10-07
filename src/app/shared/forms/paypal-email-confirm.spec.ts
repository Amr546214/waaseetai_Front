import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PaypalEmailConfirmComponent } from './paypal-email-confirm.component';
import { ProviderProfileService } from '../../core/services/provider-profile.service';

// Finance #33: the e-mailed code confirms a new PayPal email; a wrong code shows the backend's Arabic message and nothing is confirmed.
describe('PaypalEmailConfirmComponent', () => {
	const make = (api: any) => {
		TestBed.configureTestingModule({ providers: [{ provide: ProviderProfileService, useValue: api }] });
		const f = TestBed.createComponent(PaypalEmailConfirmComponent);
		f.componentRef.setInput('email', 'new@paypal.example');
		const confirmed = vi.fn();
		f.componentInstance.confirmed.subscribe(confirmed);
		f.detectChanges();
		return { f, c: f.componentInstance, confirmed };
	};

	it('the right code confirms and emits the saved email; the button needs 6 digits', () => {
		const api = { confirmPaypalEmailChange: vi.fn(() => of({ paypalPayoutEmail: 'new@paypal.example' })), requestPaypalEmailChange: vi.fn() };
		const { c, confirmed } = make(api);
		c.code.set('123'); c.confirm();
		expect(api.confirmPaypalEmailChange).not.toHaveBeenCalled();
		c.code.set('123456'); c.confirm();
		expect(api.confirmPaypalEmailChange).toHaveBeenCalledWith('123456');
		expect(confirmed).toHaveBeenCalledWith('new@paypal.example');
	});

	it('a wrong code: the backend Arabic message is shown and nothing is emitted', () => {
		const err = { status: 400, error: { success: false, message: 'رمز التحقق غير صحيح' } };
		const api = { confirmPaypalEmailChange: vi.fn(() => throwError(() => err)), requestPaypalEmailChange: vi.fn() };
		const { c, confirmed } = make(api);
		c.code.set('000000'); c.confirm();
		expect(c.error()).toContain('رمز التحقق غير صحيح');
		expect(confirmed).not.toHaveBeenCalled();
	});

	it('resend asks for a new code for the same pending email', () => {
		const api = { confirmPaypalEmailChange: vi.fn(), requestPaypalEmailChange: vi.fn(() => of({ emailSent: true, emailHint: 'x' })) };
		const { c } = make(api);
		c.resend();
		expect(api.requestPaypalEmailChange).toHaveBeenCalledWith('new@paypal.example');
		expect(c.notice()).toContain('أرسلنا رمزًا جديدًا');
	});
});
