import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Provider payout tab: "إضافة" when no PayPal email is saved, "تغيير" when one exists; the OTP panel opens only when the server confirms the mail was
// sent, and it names the (masked) ACCOUNT email, never the PayPal address.
const BASE = {
	headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
	user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: null },
	certUrls: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [], completionPercentage: 100, missingItems: [],
};

describe('provider payout tab: add vs change + OTP delivery', () => {
	let fixture: ComponentFixture<Data>;
	let component: Data;
	let request: ReturnType<typeof vi.fn>;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (s: string) => el().querySelector(s) as HTMLElement | null;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

	function setup(paypal: string | null, requestImpl: () => any) {
		request = vi.fn(requestImpl);
		TestBed.configureTestingModule({
			imports: [Data],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProviderProfileService, useValue: {
					getProfile: () => of({ ...BASE, paypalPayoutEmail: paypal }), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])),
					requestPaypalEmailChange: request, confirmPaypalEmailChange: vi.fn(() => of({ paypalPayoutEmail: 'x@paypal.example' })),
				} }],
		});
		fixture = TestBed.createComponent(Data); component = fixture.componentInstance; fixture.detectChanges(); render();
	}
	const clickChange = (email: string) => {
		component.payoutForm.patchValue({ paypalPayoutEmail: email });
		(q('#prof-panel-payout .btn-primary') as HTMLButtonElement).click(); render();
	};
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('no PayPal email saved: every label says "إضافة", none says "تغيير"', () => {
		setup(null, () => of({ emailSent: true, emailHint: 'a***@b.co', mode: 'add' }));
		const panel = q('#prof-panel-payout')!;
		expect(panel.querySelector('.btn-primary')!.textContent).toContain('إضافة بريد PayPal');
		expect(panel.textContent).not.toContain('تغيير بريد PayPal');
		expect(panel.textContent).not.toContain('تغييره');
		expect(q('[data-testid="paypal-policy"]')!.textContent).toContain('سنرسل رمز تحقق إلى بريد حسابك لتأكيد إضافة بريد PayPal');
		expect(q('[data-testid="paypal-policy"]')!.textContent).toContain('بعد التأكيد، يتوقف السحب لمدة 24 ساعة لحماية الحساب');
	});

	it('a PayPal email exists: the labels say "تغيير"', () => {
		setup('old@paypal.example', () => of({ emailSent: true, emailHint: 'a***@b.co', mode: 'change' }));
		const panel = q('#prof-panel-payout')!;
		expect(panel.querySelector('.btn-primary')!.textContent).toContain('تغيير بريد PayPal');
		expect(panel.textContent).not.toContain('إضافة بريد PayPal');
		expect(q('[data-testid="paypal-policy"]')!.textContent).toContain('بعد التأكيد، يتوقف السحب لمدة 24 ساعة لحماية الحساب');
	});

	it('server confirms the mail was sent: the OTP panel opens with the six-box input and the masked ACCOUNT email (add wording)', () => {
		setup(null, () => of({ emailSent: true, emailHint: 'o***@example.com', mode: 'add' }));
		clickChange('first@paypal.example');
		expect(q('[data-testid="paypal-confirm"]')).toBeTruthy();
		expect(q('[data-testid="paypal-confirm-title"]')!.textContent).toContain('تأكيد بريد PayPal');
		expect(q('[data-testid="paypal-confirm-sent"]')!.textContent).toContain('أرسلنا رمزًا إلى بريد حسابك: o***@example.com');
		expect(q('[data-testid="paypal-confirm-target"]')!.textContent).toContain('لتأكيد إضافة بريد PayPal');
		expect(q('[data-testid="paypal-confirm-freeze"]')!.textContent).toContain('بعد التأكيد، يتوقف السحب لمدة 24 ساعة لحماية الحساب');
		expect(el().querySelectorAll('ws-otp-input .otp-box').length).toBe(6);
		expect(q('[data-testid="paypal-confirm"] input[maxlength="6"]')).toBeNull(); // the old single plain input is gone
	});

	it('mail failure (503): no OTP panel, no "أرسلنا رمزًا", the user stays on the form with the error', () => {
		setup(null, () => throwError(() => ({ status: 503, error: { success: false, code: 'PAYPAL_OTP_EMAIL_FAILED', message: 'تعذر إرسال رمز التحقق، حاول مرة أخرى' } })));
		clickChange('first@paypal.example');
		expect(q('[data-testid="paypal-confirm"]')).toBeNull();
		expect(q('[data-testid="paypal-request-error"]')!.textContent).toContain('تعذر إرسال رمز التحقق، حاول مرة أخرى');
		expect(el().textContent).not.toContain('أرسلنا رمزًا إلى بريد حسابك');
	});

	it('a reply without emailSent:true never opens the panel', () => {
		setup(null, () => of({ emailSent: false, emailHint: 'a***@b.co' }));
		clickChange('first@paypal.example');
		expect(q('[data-testid="paypal-confirm"]')).toBeNull();
		expect(q('[data-testid="paypal-request-error"]')!.textContent).toContain('تعذر إرسال رمز التحقق');
	});

	it('too many requests (429): the wait message is shown under the button and the panel stays closed', () => {
		setup('old@paypal.example', () => throwError(() => ({ status: 429, error: { success: false, message: 'أرسلنا لك رمزًا قبل قليل. انتظر 45 ثانية قبل طلب رمز جديد.', retryAfterSeconds: 45 } })));
		clickChange('new@paypal.example');
		expect(q('[data-testid="paypal-confirm"]')).toBeNull();
		expect(q('[data-testid="paypal-request-error"]')!.textContent).toContain('انتظر 45 ثانية');
	});

	it('a confirmed ADD flips the page to "change" mode', () => {
		setup(null, () => of({ emailSent: true, emailHint: 'a***@b.co', mode: 'add' }));
		clickChange('first@paypal.example');
		component.onPaypalConfirmed('first@paypal.example'); render();
		expect(q('#prof-panel-payout .btn-primary')!.textContent).toContain('تغيير بريد PayPal');
	});
});
