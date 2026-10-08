import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

// #17 — the backend now enforces the full contract of POST /client/profile/setup (details, identity, documents, agreements [+ bank]) and
// rejects anything but three literal `true` agreements with a 400 that names the fields. The wizard always sends that shape, and a failure is visible.
describe('client profile-setup: backend contract (#17)', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let component: ProfileSetupDashboard;
	let save: ReturnType<typeof vi.fn>;
	let notify: UiNotificationService;

	const setup = (saveImpl: () => any) => {
		save = vi.fn(saveImpl);
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: {} }), saveClientProfileSetup: save, saveClientSetupStep: vi.fn(() => of({ success: true, data: {} })) } }],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		component = fixture.componentInstance;
		notify = TestBed.inject(UiNotificationService);
		fixture.detectChanges();
		component.setupForm.get('details')!.patchValue({ idNumber: '1234567890', dob: '1990-01-01', country: 'السعودية', city: 'الرياض', occupation: 'مهندس', address: 'الرياض' });
		component.setupForm.get('bank')!.patchValue({ paypalPayoutEmail: 'pay@example.com' });
		component.setupForm.get('agreements')!.patchValue({ accurate: true, terms: true, privacy: true });
	};
	afterEach(() => { notify?.clearAll(); fixture?.destroy(); TestBed.resetTestingModule(); });
	const httpErr = (status: number, error: any) => throwError(() => new HttpErrorResponse({ status, error }));

	it('sends all objects (details, identity, bank, documents, agreements) and the three agreements as literal true', () => {
		setup(() => of({ success: true }));
		component.submitForm();
		expect(save).toHaveBeenCalledTimes(1);
		const body = save.mock.calls[0][0];
		for (const key of ['details', 'identity', 'bank', 'documents', 'agreements']) expect(body[key], key).toBeTruthy();
		expect(body.agreements).toEqual({ accurate: true, terms: true, privacy: true });
		expect(body.agreements.accurate).toBe(true);
		expect(body.details.idNumber).toBe('1234567890');
		expect(body.bank).toEqual({ paymentType: 'paypal', paypalPayoutEmail: 'pay@example.com' });
	});

	it('the three agreements cannot be left unchecked: submit is blocked client-side and nothing is sent', () => {
		setup(() => of({ success: true }));
		component.setupForm.get('agreements')!.patchValue({ terms: false });
		component.submitForm();
		expect(save).not.toHaveBeenCalled();
	});

	it('a 400 from the backend about an agreement is shown to the user in Arabic', () => {
		setup(() => httpErr(400, { success: false, message: 'بيانات غير صحيحة، يرجى مراجعة الحقول المحددة', errors: [{ path: 'agreements.terms', field: 'agreements.terms', message: 'يجب الموافقة على الشروط والأحكام' }] }));
		component.submitForm();
		const shown = notify.toasts().map(t => t.message).join(' | ');
		expect(shown).toContain('يجب الموافقة على الشروط والأحكام');
		expect(component.isSubmitting()).toBe(false);
	});

	it('a 400 about the id number puts the Arabic message on that field and returns to step 1', () => {
		setup(() => httpErr(400, { success: false, message: 'بيانات غير صحيحة', errors: [{ path: 'details.idNumber', field: 'details.idNumber', message: 'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2' }] }));
		component.currentStep.set(5);
		component.submitForm();
		return new Promise<void>(resolve => setTimeout(() => {
			expect(component.currentStep()).toBe(1);
			expect(component.setupForm.get('details.idNumber')!.errors?.['server']).toContain('رقم الهوية');
			resolve();
		}, 50));
	});

	it('several rejected fields show the generic Arabic "fix the marked fields" message', () => {
		setup(() => httpErr(400, { success: false, message: 'x', errors: [{ field: 'details.city', message: 'a' }, { field: 'details.address', message: 'b' }] }));
		component.submitForm();
		expect(notify.toasts().map(t => t.message).join('|')).toContain('يرجى تصحيح الحقول المحددة');
	});

	it('a 413 shows the Arabic size message (even when the body is a proxy page)', () => {
		setup(() => httpErr(413, '<html>413</html>'));
		component.submitForm();
		expect(notify.toasts().map(t => t.message).join('|')).toContain('أكبر من الحد المسموح');
	});
});
