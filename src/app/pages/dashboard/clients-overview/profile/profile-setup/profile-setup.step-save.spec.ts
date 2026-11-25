import { IdentityGateService } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';
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
	beforeEach(() => FakeIdentityGate.reset()); // the fake gate keeps static state: every test starts APPROVED
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
		fixture = (TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } }), TestBed.createComponent(ProfileSetupDashboard));
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
		// the number is stored with the document upload (once the type is read from the picture), not judged here without a type
		expect(body.details.idNumber).toBeUndefined();
		expect(body.details).toEqual(expect.objectContaining({ country: 'السعودية', city: 'الرياض', occupation: 'مهندس', address: 'الرياض' }));
		expect(c.currentStep()).toBe(2);
	});

	it('step 1 sends the number once the document type is known', () => {
		mount(); fill1(); c.setupForm.get('details.idDocumentType')?.setValue('NATIONAL_ID'); c.nextStep();
		expect(saveStep.mock.calls[0][1].details.idNumber).toBe('1234567890');
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

	// Updated for the identity gate: the identity images are no longer sent by the generic step-2 save; sendIdentity() sends them to the identity endpoint
	// (covered in profile-setup.id-gate.spec.ts), so «التالي» on step 2 stores nothing itself.
	it('step 2 never sends the identity through the generic step save (the identity gate does)', () => {
		mount(); fill1(); c.currentStep.set(2);
		c.setupForm.get('identity')!.patchValue({ frontId: DATA_URI, backId: 'https://res.cloudinary.com/x/back.png' });
		c.nextStep();
		expect(saveStep).not.toHaveBeenCalledWith(2, expect.anything());
	});

	it('going back needs no request and keeps the typed/prefilled values', () => {
		mount({}); fill1(); c.nextStep(); saveStep.mockClear();
		c.prevStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(1);
		expect(c.setupForm.get('details.idNumber')!.value).toBe('1234567890');
	});

	it('nothing identity-related is written to browser storage', () => {
		mount(); fill1(); c.nextStep();
		expect(JSON.stringify({ ...localStorage })).not.toContain('1234567890');
		expect(JSON.stringify({ ...sessionStorage })).not.toContain('1234567890');
	});

});
