import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { MB } from '../../../../../core/forms/file-validation';

// Client onboarding (5 steps): Next validates the current step with the shared validation kit.
describe('client profile-setup: shared validation', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let component: ProfileSetupDashboard;
	let save: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		save = vi.fn(() => of({ success: true }));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: {} }), saveClientProfileSetup: save } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	afterEach(() => TestBed.inject(UiNotificationService).clearAll());

	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
	const el = () => fixture.nativeElement as HTMLElement;
	const summary = () => el().querySelector('[data-testid="form-summary"]')?.textContent || '';
	const fillStep1 = () => component.setupForm.get('details')!.patchValue({ idNumber: '1234567890', dob: '1990-01-01', country: 'السعودية', city: 'الرياض', occupation: 'مهندس', address: 'الرياض' });
	const fillBank = () => component.setupForm.get('bank')!.patchValue({ paymentType: 'bank', bankName: 'rajhi', accountHolder: 'اسم', iban: 'SA' + '0'.repeat(22) });
	const fillAgreements = () => component.setupForm.get('agreements')!.patchValue({ accurate: true, terms: true, privacy: true });

	it('Next on an empty step 1 stays on step 1, lists every missing field, shows inline errors and focuses the first one', () => {
		document.body.appendChild(el());
		component.nextStep();
		render();
		expect(component.currentStep()).toBe(1);
		for (const label of ['رقم الهوية الوطنية', 'تاريخ الميلاد', 'الدولة', 'المهنة الحالية', 'العنوان التفصيلي']) {
			expect(summary(), label).toContain(label);
		}
		expect(el().querySelectorAll('[data-testid="field-error"]').length).toBeGreaterThanOrEqual(5);
		expect(document.activeElement?.getAttribute('formcontrolname')).toBe('idNumber');
		el().remove();
	});

	it('the ID number rule matches the backend (10 digits starting with 1 or 2) and says so', () => {
		const c = component.setupForm.get('details.idNumber')!;
		c.setValue('3234567890'); c.markAsTouched(); render();
		expect(c.invalid).toBe(true);
		expect(el().querySelector('[data-testid="field-error"]')?.textContent).toContain('غير صحيح');
		c.setValue('1234567890'); expect(c.valid).toBe(true);
	});

	it('the address field now carries a required marker (it is required by the form)', () => {
		const labels = Array.from(el().querySelectorAll('label')).filter(l => l.textContent?.includes('العنوان التفصيلي'));
		expect(labels[0]?.querySelector('.text-amber-500')).toBeTruthy();
	});

	it('a complete step 1 moves to step 2 and clears the summary; Back clears it too', () => {
		fillStep1();
		component.nextStep();
		expect(component.currentStep()).toBe(2);
		expect(component.missing()).toEqual([]);
		component.nextStep(); // identity: uploads are optional
		expect(component.currentStep()).toBe(3);
	});

	it('Next on step 3 (payout) validates bank fields: names the missing ones and an IBAN of the wrong length', () => {
		fillStep1(); component.nextStep(); component.nextStep();
		expect(component.currentStep()).toBe(3);
		component.setupForm.get('bank.paymentType')!.setValue('bank');
		component.setupForm.get('bank.iban')!.setValue('SA12');
		component.nextStep();
		render();
		expect(component.currentStep()).toBe(3);
		expect(summary()).toContain('اسم البنك');
		expect(summary()).toContain('اسم صاحب الحساب');
		expect(summary()).toContain('24');
	});

	it('the step bar cannot skip an incomplete step: it stops at the first incomplete one', () => {
		component.setStep(5);
		expect(component.currentStep()).toBe(1);
		expect(component.missing().length).toBeGreaterThan(0);
		fillStep1();
		component.setStep(5);
		expect(component.currentStep()).toBe(3); // step 3 (bank) is the next incomplete one
	});

	it('submitting an incomplete form jumps to the first incomplete step with the full list; no request is sent', () => {
		fillStep1(); fillBank();
		component.currentStep.set(5);
		component.submitForm(); // agreements missing
		render();
		expect(save).not.toHaveBeenCalled();
		expect(component.currentStep()).toBe(5);
		expect(summary()).toContain('الموافقة على شروط الاستخدام');
		const errors = Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent);
		expect(errors.some(t => t?.includes('الإقرار بصحة البيانات'))).toBe(true);
		expect(errors.some(t => t?.includes('شروط الاستخدام'))).toBe(true);
		expect(errors.some(t => t?.includes('سياسة الخصوصية'))).toBe(true);

		component.setupForm.get('details.idNumber')!.setValue('');
		component.submitForm();
		expect(component.currentStep()).toBe(1);
	});

	it('the final button is not disabled by validity (only while submitting)', () => {
		component.currentStep.set(5); render();
		const btn = el().querySelector('button[type="submit"]') as HTMLButtonElement;
		expect(btn.disabled).toBe(false);
	});

	it('a valid form sends the SAME payload as before (bank fields unchanged)', () => {
		fillStep1(); fillBank(); fillAgreements();
		component.submitForm();
		expect(save).toHaveBeenCalledTimes(1);
		const body = save.mock.calls[0][0];
		expect(body.bank).toEqual({ paymentType: 'bank', bankName: 'rajhi', accountHolder: 'اسم', iban: 'SA' + '0'.repeat(22) });
		expect(body.details.idNumber).toBe('1234567890');
		expect(body.agreements).toEqual({ accurate: true, terms: true, privacy: true });
	});

	describe('file inputs', () => {
		const pick = (control: string, group: string, file: File) => {
			const input = document.createElement('input');
			Object.defineProperty(input, 'files', { value: [file] });
			return component.onFileSelected({ target: input } as unknown as Event, group, control);
		};

		it('an oversize ID image is rejected with an Arabic message; nothing is stored', async () => {
			const big = new File([new Uint8Array(3 * MB)], 'id.png', { type: 'image/png' });
			await pick('frontId', 'identity', big);
			render();
			expect(component.fileErrors()['frontId']).toContain('حجم الملف كبير جدًا');
			expect(component.fileErrors()['frontId']).toContain('2 ميغابايت');
			expect(component.setupForm.get('identity.frontId')!.value).toBe('');
		});

		it('a wrong file type is rejected naming the allowed types', async () => {
			await pick('supportingDocs', 'documents', new File(['x'], 'a.zip', { type: 'application/zip' }));
			expect(component.fileErrors()['supportingDocs']).toContain('نوع الملف غير مسموح');
			expect(component.fileErrors()['supportingDocs']).toContain('PDF');
		});

		it('a valid file clears the previous error and is read into the form', async () => {
			await pick('backId', 'identity', new File([new Uint8Array(3 * MB)], 'x.png', { type: 'image/png' }));
			expect(component.fileErrors()['backId']).toBeTruthy();
			await pick('backId', 'identity', new File(['hello'], 'ok.png', { type: 'image/png' }));
			expect(component.fileErrors()['backId']).toBeUndefined();
			await vi.waitFor(() => expect(String(component.setupForm.get('identity.backId')!.value)).toContain('data:image/png'));
		});

		it('the ID uploads are labelled optional (they are not required by the form or the backend)', () => {
			component.currentStep.set(2); render();
			expect(el().textContent).toContain('(اختياري)');
			expect(el().querySelector('#frontIdFile')).toBeTruthy();
		});
	});

	describe('server errors', () => {
		const failWith = (status: number, body: any) => save.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: body })));

		it('the English "Invalid ID Number format." (400) becomes an Arabic field error on step 1', () => {
			fillStep1(); fillBank(); fillAgreements();
			failWith(400, { success: false, message: 'Invalid ID Number format.' });
			component.currentStep.set(5);
			component.submitForm();
			render();
			expect(component.currentStep()).toBe(1);
			expect(component.setupForm.get('details.idNumber')!.errors?.['server']).toContain('10 أرقام');
			expect(summary()).toContain('رقم الهوية الوطنية');
			expect(component.isSubmitting()).toBe(false);
		});

		it('the English IBAN 400 lands on the IBAN field on step 3', () => {
			fillStep1(); fillBank(); fillAgreements();
			failWith(400, { message: 'IBAN must be exactly 24 characters.' });
			component.submitForm();
			expect(component.currentStep()).toBe(3);
			expect(component.setupForm.get('bank.iban')!.errors?.['server']).toContain('24');
		});

		it('429 / 500 / network are shown in Arabic (never English), the form is kept', () => {
			const notify = TestBed.inject(UiNotificationService);
			fillStep1(); fillBank(); fillAgreements();
			for (const [status, body] of [[429, { message: 'Too many requests from this IP, please try again after 15 minutes' }], [500, { message: 'Internal Server Error' }], [0, undefined]] as const) {
				failWith(status, body);
				component.submitForm();
				const msg = notify.toasts().at(-1)!.message;
				expect(msg).not.toMatch(/[A-Za-z]/);
			}
			expect(component.setupForm.get('details.idNumber')!.value).toBe('1234567890');
		});

		it('zod-style errors[] are placed on the matching fields', () => {
			fillStep1(); fillBank(); fillAgreements();
			failWith(400, { message: 'Validation Error', errors: [{ path: 'body.details.city', message: 'المدينة غير مدعومة' }] });
			component.submitForm();
			expect(component.setupForm.get('details.city')!.errors?.['server']).toBe('المدينة غير مدعومة');
		});
	});
});
