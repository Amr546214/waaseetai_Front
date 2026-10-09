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

const DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';

// "التالي" stores the step it leaves (database only) and advances only when the save succeeded.
describe('client setup wizard: each Next stores its step', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let c: ProfileSetupDashboard;
	let saveStep: ReturnType<typeof vi.fn>;

	function mount(data: any = {}, stepImpl?: (step: number, body: any) => any) {
		saveStep = vi.fn(stepImpl ?? (() => of({ success: true, data: { completionPercentage: 40 } })));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data }), saveClientProfileSetup: vi.fn(), saveClientSetupStep: saveStep } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		c = fixture.componentInstance;
		fixture.detectChanges();
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); });
	const fill1 = () => c.setupForm.get('details')!.patchValue({ idNumber: '1234567890', dob: '1990-01-01', country: 'السعودية', city: 'الرياض', occupation: 'مهندس', address: 'الرياض' });

	it('step 1 -> Next sends the details to step endpoint 1 and moves to step 2', () => {
		mount(); fill1(); c.nextStep();
		expect(saveStep).toHaveBeenCalledTimes(1);
		const [step, body] = saveStep.mock.calls[0];
		expect(step).toBe(1);
		expect(body.details).toEqual(expect.objectContaining({ idNumber: '1234567890', country: 'السعودية', city: 'الرياض', occupation: 'مهندس', address: 'الرياض' }));
		expect(c.currentStep()).toBe(2);
	});

	it('an invalid step is not sent and does not advance', () => {
		mount(); c.nextStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(1);
	});

	it('a failed save keeps the user on the step and shows the error', () => {
		mount({}, () => throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'رقم الهوية غير صالح', errors: [{ field: 'idNumber', message: 'رقم الهوية غير صالح' }] } })));
		fill1(); c.nextStep();
		expect(saveStep).toHaveBeenCalled();
		expect(c.currentStep()).toBe(1);
		expect(c.isSavingStep()).toBe(false);
	});

	it('step 2 with no new upload sends nothing; step 3 sends the PayPal email; step 4 optional+empty sends nothing', () => {
		mount({ idNumber: '1', paypalPayoutEmail: null }); fill1();
		c.currentStep.set(2); c.nextStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(3);
		c.setupForm.get('bank.paypalPayoutEmail')!.setValue('me@example.com'); c.nextStep();
		expect(saveStep).toHaveBeenCalledWith(3, { paypalPayoutEmail: 'me@example.com' });
		expect(c.currentStep()).toBe(4);
		saveStep.mockClear(); c.nextStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(5);
	});

	it('a new identity upload is sent; an already stored (URL) document is never re-sent', () => {
		mount(); fill1(); c.currentStep.set(2);
		c.setupForm.get('identity')!.patchValue({ frontId: DATA_URI, backId: 'https://res.cloudinary.com/x/back.png' });
		c.nextStep();
		expect(saveStep).toHaveBeenCalledWith(2, { identity: { frontId: DATA_URI, backId: undefined } });
	});

	it('step bar jump forward stores each step on the way and stops at the first failure', () => {
		mount({}, (step: number) => step === 3 ? throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'x' } })) : of({ success: true, data: {} }));
		fill1(); c.currentStep.set(1);
		c.setupForm.get('bank.paypalPayoutEmail')!.setValue('me@example.com');
		c.setStep(5);
		expect(saveStep.mock.calls.map(x => x[0])).toEqual([1, 3]);
		expect(c.currentStep()).toBe(3);
	});

	it('going back needs no request and keeps the typed/prefilled values', () => {
		mount({}); fill1(); c.nextStep(); saveStep.mockClear();
		c.prevStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(1);
		expect(c.setupForm.get('details.idNumber')!.value).toBe('1234567890');
	});

	it('refresh: saved details + PayPal open on step 4, Previous shows the prefilled PayPal', () => {
		mount({ idNumber: '2000000001', dob: '1990-01-01T00:00:00.000Z', country: 'السعودية', city: 'الرياض', industry: 'مهندس', address: 'شارع 1', paypalPayoutEmail: 'p@x.co', completionPercentage: 60 });
		expect(c.currentStep()).toBe(4);
		c.prevStep();
		expect(c.currentStep()).toBe(3);
		expect(c.setupForm.get('bank.paypalPayoutEmail')!.value).toBe('p@x.co');
	});

	it('nothing identity-related is written to browser storage', () => {
		mount(); fill1(); c.nextStep();
		expect(JSON.stringify({ ...localStorage })).not.toContain('1234567890');
		expect(JSON.stringify({ ...sessionStorage })).not.toContain('1234567890');
	});

	it('step 4 has a "المتابعة بدون مستندات" link that only moves to the review: no upload, no step save', () => {
		mount({ idNumber: '2000000001', dob: '1990-01-01T00:00:00.000Z', country: 'السعودية', city: 'الرياض', industry: 'مهندس', address: 'شارع 1', paypalPayoutEmail: 'p@x.co', completionPercentage: 60 });
		expect(c.currentStep()).toBe(4);
		fixture.detectChanges();
		const btn = (fixture.nativeElement as HTMLElement).querySelector('[data-testid=skip-documents]') as HTMLButtonElement;
		expect(btn?.textContent?.trim()).toBe('المتابعة بدون مستندات');
		btn.click(); fixture.detectChanges();
		expect(c.currentStep()).toBe(5);
		expect(saveStep).not.toHaveBeenCalled();
	});

	it('the link exists only in the documents step (not in steps 1-3 or 5)', () => {
		mount();
		for (const step of [1, 2, 3, 5]) { c.currentStep.set(step); fixture.detectChanges(); expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=skip-documents]')).toBeNull(); }
		c.skipDocuments(); // outside step 4 it does nothing
		expect(c.currentStep()).toBe(5);
	});
});
